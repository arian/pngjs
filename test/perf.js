"use strict";

var PNGReader = require('../PNGReader');
var fs = require("fs");
var profiler = require('profiler');

var file = __dirname + "/../html/ubuntu.png";

fs.readFile(file, function(err, bytes){
	if (err) throw err;

	profiler.resume();

	var reader = new PNGReader(bytes);
	reader.parse(function(png){

		console.log('pixels', png.pixels.length);
		console.log('width', png.width, 'height', png.height, 'colors', png.colors);
		console.log('colorType', png.colorType);
		console.log('bitDepth', png.bitDepth);
		console.log('colors', png.colors);

	});

});
