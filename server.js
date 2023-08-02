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

function createJSONFromText(text) {
  const regex = /(?<=: )(.+?)(?=(\n|$))/g;
  const matches = text.match(regex);
  if(matches?.includes('IPT2023127615 Asal Permohonan : Online Filing')){
    return {
      "Nomor Transaksi": matches[0].split(" Asal Permohonan : ")[0],
      "Asal Permohonan": matches[0].split(" Asal Permohonan : ")[1],
      "Nomor Permohonan": matches[1].split(" Tipe Permohonan : ")[0],
      "Tipe Permohonan": matches[1].split(" Tipe Permohonan : ")[1],
      "Tanggal Penerimaan": matches[2].split(" Jenis Permohonan : ")[0],
      "Jenis Permohonan": matches[2].split(" Jenis Permohonan : ")[1],
      "Tipe Merek": matches[3].split(" Etiket Gambar/Label Merek")[0],
      "Etiket Gambar/Label Merek": "",
      "Nama Merek": matches[4].split(" © ")[1],
      "Deskripsi": matches[6] ? matches[6] : "",
      "Warna": matches[8] ? matches[8] : "",
      "Terjemahan": matches[10] ? matches[10] : "",
      "Transliterasi/Pengucapan": matches[12] ? matches[12] : "",
      "Disclaimers": matches[14] ? matches[14] : "",
    };
  }
  else if (matches?.includes('Zheng Xiaowang')){
    return {
      "Nama": matches[0] ? matches[0] : "",
      "Jenis Pemohon": matches[1] ? matches[1] : "",
      "Kewarganegaraan": matches[2] ? matches[2] : "",
      "Alamat": matches[3] ? matches[3] : "",
      "Kabupaten/Kota": matches[4] ? matches[4].split('Kode Pos :')[0] : "",
      "Kode Pos": matches[5] ? matches[5].split('Negara : ')[0] : "",
      "Negara": matches[5] ? matches[5].split('Negara : ')[1] : "",
      "Provinsi": matches[7] ? matches[7].split('Kode Pos :')[0] : "",
      "Telepon": matches[8] ? matches[6] : "",
      "Surel": matches[9] ? matches[9] : "",
      "Alamat Surat Menyurat": matches[10] ? matches[10] : "", 
      "Kabupaten/Kota Surat Menyurat": matches[11] ? matches[11] : "", 
      "Kode Pos Surat Menyurat": matches[12] ? matches[12] : "", 
      "Provinsi Surat Menyurat": matches[13] ? matches[13] : "",
      "Negara Surat Menyurat": matches[14] ? matches[14] : "",
      "Telp/Fax Surat Menyurat": matches[15] ? matches[15] : "", 
      "Surel Surat Menyurat": matches[16] ? matches[16] : "", 
      "Nama Konsultan": matches[17] ? matches[17] : "",
      "No Konsultan": matches[18] ? matches[18] : "",
      "Nama Kantor": matches[19] ? matches[19] : "",
      "Alamat Kantor": matches[20] ? matches[20] : "",
      "Telp/Fax Kantor": matches[21] ? matches[21] : "",
      "Surel Kantor": matches[22] ? matches[22] : "",
      "Tanggal Prioritas": matches[23] ? matches[23] : "", 
      "Negara/Kantor Merek": matches[24] ? matches[24] : "", 
      "No Prioritas": matches[25] ? matches[25] : "" 
  }
  }
  else if (matches?.includes('Zheng Xiaowang')){
    return {

    }
  }

  return text
}

function extractKeyValuePairsFromText(text) {
  try {
    let resultJSON = createJSONFromText(text);
    console.log("Extracting",resultJSON)
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
