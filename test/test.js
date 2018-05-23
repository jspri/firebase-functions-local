'use strict';

const BASE_LOCATION = '/TEST' // Root in the firebase db used for tests

require('dotenv').config({silent: true});

if (!process.env.FIREBASE_SDK_JSON) {
  throw Error('Set process.env.FIREBASE_SDK_JSON to run tests');
}

if (!process.env.FIREBASE_DATABASE_URL) {
  throw Error('Set process.env.FIREBASE_DATABASE_URL to run tests');  
}

const serviceAccount = JSON.parse(process.env.FIREBASE_SDK_JSON);

const admin = require('firebase-admin');
const functions = require('../')();

const assert = require('assert');

const SAFE_LATENCY = process.env.SAFE_LATENCY || 350;

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: process.env.FIREBASE_DATABASE_URL
});

describe('database', () => {
  before(callback => {
    // Nuke the database
    admin.database().ref(BASE_LOCATION).remove().then(callback);
  });

  /*
  after(callback => {
    // Nuke the database
    admin.database().ref(BASE_LOCATION).remove().then(callback);
  });
  */

  describe('onWrite', () => {
    it('should listen to reads', callback => {
      const location = newTestLocation();
      
      functions.database.ref(location).onWrite(change => {
        assert.strictEqual(change.after.val(), 'abc123');

        callback();
      });

      setTimeout(() => admin.database().ref(location).set('abc123'), SAFE_LATENCY);
    });

    it('should pass params', callback => {
      const location = newTestLocation();
      
      functions.database.ref(location + '/{1}/little/{2}').onWrite((change, context) => {
        assert.deepEqual(context.params, {1: 'hello', 2: 'kitty'});

        callback();
      });

      setTimeout(() => admin.database().ref(location + '/hello/little/kitty').set('abc123'), SAFE_LATENCY);
    });

    it('should listen to deletes', callback => {
      const location = newTestLocation();

      let i = 0;

      functions.database.ref(location).onWrite(change => {
        if (i === 0) {
          i += 1;
          return;
        }
        assert.strictEqual(change.after.val(), null);

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

      functions.database.ref(location).onWrite(change => {
        assert.deepEqual(change.after.val(), { foo: { bar: 'abc123' }});

        i += 1;
      });

      let j = 0;

      functions.database.ref(location + '/foo/bar').onWrite(change => {
        assert.strictEqual(change.after.val(), 'abc123');

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

      functions.database.ref(location + '/{cat}').onWrite((change, context) => {
        cats.add(context.params.cat)

        i += 1;
      });

      setTimeout(() => admin.database().ref(location).set({ 'garfield': true, 'oscar': true }), SAFE_LATENCY);
      setTimeout(() =>{
        assert.strictEqual(i, 2, 'Wrong number of callbacks')
        assert.strictEqual(cats.size, 2)

        assert(cats.has('garfield'));
        assert(cats.has('oscar'));

        callback()
      }, SAFE_LATENCY * 2); 
    }); 

    it('should set adminRef', callback => {
      const location = newTestLocation();
      
      functions.database.ref(location).onWrite(change => {
        assert(change.after.ref.isEqual(admin.database().ref(location)));

        callback();
      });

      setTimeout(() => admin.database().ref(location).set('abc123'), SAFE_LATENCY);      
    })
  })

  describe('onCreate', () => {
    it('should listen to objects being created', callback => {
      const location = newTestLocation();
      
      functions.database.ref(location).onCreate(createSnap => {
        assert.strictEqual(createSnap.val(), 'abc123');

        callback();
      });

      setTimeout(() => admin.database().ref(location).set('abc123'), SAFE_LATENCY);
    });

    it('should not listen when the object already exists', callback => {
      const location = newTestLocation();

      admin.database().ref(location).set('abc123').then(() => {
        functions.database.ref(location).onCreate(() => {
          throw Error('Should not be called');
        });

        setTimeout(() => admin.database().ref(location).set('abc123'), SAFE_LATENCY);
        setTimeout(callback, SAFE_LATENCY * 2);        
      })
    })

    it('should not trigger when an object is deleted', callback => {
      const baseLocation = newTestLocation();
      const listener = baseLocation + '/{id}';
      const oldTrigger = baseLocation + '/bar';
      const trigger = baseLocation + '/foo';

      let count = 0;

      admin.database().ref(oldTrigger).set('bar');

      functions.database.ref(listener).onCreate((createSnap, context) => {
        const id = context.params.id;

        if (!count) {
          count++
          admin.database().ref(baseLocation + '/' + id).remove();
          return;
        }

        throw Error('Called on delete')
      });

      setTimeout(() => admin.database().ref(trigger).set('foo'), SAFE_LATENCY);

      setTimeout(callback, SAFE_LATENCY * 2);
    })
  })

  describe('onUpdate', () => {
    it('should listen to updates', callback => {
      const location = newTestLocation();
      
      functions.database.ref(location).onUpdate(change => {
        assert.strictEqual(change.before.val(), 'abc123')
        assert.strictEqual(change.after.val(), 'def456')

        callback();
      });

      setTimeout(() => {
        admin.database().ref(location).set('abc123')
        admin.database().ref(location).set('def456')
      }, SAFE_LATENCY);
    });
  })

  describe('onDelete', () => {
    it('should listen to deletes', callback => {
      const location = newTestLocation();
      
      functions.database.ref(location).onDelete(deleteSnap => {
        assert.strictEqual(deleteSnap.val(), 'abc123');

        callback();
      });

      setTimeout(() => {
        admin.database().ref(location).set('abc123')
        admin.database().ref(location).remove();        
      }, SAFE_LATENCY);
    });
  })
});

let i = 0;

function newTestLocation() {
  i += 1;

  return BASE_LOCATION + '/' + i;
}
