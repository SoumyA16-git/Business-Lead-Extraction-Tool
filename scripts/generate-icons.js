import { writeFileSync, mkdirSync } from "node:fs";
import { deflateSync } from "node:zlib";

function crc32(buf) {
  let table = [];
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  let crc = 0 ^ -1;
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
  }
  return (crc ^ -1) >>> 0;
}

function createChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function generatePng(size) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // 8-bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const rawRows = [];
  const radius = size * 0.2;
  const center = size / 2;
  const pinRadius = size * 0.22;

  for (let y = 0; y < size; y++) {
    rawRows.push(0); // scanline filter: None
    for (let x = 0; x < size; x++) {
      // Rounded rect check
      let inBox = true;
      const dx = Math.min(x, size - 1 - x);
      const dy = Math.min(y, size - 1 - y);
      if (dx < radius && dy < radius) {
        const dist = Math.hypot(radius - dx, radius - dy);
        if (dist > radius) inBox = false;
      }

      if (!inBox) {
        rawRows.push(0, 0, 0, 0); // Transparent
        continue;
      }

      // Draw center icon (white target / pin circle)
      const distFromCenter = Math.hypot(x - center, y - center);
      const isInnerPin = distFromCenter <= pinRadius && distFromCenter >= pinRadius * 0.45;
      const isCenterDot = distFromCenter <= pinRadius * 0.25;

      if (isInnerPin || isCenterDot) {
        rawRows.push(255, 255, 255, 255); // White glyph
      } else {
        rawRows.push(41, 85, 168, 255); // #2955A8 Accent Blue
      }
    }
  }

  const deflated = deflateSync(Buffer.from(rawRows));

  return Buffer.concat([
    sig,
    createChunk("IHDR", ihdr),
    createChunk("IDAT", deflated),
    createChunk("IEND", Buffer.alloc(0)),
  ]);
}

mkdirSync("public/icons", { recursive: true });
mkdirSync("dist/icons", { recursive: true });

for (const size of [16, 32, 48, 128]) {
  const png = generatePng(size);
  writeFileSync(`public/icons/icon-${size}.png`, png);
  console.log(`Generated public/icons/icon-${size}.png`);
}
