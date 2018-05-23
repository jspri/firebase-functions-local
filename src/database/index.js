const admin = require('firebase-admin');
const snapshotMaker = require('./data-snapshot');
const fChangeMaker = require('./change');

const EVENT_TYPES = ['onWrite', 'onCreate', 'onUpdate', 'onDelete']

function getPath(pathDescription, params) {
  return pathDescription
    .map(currentPathDescription => {
      if (currentPathDescription.isParam) {
        return params[currentPathDescription.name];
      }

      return currentPathDescription.name;
    })
    .join('/');
}

function createListenerDescription(pathDescription, type, cb) {
  return {
    pathDescription: pathDescription,
    type: type,
    callback: cb,
    oldValues: {},
  };
}

function newData(listener, pathDescription, snapshot, first) {
  const newData = snapshot.val();

  const oldValues = listener.oldValues;
  const oldData = getData(pathDescription, oldValues);
  
  setData(pathDescription, newData, oldValues);

  if (first) {
    return;
  }

  const depth = pathDescription.length;
  const changes = detectChanges(oldData, newData, listener, depth);

  changes.forEach(change => createCallbackEvent(change, listener.type, listener.callback));

  return;
}

function getData(pathDescription, oldValues) {
  let obj = oldValues;

  for(let i=0;i<pathDescription.length; i++) {
    let currentPathDescription = pathDescription[i];
    let key = currentPathDescription.name;

    //Shouldn't be any parameters here....
    if (currentPathDescription.isParam) {
      throw Error('Unexpected path description');
    }

    if (obj == null || !(key in obj)) {
      return null;
    }

    obj = obj[key];
  }

  const stringify = JSON.stringify(obj);

  if (stringify === '{}') {
    return null;
  }

  return JSON.parse(stringify);
}

function setData(pathDescription, val, oldValues) {
  let obj = oldValues;
  let parent;
  let key;

  for(let i=0;i<pathDescription.length; i++) {
    let currentPathDescription = pathDescription[i];
    key = currentPathDescription.name;

    if (obj == null) {
      parent[key] = obj = {};
    }

    //Shouldn't be any parameters here....
    if (currentPathDescription.isParam) {
      throw Error('Unexpected path description');
    }

    if (!(key in obj)) {
      obj[key] = {};
    }

    parent = obj;
    obj = obj[key];
  }

  parent[key] = val;

  return;
}

class Change {
  constructor(oldData, newData, params, path) {
    this.oldData = oldData;
    this.newData = newData;
    this.params = params;
    this.path = path;
  }
}

function detectChanges(oldData, newData, listener, depth, _params) {
  const changes = [];
  
  const pathDescription = listener.pathDescription;

  let newObj = newData;
  let oldObj = oldData;
  
  const params = _params || {};

  for(let i=depth;i<pathDescription.length; i++) {
    let currentPathDescription = pathDescription[i];
    let key = currentPathDescription.name;

    //Fork into multiple!!
    if (currentPathDescription.isParam) {
      let newKeys = newObj ? Object.keys(newObj) : [];
      let oldKeys = oldObj ? Object.keys(oldObj) : [];

      let keySet = new Set(newKeys.concat(oldKeys));
      
      keySet.forEach(key => {
        let _oldObj = oldObj ? oldObj[key] : null;
        let _newObj = newObj ? newObj[key] : null;

        let _params = Object.assign({}, params);
        _params[currentPathDescription.name] = key;

        changes.push(...detectChanges(_oldObj, _newObj, listener, i+1, _params));
      })

      return changes;
    }

    if (!isObj(newObj) || !(key in newObj)) {
      newObj = null;
    } else {
      newObj = newObj[key];
    }

    if (!isObj(oldObj) || !(key in oldObj)) {
      oldObj = null;
    } else {
      oldObj = oldObj[key];
    }
  }

  if (JSON.stringify(newObj) === JSON.stringify(oldObj)) {
    return changes;
  }

  const path = getPath(pathDescription, params);

  const change = new Change(oldObj, newObj, params, path);

  changes.push(change);

  return changes;
}

function isObj(obj) {
  if (obj === null) {
    return false;
  }

  return typeof obj === 'object';
}

function createCallbackEvent(change, type, callback) {
  const newSnap = snapshotMaker(change.newData, change.path);
  const oldSnap = snapshotMaker(change.oldData, change.path);
  
  const currentExists = newSnap.exists();
  const previousExists = oldSnap.exists();

  // Check event is correct type
  if (type === 'onCreate' && previousExists) {
    return;
  } else if (type === 'onUpdate' && !(previousExists && currentExists)) {
    return;
  } else if (type === 'onDelete' && currentExists) {
    return;
  }

  const context = {
    params: change.params,
  };

  let dataEvent;

  // Create event object
  if (type === 'onCreate') {
    dataEvent = newSnap;
  } else if (type === 'onDelete') {
    dataEvent = oldSnap;
  } else {
    dataEvent = fChangeMaker(oldSnap, newSnap);
  }

  // Avoid firebase-admin catching erros
  setImmediate(() => callback(dataEvent, context));
}

function createListener(pathDescription, type, cb) {
  //Get rootiest parameter
  let i = 0;

  for (i;i<pathDescription.length;i++) {
    let currentPathDescription = pathDescription[i];

    if (currentPathDescription.isParam) {
      break;
    }
  }

  //Listen to one above
  const listenDescription = pathDescription.slice(0, i);
  const listenPath = getPath(listenDescription);

  const listener = createListenerDescription(pathDescription, type, cb);

  let first = true;

  admin.database().ref(listenPath).on('value', snapshot => { // Data listener
    newData(listener, listenDescription, snapshot, first); // Don't fire listeners on first pull

    if (first) {
      first = false;      
    }
  });
}

function createEvent(path, type, cb) {
  var pathDescription = path
    .split('/')
    .filter(str => str !== '')
    .reduce(function(currentPathDescription, pathKey) {
      var paramMatch = pathKey.match(/\{(.*)\}/);
      var isParam = Boolean(paramMatch);

      return currentPathDescription.concat({
        isParam,
        name: isParam ? paramMatch[1] : pathKey,
      });
    }, []);

  createListener(pathDescription, type, cb);
}

function databaseEvents(path) {
  const events = {};

  EVENT_TYPES.forEach(type => {
    return events[type] = (callback) => createEvent(path, type, callback);
  });

  return events;
}

module.exports = {
  ref: (path) => databaseEvents(path)
}
