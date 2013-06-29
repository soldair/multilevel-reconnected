var net = require('net')
, multilevel = require('multilevel')
, MemDOWN = require('memdown')
, levelup = require('levelup')
, factory = function (location) { return new MemDOWN(location) }

var through = require('through');

var db = levelup('./db', { db: factory });

var server;
server = net.createServer(function(con){
  mdb = multilevel.server(db);
  con.pipe(mdb).pipe(through(function(data){
    this.queue(data);
  },function(){
    // doesnt end!
  })).pipe(con);
  server.con = con;
}).listen(0,function(){
  address = this.address();
  process.send(address); // send to parent process.
});

