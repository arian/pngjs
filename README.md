
PNG.js
======

PNG.js is a PNG decoder fully written in JavaScript. It works in Node.js as
well as in (modern) browsers.

Usage
-----

``` js
var PNGReader = require('png.js');

var reader = new PNGReader(bytes);
reader.parse(function(err, png){
	if (err) throw err;
	console.log(png);
});

```

Or with options:

``` js
reader.parse({
	data: false
}, function(err, png){
	if (err) throw err;
	console.log(png);
});

```

Currently the only option is:

- `data` (*boolean*) - should it read the pixel data, or only the image information.

### PNG object

The PNG object is passed in the callback. It contains all the data extracted
from the image.

``` js
// most importantly
png.getWidth();
png.getHeight();
png.getPixel(x, y); // [red, blue, green, alpha]
png.getRGBA8Array(); // [r1, g1, b1, a1, r2, b2, g2, a2, ... ] - Same as canvas.getImageData
// but also
png.getBitDepth();
png.getColorType();
png.getCompressionMethod();
png.getFilterMethod();
png.getInterlaceMethod();
png.getPalette();
```

Using PNGReader in Node.js
--------------------------

PNGReader accepts an `Buffer` object, returned by `fs.readFile`, for example:

``` js
fs.readFile('test.png', function(err, buffer){

	var reader = new PNGReader(buffer);
	reader.parse(function(err, png){
		if (err) throw err;
		console.log(png);
	});

});
```

Using PNGReader in the Browser
------------------------------

PNGReader accepts a byte string, array of bytes or an ArrayBuffer.

For example using FileReader with file input fields:

```js
var reader = new FileReader();

reader.onload = function(event){
	var reader = new PNGReader(event.target.result);
	reader.parse(function(err, png){
		if (err) throw err;
		console.log(png);
	});
};

fileInputElement.onchange = function(){
	reader.readAsArrayBuffer(fileInputElement.files[0]);
	// or, but less optimal
	reader.readAsBinaryString(fileInputElement.files[0]);
};
```

Or instead of using input elements, XHR can also be used:

```js
var xhr = new XMLHttpRequest();
xhr.open('GET', 'image.png', true);
xhr.responseType = 'arraybuffer';

xhr.onload = function(e){
	if (this.status == 200){
		var reader = new PNGReader(this.response);
		reader.parse(function(err, png){
			if (err) throw err;
			console.log(png);
		});
	}
};

xhr.send();
```

Building Browser Version
------------------------

PNG.js uses CommonJS modules which can be used in browsers after building it
with [browserify](http://browserify.org/):

	browserify ./PNGReader.js -s PNGReader
