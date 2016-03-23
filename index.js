var util = require('util');
var spawn = require('child_process').spawn;
var EventEmitter = require('events').EventEmitter;

var InkscapeQueue = new EventEmitter();
InkscapeQueue.queue = [];
InkscapeQueue.push = function (obj) {
  this.queue.push(obj);
  this.emit('pushed');
};

InkscapeQueue.shift = function () {
  var obj = this.queue.shift();
  this.emit('popped', obj);
  return obj;
};

InkscapeQueue.getLength = function () {
  return this.queue.length;
};

var Oodako = {};
  
/**
 * the inkscape process
 * @type {ChildProcess}
 */
Oodako.inkscapeProcesses = [];

Oodako.queue = InkscapeQueue;

Oodako.isReady = false;

Oodako.init = function (path, callback) {
  var self = this;
  path = path || "inkscape";
  if (path && typeof path === "function") {
    callback = path;
  }
  this.queue = InkscapeQueue;
  this.startProcess(path, callback);
};

Oodako.startProcess = function (path, callback) {
  var self = this;
  var isStarted = false;
  path = path || "inkscape";
  if (path && typeof path === "function") {
    callback = path;
  }

  // spawn inkscape process in interactive shell mode (--shell)
  // and without a gui (-z)
  var inkscapeProcess = spawn('inkscape', ['-z', '--shell']);

  // add process to list of process
  this.inkscapeProcesses.push(inkscapeProcess);

  function promptIsReady(data) {
    var dataString = data.toString();
    if (dataString == '>' || dataString.slice(-1) == '>') {
      // prompt is ready, get next queue item
      if (self.queue.getLength() > 0) {
        var cmd = self.queue.shift();
        self.execute(inkscapeProcess, cmd.command, cmd.callback);
      } else {
        if (self.inkscapeProcesses.length > 1) {
          inkscapeProcess.stdin.end();
        } else {
          self.queue.once('pushed', function () {
            if (self.queue.getLength() > 0) {
              var cmd = self.queue.shift();
              self.execute(inkscapeProcess, cmd.command, cmd.callback);
            }
          });
        }
      }

      // on first run call callback to notify of successful start
      if (!isStarted) {
        callback && callback();
        isStarted = true;
      }
      //inkscapeProcess.stdout.removeListener('data', promptIsReady);
      inkscapeProcess.stderr.removeListener('data', errorCallback);
    }
  }

  function errorCallback(data) {
    callback && callback(new Error(data.toString()));
    inkscapeProcess.stdout.removeListener('data', promptIsReady);
    inkscapeProcess.stderr.removeListener('data', errorCallback);
  }
  inkscapeProcess.stderr.on('data', errorCallback);
  inkscapeProcess.stdout.on('data', promptIsReady);
};

Oodako.exec = function (cmd, callback) {
  var self = this;
  if (typeof cmd !== 'string') {
    throw new Error('A command must be provided to Oodako.exec().');
  }

  // add command to queue
  // triggers pushed event on queue
  this.queue.push({
    command: cmd,
    callback: callback
  });

  // if queue outnumbers process more than 5:1 then add another process
  if ((this.queue.getLength() / 5) > this.inkscapeProcesses.length) {
    self.startProcess();
  }
  
};

/**
 * Executes a command using the given process
 * @param  {[type]} process [description]
 * @param  {[type]}   cmd      [description]
 * @param  {Function} callback [description]
 */
Oodako.execute = function (process, cmd, callback) {
  function promptIsReady(data) {
    var dataString = data.toString();
    if (dataString == '>' || dataString.slice(-1) == '>') {
      callback && callback();
      process.stdout.removeListener('data', promptIsReady);
      process.stderr.removeListener('data', errorCallback);
    }
  }

  function errorCallback(data) {
    callback && callback(new Error(data.toString()));
    process.stdout.removeListener('data', promptIsReady);
    process.stderr.removeListener('data', errorCallback);
  }
  process.stderr.on('data', errorCallback);
  process.stdout.on('data', promptIsReady);

  process.stdin.write(cmd);

  // if the command did not end with a new line
  // terminating the command
  if ("\n" != cmd.slice(-1)) {
    process.stdin.write('\n');
  }
};

Oodako.end = function () {
  this.process.stdin.end();
};

/*
var start = new Date();

Oodako.init(function () {
  for (var i = 0; i < 100; i++) {
    testExec(i);
  }
});

function testExec(i) {
  Oodako.exec('-w 2552 -h 1651 -b "white" "/path/to/svg/" -z -e "/path/to/png/' + i + '.png"',
  function (err) {
    if (err) {
      console.log('Exec ', i, 'NOT successful');
    } else {
      var end = new Date();
      console.log("Operation took " + ((end.getTime() - start.getTime()) / 1000) + "sec");
      console.log('Exec ', i, ' successful');
    }
  });
}
*/

module.exports = Oodako;