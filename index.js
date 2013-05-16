var multilevel = require('multilevel');
var reconnect = require('reconnect');
var whenConnected = require('when-connected');
var through = require('through');


module.exports = function(options){

  var secretProperty = Math.random()+''+Date.now();

  var connectCb;
  // handle net style options.
  if(typeof options === 'number') {

    //port
    // look for ip and options
    options = {port:options};

    if(arguments[1]) {
      if(typeof arguments[1] === 'string'){
        options.host = arguments;
      } else if(typeof arguments[1] === 'function'){
        connectCb = arguments[1];
      }
    }

    if(typeof arguments[2] === 'function') {
      connectCb = arguments[2];
    }
  }

  options = options||{};
  if(options.port === undefined){
    throw new Error("you must specify a port for now. you probably dont want a domain socket named 'undefined'");
  }
  
  // create reconnect and first multilevel client
  var client = multilevel.client();
  var recon = reconnect(options.reconnect,function(stream){
    client = multilevel.client();
    stream.pipe(client).pipe(stream);
  }).connect(options);

  // handle connected property
  var connected = false;
  recon.on('connect',function(){
    connected = true;
  }).on('disconnect',function(){
    connected = false;
  })

  // create the leveldb intterface object.
  var o = {
    isOpen:function(){
      if(!connected) return false;
      return client.isOpen();
    },
    close:function(){
      recon.disconnect();
    }
  };

  var cbopts = {}, streamopts = {stream:true};

  cbopts.retries = options.retries === undefined?1:options.retries;// default to retry
  streamResume = options.resume === undefined?1:options.resume;// default to resume range query streams through 1 disconnect
  
  cbopts.timeout = streamopts.timeout = options.timeout||-1;
  cbopts.reconnect = streamopts.reconnect = recon;
  
  [
    'get',
    'put',
    'del',
    'batch',
    'aproximateSize' 
  ].forEach(function(m){
    o[m] = whenConnected(function(){
      client[m].apply(client,arguments);
    },cbopts);
  });

  [
    'createKeyStream',
    'createValueStream',
    'createReadStream'
  ].forEach(function(m){
    o[m] = whenConnected(function(){

      var args = [].slice.call(arguments);
      if(streamResume) {

        var t;
        if(args[args.length-1] && args[args.length-1][secretProperty]) {
          t = args.pop();
        } else {
          t = through(function(data){

            if(m === 'createKeyStream') {
              t.lastKey = data;
            } else {
              t.lastkey = data.key;
            }

            if(m === 'createValueStream') {
              data = data.value;
            }
            
            this.queue(data);
          });
          t.resume = 0;
          t[secretProperty] = 1;
        }

        var s = client[m === 'createValueSream'?'createReadStream':m].apply(client,args);
        
        s.pipe(t,{end:false});

        var resuming = false;
        s.on('error',function(e){
          if(e && e.code === 'E_DISCONNECT'){
            // check resume count
            if(t.resume < streamResume) {
              t.resume++;
              resuming = true;

              // add stream to args.
              args.push(t);
              if(args[0]){ 
                if(args[0].reverse) {
                  args[0].end = t.lastKey+'\xff';// start from exactly before the last key.
                } else {
                  args[0].start = t.lastKey+'\x00';
                }
              } else {
                args[0] = {start:lastKey+'\x00'};// start from exactky after the last key.
              }

              // change range query to start at lastKey
              // ! make sure doesnt include start key in output.
              o[m].apply(o,args);
              // this returns the same stream object that we passed as the last argument.
            }
          }

          t.emit('error',e);

        });

        s.on('end',function(){
          // cleanup last key tracking.
          if(!resuming) t.emit('end');
        });
        return t;

      }

      return client[m].apply(client,arguments);

    },streamopts);

  });

  // todo sublevel/createLiveStream and other madness im too newb to know about yet.

  return o;
}
