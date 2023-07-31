require("dotenv").config();

const express = require("express");
const proxy = require("express-http-proxy");
const logger = require("morgan");
const cors = require("cors");
const bodyParser = require("body-parser");
const axios = require('axios')
const { PDFDocument, rgb } = require('pdf-lib');
const Tesseract = require('tesseract.js');
const fs = require('fs');
const { extractPDF } = require('pdf-extraction');
const { createWorker } = Tesseract;

var app = express();

app.use(cors());

app.use(function (req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Methods",
    "GET,PUT,POST,DELETE,PATCH,OPTIONS"
  );
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept"
  );
  next();
});

const isMultipartRequest = function (req) {
  let contentTypeHeader = req.headers["content-type"];
  return contentTypeHeader && contentTypeHeader.indexOf("multipart") > -1;
};

const bodyParserJsonMiddleware = function () {
  return function (req, res, next) {
    if (isMultipartRequest(req)) {
      app.use(bodyParser.json({ limit: "50mb" }));
      app.use(bodyParser.urlencoded({ extended: true, limit: "50mb" }));
      console.log("this is multipart !");
      return next();
    }
    // app.use(bodyParser.json());
    const hed = req.headers;
    console.log("NOT multipart !", JSON.stringify(hed));
    console.log(JSON.stringify(req.headers));
    if (hed["content-type"] === "text/json") {
      console.log("req = text/json");
      app.use(bodyParser.text({ type: "text/*" }));
    } else {
      console.log("req = JSON");
      app.use(bodyParser.json({ limit: "50mb" }));
      app.use(bodyParser.urlencoded({ extended: true, limit: "50mb" }));
      return bodyParser.json({ limit: "50mb" })(req, res, next);
    }
    return next();
  };
};

app.use(bodyParserJsonMiddleware());

app.use(logger("dev"));


app.get("/", (req, res) => {
  res.send("Gateway Service is Connected");
});

function createJSONFromText(text) {
  const keyValuePairs = {};
  const lines = text.split('\n');
  for (const line of lines) {
    const [key, ...valueParts] = line.split(':').map((item) => item.trim());
    if (key && valueParts.length > 0) {
      const value = valueParts.join(':').trim();
      keyValuePairs[key] = value;
    }
  }
  return keyValuePairs;
}

function extractKeyValuePairsFromText(text) {
  try {
    const resultJSON = createJSONFromText(text);

    // Write the JSON result to a file
    fs.writeFileSync('output3-new.json', JSON.stringify(resultJSON, null, 2));
    console.log('JSON data has been saved to output.json');
    return resultJSON
  } catch (error) {
    console.error('Error occurred:', error);
  }
}


app.post("/ocr",async (req, res) => {
  // const pdfPath = 'G:/Project/HAKI app/pspdf-api/CetakMerek4-DID2023034654-1.png';
  const worker = await createWorker({
    logger: m => console.log(m)
  });
  
  (async () => {
    await worker.loadLanguage('eng');
    await worker.initialize('eng');
    const { data: { text } } = await worker.recognize('G:/Project/HAKI app/pspdf-api/CetakMerek4-DID2023034654-3.png');
    console.log(JSON.stringify(text));
    await worker.terminate();
    const result = await extractKeyValuePairsFromText(text)
    res.json(text);
  })();
})

const port = process.env.PORT || 1111;

var server = require("http").createServer(app);

server.listen(port, () => {
  console.log(`Gateway Service running on port ${port}`);
});
