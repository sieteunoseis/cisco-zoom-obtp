var createError = require("http-errors");
var express = require("express");
var path = require("path");
var cookieParser = require("cookie-parser");
var logger = require("morgan");
const ngrok = require("ngrok");
var indexRouter = require("./routes/index");
var zoomRouter = require("./routes/zoom");
var envMode = process.env.NODE_ENV ? process.env.NODE_ENV : "development";

if (envMode === "development") {
  // In development mode...let's start NGROK status page and open status page
  (async function () {
    await ngrok.connect({
      proto: "http", // http|tcp|tls, defaults to http
      addr: (result = process.env.PORT ? process.env.PORT : 3000), // port
      subdomain: process.env.NGROK_SUBDOMAIN, // reserved tunnel name
      authtoken: process.env.NGROK_AUTH_TOKEN, // your authtoken from ngrok.com
      region: "us", // one of ngrok regions (us, eu, au, ap), defaults to us
      onStatusChange: (status) => {}, // 'closed' - connection is lost, 'connected' - reconnected
      onLogEvent: (data) => {}, // returns stdout messages from ngrok process
    });
  })();

  // Disconnect Ngrok
  process.once("SIGHUP", function () {
    (async function () {
      try {
        await ngrok.kill();
      } catch (error) {
        console.log(error.message);
      }
    })();
  });
}

var app = express();

// view engine setup
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "pug");

app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

app.use("/", indexRouter);
app.use("/api/zoom", zoomRouter);

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  next(createError(404));
});

// error handler
app.use(function (err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get("env") === "development" ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render("error");
});

module.exports = app;
