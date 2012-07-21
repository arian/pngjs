
build-browser:
	@./node_modules/.bin/wrup -r PNGReader ./PNGReader.js

build-browser-min:
	@./node_modules/.bin/wrup -r PNGReader ./PNGReader.js --compress

build-browser-watch:
	@./node_modules/.bin/wrup -r PNGReader ./PNGReader.js --output html/png.js --watch

.PHONY: build-browser build-browser-watch
