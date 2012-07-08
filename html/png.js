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
        var crc32 = require("1");
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
            }
            this.i = 0;
            this.bytes = bytes;
            this.png = new PNG;
        };
        PNGReader.prototype.readBytes = function(length) {
            var end = this.i + length;
            if (end > this.bytes.length) {
                throw new Error("Unexpectedly reached end of file");
            }
            var bytes = this.bytes.slice(this.i, end);
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
            this.png.width = readUInt32(chunk, 0);
            this.png.height = readUInt32(chunk, 4);
            this.png.bithDepth = readUInt8(chunk, 8);
            this.png.colorType = readUInt8(chunk, 9);
            this.png.compressionMethod = readUInt8(chunk, 10);
            this.png.filterMethod = readUInt8(chunk, 11);
            this.png.interlaceMethod = readUInt8(chunk, 12);
        };
        PNGReader.prototype.decodePLTE = function() {};
        PNGReader.prototype.decodeIDAT = function(chunk) {};
        PNGReader.prototype.decodeIEND = function() {};
        PNGReader.prototype.parse = function() {
            this.decodeHeader();
            var type;
            while (type != "IEND" && this.i < this.bytes.length) {
                type = this.decodeChunk();
            }
            return this.png;
        };
        var PNG = function() {
            this.width = 0;
            this.height = 0;
        };
        PNG.prototype.getWidth = function() {
            return this.width;
        };
        PNG.prototype.getHeight = function() {
            return this.height;
        };
        module.exports = PNGReader;
    },
    "1": function(require, module, exports, global) {
        (function() {
            "use strict";
            var table = [], poly = 3988292384;
            function makeTable() {
                var c, n, k;
                for (n = 0; n < 256; n += 1) {
                    c = n;
                    for (k = 0; k < 8; k += 1) {
                        if (c & 1) {
                            c = poly ^ c >>> 1;
                        } else {
                            c = c >>> 1;
                        }
                    }
                    table[n] = c >>> 0;
                }
            }
            function strToArr(str) {
                return Array.prototype.map.call(str, function(c) {
                    return c.charCodeAt(0);
                });
            }
            function crcDirect(arr) {
                var crc = -1, i, j, l, temp;
                for (i = 0, l = arr.length; i < l; i += 1) {
                    temp = (crc ^ arr[i]) & 255;
                    for (j = 0; j < 8; j += 1) {
                        if ((temp & 1) === 1) {
                            temp = temp >>> 1 ^ poly;
                        } else {
                            temp = temp >>> 1;
                        }
                    }
                    crc = crc >>> 8 ^ temp;
                }
                return crc ^ -1;
            }
            function crcTable(arr, append) {
                var crc, i, l;
                if (typeof crcTable.crc === "undefined" || !append || !arr) {
                    crcTable.crc = 0 ^ -1;
                    if (!arr) {
                        return;
                    }
                }
                crc = crcTable.crc;
                for (i = 0, l = arr.length; i < l; i += 1) {
                    crc = crc >>> 8 ^ table[(crc ^ arr[i]) & 255];
                }
                crcTable.crc = crc;
                return crc ^ -1;
            }
            makeTable();
            module.exports = function(val, direct) {
                var val = typeof val === "string" ? strToArr(val) : val, ret = direct ? crcDirect(val) : crcTable(val);
                return (ret >>> 0).toString(16);
            };
            module.exports.direct = crcDirect;
            module.exports.table = crcTable;
        })();
    }
});