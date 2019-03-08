const express = require('express')
const path = require('path')
const PORT = process.env.PORT || 5000
const util = require('util');
const exec = util.promisify(require('child_process').exec);
const fs = require('fs');
var https = require('https');
// var querystring = require('querystring');


async function doRequest(text, jwt) {
  const postData = JSON.stringify({
    "queryInput": {
      "text": {
        "text": text,
        "languageCode": "en"
      }
    }
  });

  const project = 'ipraktikum-demo';
  const session = 'test';

  const options = {
    hostname: 'content-dialogflow.googleapis.com',
    port: 443,
    path: `/v2/projects/${project}/agent/sessions/${session}:detectIntent`,
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${jwt}`
    }
  };

  return await new Promise(resolve => {
    const req = https.request(options, (res) => {
      // console.log(`STATUS: ${res.statusCode}`);
      // console.log(`HEADERS: ${JSON.stringify(res.headers)}`);
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        // console.log(`BODY: ${chunk}`);
        resolve(`${chunk}`);
      });
      res.on('end', () => {
        // console.log('No more data in response.');
      });
    });

    req.on('error', (e) => {
      // console.error(`problem with request: ${e.message}`);
    });

    // write data to request body
    req.write(postData);
    req.end();
  });
}

async function getNewToken() {
  await exec('GOOGLE_APPLICATION_CREDENTIALS="cred.json" gcloud auth application-default print-access-token > jwt.txt');
}

function tokenValid() {
  try {
    var stats = fs.statSync("jwt.txt");
    var mtime = new Date();
    mtime -= new Date(util.inspect(stats.mtime));
    mtime /= 1000;

    return mtime < 60 * 50;
  } catch (e) {
    return false
  }
}

async function dialogflow(req, res) {
  let response = {
    "what": "up?"
  }

  if (!tokenValid()) {
    await getNewToken();
  }
  jwt = fs.readFileSync('jwt.txt', 'utf8').replace("\n", "");

  let query = req.body.query || ' ';
  try {
    r = await doRequest(query, jwt);
  } catch (error) {
    // console.error(error)
  }

  response.data = r;
  res.json(JSON.parse(r));
}

express()
  .use(express.json())
  .get('/dialogflow', dialogflow)
  .post('/dialogflow', dialogflow)
  .listen(PORT, () => console.log(`Listening on ${ PORT }`))
