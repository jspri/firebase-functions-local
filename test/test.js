'use strict';

const BASE_LOCATION = '/TEST'

require('dotenv').config({silent: true});

if (!process.env.FIREBASE_SDK_JSON) {
  throw Error('Set process.env.FIREBASE_SDK_JSON to run tests');
}

if (!process.env.FIREBASE_DATABASE_URL) {
  throw Error('Set process.env.FIREBASE_DATABASE_URL to run tests');  
}

const serviceAccount = JSON.parse(process.env.FIREBASE_SDK_JSON);

const admin = require('firebase-admin');
const functions = require('../')(admin);

const assert = require('assert');

const SAFE_LATENCY = process.env.SAFE_LATENCY || 500;

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: process.env.FIREBASE_DATABASE_URL
});

describe('database', () => {
  before(callback => {
    // Nuke the database
    admin.database().ref(BASE_LOCATION).remove().then(callback);
  });

  describe('onWrite', () => {
    it('should listen to reads', callback => {
      const location = newTestLocation();
      
      functions.database.ref(location).onWrite(event => {
        assert.strictEqual(event.data.val(), 'abc123');

        callback();
      });

      setTimeout(() => admin.database().ref(location).set('abc123'), SAFE_LATENCY);
    });

    it('should pass params', callback => {
      const location = newTestLocation();
      
      functions.database.ref(location + '/{1}/little/{2}').onWrite(event => {
        assert.deepEqual(event.params, {1: 'hello', 2: 'kitty'});

        callback();
      });

      setTimeout(() => admin.database().ref(location + '/hello/little/kitty').set('abc123'), SAFE_LATENCY);
    });

    it('should listen to deletes', callback => {
      const location = newTestLocation();

      let i = 0;

      functions.database.ref(location).onWrite(event => {
        if (i === 0) {
          i += 1;
          return;
        }
        assert.strictEqual(event.data.val(), null);

        callback();
      });

      setTimeout(() => {
        admin.database().ref(location).set('abc123')
        admin.database().ref(location).remove()
      }, SAFE_LATENCY);
    });

    it('should handle multiple listeners on one point', callback => {
      const location = newTestLocation();

      let i = 0;

      functions.database.ref(location).onWrite(event => {
        assert.deepEqual(event.data.val(), { foo: { bar: 'abc123' }});

        i += 1;
      });

      let j = 0;

      functions.database.ref(location + '/foo/bar').onWrite(event => {
        assert.strictEqual(event.data.val(), 'abc123');

        j += 1;
      });

      setTimeout(() => admin.database().ref(location + '/foo/bar').set('abc123'), SAFE_LATENCY);
      setTimeout(() =>{
        assert.strictEqual(i, 1, 'Wrong number of outer callbacks')
        assert.strictEqual(j, 1, 'Wrong number of inner callbacks')        

        callback()
      }, SAFE_LATENCY * 2); 
    });

    it('should handle multiple updates at once', callback => {
      const location = newTestLocation();
      
      const cats = new Set();
      let i = 0;

      functions.database.ref(location + '/{cat}').onWrite(event => {
        cats.add(event.params.cat)

        i += 1;

        if (i === 2) {
          assert(cats.has('garfield'));
          assert(cats.has('oscar'));
          
          callback();
        }
      });

      setTimeout(() => admin.database().ref(location).set({ 'garfield': true, 'oscar': true }), SAFE_LATENCY);
      setTimeout(() =>{
        assert.strictEqual(i, 2, 'Wrong number of callbacks')
        assert.strictEqual(cats.size, 1)

        assert(cats.has('garfield'));
        assert(cats.has('oscar'));

        callback()
      }, SAFE_LATENCY * 2); 
    }); 
  })
});

let i = 0;

function newTestLocation() {
  i += 1;

  return BASE_LOCATION + '/' + i;
}