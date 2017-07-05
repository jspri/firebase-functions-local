const admin = require('firebase-admin');
const snapshotMaker = require('../classes/delta-snapshot');

const oldValues = {};

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

const _LISTENERS = [];

function addListener(pathDescription, cb) {
  return _LISTENERS.push({
    pathDescription: pathDescription,
    callback: cb,
  });
}

function getListeners(pathDescription) {
  //Gets listeners deeper than or equal to path description;
  let listeners = _LISTENERS;

  let i = 0;

  pathDescription.forEach(currentPathDescription => {
    listeners = listeners.filter(listener => {
      let listenerPathDescription = listener.pathDescription[i];

      if (!listenerPathDescription) {
        return false;
      }

      if (listenerPathDescription.isParam) {
        return true;
      }

      return listenerPathDescription.name === currentPathDescription.name;
    });

    i += 1;
  });

  return listeners;
}

function newData(pathDescription, snapshot) {
  const oldData = getData(pathDescription);
  const newData = snapshot.val();

  setData(pathDescription, newData);

  const listeners = getListeners(pathDescription);

  const depth = pathDescription.length;
  const changes = detectChanges(oldData, newData, listeners, depth);

  changes.forEach(createCallbackEvent);

  return;
}

function getData(pathDescription) {
  let obj = oldValues;

  for(let i=0;i<pathDescription.length; i++) {
    let currentPathDescription = pathDescription[i];
    let key = currentPathDescription.name;

    //Shouldn't be any parameters here....
    if (currentPathDescription.isParam) {
      throw Error('Unexpected path description');
    }

    if (!(key in obj)) {
      return null;
    }

    obj = obj[key];
  }

  return JSON.parse(JSON.stringify(obj));
}

function setData(pathDescription, val) {
  let obj = oldValues;

  if (val === null) {
    return;
  }

  for(let i=0;i<pathDescription.length; i++) {
    let currentPathDescription = pathDescription[i];
    let key = currentPathDescription.name;

    //Shouldn't be any parameters here....
    if (currentPathDescription.isParam) {
      throw Error('Unexpected path description');
    }

    if (!(key in obj)) {
      obj[key] = {};
    }

    obj = obj[key];
  }

  Object.assign(obj, val);

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

function detectChanges(oldData, newData, listeners, depth, _params) {
  const changes = [];
  
  listeners.forEach(listener => {
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
        let oldKeys = oldObj ? Object.keys(oldObj): [];
        
        newKeys.concat(oldKeys).forEach(key => {
          let _oldObj = oldObj ? oldObj[key] : null;
          let _newObj = newObj ? newObj[key] : null;

          let _params = Object.assign({}, params);
          _params[currentPathDescription.name] = key;

          changes.push(...detectChanges(_oldObj, _newObj, [listener], i+1, _params));
        })

        break;
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
      return;
    }

    const path = getPath(pathDescription, params);

    const change = new Change(oldObj, newObj, params, path, cb);

    changes.push(change);

    return
  });

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

  let first = true;

  admin.database().ref(listenPath).on('value', snapshot => {
    newData(listenDescription, snapshot);

    //Add listener once you have delta for the snapshot
    if (first) {
      first = false;
      addListener(pathDescription, cb);
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
