# firebase-functions-local
[![CircleCI](https://circleci.com/gh/Crazometer/firebase-functions-local/tree/master.svg?style=svg)](https://circleci.com/gh/Crazometer/firebase-functions-local/tree/master)

Work locally with firebase functions. Great for developing your functions without having to wait for them to deploy. Also allows for you to attach a debugger and avoid endless `console.log()`s. Uses live data from your firebase realtime db. 

## Install

`npm install firebase-functions-local`

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
## Limitations

- Functions that have been deployed using `firebase deploy` will also run. These should be disabled before using this library or you may get strange results.
- In order to generate the delta snapshots the previous values are gathered. This can cause a spike of data use/latency when first starting the app.
- Unable to listen to paths that have large response items or too many children. https://firebase.google.com/docs/database/usage/limits

## Credits

Based upon the work by @christianalfoni

## License
MIT