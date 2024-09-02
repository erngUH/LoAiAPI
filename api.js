const express = require('express');
const env = require("dotenv").config();
const bodyParser = require('body-parser');
const cors = require('cors');
const morgan = require('morgan');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const axios = require('axios');
const mysql = require('mysql');
const payload = require('./payload.json');
const upscalepayload = require('./upscale.json');
const dbconfig = require('./dbconfig');
const sd = require('./apiconfig');
const sharp = require('sharp');
const connection = mysql.createConnection(dbconfig);
const port = 8000;
const app = express();
app.use(bodyParser.json({ limit: '6mb' }));
app.use(cors());
app.use(morgan('dev'));
app.listen(port, () => {
  console.log(`App listening on port ${port}`)
});
//Error handler //Set timeout to 10 min
app.use((req, res, next) => {
  res.setTimeout(600000, () => {
    console.error('Request has timed out.');
    res.status(408).send('Request timeout');
  });
  next();
});
//DATABASE CONNECTION
connection.connect((err) => {
  if (err) throw err;
  console.log('Connected to Database.');
});



app.post("/internal/register", async (req,res)=>{
  try {
    const uuid = crypto.randomUUID();
    const newToken = generateAccessToken(uuid);
    connection.query("CALL register_user(?);", [[uuid, (req.body.ip == null || req.body.ip == undefined) ? "" : req.body.ip]], function (err, result){
      if(err) return res.status(500).send(err);
      else if(result.length > 0){if(result[0][0].result == 1) return res.status(200).json({id: newToken});}
      else return res.status(500).send("Failed to register user to database.");
    });
  } catch (error) {
    console.error('Error: ', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
})

//USER SECTION
app.post('/internal/verify', authenticateToken, async (req, res) => {
  try {
    connection.query('CALL verify_user(?);',[[req.uuid, req.body.ip, 1]], (err,rows) => {
      if (err) return res.status(500).send("Internal database error");
      if(rows.length > 0){
        if(rows[0][0].result == 0) return res.status(403).send("Failed to verify - Server Unavailable!");
        else return res.status(200).json({isValid: true});
      }
      });
  } catch (error) {
    console.error('Error: ', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
})

function generateAccessToken(uuid) {
  return jwt.sign(uuid, sd.tokenSecret);
}

function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  if (authHeader == null) {return res.status(400).send("Bad request")}
  else(jwt.verify(authHeader, sd.tokenSecret, (err, uuid) => {
    req.uuid = jwt.decode(req.headers.authorization);
    if (err) return res.status(403).send("Not authorized.");
    next();
  }))
}

// SD API SECTION

//POST img2img request
app.post('/internal/img2img', authenticateToken, async (req, res, next) => {
try {
  connection.query('CALL verify_user(?);',[[req.uuid, null, 0]], async function (err, userresult){
    if (err) return res.status(500).send("Internal database error");
    if (userresult[0][0].result == 0){
      return res.status(403).send("Failed to verify - Server Unavailable!");
    }
    else{
      connection.query("SELECT gentime FROM generations WHERE uuid = ? ORDER BY 1 DESC LIMIT 10", [[req.uuid]], async function (err, queryresult){
        // if(queryresult.length == 10){
        //   const timeEarliest = new Date(queryresult[queryresult.length - 1 ].gentime);
        //   if((new Date() - timeEarliest)/60000 <= 60){
        //     return res.status(429).send("Number of requests exceeded server limit. Try again at a later time.");
        //   }
        // }
        let sdpayload = null;
        if (req.body["i2imode"]==1){
          sdpayload = payload;
        }
        else{
          sdpayload = upscalepayload;
        }
        sdpayload["init_images"][0] = req.body["image"];
        if(req.body["extras"]) sdpayload.prompt = sdpayload.prompt +", "+ req.body["extras"].trim() + (req.body["face"]) ? (", ("+ req.body["face"].trim()+")") : "";
        if(req.body["face"]) sdpayload.alwayson_scripts.ADetailer.args[2].ad_prompt = sdpayload.alwayson_scripts.ADetailer.args[2].ad_prompt +", ("+req.body["face"].trim()+")";
        if ( req.body["weight"] == 1) sdpayload.denoising_strength = 0.1;
        else if ( req.body["weight"] == 2) sdpayload.denoising_strength = 0.27;
        else if ( req.body["weight"] == 3) sdpayload.denoising_strength = 0.45;
        const requestOptions = {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          data: sdpayload
        };
        const result = await axios(sd.sdURl + "v1/img2img", requestOptions);
        const thumb = await resizeOutputImg(result.data["images"][0]);
        connection.query("INSERT INTO generationthumbs (uuid, img) VALUES (?)", [[req.uuid, thumb]]);
        connection.query("INSERT INTO generations (uuid, img, gentime) VALUES (?)", [[req.uuid, result.data["images"][0], new Date()]]);
        sdpayload = null;
        return res.status(200).json({ apiData: result.data["images"][0] });
      });
    }
  });
  } catch (error) {
    console.error('Error: ', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

//GET server job queue
app.get('/internal/progress', authenticateToken, async (req, res, next) => {
  try {
    const requestOptions = {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    };
    await axios(sd.sdURl+'v1/progress', requestOptions)
    .then(result => {
      const apiData = result.data;
      delete apiData["current_image"];
      delete apiData["textinfo"];
     res.status(200).json(apiData);
    })
    .catch(err => {
      res.status(500).json({stat: 'Server Unavailable'});
    });
  }catch (error) {
    console.error('Err: ', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
})

function resizeOutputImg(base64Image) {
  return new Promise((resolve, reject) => {
    const imageBuffer = Buffer.from(base64Image, 'base64');
    sharp(imageBuffer)
      .resize(375, 550)
      .toBuffer()
      .then((outputBuffer) => {
        resolve(outputBuffer.toString('base64'));
      })
      .catch((error) => {
        console.error('Error resizing image:', error);
        reject('Error resizing image');
      });
  })
}

app.get('/internal/pastgens', authenticateToken, async (req, res, next) => {
  try {
      var sql = "SELECT img FROM generations WHERE uuid = ? ORDER BY gentime DESC LIMIT 5";
      const timeNow = new Date();
      connection.query(sql, [[req.uuid]], function (err, queryresult){
        if(err) throw err;
        res.status(200).json(queryresult);
      });
    } catch (error) {
      console.error('Error: ', error.message);
      res.status(500).json({ error: 'Internal server error' });
    }
  });