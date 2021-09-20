const express = require("express");
const path = require("path");
const PORT = process.env.PORT || 5000;
const util = require("util");
const exec = util.promisify(require("child_process").exec);
const fs = require("fs");
var https = require("https");
var session = require("express-session");
var uuid = require("node-uuid");

async function doRequest(text, jwt, session) {
  const postData = JSON.stringify({
    queryInput: {
      text: {
        text: text,
        languageCode: "en",
      },
    },
  });

  const project = "ipraktikum-demo";

  const options = {
    hostname: "content-dialogflow.googleapis.com",
    port: 443,
    path: `/v2/projects/${project}/agent/sessions/${session}:detectIntent`,
    method: "POST",
    headers: {
      Authorization: `Bearer ${jwt}`,
    },
  };

  return await new Promise((resolve) => {
    const req = https.request(options, (res) => {
      res.setEncoding("utf8");
      res.on("data", (chunk) => {
        resolve(`${chunk}`);
      });
      res.on("end", () => {});
    });

    req.on("error", (e) => {});

    // write data to request body
    req.write(postData);
    req.end();
  });
}

async function getNewToken() {
  await exec(
    'echo secretpw | openssl enc -d -aes-256-cbc -in cred.json.enc -pass stdin -md md5 > cred.json; GOOGLE_APPLICATION_CREDENTIALS="cred.json" gcloud auth application-default print-access-token > jwt.txt'
  );
}

function tokenValid() {
  try {
    var stats = fs.statSync("jwt.txt");
    var mtime = new Date();
    mtime -= new Date(util.inspect(stats.mtime));
    mtime /= 1000;

    return mtime < 60 * 50;
  } catch (e) {
    return false;
  }
}

async function dialogFlow(req, res) {
  if (!tokenValid()) {
    await getNewToken();
  }
  jwt = fs.readFileSync("jwt.txt", "utf8").replace("\n", "");

  let query = req.body.query || " ";
  try {
    r = await doRequest(query, jwt, req.session.id);
    let response = JSON.parse(r);
    // response.sessionId = req.session.id;

    response.queryResult.fulfillmentText =
      response.queryResult.fulfillmentText.replace(/\\n/g, "\n");

    res.json(response);
  } catch (error) {}
}

express()
  .set("trust proxy", 1) // trust first proxy
  .use(
    session({
      genid: function (_) {
        return uuid.v4(); // use UUIDs for session IDs
      },
      secret: "keyboard catz",
      resave: false,
      saveUninitialized: true,
      cookie: {
        secure: true,
        maxAge: 24 * 60 * 60 * 1000,
      },
    })
  )
  .use(express.json())
  .get("/up", (req, res) => {
    res.json({
      up: true,
    });
  })
  .get("/dialogflow", dialogFlow)
  .post("/dialogflow", dialogFlow)
  .listen(PORT, () => console.log(`Listening on ${PORT}`));
