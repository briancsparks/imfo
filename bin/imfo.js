#!/usr/bin/env node

const ARGV    = require('minimist')(process.argv.slice(2));
const _       = require('underscore');
const os      = require('os')

const ipOut = ARGV.ip  || ARGV.ipconfig || ARGV.ifconfig;

main();

function main() {
  let result = os;
  let score = -1;
  let noProxyNeeded = true;
  let address;
  let ifaceName;

  if (ipOut) {

    _.each(os.networkInterfaces(), function (iface, name) {
      _.each(iface, function (subIface) {
        if (subIface.family.toLowerCase() === 'ipv4') {
          const [score_, noProxyNeeded_] = scoreTheIp(subIface.address);
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

      if (key.startsWith('set')) {
        return m;
      }

      return {...m, [key]: value()};
    }, {});
  }

  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
}

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