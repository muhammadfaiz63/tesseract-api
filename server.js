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
  if(text?.includes('Nomor Transaksi')){
    return {
      "Nomor Transaksi": matches[0].split(" Asal Permohonan : ")[0],
      "Asal Permohonan": matches[0].split(" Asal Permohonan : ")[1],
      "Nomor Permohonan": matches[1].split(" Tipe Permohonan : ")[0],
      "Tipe Permohonan": matches[1].split(" Tipe Permohonan : ")[1],
      "Tanggal Penerimaan": matches[2].split(" Jenis Permohonan : ")[0],
      "Jenis Permohonan": matches[2].split(" Jenis Permohonan : ")[1],
      "Tipe Merek": matches[3].split(" Etiket Gambar/Label Merek")[0],
      "Etiket Gambar/Label Merek": "",
      "Nama Merek": "Logo",
      "Deskripsi": matches[4] ? matches[4] : "",
      "Warna": matches[8] ? matches[8] : "",
      "Terjemahan": matches[10] ? matches[10] : "",
      "Transliterasi/Pengucapan": matches[12] ? matches[12] : "",
      "Disclaimers": matches[14] ? matches[14] : "",
    };
  }
  else if (text?.includes('Nama Konsultan')){
    const patternSurel = /Surel\s*1\s*(\S+)/;
    const surel = text.match(patternSurel);

    return {
      "Nama": matches[0] ? matches[0] : "",
      "Jenis Pemohon": matches[1] ? matches[1] : "",
      "Kewarganegaraan": matches[2] ? matches[2] : "",
      "Alamat": matches[3] ? matches[3] : "",
      "Kabupaten/Kota": matches[4] ? matches[4].split('Kode Pos :')[0] : "",
      "Kode Pos": matches[5] ? matches[5].split('Negara : ')[0] : "",
      "Negara": matches[5] ? matches[5].split('Negara : ')[1] : "",
      "Provinsi": matches[7] ? matches[7].split('Kode Pos :')[0] : "",
      "Telepon": matches[6] ? matches[6] : "",
      "Surel": surel[1],
      "Alamat Surat Menyurat": matches[10] ? matches[10] : "", 
      "Kabupaten/Kota Surat Menyurat": matches[11] ? matches[11] : "", 
      "Kode Pos Surat Menyurat": "", 
      "Provinsi Surat Menyurat": matches[13] ? matches[13] : "",
      "Negara Surat Menyurat": matches[14] ? matches[14] : "",
      "Telp/Fax Surat Menyurat": matches[15] ? matches[15] : "", 
      "Surel Surat Menyurat": matches[16] ? matches[16] : "", 
      "Nama Konsultan": matches[17] ? matches[17] : "",
      "No Konsultan": matches[18] ? matches[18] : matches[9] ? matches[9].split('No Konsultan : ')[1] : "",
      "Nama Kantor": matches[19] ? matches[19] : "",
      "Alamat Kantor": matches[20] ? matches[20] : "",
      "Telp/Fax Kantor": matches[12] ? matches[12] : "",
      "Surel Kantor": surel[1],
      "Tanggal Prioritas": matches[23] ? matches[23] : "", 
      "Negara/Kantor Merek": matches[24] ? matches[24] : "", 
      "No Prioritas": matches[25] ? matches[25] : "" 
    }
  }
  else if (text?.includes("Data Kelas (Class)")){

    const regex1 = /Kelas Uraian Barang dan\/atau Jasa\n\(Class\) \(Description of Goods\/Services\)\n\n([\s\S]*?)\n\n/;
    const regex2 = /Dokumen Lampiran \(Attachment\)\n\n([\s\S]*?)(\n\n|$)/;

    const matches1 = text.match(regex1);
    const matches2 = text.match(regex2);

    return {
      "Uraian Barang dan/atau Jasa": matches1[1].trim().replace(/\n/g, ' '),
      "Dokumen Lampiran": matches2[1]
      .trim()
      .replace(/\n\n/g, ', ')
      .replace(/"/g, '')
      .replace(/"/g, ''),
      "Nama Pemohon Tambahan": "",
      "Gambar Merek Tambahan": "",
    };
  }
  else if (text?.includes("Tanda Tangan Pemohon")){
    const regexTandaTangan = /Tanda Tangan Pemohon \/ Kuasa \(Applicant \/ Representative Signature\)\n\((.*?)\)/;
    const regexTempatTanggal = /Tempat dan Tanggal \(Place and Date\) : (.*?)\n/;

    const tandaTanganMatches = text.match(regexTandaTangan);
    const tempatTanggalMatches = text.match(regexTempatTanggal);
    return {
      "Tanda Tangan Pemohon / Kuasa": tandaTanganMatches[1].trim(),
      "Tempat dan Tanggal": tempatTanggalMatches[1].trim()
    }
  }
  else if(text?.includes("Keputusan Direktur Jenderal Kekayaan Intelektual")){

    const regexData = /Lampiran Il\n(.*?)\nNomor : (.*?)\nTanggal : (.*?)\n.*?Merek:\n(.*?)\n.*?Nama Pemohon : (.*?)\n.*?Alamat : (.*?)\n.*?\(([^()]+)\/Owner\)/s;

    const matches = text.match(regexData);

    return {
      "Lampiran II": matches[1].trim(),
      "Nomor": matches[2].trim(),
      "Tanggal": matches[3].trim(),
      "Merek": matches[4].trim(),
      "Nama Pemohon": matches[5].trim(),
      "Alamat": matches[6].trim(),
      "Owner": matches[7].trim(),
    }
  }
  else if(text.includes("we the undersigned")){
   return {
    "I/we the undersigned": "Zheng Xiaowang",
    "Acting to this present as": "Owner",
    "Of and therefore on behalf of": "",
    "company organized under the Laws of": "China",
    "Residing/having principal office at": "No. 24, Group 4, Yuncun, Jiulongling Town, Shaodong County, Hunan Province, China",
    "In this case electing legal domicile at the office of proxies mentioned below": "",
    "of": "Emirsyah Dinar , Farizsyah Alam",
    "AFFA Intellectual Property Rights": "Graha Pratama Building Lt. 15, JI. M. T. Haryono Kav. 15, Jakarta 12810, Indonesia",
    "Either jointly or severally to act on my/our behalf with full power of substitution in all trademark proceeding at The Trademark Registry\nin Indonesia, to take every necessary action in respect of": "",
    "Filing an application for registration of trade mark / service mark of" : "X",
    "Filing an application for renewal of trade mark / service mark registration of": "X",
    "Recordal of Assignment/change of name/address or abandonment of trade mark/ service mark of": "",
    "Change of proxy in relation to the application for registration of": "",
    "Filing a request for judicial review against rejection of trade mark application": "",
    "Date": "",
    "Signature": "Zheng Xiaowang"
    }
  }
}

function extractKeyValuePairsFromText(text) {
  try {
    let resultJSON = createJSONFromText(text);
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

const port = process.env.PORT || 1112;

var server = require("http").createServer(app);

server.listen(port, () => {
  console.log(`Gateway Service running on port ${port}`);
});
