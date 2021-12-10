#!/usr/bin/env node

const ARGV    = require('minimist')(process.argv.slice(2));
const _       = require('underscore');
const os      = require('os');

const imfo    = require('..')
const {cleanupArgs} = require("../lib/atlas");

const ipOut = ARGV.ip  || ARGV.ipconfig || ARGV.ifconfig;

let haveNet15 = false;
let haveNet10 = false;
let have192   = false;
let have172   = false;

main();

function main() {
  if (ARGV.get) {
    const query = cleanupArgs(ARGV, '_,get');

    return imfo.mongoConnect('', function (err, client) {
      if (err) {
        console.error(err);
        process.exit(9);
        return;
      }

      const dbOne = imfo.Collection("main", "imfo");
      return dbOne.query(query, function (err, qdata) {
        if (err) {
          console.error(err);
          process.exit(9);
          return;
        }

        console.log(qdata);

        client.close();
      });
    })
  }

  return fnInfo();
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