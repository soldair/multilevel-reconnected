
[![Build Status](https://secure.travis-ci.org/soldair/multilevel-reconnected.png)](http://travis-ci.org/soldair/multilevel-reconnected)

multilevel-reconnected
======================

This is a reconnecting and stream resuming multilevel client wrapper. Right now it provides a more limited api with no sublevels but it can actually be used in long running server apps.

[multilevel](https://github.com/juliangruber/multilevel/blob/master/README.md) is a [leveldb](https://github.com/rvagg/node-levelup/blob/master/README.md) client wrapper. multilevel-reconnected wraps multilevel but for now provides a reduced api .

the most important todo is createWriteStream.

example
-------

```js
var clients = require('mulitlevel-reconnected');

var client = clients({
  // ALL of these options are passed to reconnect.connect. this is probably not something i want to keep doing.
  // unless you pass an instance of reconnect
  reconnect:[optional a disconnected reconnect instance] or [optional object of options to pass to reconnect],
  //
  // options like these would be used to connect via net through reconnect.
  //
  port: ,// right now i have hardcoded this to use net connect. this is wrong and will be fixed.
  //
  host: ,// just like net. if its there will try to connect to said host.
  //
  // these options are used to configure retires and error behavior.
  //
  retries:1 [default], // if the server disconnected before firing the callback of a method 
  // the method will be retried up to retires times before calling back with E_DISCONNECT
  // 
  resume:1 [default],  // if the server crashes how many times should an active stream be resumed before issuing and E_DISCONNECT error.
  // streaming methods such as createKeyStream createValueStream and createReadStream take advantage of this.
  // NOTE: if you use resume calls to createValueStream will really call createReadStream on multilevel for key tracking and emit only the values.
  //
  timeout:10000, // if a callback method takes greater than timeout ms to callback it will be called back with an E_TIMEDOUT error
  // if a stream waits timeout ms for the server to connect an E_TIMEDOUT error will be emitted. once it is connected it will not timeout.
  // 
});

// -1 for retry/timeout/resume options will make it infinite. 0 timeout is the same as no timeout. 

client.createReadStream().on('data',console.log);

```

api
---

see levelup for details.

- get
- put
- batch
- del

- createReadStream
- createValueStream
- createKeyStream



 
