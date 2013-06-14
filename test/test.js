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

        t.ok(!error,'should not have error');
        t.equals(arr.length,5,'should have had 5 data events');

        var values = [];

        db.createValueStream().on('data',function(v){
          values.push(v);
        }).on('end',function(){
          t.equals(values.length,arr.length,'should have correct number of values');
          t.equals(values[values.length-1],arr[arr.length-1].value,'value should be correct from value stream');

          db.close();
          server.close();
          t.end();

        });

      });
    });

  });
});


