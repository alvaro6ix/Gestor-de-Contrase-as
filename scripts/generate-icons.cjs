/**
 * Genera iconos PNG válidos a partir del logo de la app.
 * Run: node scripts/generate-icons.cjs
 *
 * Render: cuadrado redondeado amarillo (#ffd300) sobre fondo transparente,
 * con un escudo oscuro y un check amarillo. PNG con canal alpha.
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function crc32(buf) {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    table[i] = c >>> 0;
  }
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xFF];
  return (crc ^ 0xFFFFFFFF) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crc]);
}

// Logo design tied to the brand: 40-unit SVG mapped into N×N pixels.
// Background rounded square color: #ffd300 (yellow)
// Shield: dark navy #292528
// Check stroke on the shield: yellow
function renderLogo(W) {
  const data = Buffer.alloc(W * W * 4); // RGBA
  // Reference design uses a 40x40 viewBox.
  const scale = W / 40;
  // Rounded square: rx = 9, area = 0..40
  const rx = 9 * scale;
  // Shield polygon points (approximated as scaled coords)
  // M 20 6 L 32 12 L 32 22 Q 32 31 20 36 Q 8 31 8 22 L 8 12 Z
  // Easy approximation: shield = "fat rounded rectangle" within 8..32, with
  // tapered bottom. We'll use distance from center plus a vertical mask.
  const cx = 20 * scale, cy = 22 * scale;

  // Check polyline (yellow): 15,21 -> 19,25 -> 26,17 (stroke width ~2.5)
  const ck1 = { x: 15 * scale, y: 21 * scale };
  const ck2 = { x: 19 * scale, y: 25 * scale };
  const ck3 = { x: 26 * scale, y: 17 * scale };
  const strokeWidth = 2.5 * scale;

  function inRoundedSquare(x, y) {
    // Rounded corners on rx radius
    const dx = Math.max(rx - x, x - (W - rx), 0);
    const dy = Math.max(rx - y, y - (W - rx), 0);
    return dx * dx + dy * dy <= rx * rx;
  }
  function inShield(x, y) {
    // Map back to design coords
    const dx = x / scale, dy = y / scale;
    // Top rectangle 8..32 x 6..22
    const inTop = dx >= 8 && dx <= 32 && dy >= 6 && dy <= 22;
    // Bottom: ellipse with center (20,22) radii (12 horizontal, 14 vertical) for the tapered bottom
    const ex = dx - 20, ey = dy - 22;
    const inBottom = dy >= 22 && (ex * ex) / (12 * 12) + (ey * ey) / (14 * 14) <= 1;
    return inTop || inBottom;
  }
  function distToSegment(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay;
    const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
    const qx = ax + t * dx, qy = ay + t * dy;
    return Math.hypot(px - qx, py - qy);
  }
  function inCheck(x, y) {
    const d1 = distToSegment(x, y, ck1.x, ck1.y, ck2.x, ck2.y);
    const d2 = distToSegment(x, y, ck2.x, ck2.y, ck3.x, ck3.y);
    return Math.min(d1, d2) <= strokeWidth / 2;
  }

  const YELLOW = [0xff, 0xd3, 0x00, 0xff];
  const DARK   = [0x29, 0x25, 0x28, 0xff];
  const TRANS  = [0, 0, 0, 0];

  for (let y = 0; y < W; y++) {
    for (let x = 0; x < W; x++) {
      let color = TRANS;
      if (inRoundedSquare(x + 0.5, y + 0.5)) {
        color = YELLOW;
        if (inShield(x + 0.5, y + 0.5)) {
          color = DARK;
          if (inCheck(x + 0.5, y + 0.5)) {
            color = YELLOW;
          }
        }
      }
      const i = (y * W + x) * 4;
      data[i] = color[0]; data[i + 1] = color[1]; data[i + 2] = color[2]; data[i + 3] = color[3];
    }
  }
  return data;
}

function makePNG(W) {
  const sig = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(W, 4);
  ihdr.writeUInt8(8, 8);   // 8 bit depth
  ihdr.writeUInt8(6, 9);   // color type RGBA
  ihdr.writeUInt8(0, 10); ihdr.writeUInt8(0, 11); ihdr.writeUInt8(0, 12);

  const pixels = renderLogo(W);
  const rowSize = W * 4 + 1;
  const raw = Buffer.alloc(rowSize * W);
  for (let y = 0; y < W; y++) {
    raw[y * rowSize] = 0; // filter: none
    pixels.copy(raw, y * rowSize + 1, y * W * 4, y * W * 4 + W * 4);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

const outDir = path.resolve(__dirname, '..', 'public');
fs.writeFileSync(path.join(outDir, 'icon-192.png'), makePNG(192));
fs.writeFileSync(path.join(outDir, 'icon-512.png'), makePNG(512));
fs.writeFileSync(path.join(outDir, 'apple-touch-icon.png'), makePNG(180));
console.log('Generated icon-192.png (192x192), icon-512.png (512x512), apple-touch-icon.png (180x180)');
