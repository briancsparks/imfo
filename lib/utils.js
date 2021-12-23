const fs = require("fs");

const firstKey = function (o) {
  return  Object.keys(o)[0];
};

const firstValue = function (o) {
  const key1 = firstKey(o);
  if (key1 === undefined) {
    return key1;
  }
  return o[key1];
};

const firstKeyValue = function (o) {
  const key1 = firstKey(o);
  if (key1 === undefined) {
    return [];
  }
  return [key1, o[key1]];
};

const isScalar = function (x) {
  if (Array.isArray(x)) {
    return false;
  }

  const ty = typeof x;
  if (ty === 'string' || ty === 'number' || ty === 'boolean') {
    return true;
  }

  return x instanceof RegExp || x instanceof Date;
};

const arrayify = module.exports.arrayify = function (x, sep) {
  if (Array.isArray(x)) {
    return x;
  }

  if (typeof x === 'string') {
    return x.split(sep || ',');
  }

  return [x];
}

const arrayifyScalars = module.exports.arrayifyScalars = function (x, sep) {
  if (Array.isArray(x)) {
    return x;
  }

  if (isScalar(x)) {
    return arrayify(x, sep);
  }

  return x;
}

const keyMirror = module.exports.keyMirror = function (keys, sep) {
  const keys_ = arrayifyScalars(keys, sep);
  return keys_.reduce((m,k) => ({...m, [k]:k}), {});
}

const extract = module.exports.extract = function (x, keys, keySep) {
  let y = {...keyMirror(keys, keySep)};   /* return a copy */

  y = Object.keys(y).reduce((m,k) => {
    const value = x[k];
    delete x[k];
    return {...m, [k]: value};
  }, {});
  return y;
};

const pick = module.exports.pick = function (o, keys, keySep) {
  const keys_ = arrayifyScalars(keys, keySep);
  return keys_.reduce((m,k) => ((o[k] === undefined) ? m : {...m, [k]: o[k]}), {});
};

const aliases = module.exports.aliases = function(o, keysSep, keys, ...rest) {
  let result = [];

  const keys_   = arrayifyScalars(keys, keysSep);
  const picked  = pick(o, keys, keysSep);
  const [key1, value1] = firstKeyValue(picked);
  const all     = keys_.reduce((m,k) => ({...m, [k]: value1}), {});

  result.push(all);

  if (rest.length > 0) {
    const [nextKeys, ...nextRest] = rest;
    result.push(...aliases(o, keysSep, nextKeys, ...nextRest))
  }

  return result;
};

const allAliases = module.exports.allAliases = function (o, keysSep, keys, ...rest) {
  let als = aliases(o, keysSep, keys, ...rest);

  als = als.reduce((m,o) => {
    return {...m, ...o};
  }, {});

  return als;
};

// const o = {dbName: 'db', c: 'coll'};
// console.log(allAliases(o, ',', 'db,dbName', 'c,coll,collName'));

module.exports.safeJSONParse = function (s) {
  try {
    return JSON.parse(s);
  } catch(e) {
  }

  return /*undefined*/;
}

module.exports.safeJSONParseSq = function (s) {
  try {
    return JSON.parse(s.replace(/'/g, '"'));
  } catch(e) {
  }

  return /*undefined*/;
}

module.exports.safeReadFileSync = function (filename) {
  try {
    return fs.readFileSync(filename, 'utf8');
  } catch(e) {
  }

  return /*undefined*/;
}

// console.log(keyMirror('a,b,c'));
// const o = {a:'a',b:'b',c:'c'};
// const o2 = extract(o, 'a,c');
// console.log({o,o2})

