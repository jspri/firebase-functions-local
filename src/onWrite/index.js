const admin = require('firebase-admin');
const snapshotMaker = require('../classes/delta-snapshot');

const oldValues = {};

function getKey(pathIndexTriggered, pathIndex, snapshot) {
  if (pathIndexTriggered > pathIndex) {
    var parent = snapshot.ref;
    while (pathIndex < pathIndexTriggered) {
      parent = parent.parent;
      pathIndex++;
    }

    return parent.key;
  } else if (pathIndex === pathIndexTriggered) {
    return snapshot.key;
  } else {
    var child = snapshot.val();
    while (pathIndexTriggered < pathIndex - 1) {
      child = child[Object.keys(child)[0]];
      pathIndex--;
    }

    return Object.keys(child)[0];
  }
}

function createParams(pathDescription, pathIndexTriggered, snapshot) {
  return pathDescription.reduce(function(params, path, pathIndex) {
    if (path.isParam) {
      params[path.name] = getKey(pathIndexTriggered, pathIndex, snapshot);
    }

    return params;
  }, {});
}

function getPath(pathDescription, pathIndex, snapshot) {
  return pathDescription
    .reduce(function(currentPath, path, index) {
      if (path.isParam) {
        return currentPath.concat(getKey(pathIndex, index, snapshot));
      }

      return currentPath.concat(path.name);
    }, [])
    .join('/');
}

_LISTENERS = [];

function addDataListener(pathDescription, cb) {
  return _LISTENERS.push({
    pathDescription: pathDescription,
    callback: cb,
  });
}

function getListeners(pathDescription) {
  //Filter irrelevant listeners
  let listeners = _LISTENERS;

  let i = 0;

  pathDescription.forEach(currentPathDescription => {
    listeners = listeners.filter(listener => {
      let listenerPathDescription = listener.pathDescription;

      if (!listenerPathDescription[i]) {
        return false;
      }

      if (listenerPathDescription.isParam) {
        return true;
      }

      return listenerPathDescription.name === pathDescription.name;
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

  detectChanges(oldData, newData, listeners);

  return;
}

function getData(pathDescription) {
  let obj = oldValues;

  for(let i=0;i<pathDescription.length; i++) {
    let currentPathDescription = pathDescription[i];
    let key = currentPathDescription.name;

    //Shouldn't be any parameters here....
    if (currentPathDescription.isParam) {
      throw Error("Unexpected path description");
    }

    if (!(key in obj)) {
      return null;
    }

    obj = obj[key];
  }

  return obj;
}

function setData(pathDescription, val) {
  let obj = oldValues;

  for(let i=0;i<pathDescription.length; i++) {
    let currentPathDescription = pathDescription[i];
    let key = currentPathDescription.name;

    //Shouldn't be any parameters here....
    if (currentPathDescription.isParam) {
      throw Error("Unexpected path description");
    }

    if (!(key in obj)) {
      obj[key] = {};
    }

    obj = obj[key];
  }

  obj = val;

  return;
}

function createCallbackEvent(pathDescription, pathIndex, snapshot) {
  const path = getPath(pathDescription, pathIndex, snapshot);

  oldValues[path] = newValue;
  return {
    params: createParams(pathDescription, pathIndex, snapshot),
    data: snapshotMaker(newValue, previousValue, path)
  };
}

function getValue(pathDescription, pathIndex, snapshot) {
  var child = snapshot.val();

  //Make this actually look at the PATH
  while (pathIndex < pathDescription.length - 1) {
    child = child[Object.keys(child)[0]];
    pathIndex++;
  }

  return child;
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
  const listenPath = getPath(listenDescription, i - 1);

  addDataListener(pathDescription, cb);

  let first = true;

  admin.database().ref(listenPath).on('value', snapshot => {
    newData(listenDescription, snapshot);

    //Add listener once you have delta for the snapshot
    if (!first) {
      first = true;
      //addDataListener(pathDescription, cb);
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
