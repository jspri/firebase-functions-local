const admin = require('firebase-admin');
const functions = require('firebase-functions');

module.exports = function snapshotMaker(data, path) {
  let app = admin.app();

  const snapshot = new functions.database.DataSnapshot(
    data,
    path,
    app
  );

  return snapshot;
}