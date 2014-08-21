#!/usr/bin/env node

var socketio	= require('socket.io');
var http	= require('http');
var path 	= require('path');
var serialport = require("serialport");
var express	= require('express');


var debug = true;

//==========================================================
// Set default IP and used ports
//==========================================================
var IP = '127.0.0.1';
var HTTP_PORT = 1337;
var BAUDRATE = 57600;
var ARDUINO = "";

//==========================================================
// Check out on which system we're running. Between OSX
// and Linux (ie Yun) we may take different approaches
//==========================================================
var OSX = 'osx';
var LINUX = 'linux';
var BASE_OS = '';
if (process.platform == 'darwin') {
  BASE_OS = OSX;    // OSX
}
if (process.platform == 'linux') {
  BASE_OS = LINUX;  // LINUX (and with that we're assuming it's the Yun)
}
if(debug) console.log("Detected system is " + BASE_OS);

if (BASE_OS == OSX)   ARDUINO = "/dev/tty.usbmodemfa141";
if (BASE_OS == LINUX) ARDUINO = ARDUINO = "/dev/ttyATH0";

//==========================================================
// Initiate Express
// Don't do anything 'fancy' with renderers, just
// make it allow acces to this root folder as the root
// of the webserver
//==========================================================
var app = express();
app.use(express.static(__dirname));

//==========================================================
// Create http server
// Set up paths to identify different devices
// Attach socket.io
//==========================================================
var server = http.createServer(app);
server.listen(HTTP_PORT);
if(debug) console.log("server listening at port " + HTTP_PORT);

var io = socketio.listen(server);
if(!debug) io.set('log level', 0);



//==========================================================
// Create Serial Port
// Set up eventhandlers
//==========================================================
var serialConnected = false;
var SerialPort = serialport.SerialPort;
var serialPort = new SerialPort(ARDUINO, {
  baudrate: BAUDRATE,

  // this parser will only trigger an event after a \n (newline)
  parser: serialport.parsers.readline("\n")
});
serialPort.on("open", function () {
  serialConnected = true;
  if(debug) console.log('Serial port opened');

  serialPort.on('data', function(data) {
    // console.log('data received: ' + data);
    if (data.split(" ")[0] == 'ping') {
      var count = data.split(" ")[1];
      console.log('	From arduino: ping count = ' + count);
      if (isConnected) {
        // alternative: io.sockets.emit()....
        connectedSocket.emit('pingBack', count);
      }

      var ledState = count % 2;
//      console.log('	ledState: ' + ledState);
      serialPort.write(ledState, function(err, results) {
        // console.log('err ' + err);
        // console.log('results ' + results);
      });
    } else {
      console.log(data);
    }
  });

  // Test that serialport is working.
  // For now that entails requesting the Arduino's current ping count
  serialPort.write('2', function(err, results) {
    // console.log('err ' + err);
    // console.log('results ' + results);
  });
});



//==========================================================
// Create Socket.io instance
// Set up eventhandlers
//==========================================================
var isConnected = false;
var connectedSocket = '';
io.sockets.on('connection', function (socket) {
  if(debug) console.log("a user connected");

	connectedSocket = socket;
	isConnected = true;
	
	socket.emit('connected', '');

	socket.on('getPing', function(data) {
		if(debug) console.log("socket trigger 'getPing' >> data: ", data);

    // '2' will be the code for sending back the current internal counter value
    if (serialConnected) serialPort.write("2");
	});

  socket.on('setLed', function(data) {
    if(debug) console.log("socket trigger 'setLed' >> data: ", data);

    // 'data' should be either '1' or '0'.
    // TODO check here if 'data' contains the correct content before blindly sending this off
    if (serialConnected) serialPort.write(data);
  });

	//==========================================================
	// Device disconnected
	//==========================================================
	io.sockets.on('disconnect', function () {
		var numRemaining = Object.keys(connection.manager.roomClients).length - 1;
		if(debug) console.log("Disconnected " + connection.id);
		if (numRemaining < 1) {
			connectedSocket = null;
			isConnected = false;
			if(debug) console.log("all clients disconnected");
		}
	});
});


//==========================================================
// Handle how Node exits 
//==========================================================
process.on('exit', function(){
  if (debug) console.log("exit handler");
  if (serialConnected) {
    if (debug) console.log("  closing serial port..");
    serialPort.close();
  }
});
process.on('SIGINT', function () {
  process.exit();
});