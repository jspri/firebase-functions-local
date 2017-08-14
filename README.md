# firebase-functions-local
[![CircleCI](https://circleci.com/gh/Crazometer/firebase-functions-local/tree/master.svg?style=svg)](https://circleci.com/gh/Crazometer/firebase-functions-local/tree/master)

Work locally with firebase functions

## Install

`npm install firebase-functions-mock`

## Supports

- **onRequest** express app handling
- **onWrite**, **onCreate**, **onUpdate**, **onDelete** database event handling
- Mocks out auth and config
- Runs static delivery of your public files folder

## How to use
*functions/index.js*
```js
const firebase = require('firebase-admin');
const admin = firebase.initializeApp({
  credential: firebase.credential.cert(JSON.parse(process.env.SERVICE_ACCOUNT)),
  databaseURL: JSON.parse(process.env.FIREBASE_CONFIG).databaseURL,
});
let functions = require('firebase-functions');

// When in debug mode, override functions with the mock and
// pass in the instance of "admin" and optional options
if (process.env.NODE_ENV !== 'production') {
  functions = require('firebase-functions-mock')({
    config: process.env.FIREBASE_CONFIG,
    port: 3001,
    publicPath: 'public'
  });
}

exports.app = functions.https.onRequest(require('./app'));
exports.publish = functions.database.ref('articles/{uid}/{articleName}').onWrite(require('./publish'));
```

## Credits

Based upon the work by @christianalfoni

## License
MIT