"use strict";
const axios = require('axios');
var soap = require("strong-soap").soap;
var request = require("request");
var XMLHandler = soap.XMLHandler;
var xmlHandler = new XMLHandler();
var path = require("path");
var specialRequest = request.defaults({
  strictSSL: false,
});

var username = process.env.AXL_USERNAME;
var password = process.env.AXL_PASSWORD;

var auth = "Basic " + Buffer.from(username + ":" + password).toString("base64");

var url = path.join(
  __dirname,
  "/axlsqltoolkit/schema/" + process.env.AXL_VERSION + "/AXLAPI.wsdl"
);

module.exports = {
  getUserId: function (mailId) {
    var options = {
      endpoint: "https://" + process.env.AXL_IP + ":8443/axl/",
      request: specialRequest,
    };
    var requestArgs = {
      sql: "select userid from enduser where mailid='" + mailId + "'",
    };
    return new Promise(function (resolve, reject) {
      soap.createClient(url, options, function (err, client) {
        client.addHttpHeader("Authorization", auth);
        var method = client.executeSQLQuery;
        method(requestArgs, function (err, result, envelope, soapHeader) {
          if (err){
            reject(err)
          }
          if(result.return){
            resolve(result.return.row[0].userid);
          }else{
            resolve()
          }
        });
      });
    });
  },
  getDevice: function (userId) {
    var options = {
      endpoint: "https://" + process.env.AXL_IP + ":8443/axl/",
      request: specialRequest,
    };
    var requestArgs = {
      userid: userId,
    };
    return new Promise(function (resolve, reject) {
      soap.createClient(url, options, function (err, client) {
        client.addHttpHeader("Authorization", auth);
        var method = client.getUser;
        method(requestArgs, function (err, result, envelope, soapHeader) {
          if (err){
            reject(err)
          }
          if(result.return.user.associatedDevices){
            resolve(result.return.user.associatedDevices.device);
          }else{
            resolve()
          }
        });
      });
    });
  },
  addAppUser: function (userId,password,device) {
    var options = {
      endpoint: "https://" + process.env.AXL_IP + ":8443/axl/",
      request: specialRequest,
    };
    var requestArgs = {
      "appUser": {
        "userid": userId,
        "password": password,
        "associatedDevices" :{
          "device": device
        },
        "associatedGroups":{
          "userGroup":{
            "name": "Standard CTI Allow Control of All Devices"
          }
        }
      },
    };
    return new Promise(function (resolve, reject) {
      soap.createClient(url, options, function (err, client) {
        client.addHttpHeader("Authorization", auth);
        var method = client.addAppUser;
        method(requestArgs, function (err, result, envelope, soapHeader) {
          if (err){
            reject(err)
          }else{
            resolve(result);
          }
        });
      });
    });
  },
  removeAppUser: function (userId) {
    var options = {
      endpoint: "https://" + process.env.AXL_IP + ":8443/axl/",
      request: specialRequest,
    };
    var requestArgs = {
      userid: userId,
    };
    return new Promise(function (resolve, reject) {
      soap.createClient(url, options, function (err, client) {
        client.addHttpHeader("Authorization", auth);
        var method = client.removeAppUser;
        method(requestArgs, function (err, result, envelope, soapHeader) {
          if (err){
            reject(err)
          }else{
            resolve(result);
          }
        });
      });
    });
  },
  getIpAddress: function (device) {
    var url = path.join(
      __dirname,
      "/axlsqltoolkit/schema/RISService70.wsdl"
    );
    
    var options = {
      endpoint: "https://" + process.env.AXL_IP + ":8443/realtimeservice2/services/RISService70",
      request: specialRequest,
    };
    var requestArgs = {
      StateInfo: '',
      CmSelectionCriteria: {
        MaxReturnedDevices: "10",
        DeviceClass: "Phone",
        Model: "255",
        Status: "Any",
        NodeName: "",
        SelectBy: "Name",
        SelectItems: { item: {}},
        Protocol: "Any",
        DownloadStatus: "Any",
      },
    };
    requestArgs.CmSelectionCriteria.SelectItems.item.Item = device
    return new Promise(function (resolve, reject) {
      soap.createClient(url, options, function (err, client) {
        client.addHttpHeader("Authorization", auth);
        var method = client.selectCmDeviceExt;
        method(requestArgs, function (err, result, envelope, soapHeader) {
          if (err){
            reject(err)
          }
          var ret = xmlHandler.xmlToJson(null, envelope, null)
          if (ret.Body.selectCmDeviceResponse.selectCmDeviceReturn.SelectCmDeviceResult.TotalDevicesFound > 0){
            var jsonResult = ret.Body.selectCmDeviceResponse.selectCmDeviceReturn.SelectCmDeviceResult.CmNodes.item
          
            let filteredResults = jsonResult.filter(function (e) {
              return e.CmDevices;
            });
            if (filteredResults[0].CmDevices.item.Status === 'Registered'){
              resolve(filteredResults[0].CmDevices.item.IPAddress.item.IP)
            }else{
              resolve()
            }
          }else{
            resolve()
          }
        });
      });
    });
  },
};
