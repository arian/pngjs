
PNG.js
======

PNG.js is a PNG decoder fully written in JavaScript. It works in Node.js as
well as in (modern) browsers.

Usage
-----

``` js
var PNGReader = require('png.js');

var reader = new PNGReader(bytes);
reader.parse(function(png){
	console.log(png);
});

```

Or with options:

``` js
reader.parse({
	data: false
}, function(png){
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
// but also
png.getBitDepth();
png.getColorType();
png.getCompressionMethod();
png.getFilterMethod();
png.getInterlaceMethod();
png.getPalette();
```

