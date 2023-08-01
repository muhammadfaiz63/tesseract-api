require("dotenv").config();

const express = require("express");
const proxy = require("express-http-proxy");
const logger = require("morgan");
const cors = require("cors");
const bodyParser = require("body-parser");
const axios = require('axios')
var pdf2img = require('pdf-img-convert');
const multer = require("multer");
const Tesseract = require('tesseract.js');
const fs = require('fs');
const path = require("path");
const { createWorker } = Tesseract;

var app = express();

const storage = multer.diskStorage({
  destination: "./repo/pdf",
  filename: function(req, file, cb) {
    //Rename file
    cb(null, "affa-cetak-merek" + "-" + Date.now() + ".pdf");
  }
})

const upload = multer({
  storage: storage,
  limits: { fileSize: 1000000 },
}).single("document")

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

const keyValueRegex = /([^:\n]+)\s*:\s*([^:\n]+)/g;
const keyValuePairRegex = /([^:\n]+):\s*([^:\n]+)/g;

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

    // fs.writeFileSync("./repo/json/affa-cetak-merek" + "-"+ Date.now() +".json", JSON.stringify(resultJSON, null, 2));
    return resultJSON
  } catch (error) {
    console.error('Error occurred:', error);
  }
}

app.use('/repo', express.static(path.join(__dirname, 'repo')))

app.post("/pdf-to-img",async (req, res) => {
  await upload(req, res, err => {
    (async function () {
      let options = {
        scale: 2.0
      }
      pdfArray = await pdf2img.convert(req.file?.path,options);
      let dataImage = []
      for (i = 0; i < pdfArray.length; i++){
        let fileNameImage = "./repo/image/affa-cetak-merek" + "-" + i + "-"+ Date.now() +".png"
        dataImage = [...dataImage, fileNameImage]
        fs.writeFile(fileNameImage, pdfArray[i], function (error) {
          if (error) { console.error("Error: " + error); }
        }); //writeFile
      } // for
      res.json({pdf: req.file?.path , image: dataImage})
    })();
  })
})

app.post("/ocr",async (req, res) => {
  const { msg } = req.body;
  let datasend = [];

  // Function to perform OCR and return a promise
  const performOCR = async (message) => {
    const worker = await createWorker({
      logger: m => console.log(m)
    });

    await worker.loadLanguage('eng');
    await worker.initialize('eng');
    const { data: { text } } = await worker.recognize(message);
    await worker.terminate();
    return extractKeyValuePairsFromText(text);
  };

  // Create an array of promises for OCR processing
  const ocrPromises = msg.map((message, i) => {
    return new Promise((resolve) => {
      setTimeout(async () => {
        const result = await performOCR(message);
        resolve(result);
      }, i * 5000);
    });
  });

  // Wait for all OCR promises to resolve
  datasend = await Promise.all(ocrPromises);
  res.json(datasend);
})

const port = process.env.PORT || 1111;

var server = require("http").createServer(app);

server.listen(port, () => {
  console.log(`Gateway Service running on port ${port}`);
});
