var test = require('tap').test

var net = require('net')
, client = require('../index')
, multilevel = require('multilevel')
, MemDOWN = require('memdown')
, levelup = require('levelup')
, factory = function (location) { return new MemDOWN(location) }
, child_process = require('child_process')

test("fix the effin things",function(t){

  //
  // so i think that if im streaming and the server crashes i try to crash this process.
  neverendingStreamServer(function(err,cp,address){
    console.log(address);
    var db = client(address);

    

    db.createReadStream().on('data',function(data){
      console.log('got data');
    });

    cp.kill();

    setTimeout(function(){
      t.end();
    },1000);
  });
  
});


function neverendingStreamServer(cb){
  var cp = child_process.fork(__dirname+"/fixture/server.js");
  cp.on('message',function(address){
    cb(false,cp,address);
  });
  return cp;
  
}
