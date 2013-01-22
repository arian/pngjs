(function(modules) {
    var cache = {}, require = function(id) {
        var module = cache[id];
        if (!module) {
            module = cache[id] = {};
            var exports = module.exports = {};
            modules[id].call(exports, require, module, exports, window);
        }
        return module.exports;
    };
    window["PNGReader"] = require("0");
})({
    "0": function(require, module, exports, global) {
        "use strict";
        var PNG = require("1");
        var isNode = typeof process !== "undefined" && !process.browser;
        var inflate = function() {
            if (isNode) {
                var zlib = null;
                return function(data, callback) {
                    return zlib.inflate(new Buffer(data), callback);
                };
            } else {
                var stream = require("2");
                return function(data, callback) {
                    data = new stream.FlateStream(new stream.Stream(data));
                    callback(null, data.getBytes());
                };
            }
        }();
        var ByteBuffer = isNode ? Buffer : function() {
            if (typeof ArrayBuffer == "function") {
                return function(length) {
                    return new Uint8Array(new ArrayBuffer(length));
                };
            } else {
                return function(length) {
                    return new Array(length);
                };
            }
        }();
        var slice = Array.prototype.slice;
        var toString = Object.prototype.toString;
        function equalBytes(a, b) {
            if (a.length != b.length) return false;
            for (var l = a.length; l--; ) if (a[l] != b[l]) return false;
            return true;
        }
        function readUInt32(buffer, offset) {
            return (buffer[offset] << 24) + (buffer[offset + 1] << 16) + (buffer[offset + 2] << 8) + (buffer[offset + 3] << 0);
        }
        function readUInt16(buffer, offset) {
            return (buffer[offset + 1] << 8) + (buffer[offset] << 0);
        }
        function readUInt8(buffer, offset) {
            return buffer[offset] << 0;
        }
        function bufferToString(buffer) {
            var str = "";
            for (var i = 0; i < buffer.length; i++) {
                str += String.fromCharCode(buffer[i]);
            }
            return str;
        }
        var PNGReader = function(bytes) {
            if (typeof bytes == "string") {
                var bts = bytes;
                bytes = new Array(bts.length);
                for (var i = 0, l = bts.length; i < l; i++) {
                    bytes[i] = bts[i].charCodeAt(0);
                }
            } else {
                var type = toString.call(bytes).slice(8, -1);
                if (type == "ArrayBuffer") bytes = new Uint8Array(bytes);
            }
            this.i = 0;
            this.bytes = bytes;
            this.png = new PNG;
            this.dataChunks = [];
        };
        PNGReader.prototype.readBytes = function(length) {
            var end = this.i + length;
            if (end > this.bytes.length) {
                throw new Error("Unexpectedly reached end of file");
            }
            var bytes = slice.call(this.bytes, this.i, end);
            this.i = end;
            return bytes;
        };
        PNGReader.prototype.decodeHeader = function() {
            if (this.i !== 0) {
                throw new Error("file pointer should be at 0 to read the header");
            }
            var header = this.readBytes(8);
            if (!equalBytes(header, [ 137, 80, 78, 71, 13, 10, 26, 10 ])) {
                throw new Error("invalid PNGReader file (bad signature)");
            }
            this.header = header;
        };
        PNGReader.prototype.decodeChunk = function() {
            var length = readUInt32(this.readBytes(4), 0);
            if (length < 0) {
                throw new Error("Bad chunk length " + (4294967295 & length));
            }
            var type = bufferToString(this.readBytes(4));
            var chunk = this.readBytes(length);
            var crc = this.readBytes(4);
            switch (type) {
              case "IHDR":
                this.decodeIHDR(chunk);
                break;
              case "PLTE":
                this.decodePLTE(chunk);
                break;
              case "IDAT":
                this.decodeIDAT(chunk);
                break;
              case "IEND":
                this.decodeIEND(chunk);
                break;
            }
            return type;
        };
        PNGReader.prototype.decodeIHDR = function(chunk) {
            var png = this.png;
            png.setWidth(readUInt32(chunk, 0));
            png.setHeight(readUInt32(chunk, 4));
            png.setBitDepth(readUInt8(chunk, 8));
            png.setColorType(readUInt8(chunk, 9));
            png.setCompressionMethod(readUInt8(chunk, 10));
            png.setFilterMethod(readUInt8(chunk, 11));
            png.setInterlaceMethod(readUInt8(chunk, 12));
        };
        PNGReader.prototype.decodePLTE = function(chunk) {
            this.png.setPalette(chunk);
        };
        PNGReader.prototype.decodeIDAT = function(chunk) {
            this.dataChunks.push(chunk);
        };
        PNGReader.prototype.decodeIEND = function() {};
        PNGReader.prototype.decodePixels = function(callback) {
            var png = this.png;
            var reader = this;
            var length = 0;
            var i, j, k, l;
            for (l = this.dataChunks.length; l--; ) length += this.dataChunks[l].length;
            var data = new ByteBuffer(length);
            for (i = 0, k = 0, l = this.dataChunks.length; i < l; i++) {
                var chunk = this.dataChunks[i];
                for (j = 0; j < chunk.length; j++) data[k++] = chunk[j];
            }
            inflate(data, function(err, data) {
                if (err) return callback(err);
                try {
                    if (png.getInterlaceMethod() === 0) {
                        reader.interlaceNone(data);
                    } else {
                        reader.interlaceAdam7(data);
                    }
                } catch (e) {
                    return callback(e);
                }
                callback();
            });
        };
        PNGReader.prototype.interlaceNone = function(data) {
            var png = this.png;
            var bpp = Math.max(1, png.colors * png.bitDepth / 8);
            var cpr = bpp * png.width;
            var pixels = new ByteBuffer(bpp * png.width * png.height);
            var scanline;
            var offset = 0;
            for (var i = 0; i < data.length; i += cpr + 1) {
                scanline = slice.call(data, i + 1, i + cpr + 1);
                switch (readUInt8(data, i)) {
                  case 0:
                    this.unFilterNone(scanline, pixels, bpp, offset, cpr);
                    break;
                  case 1:
                    this.unFilterSub(scanline, pixels, bpp, offset, cpr);
                    break;
                  case 2:
                    this.unFilterUp(scanline, pixels, bpp, offset, cpr);
                    break;
                  case 3:
                    this.unFilterAverage(scanline, pixels, bpp, offset, cpr);
                    break;
                  case 4:
                    this.unFilterPaeth(scanline, pixels, bpp, offset, cpr);
                    break;
                  default:
                    throw new Error("unkown filtered scanline");
                }
                offset += cpr;
            }
            png.pixels = pixels;
        };
        PNGReader.prototype.interlaceAdam7 = function(data) {
            throw new Error("Adam7 interlacing is not implemented yet");
        };
        PNGReader.prototype.unFilterNone = function(scanline, pixels, bpp, of, length) {
            for (var i = 0, to = length; i < to; i++) {
                pixels[of + i] = scanline[i];
            }
        };
        PNGReader.prototype.unFilterSub = function(scanline, pixels, bpp, of, length) {
            var i = 0;
            for (; i < bpp; i++) pixels[of + i] = scanline[i];
            for (; i < length; i++) {
                pixels[of + i] = scanline[i] + pixels[of + i - bpp] & 255;
            }
        };
        PNGReader.prototype.unFilterUp = function(scanline, pixels, bpp, of, length) {
            var i = 0, byte, prev;
            if (of - length < 0) for (; i < length; i++) {
                pixels[of + i] = scanline[i];
            } else for (; i < length; i++) {
                byte = scanline[i];
                prev = pixels[of + i - length];
                pixels[of + i] = byte + prev & 255;
            }
        };
        PNGReader.prototype.unFilterAverage = function(scanline, pixels, bpp, of, length) {
            var i = 0, byte, prev, prior;
            if (of - length < 0) {
                for (; i < bpp; i++) {
                    pixels[of + i] = scanline[i];
                }
                for (; i < length; i++) {
                    pixels[of + i] = scanline[i] + (pixels[of + i - bpp] >> 1) & 255;
                }
            } else {
                for (; i < bpp; i++) {
                    pixels[of + i] = scanline[i] + (pixels[of - length + i] >> 1) & 255;
                }
                for (; i < length; i++) {
                    byte = scanline[i];
                    prev = pixels[of + i - bpp];
                    prior = pixels[of + i - length];
                    pixels[of + i] = byte + (prev + prior >> 1) & 255;
                }
            }
        };
        PNGReader.prototype.unFilterPaeth = function(scanline, pixels, bpp, of, length) {
            var i = 0, raw, a, b, c, p, pa, pb, pc, pr;
            if (of - length < 0) {
                for (; i < bpp; i++) {
                    pixels[of + i] = scanline[i];
                }
                for (; i < length; i++) {
                    pixels[of + i] = scanline[i] + pixels[of + i - bpp] & 255;
                }
            } else {
                for (; i < bpp; i++) {
                    pixels[of + i] = scanline[i] + pixels[of + i - length] & 255;
                }
                for (; i < length; i++) {
                    raw = scanline[i];
                    a = pixels[of + i - bpp];
                    b = pixels[of + i - length];
                    c = pixels[of + i - length - bpp];
                    p = a + b - c;
                    pa = Math.abs(p - a);
                    pb = Math.abs(p - b);
                    pc = Math.abs(p - c);
                    if (pa <= pb && pa <= pc) pr = a; else if (pb <= pc) pr = b; else pr = c;
                    pixels[of + i] = raw + pr & 255;
                }
            }
        };
        PNGReader.prototype.parse = function(options, callback) {
            if (typeof options == "function") callback = options;
            if (typeof options != "object") options = {};
            try {
                this.decodeHeader();
                while (this.i < this.bytes.length) {
                    var type = this.decodeChunk();
                    if (type == "IHDR" && options.data === false || type == "IEND") break;
                }
                var png = this.png;
                this.decodePixels(function(err) {
                    callback(err, png);
                });
            } catch (e) {
                callback(e);
            }
        };
        module.exports = PNGReader;
    },
    "1": function(require, module, exports, global) {
        "use strict";
        var PNG = function() {
            this.width = 0;
            this.height = 0;
            this.bitDepth = 0;
            this.colorType = 0;
            this.compressionMethod = 0;
            this.filterMethod = 0;
            this.interlaceMethod = 0;
            this.colors = 0;
            this.alpha = false;
            this.pixelBits = 0;
            this.palette = null;
            this.pixels = null;
        };
        PNG.prototype.getWidth = function() {
            return this.width;
        };
        PNG.prototype.setWidth = function(width) {
            this.width = width;
        };
        PNG.prototype.getHeight = function() {
            return this.height;
        };
        PNG.prototype.setHeight = function(height) {
            this.height = height;
        };
        PNG.prototype.getBitDepth = function() {
            return this.bitDepth;
        };
        PNG.prototype.setBitDepth = function(bitDepth) {
            if ([ 2, 4, 8, 16 ].indexOf(bitDepth) === -1) {
                throw new Error("invalid bith depth " + bitDepth);
            }
            this.bitDepth = bitDepth;
        };
        PNG.prototype.getColorType = function() {
            return this.colorType;
        };
        PNG.prototype.setColorType = function(colorType) {
            var colors = 0, alpha = false;
            switch (colorType) {
              case 0:
                colors = 1;
                break;
              case 2:
                colors = 3;
                break;
              case 3:
                colors = 1;
                break;
              case 4:
                colors = 2;
                alpha = true;
                break;
              case 6:
                colors = 4;
                alpha = true;
                break;
              default:
                throw new Error("invalid color type");
            }
            this.colors = colors;
            this.alpha = alpha;
            this.colorType = colorType;
        };
        PNG.prototype.getCompressionMethod = function() {
            return this.compressionMethod;
        };
        PNG.prototype.setCompressionMethod = function(compressionMethod) {
            if (compressionMethod !== 0) {
                throw new Error("invalid compression method " + compressionMethod);
            }
            this.compressionMethod = compressionMethod;
        };
        PNG.prototype.getFilterMethod = function() {
            return this.filterMethod;
        };
        PNG.prototype.setFilterMethod = function(filterMethod) {
            if (filterMethod !== 0) {
                throw new Error("invalid filter method " + filterMethod);
            }
            this.filterMethod = filterMethod;
        };
        PNG.prototype.getInterlaceMethod = function() {
            return this.interlaceMethod;
        };
        PNG.prototype.setInterlaceMethod = function(interlaceMethod) {
            if (interlaceMethod !== 0 && interlaceMethod !== 1) {
                throw new Error("invalid interlace method " + interlaceMethod);
            }
            this.interlaceMethod = interlaceMethod;
        };
        PNG.prototype.setPalette = function(palette) {
            if (palette.length % 3 !== 0) {
                throw new Error("incorrect PLTE chunk length");
            }
            if (palette.length > Math.pow(2, this.bitDepth) * 3) {
                throw new Error("palette has more colors than 2^bitdepth");
            }
            this.palette = palette;
        };
        PNG.prototype.getPalette = function() {
            return this.palette;
        };
        PNG.prototype.getPixel = function(x, y) {
            if (!this.pixels) throw new Error("pixel data is empty");
            if (x >= this.width || y >= this.height) {
                throw new Error("x,y position out of bound");
            }
            var i = this.colors * this.bitDepth / 8 * (y * this.width + x);
            var pixels = this.pixels;
            switch (this.colorType) {
              case 0:
                return [ pixels[i], pixels[i], pixels[i], 255 ];
              case 2:
                return [ pixels[i], pixels[i + 1], pixels[i + 2], 255 ];
              case 3:
                return [ this.palette[pixels[i] * 3 + 0], this.palette[pixels[i] * 3 + 1], this.palette[pixels[i] * 3 + 2], 255 ];
              case 4:
                return [ pixels[i], pixels[i], pixels[i], pixels[i + 1] ];
              case 6:
                return [ pixels[i], pixels[i + 1], pixels[i + 2], pixels[i + 3] ];
            }
        };
        module.exports = PNG;
    },
    "2": function(require, module, exports, global) {
        "use strict";
        var Stream = function StreamClosure() {
            function Stream(arrayBuffer, start, length, dict) {
                this.bytes = new Uint8Array(arrayBuffer);
                this.start = start || 0;
                this.pos = this.start;
                this.end = start + length || this.bytes.length;
                this.dict = dict;
            }
            Stream.prototype = {
                get length() {
                    return this.end - this.start;
                },
                getByte: function Stream_getByte() {
                    if (this.pos >= this.end) return null;
                    return this.bytes[this.pos++];
                },
                getBytes: function Stream_getBytes(length) {
                    var bytes = this.bytes;
                    var pos = this.pos;
                    var strEnd = this.end;
                    if (!length) return bytes.subarray(pos, strEnd);
                    var end = pos + length;
                    if (end > strEnd) end = strEnd;
                    this.pos = end;
                    return bytes.subarray(pos, end);
                },
                lookChar: function Stream_lookChar() {
                    if (this.pos >= this.end) return null;
                    return String.fromCharCode(this.bytes[this.pos]);
                },
                getChar: function Stream_getChar() {
                    if (this.pos >= this.end) return null;
                    return String.fromCharCode(this.bytes[this.pos++]);
                },
                skip: function Stream_skip(n) {
                    if (!n) n = 1;
                    this.pos += n;
                },
                reset: function Stream_reset() {
                    this.pos = this.start;
                },
                moveStart: function Stream_moveStart() {
                    this.start = this.pos;
                },
                makeSubStream: function Stream_makeSubStream(start, length, dict) {
                    return new Stream(this.bytes.buffer, start, length, dict);
                },
                isStream: true
            };
            return Stream;
        }();
        var DecodeStream = function DecodeStreamClosure() {
            function DecodeStream() {
                this.pos = 0;
                this.bufferLength = 0;
                this.eof = false;
                this.buffer = null;
            }
            DecodeStream.prototype = {
                ensureBuffer: function DecodeStream_ensureBuffer(requested) {
                    var buffer = this.buffer;
                    var current = buffer ? buffer.byteLength : 0;
                    if (requested < current) return buffer;
                    var size = 512;
                    while (size < requested) size <<= 1;
                    var buffer2 = new Uint8Array(size);
                    for (var i = 0; i < current; ++i) buffer2[i] = buffer[i];
                    return this.buffer = buffer2;
                },
                getByte: function DecodeStream_getByte() {
                    var pos = this.pos;
                    while (this.bufferLength <= pos) {
                        if (this.eof) return null;
                        this.readBlock();
                    }
                    return this.buffer[this.pos++];
                },
                getBytes: function DecodeStream_getBytes(length) {
                    var end, pos = this.pos;
                    if (length) {
                        this.ensureBuffer(pos + length);
                        end = pos + length;
                        while (!this.eof && this.bufferLength < end) this.readBlock();
                        var bufEnd = this.bufferLength;
                        if (end > bufEnd) end = bufEnd;
                    } else {
                        while (!this.eof) this.readBlock();
                        end = this.bufferLength;
                        if (!end) this.buffer = new Uint8Array(0);
                    }
                    this.pos = end;
                    return this.buffer.subarray(pos, end);
                },
                lookChar: function DecodeStream_lookChar() {
                    var pos = this.pos;
                    while (this.bufferLength <= pos) {
                        if (this.eof) return null;
                        this.readBlock();
                    }
                    return String.fromCharCode(this.buffer[this.pos]);
                },
                getChar: function DecodeStream_getChar() {
                    var pos = this.pos;
                    while (this.bufferLength <= pos) {
                        if (this.eof) return null;
                        this.readBlock();
                    }
                    return String.fromCharCode(this.buffer[this.pos++]);
                },
                makeSubStream: function DecodeStream_makeSubStream(start, length, dict) {
                    var end = start + length;
                    while (this.bufferLength <= end && !this.eof) this.readBlock();
                    return new Stream(this.buffer, start, length, dict);
                },
                skip: function DecodeStream_skip(n) {
                    if (!n) n = 1;
                    this.pos += n;
                },
                reset: function DecodeStream_reset() {
                    this.pos = 0;
                }
            };
            return DecodeStream;
        }();
        var FlateStream = function FlateStreamClosure() {
            var codeLenCodeMap = new Uint32Array([ 16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15 ]);
            var lengthDecode = new Uint32Array([ 3, 4, 5, 6, 7, 8, 9, 10, 65547, 65549, 65551, 65553, 131091, 131095, 131099, 131103, 196643, 196651, 196659, 196667, 262211, 262227, 262243, 262259, 327811, 327843, 327875, 327907, 258, 258, 258 ]);
            var distDecode = new Uint32Array([ 1, 2, 3, 4, 65541, 65543, 131081, 131085, 196625, 196633, 262177, 262193, 327745, 327777, 393345, 393409, 459009, 459137, 524801, 525057, 590849, 591361, 657409, 658433, 724993, 727041, 794625, 798721, 868353, 876545 ]);
            var fixedLitCodeTab = [ new Uint32Array([ 459008, 524368, 524304, 524568, 459024, 524400, 524336, 590016, 459016, 524384, 524320, 589984, 524288, 524416, 524352, 590048, 459012, 524376, 524312, 589968, 459028, 524408, 524344, 590032, 459020, 524392, 524328, 59e4, 524296, 524424, 524360, 590064, 459010, 524372, 524308, 524572, 459026, 524404, 524340, 590024, 459018, 524388, 524324, 589992, 524292, 524420, 524356, 590056, 459014, 524380, 524316, 589976, 459030, 524412, 524348, 590040, 459022, 524396, 524332, 590008, 524300, 524428, 524364, 590072, 459009, 524370, 524306, 524570, 459025, 524402, 524338, 590020, 459017, 524386, 524322, 589988, 524290, 524418, 524354, 590052, 459013, 524378, 524314, 589972, 459029, 524410, 524346, 590036, 459021, 524394, 524330, 590004, 524298, 524426, 524362, 590068, 459011, 524374, 524310, 524574, 459027, 524406, 524342, 590028, 459019, 524390, 524326, 589996, 524294, 524422, 524358, 590060, 459015, 524382, 524318, 589980, 459031, 524414, 524350, 590044, 459023, 524398, 524334, 590012, 524302, 524430, 524366, 590076, 459008, 524369, 524305, 524569, 459024, 524401, 524337, 590018, 459016, 524385, 524321, 589986, 524289, 524417, 524353, 590050, 459012, 524377, 524313, 589970, 459028, 524409, 524345, 590034, 459020, 524393, 524329, 590002, 524297, 524425, 524361, 590066, 459010, 524373, 524309, 524573, 459026, 524405, 524341, 590026, 459018, 524389, 524325, 589994, 524293, 524421, 524357, 590058, 459014, 524381, 524317, 589978, 459030, 524413, 524349, 590042, 459022, 524397, 524333, 590010, 524301, 524429, 524365, 590074, 459009, 524371, 524307, 524571, 459025, 524403, 524339, 590022, 459017, 524387, 524323, 589990, 524291, 524419, 524355, 590054, 459013, 524379, 524315, 589974, 459029, 524411, 524347, 590038, 459021, 524395, 524331, 590006, 524299, 524427, 524363, 590070, 459011, 524375, 524311, 524575, 459027, 524407, 524343, 590030, 459019, 524391, 524327, 589998, 524295, 524423, 524359, 590062, 459015, 524383, 524319, 589982, 459031, 524415, 524351, 590046, 459023, 524399, 524335, 590014, 524303, 524431, 524367, 590078, 459008, 524368, 524304, 524568, 459024, 524400, 524336, 590017, 459016, 524384, 524320, 589985, 524288, 524416, 524352, 590049, 459012, 524376, 524312, 589969, 459028, 524408, 524344, 590033, 459020, 524392, 524328, 590001, 524296, 524424, 524360, 590065, 459010, 524372, 524308, 524572, 459026, 524404, 524340, 590025, 459018, 524388, 524324, 589993, 524292, 524420, 524356, 590057, 459014, 524380, 524316, 589977, 459030, 524412, 524348, 590041, 459022, 524396, 524332, 590009, 524300, 524428, 524364, 590073, 459009, 524370, 524306, 524570, 459025, 524402, 524338, 590021, 459017, 524386, 524322, 589989, 524290, 524418, 524354, 590053, 459013, 524378, 524314, 589973, 459029, 524410, 524346, 590037, 459021, 524394, 524330, 590005, 524298, 524426, 524362, 590069, 459011, 524374, 524310, 524574, 459027, 524406, 524342, 590029, 459019, 524390, 524326, 589997, 524294, 524422, 524358, 590061, 459015, 524382, 524318, 589981, 459031, 524414, 524350, 590045, 459023, 524398, 524334, 590013, 524302, 524430, 524366, 590077, 459008, 524369, 524305, 524569, 459024, 524401, 524337, 590019, 459016, 524385, 524321, 589987, 524289, 524417, 524353, 590051, 459012, 524377, 524313, 589971, 459028, 524409, 524345, 590035, 459020, 524393, 524329, 590003, 524297, 524425, 524361, 590067, 459010, 524373, 524309, 524573, 459026, 524405, 524341, 590027, 459018, 524389, 524325, 589995, 524293, 524421, 524357, 590059, 459014, 524381, 524317, 589979, 459030, 524413, 524349, 590043, 459022, 524397, 524333, 590011, 524301, 524429, 524365, 590075, 459009, 524371, 524307, 524571, 459025, 524403, 524339, 590023, 459017, 524387, 524323, 589991, 524291, 524419, 524355, 590055, 459013, 524379, 524315, 589975, 459029, 524411, 524347, 590039, 459021, 524395, 524331, 590007, 524299, 524427, 524363, 590071, 459011, 524375, 524311, 524575, 459027, 524407, 524343, 590031, 459019, 524391, 524327, 589999, 524295, 524423, 524359, 590063, 459015, 524383, 524319, 589983, 459031, 524415, 524351, 590047, 459023, 524399, 524335, 590015, 524303, 524431, 524367, 590079 ]), 9 ];
            var fixedDistCodeTab = [ new Uint32Array([ 327680, 327696, 327688, 327704, 327684, 327700, 327692, 327708, 327682, 327698, 327690, 327706, 327686, 327702, 327694, 0, 327681, 327697, 327689, 327705, 327685, 327701, 327693, 327709, 327683, 327699, 327691, 327707, 327687, 327703, 327695, 0 ]), 5 ];
            function FlateStream(stream) {
                var bytes = stream.getBytes();
                var bytesPos = 0;
                this.dict = stream.dict;
                var cmf = bytes[bytesPos++];
                var flg = bytes[bytesPos++];
                if (cmf == -1 || flg == -1) error("Invalid header in flate stream: " + cmf + ", " + flg);
                if ((cmf & 15) != 8) error("Unknown compression method in flate stream: " + cmf + ", " + flg);
                if (((cmf << 8) + flg) % 31 != 0) error("Bad FCHECK in flate stream: " + cmf + ", " + flg);
                if (flg & 32) error("FDICT bit set in flate stream: " + cmf + ", " + flg);
                this.bytes = bytes;
                this.bytesPos = bytesPos;
                this.codeSize = 0;
                this.codeBuf = 0;
                DecodeStream.call(this);
            }
            FlateStream.prototype = Object.create(DecodeStream.prototype);
            FlateStream.prototype.getBits = function FlateStream_getBits(bits) {
                var codeSize = this.codeSize;
                var codeBuf = this.codeBuf;
                var bytes = this.bytes;
                var bytesPos = this.bytesPos;
                var b;
                while (codeSize < bits) {
                    if (typeof (b = bytes[bytesPos++]) == "undefined") error("Bad encoding in flate stream");
                    codeBuf |= b << codeSize;
                    codeSize += 8;
                }
                b = codeBuf & (1 << bits) - 1;
                this.codeBuf = codeBuf >> bits;
                this.codeSize = codeSize -= bits;
                this.bytesPos = bytesPos;
                return b;
            };
            FlateStream.prototype.getCode = function FlateStream_getCode(table) {
                var codes = table[0];
                var maxLen = table[1];
                var codeSize = this.codeSize;
                var codeBuf = this.codeBuf;
                var bytes = this.bytes;
                var bytesPos = this.bytesPos;
                while (codeSize < maxLen) {
                    var b;
                    if (typeof (b = bytes[bytesPos++]) == "undefined") error("Bad encoding in flate stream");
                    codeBuf |= b << codeSize;
                    codeSize += 8;
                }
                var code = codes[codeBuf & (1 << maxLen) - 1];
                var codeLen = code >> 16;
                var codeVal = code & 65535;
                if (codeSize == 0 || codeSize < codeLen || codeLen == 0) error("Bad encoding in flate stream");
                this.codeBuf = codeBuf >> codeLen;
                this.codeSize = codeSize - codeLen;
                this.bytesPos = bytesPos;
                return codeVal;
            };
            FlateStream.prototype.generateHuffmanTable = function flateStreamGenerateHuffmanTable(lengths) {
                var n = lengths.length;
                var maxLen = 0;
                for (var i = 0; i < n; ++i) {
                    if (lengths[i] > maxLen) maxLen = lengths[i];
                }
                var size = 1 << maxLen;
                var codes = new Uint32Array(size);
                for (var len = 1, code = 0, skip = 2; len <= maxLen; ++len, code <<= 1, skip <<= 1) {
                    for (var val = 0; val < n; ++val) {
                        if (lengths[val] == len) {
                            var code2 = 0;
                            var t = code;
                            for (var i = 0; i < len; ++i) {
                                code2 = code2 << 1 | t & 1;
                                t >>= 1;
                            }
                            for (var i = code2; i < size; i += skip) codes[i] = len << 16 | val;
                            ++code;
                        }
                    }
                }
                return [ codes, maxLen ];
            };
            FlateStream.prototype.readBlock = function FlateStream_readBlock() {
                var hdr = this.getBits(3);
                if (hdr & 1) this.eof = true;
                hdr >>= 1;
                if (hdr == 0) {
                    var bytes = this.bytes;
                    var bytesPos = this.bytesPos;
                    var b;
                    if (typeof (b = bytes[bytesPos++]) == "undefined") error("Bad block header in flate stream");
                    var blockLen = b;
                    if (typeof (b = bytes[bytesPos++]) == "undefined") error("Bad block header in flate stream");
                    blockLen |= b << 8;
                    if (typeof (b = bytes[bytesPos++]) == "undefined") error("Bad block header in flate stream");
                    var check = b;
                    if (typeof (b = bytes[bytesPos++]) == "undefined") error("Bad block header in flate stream");
                    check |= b << 8;
                    if (check != (~blockLen & 65535)) error("Bad uncompressed block length in flate stream");
                    this.codeBuf = 0;
                    this.codeSize = 0;
                    var bufferLength = this.bufferLength;
                    var buffer = this.ensureBuffer(bufferLength + blockLen);
                    var end = bufferLength + blockLen;
                    this.bufferLength = end;
                    for (var n = bufferLength; n < end; ++n) {
                        if (typeof (b = bytes[bytesPos++]) == "undefined") {
                            this.eof = true;
                            break;
                        }
                        buffer[n] = b;
                    }
                    this.bytesPos = bytesPos;
                    return;
                }
                var litCodeTable;
                var distCodeTable;
                if (hdr == 1) {
                    litCodeTable = fixedLitCodeTab;
                    distCodeTable = fixedDistCodeTab;
                } else if (hdr == 2) {
                    var numLitCodes = this.getBits(5) + 257;
                    var numDistCodes = this.getBits(5) + 1;
                    var numCodeLenCodes = this.getBits(4) + 4;
                    var codeLenCodeLengths = new Uint8Array(codeLenCodeMap.length);
                    for (var i = 0; i < numCodeLenCodes; ++i) codeLenCodeLengths[codeLenCodeMap[i]] = this.getBits(3);
                    var codeLenCodeTab = this.generateHuffmanTable(codeLenCodeLengths);
                    var len = 0;
                    var i = 0;
                    var codes = numLitCodes + numDistCodes;
                    var codeLengths = new Uint8Array(codes);
                    while (i < codes) {
                        var code = this.getCode(codeLenCodeTab);
                        if (code == 16) {
                            var bitsLength = 2, bitsOffset = 3, what = len;
                        } else if (code == 17) {
                            var bitsLength = 3, bitsOffset = 3, what = len = 0;
                        } else if (code == 18) {
                            var bitsLength = 7, bitsOffset = 11, what = len = 0;
                        } else {
                            codeLengths[i++] = len = code;
                            continue;
                        }
                        var repeatLength = this.getBits(bitsLength) + bitsOffset;
                        while (repeatLength-- > 0) codeLengths[i++] = what;
                    }
                    litCodeTable = this.generateHuffmanTable(codeLengths.subarray(0, numLitCodes));
                    distCodeTable = this.generateHuffmanTable(codeLengths.subarray(numLitCodes, codes));
                } else {
                    error("Unknown block type in flate stream");
                }
                var buffer = this.buffer;
                var limit = buffer ? buffer.length : 0;
                var pos = this.bufferLength;
                while (true) {
                    var code1 = this.getCode(litCodeTable);
                    if (code1 < 256) {
                        if (pos + 1 >= limit) {
                            buffer = this.ensureBuffer(pos + 1);
                            limit = buffer.length;
                        }
                        buffer[pos++] = code1;
                        continue;
                    }
                    if (code1 == 256) {
                        this.bufferLength = pos;
                        return;
                    }
                    code1 -= 257;
                    code1 = lengthDecode[code1];
                    var code2 = code1 >> 16;
                    if (code2 > 0) code2 = this.getBits(code2);
                    var len = (code1 & 65535) + code2;
                    code1 = this.getCode(distCodeTable);
                    code1 = distDecode[code1];
                    code2 = code1 >> 16;
                    if (code2 > 0) code2 = this.getBits(code2);
                    var dist = (code1 & 65535) + code2;
                    if (pos + len >= limit) {
                        buffer = this.ensureBuffer(pos + len);
                        limit = buffer.length;
                    }
                    for (var k = 0; k < len; ++k, ++pos) buffer[pos] = buffer[pos - dist];
                }
            };
            return FlateStream;
        }();
        exports.Stream = Stream;
        exports.FlateStream = FlateStream;
    }
});
