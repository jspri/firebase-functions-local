# firebase-functions-local
[![CircleCI](https://circleci.com/gh/Crazometer/firebase-functions-local/tree/master.svg?style=svg)](https://circleci.com/gh/Crazometer/firebase-functions-local/tree/master)

Work locally with firebase functions. Great for developing your functions without having to wait for them to deploy. Allows you to attach a debugger and avoid scrolling through endless `console.log()`s. Uses live data from your firebase realtime db as the trigger.

Requires `firebase-functions` version 1+.  

## Install

`npm install firebase-functions-local`

## Supports

- **onRequest** express app handling
- **onWrite**, **onCreate**, **onUpdate**, **onDelete** realtime database event handling
- Mocks out auth and config
- Runs static delivery of your public files folder

## How to use
*functions/index.js*
```js
const admin = require('firebase-admin');

// See https://firebase.google.com/docs/admin/setup#initialize_the_sdk
const admin = admin.initializeApp({/* ... */});

const functions = require('firebase-functions-local')({
  config: {}, // Set functions.config() values
  port: 3001,
  publicPath: 'public'
});

exports.app = functions.https.onRequest(require('./app'));
exports.publish = functions.database.ref('articles/{uid}/{article}').onWrite(require('./publish'));
```
## Limitations

- Functions that have been deployed using `firebase deploy` will run concurrently with `firebase-functions-local`. These should be disabled before using this library or you may get strange results.
- In order to generate `Change` objects the existing database state has to be loaded on startup. This can cause delays before the local functions become response.
- Unable to listen to paths that have large response items or too many children. https://firebase.google.com/docs/database/usage/limits


## License
MIT