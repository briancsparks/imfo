
const { MongoClient } = require('mongodb');
const {extract}       = require('./utils');
const ARGV            = require('minimist')(process.argv.slice(2));

let   uri     = "";
let   g_client;

let   defs = {};

module.exports.mongoConnect = function(dbName, callback) {
  let   err;

  const user  = ARGV.user || process.env.IMFO_ATLAS_USER;
  const pw    = ARGV.pw   || process.env.IMFO_ATLAS_PW;
  const db    = ARGV.db   || process.env.IMFO_ATLAS_DB;
  const fqdn  = ARGV.fqdn || process.env.IMFO_ATLAS_FQDN;

  if ((err = checkInput({user,pw,db,fqdn}))) {
    return callback(err);
  }

  uri       = `mongodb+srv://${user}:${pw}@${fqdn}/${db}?retryWrites=true&w=majority`;
  g_client  = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

  return g_client.connect(function (err) {
    if (err) {
      console.error(err);
      return callback(err);
    }

    defs.dbName = db;

    return callback(null, g_client);
  });
};

const queryFn =  module.exports.query = function (query, context, callback) {
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

const Collection = module.exports.Collection = function (...args) {
  if (new.target === undefined) {
    return new Collection(...args);
  }
  let self = this;
  const [collName, dbName =defs.dbName] = args;

  self.query = function(query, callback) {
    return queryFn(query, {collName, dbName}, callback);
  };
};

module.exports.cleanupArgs = function (argv, keys2) {
  let result = {...argv};   /* copy it, dont destroy it */
  extract(result, 'user,pw,db,fqdn');
  extract(result, keys2 || {});
  return result;
};


function checkInput(x) {
  let errMsg = '';

  errMsg = checkOne(errMsg, x, 'user');
  errMsg = checkOne(errMsg, x, 'pw');
  errMsg = checkOne(errMsg, x, 'db');
  errMsg = checkOne(errMsg, x, 'fqdn');

  if (errMsg) {
    return errMsg;
  }
}

function checkOne(msg, x, key) {
  if (!x[key]) {
    const first = msg ? `${msg}\n` : '';
    return `${first}      Use "--${key} "<${key}>" or set IMFO_ATLAS_${key.toUpperCase()}="<${key}>"`;
  }

  return msg;
}

