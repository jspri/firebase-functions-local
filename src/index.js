var express = require('express');
var database = require('./database');
var path = require('path');
var admin = require('firebase-admin');
var adminUtils = require('firebase-admin/lib/utils');

module.exports = function(options) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('You are running firebase-functions-local in production, DOH! :-)')
  }

  // Set environment variables
  // https://firebase.google.com/docs/functions/config-env#automatically_populated_environment_variables
  const firebaseApp = admin.app();
  const projectId = process.env.GCLOUD_PROJECT || adminUtils.getProjectId(firebaseApp);

  process.env.GCLOUD_PROJECT = projectId;
  process.env.FIREBASE_CONFIG = JSON.stringify({
    projectId: projectId,
    databaseURL: firebaseApp.options.databaseURL,
    storageBucket: firebaseApp.options.storageBucket,  
  });


  options = options || {}

  var config = options.config || {}
  var port = options.port || 3001
  var publicPath = options.publicPath || 'public'
  var app = express();
  var httpListener = function (req, res) {
    res.status(404).send('You have not added an "onRequest" handler for your firebase functions');
  };

  app.use(express.static(path.resolve(publicPath)))
  app.all('*', function (req, res, next) {
    httpListener(req, res, next);
  });

  console.log("firebase-functions-local listening on port 3001")
  app.listen(port);

  return {
    auth: {
      user() {
        console.warn('WARNING: firebase-functions-local does not support auth events')

        return {
          onCreate(){}
        }
      }
    },

    config: function () { return config },

    database: database,

    https: {
      onRequest: function(cb) {
        httpListener = cb;
      }
    }
  };
};

// TODO Fix warning
