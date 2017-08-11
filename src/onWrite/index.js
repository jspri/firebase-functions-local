const admin = require('firebase-admin');
const snapshotMaker = require('../classes/delta-snapshot');

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

function createListener(pathDescription, cb) {
  return {
    pathDescription: pathDescription,
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

  changes.forEach(createCallbackEvent);

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
  constructor(oldData, newData, params, path, callback) {
    this.oldData = oldData;
    this.newData = newData;
    this.params = params;
    this.path = path;
    this.callback = callback;
  }
}

function detectChanges(oldData, newData, listener, depth, _params) {
  const changes = [];
  
  const pathDescription = listener.pathDescription;
  const cb = listener.callback;

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

  const change = new Change(oldObj, newObj, params, path, cb);

  changes.push(change);

  return changes;
}

function isObj(obj) {
  if (obj === null) {
    return false;
  }

  return typeof obj === 'object';
}

function createCallbackEvent(change) {
  const event = {
    params: change.params,
    data: snapshotMaker(change.newData, change.oldData, change.path)
  };

  change.callback(event);
}

function createEvent(pathDescription, cb) {
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

  const listener = createListener(pathDescription, cb);

  let first = true;

  admin.database().ref(listenPath).on('value', snapshot => { // Data listener
    newData(listener, listenDescription, snapshot, first); // Don't fire listeners on first pull

    if (first) {
      first = false;      
    }
  });
}

function onWrite(path, cb) {
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

  createEvent(pathDescription, cb);
}

module.exports = onWrite;
