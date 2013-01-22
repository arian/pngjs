"use strict";

var PNGReader = require('../PNGReader');
var fs = require("fs");

var file = __dirname + "/../html/ubuntu-screenshot.png";

fs.readFile(file, function(err, bytes){
	if (err) throw err;

	var t = process.hrtime();

	var reader = new PNGReader(bytes);
	reader.parse(function(err, png){

		t = process.hrtime(t);

		console.log('benchmark took %d seconds and %d ms', t[0], t[1] / 1e6);

		console.log('pixels', png.pixels.length);
		console.log('width', png.width, 'height', png.height, 'colors', png.colors);
		console.log('colorType', png.colorType);
		console.log('bitDepth', png.bitDepth);
		console.log('colors', png.colors);

		t = process.hrtime();

		for (var i = 0; i < png.width; i++){
			for (var j = 0; j < png.height; j++){
				png.getPixel(i, j);
			}
		}

		t = process.hrtime(t);
		console.log('getPixel benchmark took %d seconds and %d ms', t[0], t[1] / 1e6);

	});

});
