const admin = require('firebase-admin');

// Don't load whole functions library
const path = require('path');
const snapshotPath = path.join(require.resolve('firebase-functions'), '../providers/database');
const DataSnapshot = require(snapshotPath).DataSnapshot;

module.exports = function snapshotMaker(data, path) {
  let app = admin.app();

  const snapshot = new DataSnapshot(
    data,
    path,
    app
  );

  return snapshot;
}