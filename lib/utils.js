
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
    return arrayify(x);
  }

  return x;
}

const keyMirror = module.exports.keyMirror = function (keys) {
  const keys_ = arrayifyScalars(keys);
  return keys_.reduce((m,k) => ({...m, [k]:k}), {});
}

const extract = module.exports.extract = function (x, keys) {
  let y = {...keyMirror(keys)};   /* return a copy */

  y = Object.keys(y).reduce((m,k) => {
    const value = x[k];
    delete x[k];
    return {...m, [k]: value};
  }, {});
  return y;
};

// console.log(keyMirror('a,b,c'));
// const o = {a:'a',b:'b',c:'c'};
// const o2 = extract(o, 'a,c');
// console.log({o,o2})

