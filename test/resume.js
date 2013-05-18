var test = require('tap').test;

var net = require('net')
, client = require('../index')
, multilevel = require('multilevel')
, MemDOWN = require('memdown')
, levelup = require('levelup')
, factory = function (location) { return new MemDOWN(location) }


test("test can resume stream after server disconnect+reconnect",function(t){

  var db = levelup('./db', { db: factory });
  var server, address, mdb;

  server = makeServer(function(){
    var db = client({port:address.port,resume:1,retries:1});
    // put in test data.
    db.batch([
       { type: 'put', key: 'name1', value: 'a' }
      ,{ type: 'put', key: 'name2', value: 'b' }
      ,{ type: 'put', key: 'name3', value: 'c' }
      ,{ type: 'put', key: 'name4', value: 'd' }
      ,{ type: 'put', key: 'name5', value: 'e' }
    ],function(){

      // pause the multlevel server.
      mdb.pause();// lets one data event through.

      var arr = [];
      var stream = db.createReadStream();

      stream.on('data',function(data){

        arr.push(data);
        if(arr.length === 1){
          // set server to close.
          server.close(function(){

            // re create server. client should reconnect and resume streaming.
            server = makeServer(function(){
              t.ok(arr.length < 5,'shoudld not have 5 items yet or im not testing reconnect');
            });

          });

          //destroy multilevel connection from the server's side
          server.con.destroy();
        }

      });

      stream.on('end',function(){

        db.close();
        server.close();

        t.equals(arr.length,5,'should have all 5 data events even though server crashed in the middle');
        t.end();

      });
    
    });
  });

  function makeServer(cb){
    var server;
    server = net.createServer(function(con){
      mdb = multilevel.server(db);
      con.pipe(mdb).pipe(con);
      server.con = con;
    }).listen(address?address.port:0,function(){
      address = this.address();
      if(cb) cb();
    });
    return server;
  }

});
