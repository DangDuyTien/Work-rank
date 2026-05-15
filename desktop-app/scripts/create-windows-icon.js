const fs = require('fs');
const path = require('path');

const size = 256;
const pixels = Buffer.alloc(size * size * 4, 0);

function setPixel(x, y, r, g, b, a = 255) {
  if (x < 0 || y < 0 || x >= size || y >= size) return;
  const i = ((size - 1 - y) * size + x) * 4;
  pixels[i] = b;
  pixels[i + 1] = g;
  pixels[i + 2] = r;
  pixels[i + 3] = a;
}

function roundedRect(x, y, w, h, radius, color) {
  const [r, g, b, a = 255] = color;
  for (let yy = y; yy < y + h; yy++) {
    for (let xx = x; xx < x + w; xx++) {
      const dx = xx < x + radius ? x + radius - xx : xx >= x + w - radius ? xx - (x + w - radius - 1) : 0;
      const dy = yy < y + radius ? y + radius - yy : yy >= y + h - radius ? yy - (y + h - radius - 1) : 0;
      if (dx * dx + dy * dy <= radius * radius || dx === 0 || dy === 0) setPixel(xx, yy, r, g, b, a);
    }
  }
}

function line(x1, y1, x2, y2, width, color) {
  const [r, g, b, a = 255] = color;
  const steps = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1)) * 2;
  for (let i = 0; i <= steps; i++) {
    const t = steps === 0 ? 0 : i / steps;
    const x = Math.round(x1 + (x2 - x1) * t);
    const y = Math.round(y1 + (y2 - y1) * t);
    roundedRect(x - Math.floor(width / 2), y - Math.floor(width / 2), width, width, Math.floor(width / 2), [r, g, b, a]);
  }
}

roundedRect(8, 8, 240, 240, 48, [255, 255, 255, 255]);
roundedRect(30, 30, 196, 196, 38, [239, 246, 255, 255]);

roundedRect(76, 117, 42, 76, 10, [56, 189, 248, 255]);
roundedRect(128, 65, 42, 128, 10, [37, 99, 235, 255]);
roundedRect(180, 137, 42, 56, 10, [34, 197, 94, 255]);
line(58, 195, 228, 195, 16, [15, 23, 42, 255]);
line(64, 80, 82, 98, 13, [15, 23, 42, 255]);
line(82, 98, 118, 62, 13, [15, 23, 42, 255]);
roundedRect(146, 86, 18, 18, 9, [255, 255, 255, 230]);

const xorSize = size * size * 4;
const andStride = Math.ceil(size / 32) * 4;
const andSize = andStride * size;
const dibSize = 40 + xorSize + andSize;
const ico = Buffer.alloc(6 + 16 + dibSize);

let offset = 0;
ico.writeUInt16LE(0, offset); offset += 2;
ico.writeUInt16LE(1, offset); offset += 2;
ico.writeUInt16LE(1, offset); offset += 2;

ico.writeUInt8(0, offset++);
ico.writeUInt8(0, offset++);
ico.writeUInt8(0, offset++);
ico.writeUInt8(0, offset++);
ico.writeUInt16LE(1, offset); offset += 2;
ico.writeUInt16LE(32, offset); offset += 2;
ico.writeUInt32LE(dibSize, offset); offset += 4;
ico.writeUInt32LE(22, offset); offset += 4;

ico.writeUInt32LE(40, offset); offset += 4;
ico.writeInt32LE(size, offset); offset += 4;
ico.writeInt32LE(size * 2, offset); offset += 4;
ico.writeUInt16LE(1, offset); offset += 2;
ico.writeUInt16LE(32, offset); offset += 2;
ico.writeUInt32LE(0, offset); offset += 4;
ico.writeUInt32LE(xorSize + andSize, offset); offset += 4;
ico.writeInt32LE(0, offset); offset += 4;
ico.writeInt32LE(0, offset); offset += 4;
ico.writeUInt32LE(0, offset); offset += 4;
ico.writeUInt32LE(0, offset); offset += 4;

pixels.copy(ico, offset);

const outDir = path.resolve(__dirname, '..', 'build');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'icon.ico'), ico);
console.log(`Created ${path.join(outDir, 'icon.ico')}`);
