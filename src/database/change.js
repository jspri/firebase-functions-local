const functions = require('firebase-functions');

module.exports = function changeMaker(before, after) {
  const snapshot = new functions.Change(
    before,
    after
  );

  return snapshot;
}