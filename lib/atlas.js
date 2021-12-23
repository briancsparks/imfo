
const { MongoClient } = require('mongodb');
const {extract,pick,allAliases, keyMirror}       = require('./utils');
const imfo = require("..");
const ARGV            = require('minimist')(process.argv.slice(2));

let   uri     = "";
let   g_client;

let   defs = {};

// --------------------------------------------------------------------------------------------------------------------
const mongoConnect = module.exports.mongoConnect = function(options, callback) {
  let   err;

  const user  = ARGV.user   || options.user                         || process.env.IMFO_ATLAS_USER;
  const pw    = ARGV.pw     || options.pw                           || process.env.IMFO_ATLAS_PW;
  const db    = ARGV.db     || options.db       || options.dbName   || process.env.IMFO_ATLAS_DB;
  const fqdn  = ARGV.fqdn   || options.fqdn                         || process.env.IMFO_ATLAS_FQDN;

  if ((err = checkUserPwDbFqdn({user,pw,db,fqdn}))) {
    console.error(`Cannot find param ${err}`)
    return callback(err);
  }

  // uri       = `mongodb+srv://${user}:${pw}@${fqdn}/${db}?retryWrites=true&w=majority`;
  uri       = `mongodb+srv://${user}:${pw}@${fqdn}/?retryWrites=true&w=majority`;
  g_client  = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });
  if (!g_client) {
    console.error(`Error getting client`);
    return callback({err: `Error getting client`})
  }

  return g_client.connect(function (err) {
    if (err) {
      console.error(err);
      return callback(err);
    }

    defs.dbName = db;

    return callback(null, g_client);
  });
};

// --------------------------------------------------------------------------------------------------------------------
module.exports.MongoCollection = function(options, callback) {
  const options_            = pick(options, 'user,pw,db,dbName,fqdn');
  const {collName, dbName}  = allAliases(options, ',', 'db,dbName', 'c,coll,collName');

  // let [collName, dbName =''] = (typeof options == 'string') ? [options] : options;

  return mongoConnect(options_, function (err, client) {
    if (err) {
      console.error(err);
      return callback(err);
    }

    const db = Collection(client,collName || "main", dbName || "imfo");
    return callback(null, {db, client, /*aliases:*/ collection: db, coll: db});
  });

}

// --------------------------------------------------------------------------------------------------------------------
const Collection = module.exports.Collection = function (client, ...args) {
  const [collName, dbName =defs.dbName] = args;
  if (!checkInputs({collName,dbName,client})) {
    return;
  }

  if (new.target === undefined) {
    return new Collection(client, ...args);
  }
  let self = this;
  const c = client.db(dbName).collection(collName);

  self.findOne = function(query, callback) {
    return findOne(query, {client, collName, dbName}, callback);
  };
  self.query = self.findOne;

  self.upsert = function (query, changes, callback) {
    return upsert(query, changes, {client, collName, dbName}, callback);
  };

  self.updateMany = function (query, changes, callback) {
    return updateMany(query, changes, {c, client, collName, dbName}, callback);
  };
};

// --------------------------------------------------------------------------------------------------------------------
const updateMany = function(query, changes, context, callback) {
  const {c,client =g_client}    = context;

  const [$keys, userChanges] = splitObj(changes, '$');

  let   $set      = {...userChanges, mtime: new Date()};
  let   update    = {$set, ...$keys};
  const options   = {};

  // console.log({query, update, options, $keys})
  return c.updateMany(query, update, options, function (err, data) {
    if (err)    { return errback(callback, err); }
    return callback(err, data);
  });
};

// --------------------------------------------------------------------------------------------------------------------
const splitObj = function(o, keys1) {
  const keep1   = keyMirror(keys1);
  let   o1      = {};
  let   o2      = {};

  Object.keys(o).forEach((k) => {
    if (k in keep1) {
      o1[k] = o[k];
    } else {
      o2[k] = o[k];
    }
  });

  return [o1, o2];
};

// --------------------------------------------------------------------------------------------------------------------
function errback(callback, err, msg ='') {
  console.error(msg, err);
  return callback(err);
};

// --------------------------------------------------------------------------------------------------------------------
const upsert =  module.exports.upsert = function (query, changes, context, callback) {
  const {dbName,collName} = context;
  const client = context.client || g_client;

  if (!client)      { return callback({err: 'ENO_CLIENT'}); }
  if (!dbName)      { return callback({err: 'ENO_DBNAME'}); }
  if (!collName)    { return callback({err: 'ENO_COLLNAME'}); }

  let $set          = {...query, ...changes, mtime: new Date()};
  let $setOnInsert  = {ctime: new Date()};
  let update        = {$set, $setOnInsert};

  const options = {upsert: true};
  const c = client.db(dbName).collection(collName);

  return c.updateOne(query, update, options, function (err, data) {
    if (err) {
      console.error(err);
      return callback(err);
    }

    return callback(null, data);
  });
};

// --------------------------------------------------------------------------------------------------------------------
const findOne =  module.exports.findOne = function (query, context, callback) {
  const {dbName,collName} = context;
  const client = context.client || g_client;

  if (!client)      { return callback({err: 'ENO_CLIENT'}); }
  if (!dbName)      { return callback({err: 'ENO_DBNAME'}); }
  if (!collName)    { return callback({err: 'ENO_COLLNAME'}); }

  const options = {projection: {_id:0}};
  const c = client.db(dbName).collection(collName);
  return c.findOne(query, options, function (err, data) {
    if (err) {
      console.error(err);
      return callback(err);
    }

    return callback(null, data);
  });
};

// --------------------------------------------------------------------------------------------------------------------
const checkInputs = function(inputs, callback =function(){}) {
  const keys = Object.keys(inputs);
  const len  = keys.length;

  for (let i = 0; i < len; ++i) {
    const key   = keys[i];
    const value = inputs[key];
    if (value === undefined) {
      const eno = `ENO_${key.toUpperCase()}`;
      console.error(`${eno}: Need to provide ${key}.`);
      callback({err: eno});
      return false;
    }
  }

  return true;
};

// --------------------------------------------------------------------------------------------------------------------
module.exports.cleanupArgs = function (argv, keys2) {
  let result = {...argv};   /* copy it, dont destroy it */
  extract(result, 'user,pw,db,fqdn');
  extract(result, keys2 || {});
  return result;
};


// --------------------------------------------------------------------------------------------------------------------
function checkUserPwDbFqdn(x) {
  let errMsg = '';

  errMsg = checkOne(errMsg, x, 'user');
  errMsg = checkOne(errMsg, x, 'pw');
  errMsg = checkOne(errMsg, x, 'db');
  errMsg = checkOne(errMsg, x, 'fqdn');

  if (errMsg) {
    return errMsg;
  }
}

// --------------------------------------------------------------------------------------------------------------------
function checkOne(msg, x, key) {
  if (!x[key]) {
    const first = msg ? `${msg}\n` : '';
    return `${first}      Use "--${key} "<${key}>" or set IMFO_ATLAS_${key.toUpperCase()}="<${key}>"`;
  }

  return msg;
}

