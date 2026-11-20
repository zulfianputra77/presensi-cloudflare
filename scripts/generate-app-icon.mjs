/**
 * Zero-dependency Windows .ico & .png App Icon Generator
 * Menghasilkan ikon aplikasi profesional (assets/app-icon.ico & assets/app-icon.png)
 * untuk Desktop Shortcut, Start Menu, dan Installer Setup.exe.
 */

import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const ASSETS_DIR = path.resolve(ROOT, 'assets');

// CRC32 helper untuk PNG chunks
const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  CRC_TABLE[n] = c >>> 0;
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function makePngChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

function encodePng(width, height, rgba) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const stride = width * 4 + 1;
  const raw = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    raw[y * stride] = 0; // filter None
    rgba.copy(raw, y * stride + 1, y * width * 4, (y + 1) * width * 4);
  }

  const compressed = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    signature,
    makePngChunk('IHDR', ihdr),
    makePngChunk('IDAT', compressed),
    makePngChunk('IEND', Buffer.alloc(0)),
  ]);
}

function distToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

function blendPixel(buf, idx, r, g, b, a) {
  const alpha = Math.max(0, Math.min(1, a));
  const inv = 1 - alpha;
  buf[idx] = Math.round(buf[idx] * inv + r * alpha);
  buf[idx + 1] = Math.round(buf[idx + 1] * inv + g * alpha);
  buf[idx + 2] = Math.round(buf[idx + 2] * inv + b * alpha);
  buf[idx + 3] = Math.min(255, Math.round(buf[idx + 3] + (255 - buf[idx + 3]) * alpha));
}

function renderIconRgba(size) {
  const buf = Buffer.alloc(size * size * 4, 0);
  const pad = size * 0.06;
  const boxSize = size - pad * 2;
  const radius = size * 0.22;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const nx = x / size;
      const ny = y / size;

      // Signed distance rounded square
      const cx = Math.abs(x + 0.5 - size / 2) - (boxSize / 2 - radius);
      const cy = Math.abs(y + 0.5 - size / 2) - (boxSize / 2 - radius);
      const outsideDist = Math.hypot(Math.max(cx, 0), Math.max(cy, 0)) + Math.min(Math.max(cx, cy), 0) - radius;

      if (outsideDist < 1.0) {
        const edgeAlpha = Math.max(0, Math.min(1, 0.7 - outsideDist));
        // Gradien Navy -> Indigo -> Royal Blue
        const mix = nx * 0.45 + ny * 0.55;
        const r = Math.round(23 + mix * 38);
        const g = Math.round(37 + mix * 45);
        const b = Math.round(84 + mix * 145);
        buf[idx] = r;
        buf[idx + 1] = g;
        buf[idx + 2] = b;
        buf[idx + 3] = Math.round(255 * edgeAlpha);
      } else {
        continue;
      }

      // Garis bingkai tipis di dalam badge
      if (outsideDist > -size * 0.025 && outsideDist <= 0) {
        blendPixel(buf, idx, 165, 180, 252, 0.35);
      }

      // 4 Sudut QR Scanner berwarna putih/cyan lembut
      const cornerThick = 0.036;
      const cornerLen = 0.14;
      const cMin = 0.22;
      const cMax = 0.78;
      const inQrBracket =
        // Kiri atas
        (nx >= cMin && nx <= cMin + cornerLen && ny >= cMin && ny <= cMin + cornerThick) ||
        (nx >= cMin && nx <= cMin + cornerThick && ny >= cMin && ny <= cMin + cornerLen) ||
        // Kanan atas
        (nx >= cMax - cornerLen && nx <= cMax && ny >= cMin && ny <= cMin + cornerThick) ||
        (nx >= cMax - cornerThick && nx <= cMax && ny >= cMin && ny <= cMin + cornerLen) ||
        // Kiri bawah
        (nx >= cMin && nx <= cMin + cornerLen && ny >= cMax - cornerThick && ny <= cMax) ||
        (nx >= cMin && nx <= cMin + cornerThick && ny >= cMax - cornerLen && ny <= cMax) ||
        // Kanan bawah
        (nx >= cMax - cornerLen && nx <= cMax && ny >= cMax - cornerThick && ny <= cMax) ||
        (nx >= cMax - cornerThick && nx <= cMax && ny >= cMax - cornerLen && ny <= cMax);

      if (inQrBracket) {
        blendPixel(buf, idx, 224, 242, 254, 0.92);
      }

      // Simbol Centang Kehadiran (Checkmark) tebal di tengah
      const d1 = distToSegment(nx, ny, 0.35, 0.52, 0.46, 0.63);
      const d2 = distToSegment(nx, ny, 0.46, 0.63, 0.67, 0.38);
      const checkDist = Math.min(d1, d2);
      const stroke = 0.052;
      if (checkDist < stroke) {
        const aa = Math.max(0, Math.min(1, (stroke - checkDist) * size * 0.9));
        // Emas/Hijau Zamrud terang untuk centang hadir
        blendPixel(buf, idx, 52, 211, 153, aa);
      }
    }
  }

  return buf;
}

function buildIcoFromPngs(entries) {
  // ICONDIR header: 6 bytes
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // Reserved
  header.writeUInt16LE(1, 2); // Type 1 = ICO
  header.writeUInt16LE(entries.length, 4);

  const dirEntries = [];
  let offset = 6 + entries.length * 16;

  for (const { size, png } of entries) {
    const dir = Buffer.alloc(16);
    dir[0] = size >= 256 ? 0 : size; // width (0 means 256)
    dir[1] = size >= 256 ? 0 : size; // height
    dir[2] = 0; // palette count
    dir[3] = 0; // reserved
    dir.writeUInt16LE(1, 4); // planes
    dir.writeUInt16LE(32, 6); // bpp
    dir.writeUInt32LE(png.length, 8);
    dir.writeUInt32LE(offset, 12);
    dirEntries.push(dir);
    offset += png.length;
  }

  return Buffer.concat([header, ...dirEntries, ...entries.map((e) => e.png)]);
}

export function generateAppIconFiles() {
  if (!fs.existsSync(ASSETS_DIR)) {
    fs.mkdirSync(ASSETS_DIR, { recursive: true });
  }

  const sizes = [32, 48, 256];
  const entries = sizes.map((size) => {
    const rgba = renderIconRgba(size);
    const png = encodePng(size, size, rgba);
    return { size, png };
  });

  const icoBuffer = buildIcoFromPngs(entries);
  const icoPath = path.resolve(ASSETS_DIR, 'app-icon.ico');
  const pngPath = path.resolve(ASSETS_DIR, 'app-icon.png');

  fs.writeFileSync(icoPath, icoBuffer);
  fs.writeFileSync(pngPath, entries[entries.length - 1].png);

  return { icoPath, pngPath };
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename);
if (isDirectRun) {
  const { icoPath, pngPath } = generateAppIconFiles();
  console.log(`[OK] Ikon aplikasi berhasil dibuat:\n  - ${icoPath}\n  - ${pngPath}`);
}
