const admin = require('firebase-admin');
const functions = require('firebase-functions');

module.exports = function snapshotMaker(newData, oldData, path) {
  let app = admin.app();

  if (newData === undefined) {
    newData = null;
  }

  const snapshot = new functions.database.DeltaSnapshot(
    app,
    app,
    oldData,
    newData,
    path
  );

  return snapshot;
}