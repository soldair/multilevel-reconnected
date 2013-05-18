var test = require('tap').test;

var net = require('net')
, client = require('../index')
, multilevel = require('multilevel')
, MemDOWN = require('memdown')
, levelup = require('levelup')
, factory = function (location) { return new MemDOWN(location) }


test("test can db stuff",function(t){
  var db = levelup('/does/not/matter', { db: factory })
  var address,server;

  server = net.createServer(function(con){

    // connect server to connection.
    con.pipe(multilevel.server(db)).pipe(con);

  }).listen(0,function(){

    address = this.address();
    // create reconnecting client.
    var db = client({port:this.address().port});

    db.batch([
      { type: 'put', key: 'name1', value: 'a' }
      ,{ type: 'put', key: 'name2', value: 'b' }
      ,{ type: 'put', key: 'name3', value: 'c' }
      ,{ type: 'put', key: 'name4', value: 'd' }
      ,{ type: 'put', key: 'name5', value: 'e' }
    ],function(err){

      t.ok(!err,'should have put test data');

      var s = db.createReadStream();

      var error;
      var arr = [];
      s.on('data',function(data){
        arr.push(data);
      })

      s.on('error',function(err){
        error = err;
      });

      s.on('end',function(){

        db.close();
        server.close();

        t.ok(!error,'shoudl not have error');
        t.equals(arr.length,5,'should have had 5 data events');
        t.end();

      });
    });

  });
});



test("test can resume on",function(t){

  var db = levelup('/does/not/matter', { db: factory });
  var server , address, mdb;

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

        console.log('data',data);

        arr.push(data);
        if(arr.length === 1){
          server.close();
          // re create server. client should reconnect and resume streaming.
          server = makeServer(function(){
            console.log('server listening again');
          });
        }
      });

      stream.on('end',function(){

        console.log('end!');

        db.close();
        server.close();

        t.equals(arr.length,5,'should have all 5 data events even though server crashed in the middle');
        t.end();

      });
    
    });
  });

  function makeServer(cb){
    return net.createServer(function(con){
      mdb = multilevel.server(db);
      con.pipe(mdb).pipe(con)
    }).listen(address?address.port:0,function(){
      address = this.address();
      if(cb) cb();
    });
  }

});
