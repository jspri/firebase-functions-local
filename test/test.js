'use strict';

const env = require('dotenv').config({silent: true});

const admin = require('firebase-admin');
const functions = require('../')(admin);

const serviceAccount = JSON.parse(process.env.FIREBASE_SDK_JSON);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: process.env.FIREBASE_DATABASEURL
});

let i = 0;

functions.database.ref('/test/{id}/abc').onWrite(event => {
  console.log(i++);
});

function alternator() {
  return admin.database().ref('/test/joking/abc').set("Happy")
    .then(() => {
      return admin.database().ref('/test/joking/abc').set("Sad")
    }).then(alternator)
}

alternator();