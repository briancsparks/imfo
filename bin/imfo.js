#!/usr/bin/env node

const ARGV    = require('minimist')(process.argv.slice(2));
const _       = require('underscore');
const os      = require('os');
const fs      = require('fs');

const imfo    = require('..')
const {
  safeJSONParse, safeJSONParseSq, safeReadFileSync, allAliases
}                   = require('../lib/utils');
const {cleanupArgs} = require("../lib/atlas");

const ipOut = ARGV.ip  || ARGV.ipconfig || ARGV.ifconfig;

let haveNet15 = false;
let haveNet10 = false;
let have192   = false;
let have172   = false;

(function () {
  main(function(err, data) {
    if (err) {
      process.exit(typeof err === 'number' ? err : 99);
    }
    console.log(data);
  });
}());

function main(callback) {
  // console.log({ARGV})

  // -------------------------------------------------------------------------------------------------------------------
  if (ARGV.get) {
    const query = cleanupArgs(ARGV, '_,get');

    return imfo.MongoCollection({c:'main', db:'imfo'}, function (err, {client, db}) {
      return db.findOne(query, function (err, qdata) {
        if (err) {
          return callback(9);
        }

        // console.log(qdata);

        client.close();
        return callback(null, qdata);
      });
    });
  }

  // -------------------------------------------------------------------------------------------------------------------
  if (ARGV.upsert) {
    let   {upsert} = ARGV
    const query = cleanupArgs(ARGV, '_,upsert');

    upsert = specialArg(upsert);
    if (upsert === null) {
      return callback(10);
    }

    // console.log({upsert, query, _: ARGV._})

    return imfo.MongoCollection({c:'main', db:'imfo'}, function (err, {client, db}) {
      return db.upsert(query, upsert, function(err, qdata) {
        if (err) {
          return callback(err);
        }

        const {ok} = allAliases(qdata, ',', 'ok,acknowledged');
        // console.log({ok});

        client.close();
        return callback(null, {ok, ...qdata});
      });
    });
  }

  // -------------------------------------------------------------------------------------------------------------------
  if (ARGV.many) {
    let   {many} = ARGV
    const query = cleanupArgs(ARGV, '_,many');

    many = specialArg(many);
    if (many === null) {
      return callback(10);
    }

    // console.log(1, {many, query, _: ARGV._})

    // return;
    return imfo.MongoCollection({c:'main', db:'imfo'}, function (err, {client, db}) {
      return db.updateMany(query, many, function(err, qdata) {
        if (err) {
          return callback(err);
        }

        const {ok} = allAliases(qdata, ',', 'ok,acknowledged');
        // console.log({ok, ...qdata});

        client.close();
        return callback(null, {ok, ...qdata});
      });
    });
  }

  // -------------------------------------------------------------------------------------------------------------------

  // TODO: insert, updateMany, findAll

  // -------------------------------------------------------------------------------------------------------------------
  return callback(null, fnInfo());
}

function specialArg(arg) {
  let result = arg;

  if (result[0] === '{') {
    // JSON?
    result = safeJSONParse(result) || safeJSONParseSq(result) || result;

  } else if (result[0] === '@') {
    // Read file
    const filename = result.substr(1)
    const content = safeReadFileSync(filename);
    if (content === null || content === undefined) {
      console.error(`ENOENT: ${filename}`);
      return null;
    }

    const json = safeJSONParse(content);
    if (!json && filename.endsWith('.json')) {
      console.error(`ENOT_JSON: ${filename}`);
      return null;
    }

    result = json || content || result;
  }

  return result;
}

function fnInfo() {
  let result = os;
  let score = -1;
  let noProxyNeeded = true;
  let address;
  let ifaceName;

  if (ipOut) {

    _.each(os.networkInterfaces(), function (iface, name) {
      _.each(iface, function (subIface) {
        if (subIface.family.toLowerCase() === 'ipv4') {
          if (subIface.address.startsWith('1[567]\.'))  {haveNet15 = true;}
          if (subIface.address.startsWith('10\.'))      {haveNet10 = true;}
          if (subIface.address.startsWith('192\.'))     {have192 = true;}
          if (subIface.address.startsWith('172\.'))     {have172 = true;}
        }
      })
    });

    _.each(os.networkInterfaces(), function (iface, name) {
      _.each(iface, function (subIface) {
        if (subIface.family.toLowerCase() === 'ipv4') {
          const [score_, noProxyNeeded_] = scoreTheIp(subIface.address);

          //console.log(`${subIface.address} score: ${score_}, no proxy: ${noProxyNeeded_}`);

          if (score_ > score) {
            score = score_;
            noProxyNeeded = noProxyNeeded_;
            address = subIface.address;
            ifaceName = name;
          }
        }
      })
    });

    // User wants IP
    result = address;
  }

  // No options specified
  else {
    result = {...result, constants: null};
  }

  if (typeof result === 'object') {
    result = _.reduce(result, function (m, value, key) {
      if (typeof value !== 'function') {
        return m;
      }

      if (key.startsWith('set') || key === 'tmpDir') {
        return m;
      }

      return {...m, [key]: value()};
    }, {});
  }

  if (typeof result === 'object') {
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  } else {
    process.stdout.write(result + '\n');
  }
}

// --------------------------------------------------------------------------------------------------------------------
function scoreTheIp(ip ='') {
  const octets = ip.split('.');
  if (octets.length !== 4) {
    return [0, false];
  }

  if (os.platform().toLowerCase() === 'linux') {
    if (os.release().toLowerCase().indexOf('microsoft') !== -1) {
      // WSL -- 172.x.y.z
      if (octets[0] === '172') {
        return [10, true];
      }

      // WSL usually gets 172, but it could end up with 192.
      if (octets[0] === '192') {
        if (octets[2] === '1' || octets[2] === '100' || octets[2] === '10') {
          return [8, true];
        }
        return [7, true];
      }

      return [0, false];
    }

    // Linux in cloud
    if (octets[0] === '10') {
      return [10, true];
    }

    // Linux at a work
    if (octets[0] === '15' || octets[0] === '16' || octets[0] === '17') {
      if (have192) {
        return [8, true];       // Probably on VPN
      }
      return [10, false];
    }

    // Linux at home?
    if (octets[0] === '192' || octets[0] === '172') {
      return [7, true];
    }

    return [0, false];
  }

  if (os.platform().toLowerCase() === 'win32') {
    if (octets[0] === '192') {
      if (octets[2] === '1' || octets[2] === '100' || octets[2] === '10') {
        return [10, true];
      }
      return [7, true];
    }

    if (octets[0] === '15' || octets[0] === '16' || octets[0] === '17') {
      if (have192) {
        return [8, false];
      }
      return [10, false];
    }

    return [0, false];
  }

  if (os.platform().toLowerCase() === 'darwin') {
    if (octets[0] === '192') {
      if (octets[2] === '1' || octets[2] === '100' || octets[2] === '10') {
        return [8, true];
      }
      return [7, true];
    }

    if (octets[0] === '15' || octets[0] === '16' || octets[0] === '17') {
      return [10, false];
    }

    return [0, false];
  }

}