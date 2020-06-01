var express = require("express");
var router = express.Router();
const axios = require("axios");
var axlModule = require("../js/ciscoSoap");
const jwt = require("jsonwebtoken");
var path = require("path");
var parser = require('xml2json');

var zoomApiKey = process.env.ZOOM_API_KEY;
var zoomApiSecret = process.env.ZOOM_API_SECRET;

const jwtPayload = {
  iss: zoomApiKey,
  exp: new Date().getTime() + 5000,
};

/* POST API */
router.post("/", async function (req, res) {
  var meetingType = req.body.event;
  var meetingId = req.body.payload.object.id;
  var meetingTopic = req.body.payload.object.topic;
  const jwtToken = jwt.sign(jwtPayload, zoomApiSecret);
  const zoomApiConfig = {
    headers: { Authorization: `Bearer ${jwtToken}` },
  };

  if (meetingType === "meeting.started") {
    var meetingInfo = await axios
      .get("https://api.zoom.us/v2/meetings/" + meetingId, zoomApiConfig)
      .then((response) => {
        return response.data;
      })
      .catch((error) => {
        return error;
      });

    console.log("Meeting Info: "  + JSON.stringify(meetingInfo))

    var users = process.env.ZOOM_USERS.split(",");

    console.log("Users: "  + users)

    const userLoop = async (_) => {
      const promises = users.map(async (email) => {
        var userId = await axlModule.getUserId(email);
        return userId;
      });

      const userIds = await Promise.all(promises);
      return userIds.filter(item => typeof item ==='string');
    }

    var userIds = await userLoop();

    console.log("User ID's: "  + userIds)

    const deviceLoop = async (_) => {
      const promises = userIds.map(async (userId) => {
        var userDevices = await axlModule.getDevice(userId);
        return userDevices;
      })

      const devices = await Promise.all(promises);
      return devices.filter(item => typeof item ==='object');;
    }

    var devices = await deviceLoop();
    const flattenedDevices = devices.flat();
    uniqueDevices = flattenedDevices.filter(function (elem, pos) {
      return flattenedDevices.indexOf(elem) == pos;
    });

    console.log("Devices: "  + uniqueDevices)

    var appUser = await axlModule.addAppUser(
      process.env.AXL_APP_USERNAME,
      process.env.AXL_APP_PASSWORD,
      uniqueDevices
    );

    console.log("App User: "  + JSON.stringify(appUser))

    const ipAddressLoop = async (_) => {
      const promises = uniqueDevices.map(async (device) => {
        var ipAddress = await axlModule.getIpAddress(device);
        return ipAddress;
      });

      const ipAddressResult = await Promise.all(promises);
      return ipAddressResult.filter(item => typeof item ==='string');
    };

    var ipAddressArr = await ipAddressLoop()

    console.log("IP Addresses: "  + ipAddressArr)

    const phoneXmlLoop = async (_) => {
      const promises = ipAddressArr.map(async (ipaddress) => {
        var phoneSuccess = await sendXmlToPhone(process.env.AXL_APP_USERNAME,process.env.AXL_APP_PASSWORD,meetingId,meetingInfo.pstn_password,meetingTopic,ipaddress)
        return phoneSuccess;
      });

      const phoneResults = await Promise.all(promises);
      return phoneResults.filter(item => typeof item ==='string');
    };

    phoneXmlResults = await phoneXmlLoop()

    console.log("Phone XML: "  + phoneXmlResults)

    var deleteUser = await axlModule.removeAppUser(process.env.AXL_APP_USERNAME)

    console.log("Delete App User: "  + JSON.stringify(deleteUser))

    res.sendStatus(200);

  } else {
    // Catch for receiving incorrect post on this API
    res.sendStatus(400);
    return;
  }
});

/* POST API */
router.get("/", function (req, res, next) {
  res.send("This API accepts POST messages.");
});

function sendXmlToPhone(
  username,
  password,
  meetingId,
  meetingPassword,
  meetingTopic,
  phoneIpAddress
) {
  var res = meetingTopic.substring(0, 24);
  const XML =
    "XML=<CiscoIPPhoneGraphicFileMenu WindowMode='Wide'>" +
    "<Title>Zoom Meeting Started</Title>" +
    `<Prompt>${res}</Prompt>` +
    "<LocationX>-1</LocationX>" +
    "<LocationY>-1</LocationY>" +
    `<URL>${process.env.PHONE_XML_IMAGE_URL}</URL>` +
    "<SoftKeyItem>" +
    "<Name>Join</Name>" +
    `<URL>Dial:${meetingId}.${meetingPassword}@zoomcrc.com</URL>` +
    "<Position>2</Position>" +
    "</SoftKeyItem>" +
    "<SoftKeyItem>" +
    "<Name>Exit</Name>" +
    "<URL>SoftKey:Exit</URL>" +
    "<Position>3</Position>" +
    "</SoftKeyItem>" +
    "</CiscoIPPhoneGraphicFileMenu>";

  const ipPhoneXmlToken = Buffer.from(
    `${username}:${password}`,
    "utf8"
  ).toString("base64");
  const contentType = "application/x-www-form-urlencoded";
  const ipPhoneXmlOptions = {
    baseURL: "http://" + phoneIpAddress + "/CGI/Execute",
    method: "POST",
    withCredentials: true,
    headers: {
      Accept: "application/x-www-form-urlencoded",
      "Content-Type": contentType,
      Authorization: `Basic ${ipPhoneXmlToken}`,
    },
    data: XML,
  };

  console.log(ipPhoneXmlOptions)
  return new Promise(function (resolve, reject) {
    axios(ipPhoneXmlOptions)
      .then((response) => {
        var json = parser.toJson(response.data);
        resolve(json);
      })
      .catch((error) => {
        reject(error);
      });
  });
}

module.exports = router;
