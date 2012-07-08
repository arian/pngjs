"use strict";

var PNGReader = require('./PNGReader');
var Canvas = require('canvas');
var fs = require("fs");
var out = fs.createWriteStream(__dirname + '/test.png');

var file = "html/ubuntu.png";


fs.readFile(file, function(err, bytes){
	if (err) throw err;

	var reader = new PNGReader(bytes);
	reader.parse(function(png){

//		console.log(png.getPixel(545, 30));
		console.log(png.pixels.length);
		console.log(png.width, png.height, png.colors);
		console.log('colorType', png.colorType);
		console.log('bitDepth', png.bitDepth);
		console.log('colors', png.colors);

		var canvas = new Canvas(png.width, png.height);
		var ctx = canvas.getContext('2d');
		var stream = canvas.createPNGStream();

		for (var x = 0; x < png.width; x++){
			for (var y = 0; y < png.height; y++){
				var colors = png.getPixel(x, y);
//				if (colors[3] > 0) console.log(colors[3]);
				var fillStyle = "rgba(" + colors.slice(0, 3).join(',') + ", " + colors[3] / 255 + ")";
//				console.log(fillStyle);
				ctx.fillStyle = fillStyle;
				ctx.fillRect(x, y, 1, 1);
			}
		}

		stream.on('data', function(chunk){
			out.write(chunk);
		});

		stream.on('end', function(){
			console.log('saved png');
		});

		console.log(png.getPixel(10, 10));

	});

});


