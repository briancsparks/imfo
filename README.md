
# imfo

Get system info in an easy, consistent, cross-platform way.

Compared to parsing the output of `ifconfig` or `ip route`, the 'os' module
in Node.js is very easy to use.

```shell
> npx imfo --ip
192.168.1.12
```

You can also get the whole _os_ object to have cross-platform access to things
like `homedir` `hostname` `userInfo.username` and others.

```shell
> npx imfo | jq -r '.userInfo.username'
kronk

> npx imfo | jq -r '.tmpdir'
/tmp

> npx imfo | jq -r '.cpus | length'
8
```

