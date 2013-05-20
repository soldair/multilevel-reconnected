var multilevel = require('multilevel');
var reconnect = require('reconnect');
var whenConnected = require('when-connected');
var through = require('through');


module.exports = function(options){

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

  var client = multilevel.client();

  if(!options.reconnect) {
    // create reconnect and first multilevel client
    var recon = reconnect(options.reconnect,function(stream){      
      client = multilevel.client();
      stream.pipe(client).pipe(stream);
    }).connect(options);

  } else {
    options.reconnect.on('connect',function(){
      client = multilevel.client();
      stream.pipe(client).pipe(stream);
    });
  }

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
      if(streamResume) {
        // resumable streams always need key. i could just not support resume for value streams but i kinda want them to work correctly.
        return client[m === 'createValueSream'?'createReadStream':m].apply(client,arguments);
      }
      return client[m].apply(client,arguments);
    },streamopts);

    if(streamResume) {
      var getStream = o[m];
      o[m] = function(){

        var args = Array.prototype.slice.call(arguments);
        var s = getStream.apply(this,arguments);

        var lastKey, resumes = 0;

        var t = through(function(data){

          if(m === 'createKeyStream') {
            lastKey = data;
          } else {
            lastKey = data.key;
          }

          if(m === 'createValueStream') {
            data = data.value;
          }
          
          this.queue(data);
        });
        
        pipeReconnectingStream(s,t);         

        return t;

        function pipeReconnectingStream(s,t){
          s.pipe(t,{end:false});
          var piped = true;
          var resuming = false;
          s.on('error',function(e){

            if(e && e.code === 'E_DISCONNECT' && resumes < streamResume) {

              resumes++;
              resuming = true;

              // add stream to args.
              // change range query to start at lastKey
              // make sure doesnt include start key in output.
              if(args[0]){
                if(!lastKey) lastKey = ''; 
                if(args[0].reverse) {
                  args[0].end = lastKey+'\xff';// start from exactly before the last key.
                } else {
                  args[0].start = lastKey+'\x00';
                }
              } else {
                args[0] = {start:lastKey+'\x00'};// start from exactky after the last key.
              }

              piped = false;
              

              pipeReconnectingStream(getStream.apply(o,args),t);
              // this returns the same stream object that we passed as the last argument.
              return;
            }

            t.emit('error',e);
          });

          s.on('end',function(){
            // cleanup last key tracking.
            if(piped) t.emit('end');
          });
        }

      };
    }
  });

  // todo sublevel/createLiveStream and other madness im too newb to know about yet.
  return o;
}
