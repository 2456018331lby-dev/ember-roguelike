import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = resolve(root, 'web', 'assets');

const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type);
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  typeBuf.copy(out, 4);
  data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), out.length - 4);
  return out;
}

function writePng(path, surface) {
  const { width, height, pixels } = surface;
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    const row = y * (width * 4 + 1);
    raw[row] = 0;
    pixels.copy(raw, row + 1, y * width * 4, (y + 1) * width * 4);
  }

  const png = Buffer.concat([
    pngSignature,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
  writeFileSync(path, png);
}

function rgba(hex, alpha = 1) {
  const value = hex.replace('#', '');
  return [
    Number.parseInt(value.slice(0, 2), 16),
    Number.parseInt(value.slice(2, 4), 16),
    Number.parseInt(value.slice(4, 6), 16),
    Math.round(clamp01(alpha) * 255),
  ];
}

function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}

function smoothstep(edge0, edge1, x) {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

function mulAlpha(color, alpha) {
  return [color[0], color[1], color[2], Math.round(color[3] * clamp01(alpha))];
}

function mix(a, b, t) {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
    Math.round(a[3] + (b[3] - a[3]) * t),
  ];
}

function seededRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 0xffffffff;
  };
}

class Surface {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.pixels = Buffer.alloc(width * height * 4);
  }

  blend(x, y, color) {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.width || y >= this.height || color[3] <= 0) return;
    const i = (y * this.width + x) * 4;
    const sa = color[3] / 255;
    const da = this.pixels[i + 3] / 255;
    const outA = sa + da * (1 - sa);
    if (outA <= 0) return;
    this.pixels[i] = Math.round((color[0] * sa + this.pixels[i] * da * (1 - sa)) / outA);
    this.pixels[i + 1] = Math.round((color[1] * sa + this.pixels[i + 1] * da * (1 - sa)) / outA);
    this.pixels[i + 2] = Math.round((color[2] * sa + this.pixels[i + 2] * da * (1 - sa)) / outA);
    this.pixels[i + 3] = Math.round(outA * 255);
  }

  set(x, y, color) {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
    const i = (y * this.width + x) * 4;
    this.pixels[i] = color[0];
    this.pixels[i + 1] = color[1];
    this.pixels[i + 2] = color[2];
    this.pixels[i + 3] = color[3];
  }

  fillRect(x, y, w, h, color) {
    const x0 = Math.max(0, Math.floor(x));
    const y0 = Math.max(0, Math.floor(y));
    const x1 = Math.min(this.width, Math.ceil(x + w));
    const y1 = Math.min(this.height, Math.ceil(y + h));
    for (let yy = y0; yy < y1; yy++) {
      for (let xx = x0; xx < x1; xx++) this.blend(xx, yy, color);
    }
  }

  fillEllipse(cx, cy, rx, ry, color) {
    const x0 = Math.floor(cx - rx - 2);
    const y0 = Math.floor(cy - ry - 2);
    const x1 = Math.ceil(cx + rx + 2);
    const y1 = Math.ceil(cy + ry + 2);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const dx = (x + 0.5 - cx) / rx;
        const dy = (y + 0.5 - cy) / ry;
        const d = Math.sqrt(dx * dx + dy * dy);
        const aa = clamp01((1.02 - d) * 3.2);
        if (aa > 0) this.blend(x, y, mulAlpha(color, aa));
      }
    }
  }

  fillCircle(cx, cy, r, color) {
    this.fillEllipse(cx, cy, r, r, color);
  }

  strokeEllipse(cx, cy, rx, ry, width, color) {
    const x0 = Math.floor(cx - rx - width - 2);
    const y0 = Math.floor(cy - ry - width - 2);
    const x1 = Math.ceil(cx + rx + width + 2);
    const y1 = Math.ceil(cy + ry + width + 2);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const dx = (x + 0.5 - cx) / rx;
        const dy = (y + 0.5 - cy) / ry;
        const d = Math.sqrt(dx * dx + dy * dy);
        const dist = Math.abs(d - 1) * Math.max(rx, ry);
        const aa = clamp01((width / 2 + 0.7 - dist) / 1.4);
        if (aa > 0) this.blend(x, y, mulAlpha(color, aa));
      }
    }
  }

  drawLine(x1, y1, x2, y2, width, color) {
    const minX = Math.floor(Math.min(x1, x2) - width - 2);
    const maxX = Math.ceil(Math.max(x1, x2) + width + 2);
    const minY = Math.floor(Math.min(y1, y2) - width - 2);
    const maxY = Math.ceil(Math.max(y1, y2) + width + 2);
    const vx = x2 - x1;
    const vy = y2 - y1;
    const len2 = vx * vx + vy * vy || 1;
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const t = clamp01(((x + 0.5 - x1) * vx + (y + 0.5 - y1) * vy) / len2);
        const px = x1 + vx * t;
        const py = y1 + vy * t;
        const d = Math.hypot(x + 0.5 - px, y + 0.5 - py);
        const aa = clamp01((width / 2 + 0.65 - d) / 1.3);
        if (aa > 0) this.blend(x, y, mulAlpha(color, aa));
      }
    }
  }

  fillPolygon(points, color) {
    const minX = Math.floor(Math.min(...points.map(p => p[0])) - 1);
    const maxX = Math.ceil(Math.max(...points.map(p => p[0])) + 1);
    const minY = Math.floor(Math.min(...points.map(p => p[1])) - 1);
    const maxY = Math.ceil(Math.max(...points.map(p => p[1])) + 1);
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        if (pointInPoly(x + 0.5, y + 0.5, points)) this.blend(x, y, color);
      }
    }
  }

  radialGlow(cx, cy, radius, color, power = 1) {
    const x0 = Math.floor(cx - radius);
    const y0 = Math.floor(cy - radius);
    const x1 = Math.ceil(cx + radius);
    const y1 = Math.ceil(cy + radius);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy) / radius;
        const a = Math.pow(clamp01(1 - d), power);
        if (a > 0) this.blend(x, y, mulAlpha(color, a));
      }
    }
  }
}

function pointInPoly(x, y, points) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const xi = points[i][0], yi = points[i][1];
    const xj = points[j][0], yj = points[j][1];
    const intersect = ((yi > y) !== (yj > y)) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function generateHeroes() {
  const sheet = new Surface(512, 256);
  const heroes = [
    {
      id: 'warrior',
      armor: rgba('#2f6fed'),
      dark: rgba('#0f172a'),
      trim: rgba('#dbeafe'),
      glow: rgba('#60a5fa', 0.42),
      weapon: 'sword',
    },
    {
      id: 'mage',
      armor: rgba('#8b5cf6'),
      dark: rgba('#1e1b4b'),
      trim: rgba('#ede9fe'),
      glow: rgba('#c4b5fd', 0.58),
      weapon: 'staff',
    },
    {
      id: 'rogue',
      armor: rgba('#f59e0b'),
      dark: rgba('#451a03'),
      trim: rgba('#ffedd5'),
      glow: rgba('#fbbf24', 0.42),
      weapon: 'daggers',
    },
    {
      id: 'necro',
      armor: rgba('#64748b'),
      dark: rgba('#111827'),
      trim: rgba('#d9f99d'),
      glow: rgba('#84cc16', 0.42),
      weapon: 'scythe',
    },
  ];

  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < heroes.length; col++) {
      drawHero(sheet, col * 128, row * 128, heroes[col], row);
    }
  }

  return sheet;
}

function drawHero(sheet, ox, oy, h, frame) {
  const cx = ox + 64;
  const cy = oy + 68;
  const attack = frame === 1;
  const lean = attack ? 5 : 0;
  const glowColor = h.glow;

  sheet.radialGlow(cx, cy, 48, glowColor, 2.4);
  sheet.fillEllipse(cx, oy + 101, 36, 13, rgba('#000000', 0.34));

  const cape = mix(h.dark, h.armor, 0.22);
  sheet.fillPolygon([
    [cx - 31, cy - 4],
    [cx + 30, cy - 3],
    [cx + 23, cy + 38],
    [cx - 25, cy + 39],
  ], mulAlpha(cape, 0.9));

  sheet.fillEllipse(cx - 14, cy + 29, 8, 14, mix(h.dark, h.armor, 0.42));
  sheet.fillEllipse(cx + 14, cy + 29, 8, 14, mix(h.dark, h.armor, 0.42));
  sheet.fillEllipse(cx - 16, cy + 42, 13, 7, rgba('#111827', 0.78));
  sheet.fillEllipse(cx + 16, cy + 42, 13, 7, rgba('#111827', 0.78));

  sheet.fillEllipse(cx + lean, cy + 8, 25, 31, h.dark);
  sheet.fillEllipse(cx + lean, cy + 5, 22, 27, h.armor);
  sheet.fillPolygon([
    [cx - 21 + lean, cy - 5],
    [cx + 21 + lean, cy - 5],
    [cx + 15 + lean, cy + 20],
    [cx - 15 + lean, cy + 20],
  ], mix(h.armor, h.trim, 0.16));
  sheet.drawLine(cx - 14 + lean, cy + 4, cx + 14 + lean, cy + 4, 3, mulAlpha(h.trim, 0.56));
  sheet.fillCircle(cx + lean, cy - 24, 22, h.dark);
  sheet.fillCircle(cx + lean, cy - 25, 17, h.trim);

  if (h.weapon === 'warrior' || h.weapon === 'sword') {
    sheet.fillPolygon([
      [cx - 19 + lean, cy - 39],
      [cx + 19 + lean, cy - 39],
      [cx + 13 + lean, cy - 22],
      [cx - 13 + lean, cy - 22],
    ], mix(h.armor, h.trim, 0.18));
    sheet.drawLine(cx + 26 + lean, cy + 10, cx + (attack ? 54 : 43), cy + (attack ? -34 : -18), attack ? 8 : 7, rgba('#94a3b8'));
    sheet.drawLine(cx + 28 + lean, cy + 8, cx + (attack ? 55 : 44), cy + (attack ? -35 : -19), attack ? 3 : 2, rgba('#f8fafc', 0.82));
    sheet.drawLine(cx + 18 + lean, cy + 12, cx + 32 + lean, cy - 2, 5, rgba('#1e293b'));
  } else if (h.weapon === 'staff') {
    sheet.fillPolygon([
      [cx - 22 + lean, cy - 31],
      [cx + lean, cy - 51],
      [cx + 22 + lean, cy - 31],
      [cx + 15 + lean, cy - 18],
      [cx - 15 + lean, cy - 18],
    ], h.armor);
    sheet.drawLine(cx + 27 + lean, cy + 24, cx + (attack ? 47 : 40), cy - 38, 5, rgba('#d8b4fe'));
    sheet.fillCircle(cx + (attack ? 48 : 40), cy - 41, 10, rgba('#c4b5fd', 0.92));
    sheet.radialGlow(cx + (attack ? 48 : 40), cy - 41, 23, rgba('#a78bfa', 0.45), 1.8);
  } else if (h.weapon === 'daggers') {
    sheet.fillPolygon([
      [cx - 23 + lean, cy - 37],
      [cx + 23 + lean, cy - 37],
      [cx + 16 + lean, cy - 17],
      [cx - 16 + lean, cy - 17],
    ], h.dark);
    sheet.drawLine(cx - 26 + lean, cy + 8, cx - (attack ? 54 : 42), cy - (attack ? 20 : 6), 5, rgba('#e5e7eb'));
    sheet.drawLine(cx + 26 + lean, cy + 8, cx + (attack ? 54 : 42), cy - (attack ? 20 : 6), 5, rgba('#e5e7eb'));
    sheet.fillEllipse(cx - 7 + lean, cy - 26, 4, 2, rgba('#fff7ed'));
    sheet.fillEllipse(cx + 7 + lean, cy - 26, 4, 2, rgba('#fff7ed'));
  } else {
    sheet.fillPolygon([
      [cx - 22 + lean, cy - 29],
      [cx + lean, cy - 48],
      [cx + 22 + lean, cy - 29],
      [cx + 12 + lean, cy - 13],
      [cx - 12 + lean, cy - 13],
    ], h.dark);
    sheet.fillCircle(cx - 7 + lean, cy - 26, 4, rgba('#0f172a'));
    sheet.fillCircle(cx + 7 + lean, cy - 26, 4, rgba('#0f172a'));
    sheet.drawLine(cx + 27 + lean, cy + 25, cx + (attack ? 51 : 39), cy - 41, 4, rgba('#cbd5e1'));
    sheet.drawLine(cx + (attack ? 42 : 34), cy - 38, cx + (attack ? 64 : 53), cy - 32, 5, rgba('#d9f99d'));
    sheet.radialGlow(cx + (attack ? 52 : 43), cy - 36, 20, rgba('#84cc16', 0.28), 2);
  }

  sheet.fillEllipse(cx - 7 + lean, cy - 25, 2.6, 3.1, h.dark);
  sheet.fillEllipse(cx + 7 + lean, cy - 25, 2.6, 3.1, h.dark);
  sheet.fillEllipse(cx - 7 + lean, cy - 25, 1.2, 1.4, rgba('#ffffff', 0.82));
  sheet.fillEllipse(cx + 7 + lean, cy - 25, 1.2, 1.4, rgba('#ffffff', 0.82));
  sheet.strokeEllipse(cx + lean, cy - 1, 29, 36, 2.4, mulAlpha(h.trim, 0.28));
  sheet.strokeEllipse(cx, oy + 101, 37, 13, 1.5, rgba('#f8fafc', 0.08));
}

function generateEnemies() {
  const sheet = new Surface(512, 512);
  const layout = [
    ['slime', 'bat', 'skeleton', 'golem'],
    ['archer', 'fire_mage', 'healer', 'summoner'],
    ['charger', 'bomber', 'dragon', 'lich'],
    ['demon', 'voidling', 'warden', 'shade'],
  ];

  for (let row = 0; row < layout.length; row++) {
    for (let col = 0; col < layout[row].length; col++) {
      drawEnemySprite(sheet, col * 128, row * 128, layout[row][col]);
    }
  }

  return sheet;
}

function drawEnemySprite(sheet, ox, oy, kind) {
  const cx = ox + 64;
  const cy = oy + 68;
  const shadow = rgba('#000000', 0.32);
  sheet.fillEllipse(cx, oy + 101, 33, 12, shadow);

  const aura = {
    slime: rgba('#22c55e', 0.28),
    bat: rgba('#8b5cf6', 0.28),
    skeleton: rgba('#e5e7eb', 0.18),
    golem: rgba('#a16207', 0.22),
    archer: rgba('#fb923c', 0.22),
    fire_mage: rgba('#ef4444', 0.3),
    healer: rgba('#ec4899', 0.26),
    summoner: rgba('#7c3aed', 0.3),
    charger: rgba('#f97316', 0.3),
    bomber: rgba('#facc15', 0.28),
    dragon: rgba('#ef4444', 0.38),
    lich: rgba('#38bdf8', 0.26),
    demon: rgba('#dc2626', 0.42),
    voidling: rgba('#6366f1', 0.24),
    warden: rgba('#94a3b8', 0.22),
    shade: rgba('#a855f7', 0.22),
  }[kind] || rgba('#ef4444', 0.22);
  sheet.radialGlow(cx, cy, kind === 'demon' || kind === 'dragon' ? 58 : 43, aura, 2.1);

  switch (kind) {
    case 'slime':
      sheet.fillEllipse(cx, cy + 10, 33, 25, rgba('#14532d', 0.92));
      sheet.fillEllipse(cx, cy + 3, 29, 24, rgba('#22c55e', 0.92));
      sheet.fillEllipse(cx - 10, cy - 2, 5, 7, rgba('#dcfce7'));
      sheet.fillEllipse(cx + 10, cy - 2, 5, 7, rgba('#dcfce7'));
      sheet.fillEllipse(cx - 10, cy - 2, 2, 3, rgba('#052e16'));
      sheet.fillEllipse(cx + 10, cy - 2, 2, 3, rgba('#052e16'));
      sheet.drawLine(cx - 12, cy + 13, cx + 12, cy + 13, 3, rgba('#064e3b', 0.75));
      break;
    case 'bat':
      sheet.fillPolygon([[cx - 6, cy - 4], [cx - 49, cy - 22], [cx - 34, cy + 5], [cx - 51, cy + 18], [cx - 14, cy + 16]], rgba('#5b21b6'));
      sheet.fillPolygon([[cx + 6, cy - 4], [cx + 49, cy - 22], [cx + 34, cy + 5], [cx + 51, cy + 18], [cx + 14, cy + 16]], rgba('#5b21b6'));
      sheet.fillEllipse(cx, cy + 1, 18, 24, rgba('#2e1065'));
      sheet.fillEllipse(cx - 7, cy - 5, 3, 4, rgba('#fde68a'));
      sheet.fillEllipse(cx + 7, cy - 5, 3, 4, rgba('#fde68a'));
      sheet.fillPolygon([[cx - 9, cy - 17], [cx - 3, cy - 30], [cx + 1, cy - 16]], rgba('#7c3aed'));
      sheet.fillPolygon([[cx + 9, cy - 17], [cx + 3, cy - 30], [cx - 1, cy - 16]], rgba('#7c3aed'));
      break;
    case 'skeleton':
      sheet.fillEllipse(cx, cy - 13, 23, 21, rgba('#e5e7eb'));
      sheet.fillEllipse(cx - 8, cy - 14, 5, 6, rgba('#111827'));
      sheet.fillEllipse(cx + 8, cy - 14, 5, 6, rgba('#111827'));
      sheet.fillRect(cx - 4, cy - 4, 8, 5, rgba('#94a3b8'));
      sheet.fillEllipse(cx, cy + 20, 20, 22, rgba('#cbd5e1'));
      sheet.drawLine(cx - 26, cy + 14, cx + 26, cy + 34, 5, rgba('#e5e7eb'));
      sheet.drawLine(cx + 26, cy + 14, cx - 26, cy + 34, 5, rgba('#e5e7eb'));
      sheet.strokeEllipse(cx, cy - 13, 24, 22, 2, rgba('#f8fafc', 0.32));
      break;
    case 'golem':
      sheet.fillPolygon([[cx - 33, cy - 16], [cx - 12, cy - 36], [cx + 24, cy - 30], [cx + 37, cy - 4], [cx + 29, cy + 32], [cx - 26, cy + 37], [cx - 39, cy + 8]], rgba('#57534e'));
      sheet.fillPolygon([[cx - 21, cy - 18], [cx + 21, cy - 20], [cx + 25, cy + 14], [cx - 18, cy + 17]], rgba('#78716c'));
      sheet.fillEllipse(cx - 12, cy - 4, 4, 4, rgba('#fef3c7'));
      sheet.fillEllipse(cx + 12, cy - 5, 4, 4, rgba('#fef3c7'));
      sheet.drawLine(cx - 19, cy + 14, cx + 17, cy + 10, 4, rgba('#292524'));
      sheet.drawLine(cx - 30, cy + 29, cx - 44, cy + 42, 7, rgba('#44403c'));
      sheet.drawLine(cx + 28, cy + 27, cx + 43, cy + 42, 7, rgba('#44403c'));
      break;
    case 'archer':
      sheet.fillEllipse(cx, cy + 3, 24, 30, rgba('#431407'));
      sheet.fillPolygon([[cx - 25, cy - 18], [cx, cy - 40], [cx + 25, cy - 18], [cx + 17, cy + 25], [cx - 17, cy + 25]], rgba('#fb923c'));
      sheet.fillEllipse(cx - 8, cy - 11, 3, 3, rgba('#fff7ed'));
      sheet.fillEllipse(cx + 8, cy - 11, 3, 3, rgba('#fff7ed'));
      sheet.drawLine(cx + 25, cy - 24, cx + 37, cy + 36, 4, rgba('#fed7aa'));
      sheet.drawLine(cx + 35, cy - 20, cx + 35, cy + 31, 1.8, rgba('#451a03'));
      sheet.drawLine(cx - 18, cy + 8, cx + 35, cy + 5, 3, rgba('#f8fafc'));
      break;
    case 'fire_mage':
      sheet.fillPolygon([[cx - 26, cy + 34], [cx - 16, cy - 18], [cx, cy - 42], [cx + 17, cy - 18], [cx + 27, cy + 34]], rgba('#7f1d1d'));
      sheet.fillEllipse(cx, cy - 9, 17, 18, rgba('#1f0a0a'));
      sheet.fillEllipse(cx - 7, cy - 10, 3, 3, rgba('#fed7aa'));
      sheet.fillEllipse(cx + 7, cy - 10, 3, 3, rgba('#fed7aa'));
      sheet.fillPolygon([[cx + 20, cy - 6], [cx + 43, cy - 24], [cx + 35, cy - 4], [cx + 47, cy + 8], [cx + 25, cy + 13]], rgba('#f97316', 0.88));
      sheet.radialGlow(cx + 35, cy - 5, 26, rgba('#f97316', 0.5), 1.5);
      sheet.drawLine(cx - 24, cy + 18, cx - 38, cy + 34, 5, rgba('#450a0a'));
      break;
    case 'healer':
      sheet.fillEllipse(cx, cy + 2, 25, 30, rgba('#831843'));
      sheet.fillPolygon([[cx - 22, cy + 28], [cx - 11, cy - 25], [cx, cy - 37], [cx + 12, cy - 25], [cx + 23, cy + 28]], rgba('#ec4899'));
      sheet.fillRect(cx - 5, cy - 18, 10, 32, rgba('#fff1f2'));
      sheet.fillRect(cx - 16, cy - 7, 32, 10, rgba('#fff1f2'));
      sheet.radialGlow(cx, cy - 3, 34, rgba('#f9a8d4', 0.42), 1.8);
      break;
    case 'summoner':
      sheet.fillPolygon([[cx - 27, cy + 36], [cx - 20, cy - 10], [cx, cy - 42], [cx + 20, cy - 10], [cx + 28, cy + 36]], rgba('#312e81'));
      sheet.fillEllipse(cx, cy - 6, 18, 18, rgba('#111827'));
      sheet.fillEllipse(cx - 7, cy - 6, 3, 3, rgba('#c4b5fd'));
      sheet.fillEllipse(cx + 7, cy - 6, 3, 3, rgba('#c4b5fd'));
      sheet.strokeEllipse(cx, cy + 22, 28, 12, 3, rgba('#a78bfa', 0.8));
      sheet.strokeEllipse(cx, cy + 22, 18, 8, 2, rgba('#ddd6fe', 0.75));
      sheet.radialGlow(cx, cy + 21, 31, rgba('#7c3aed', 0.44), 1.6);
      break;
    case 'charger':
      sheet.fillEllipse(cx, cy + 4, 30, 32, rgba('#7c2d12'));
      sheet.fillPolygon([[cx - 26, cy - 19], [cx - 48, cy - 38], [cx - 38, cy - 11]], rgba('#fed7aa'));
      sheet.fillPolygon([[cx + 26, cy - 19], [cx + 48, cy - 38], [cx + 38, cy - 11]], rgba('#fed7aa'));
      sheet.fillEllipse(cx, cy - 12, 21, 19, rgba('#f97316'));
      sheet.fillEllipse(cx - 8, cy - 12, 3, 3, rgba('#111827'));
      sheet.fillEllipse(cx + 8, cy - 12, 3, 3, rgba('#111827'));
      sheet.drawLine(cx - 20, cy + 20, cx - 41, cy + 38, 7, rgba('#431407'));
      sheet.drawLine(cx + 20, cy + 20, cx + 41, cy + 38, 7, rgba('#431407'));
      break;
    case 'bomber':
      sheet.fillEllipse(cx, cy + 7, 27, 30, rgba('#422006'));
      sheet.fillEllipse(cx, cy + 4, 23, 27, rgba('#facc15'));
      sheet.fillEllipse(cx - 8, cy - 2, 3, 4, rgba('#111827'));
      sheet.fillEllipse(cx + 8, cy - 2, 3, 4, rgba('#111827'));
      sheet.drawLine(cx + 3, cy - 26, cx + 21, cy - 43, 4, rgba('#78716c'));
      sheet.radialGlow(cx + 23, cy - 45, 18, rgba('#f97316', 0.72), 1.3);
      sheet.fillPolygon([[cx + 21, cy - 53], [cx + 30, cy - 43], [cx + 18, cy - 38]], rgba('#fb923c'));
      break;
    case 'dragon':
      sheet.fillPolygon([[cx - 9, cy - 2], [cx - 56, cy - 32], [cx - 43, cy + 16], [cx - 14, cy + 20]], rgba('#7f1d1d'));
      sheet.fillPolygon([[cx + 9, cy - 2], [cx + 56, cy - 32], [cx + 43, cy + 16], [cx + 14, cy + 20]], rgba('#7f1d1d'));
      sheet.fillEllipse(cx, cy + 4, 31, 35, rgba('#991b1b'));
      sheet.fillEllipse(cx, cy - 29, 25, 21, rgba('#dc2626'));
      sheet.fillPolygon([[cx - 12, cy - 44], [cx - 28, cy - 59], [cx - 20, cy - 35]], rgba('#fecaca'));
      sheet.fillPolygon([[cx + 12, cy - 44], [cx + 28, cy - 59], [cx + 20, cy - 35]], rgba('#fecaca'));
      sheet.fillEllipse(cx - 8, cy - 31, 3, 3, rgba('#fde68a'));
      sheet.fillEllipse(cx + 8, cy - 31, 3, 3, rgba('#fde68a'));
      sheet.drawLine(cx, cy + 30, cx + 37, cy + 48, 7, rgba('#7f1d1d'));
      break;
    case 'lich':
      sheet.fillPolygon([[cx - 30, cy + 38], [cx - 20, cy - 18], [cx, cy - 48], [cx + 20, cy - 18], [cx + 30, cy + 38]], rgba('#0f172a'));
      sheet.fillEllipse(cx, cy - 13, 18, 18, rgba('#dbeafe'));
      sheet.fillEllipse(cx - 7, cy - 14, 4, 4, rgba('#0f172a'));
      sheet.fillEllipse(cx + 7, cy - 14, 4, 4, rgba('#0f172a'));
      sheet.drawLine(cx + 26, cy + 29, cx + 42, cy - 36, 5, rgba('#cbd5e1'));
      sheet.fillCircle(cx + 43, cy - 39, 9, rgba('#67e8f9', 0.9));
      sheet.radialGlow(cx + 43, cy - 39, 24, rgba('#38bdf8', 0.48), 1.6);
      break;
    case 'demon':
      sheet.fillEllipse(cx, cy + 6, 34, 39, rgba('#7f1d1d'));
      sheet.fillEllipse(cx, cy - 17, 25, 24, rgba('#dc2626'));
      sheet.fillPolygon([[cx - 17, cy - 35], [cx - 43, cy - 58], [cx - 32, cy - 24]], rgba('#fecaca'));
      sheet.fillPolygon([[cx + 17, cy - 35], [cx + 43, cy - 58], [cx + 32, cy - 24]], rgba('#fecaca'));
      sheet.fillEllipse(cx - 9, cy - 18, 4, 4, rgba('#fde047'));
      sheet.fillEllipse(cx + 9, cy - 18, 4, 4, rgba('#fde047'));
      sheet.fillPolygon([[cx - 28, cy + 1], [cx - 59, cy - 17], [cx - 46, cy + 24], [cx - 20, cy + 23]], rgba('#450a0a'));
      sheet.fillPolygon([[cx + 28, cy + 1], [cx + 59, cy - 17], [cx + 46, cy + 24], [cx + 20, cy + 23]], rgba('#450a0a'));
      break;
    case 'voidling':
      sheet.fillEllipse(cx, cy + 2, 25, 31, rgba('#1e1b4b'));
      sheet.strokeEllipse(cx, cy + 1, 31, 35, 3, rgba('#818cf8', 0.64));
      sheet.fillEllipse(cx - 8, cy - 9, 4, 4, rgba('#c4b5fd'));
      sheet.fillEllipse(cx + 8, cy - 9, 4, 4, rgba('#c4b5fd'));
      break;
    case 'warden':
      sheet.fillPolygon([[cx - 27, cy + 32], [cx - 18, cy - 20], [cx, cy - 36], [cx + 18, cy - 20], [cx + 27, cy + 32]], rgba('#475569'));
      sheet.drawLine(cx - 30, cy + 10, cx + 30, cy + 10, 8, rgba('#cbd5e1'));
      sheet.fillEllipse(cx, cy - 13, 16, 16, rgba('#0f172a'));
      sheet.fillEllipse(cx, cy - 13, 5, 5, rgba('#f8fafc'));
      break;
    case 'shade':
    default:
      sheet.fillPolygon([[cx - 26, cy + 34], [cx - 14, cy - 20], [cx, cy - 42], [cx + 14, cy - 20], [cx + 26, cy + 34], [cx, cy + 24]], rgba('#581c87'));
      sheet.fillEllipse(cx - 7, cy - 12, 3, 4, rgba('#f5d0fe'));
      sheet.fillEllipse(cx + 7, cy - 12, 3, 4, rgba('#f5d0fe'));
      sheet.radialGlow(cx, cy, 32, rgba('#a855f7', 0.3), 1.8);
      break;
  }
}

function drawPath(surface, points, width, color) {
  for (let i = 0; i < points.length - 1; i++) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[i + 1];
    surface.drawLine(x1, y1, x2, y2, width, color);
  }
}

function drawGoldPath(surface, points, alpha = 0.62) {
  drawPath(surface, points, 5.5, rgba('#05070d', 0.5));
  drawPath(surface, points, 2.6, rgba('#c99a46', alpha));
  drawPath(surface, points, 1.1, rgba('#ffe6a6', alpha * 0.58));
}

function drawDiamond(surface, x, y, r, alpha = 0.56) {
  const p = [[x, y - r], [x + r, y], [x, y + r], [x - r, y], [x, y - r]];
  drawGoldPath(surface, p, alpha);
  surface.fillCircle(x, y, Math.max(1.4, r * 0.14), rgba('#f8d78a', alpha * 0.58));
}

function drawLavaCrack(surface, path, rand, strength = 1) {
  drawPath(surface, path, 18 * strength, rgba('#280b08', 0.54));
  drawPath(surface, path, 9 * strength, rgba('#7c1d12', 0.52));
  drawPath(surface, path, 4 * strength, rgba('#f97316', 0.86));
  drawPath(surface, path, 1.4 * strength, rgba('#fed7aa', 0.94));

  for (let i = 1; i < path.length - 1; i++) {
    const [gx, gy] = path[i];
    surface.radialGlow(gx, gy, 42 * strength, rgba('#f97316', 0.18), 2.2);
    if (rand() < 0.45) {
      const [x, y] = path[i];
      const angle = rand() * Math.PI * 2;
      const len = 26 + rand() * 56;
      const branch = [[x, y], [x + Math.cos(angle) * len, y + Math.sin(angle) * len * 0.68]];
      drawPath(surface, branch, 6 * strength, rgba('#7c1d12', 0.34));
      drawPath(surface, branch, 1.8 * strength, rgba('#fb923c', 0.62));
    }
  }
}

function drawIsoSlab(surface, x, y, w, h, tone, rand) {
  const lift = 10 + rand() * 9;
  const skew = 10 + rand() * 18;
  const top = mix(rgba('#1a2634'), rgba('#354252'), tone);
  const side = mix(rgba('#060a12'), rgba('#17202b'), tone);
  const pts = [
    [x + skew, y],
    [x + w, y + lift],
    [x + w - skew, y + h],
    [x, y + h - lift],
  ];

  surface.fillPolygon([[x, y + h - lift], [x + w - skew, y + h], [x + w - skew, y + h + 12], [x + 4, y + h + 4]], rgba('#020617', 0.48));
  surface.fillPolygon(pts, top);
  surface.fillPolygon([[x, y + h - lift], [x + w - skew, y + h], [x + w - skew, y + h + 8], [x + 4, y + h + 3]], side);
  drawPath(surface, [[x + skew, y], [x + w, y + lift], [x + w - skew, y + h], [x, y + h - lift], [x + skew, y]], 1.6, rgba('#617086', 0.24));
  drawPath(surface, [[x + skew + 3, y + 2], [x + w - 6, y + lift + 2]], 1.2, rgba('#b7c4d5', 0.08));
  drawPath(surface, [[x + 3, y + h - lift], [x + w - skew - 3, y + h - 1]], 1.5, rgba('#020617', 0.34));

  if (rand() > 0.54) {
    const sx = x + 18 + rand() * Math.max(20, w - 36);
    const sy = y + 14 + rand() * Math.max(16, h - 28);
    const len = 18 + rand() * 52;
    const angle = -0.7 + rand() * 1.6;
    surface.drawLine(sx, sy, sx + Math.cos(angle) * len, sy + Math.sin(angle) * len * 0.64, 1 + rand() * 1.2, rgba('#020617', 0.3));
  }

  if (rand() > 0.77) {
    const sx = x + 10 + rand() * Math.max(20, w - 20);
    const sy = y + 10 + rand() * Math.max(16, h - 18);
    surface.fillCircle(sx, sy, 0.8 + rand() * 1.6, rgba('#dbeafe', 0.08));
  }
}

function drawRaisedFrame(surface, x, y, w, h, rand) {
  surface.fillRect(x - 10, y - 8, w + 20, h + 16, rgba('#020617', 0.46));
  surface.fillRect(x, y, w, h, rgba('#0b1019', 0.74));
  surface.drawLine(x + 6, y + 8, x + w - 6, y + 8, 3, rgba('#516071', 0.28));
  surface.drawLine(x + 8, y + h - 8, x + w - 8, y + h - 8, 4, rgba('#020617', 0.52));
  surface.drawLine(x + 8, y + 8, x + 8, y + h - 8, 2.5, rgba('#334155', 0.2));
  surface.drawLine(x + w - 8, y + 8, x + w - 8, y + h - 8, 3, rgba('#020617', 0.42));

  for (let px = x + 18; px < x + w - 18; px += 52 + Math.round(rand() * 9)) {
    drawIsoSlab(surface, px, y + 3 + rand() * 7, 46 + rand() * 9, 40 + rand() * 4, rand() * 0.7, rand);
    drawIsoSlab(surface, px + 4, y + h - 47 + rand() * 5, 48 + rand() * 9, 39 + rand() * 5, rand() * 0.7, rand);
  }
  for (let py = y + 42; py < y + h - 46; py += 48 + Math.round(rand() * 8)) {
    drawIsoSlab(surface, x + 2 + rand() * 5, py, 50 + rand() * 8, 43 + rand() * 5, rand() * 0.7, rand);
    drawIsoSlab(surface, x + w - 55 + rand() * 5, py + 8, 50 + rand() * 8, 43 + rand() * 5, rand() * 0.7, rand);
  }
}

function drawRunicPylon(surface, x, y, tone, rand) {
  const warm = tone === 'warm';
  const glow = warm ? rgba('#f97316', 0.5) : rgba('#38bdf8', 0.44);
  const core = warm ? '#7c1d12' : '#0c4a6e';
  const trim = warm ? '#f8d78a' : '#7dd3fc';
  surface.radialGlow(x, y, warm ? 150 : 136, glow, 1.85);
  surface.fillEllipse(x, y + 18, 70, 32, rgba('#020617', 0.55));
  surface.fillPolygon([[x - 38, y + 38], [x - 24, y - 42], [x + 24, y - 42], [x + 38, y + 38], [x, y + 58]], rgba('#111827', 0.86));
  surface.fillPolygon([[x - 26, y + 30], [x - 15, y - 28], [x + 15, y - 28], [x + 26, y + 30], [x, y + 42]], rgba(core, 0.62));
  surface.drawLine(x - 24, y - 36, x + 24, y - 36, 2.2, rgba(trim, 0.48));
  surface.drawLine(x, y - 34, x, y + 42, 2.4, rgba(trim, 0.34));
  drawDiamond(surface, x, y - 2, 18, warm ? 0.5 : 0.42);
  if (rand() > 0.45) surface.radialGlow(x + (rand() - 0.5) * 18, y - 12 + rand() * 22, 36, rgba(trim, 0.22), 1.8);
}

function drawRuneBand(surface) {
  const gold = 0.78;
  drawGoldPath(surface, [[112, 360], [540, 360]], gold);
  drawGoldPath(surface, [[740, 360], [1168, 360]], gold);
  drawGoldPath(surface, [[640, 112], [640, 256]], gold * 0.82);
  drawGoldPath(surface, [[640, 464], [640, 618]], gold * 0.82);
  drawGoldPath(surface, [[142, 152], [244, 152], [315, 112]], gold * 0.42);
  drawGoldPath(surface, [[1138, 152], [1036, 152], [965, 112]], gold * 0.42);
  drawGoldPath(surface, [[142, 568], [244, 568], [315, 608]], gold * 0.42);
  drawGoldPath(surface, [[1138, 568], [1036, 568], [965, 608]], gold * 0.42);

  for (const [x, y, r] of [
    [164, 360, 18], [316, 360, 13], [486, 360, 12], [794, 360, 12],
    [964, 360, 13], [1116, 360, 18], [640, 150, 14], [640, 248, 12],
    [640, 472, 12], [640, 570, 14], [228, 160, 10], [1052, 160, 10],
    [228, 560, 10], [1052, 560, 10],
  ]) drawDiamond(surface, x, y, r, gold);

  surface.strokeEllipse(640, 360, 150, 88, 2.1, rgba('#b88a3c', 0.58));
  surface.strokeEllipse(640, 360, 116, 68, 1.8, rgba('#d4a84f', 0.46));
  surface.strokeEllipse(640, 360, 78, 45, 1.4, rgba('#d4a84f', 0.42));
  surface.strokeEllipse(640, 360, 39, 23, 1.2, rgba('#f8d78a', 0.32));
  drawGoldPath(surface, [[640, 258], [640, 462]], 0.38);
  drawGoldPath(surface, [[452, 360], [828, 360]], 0.38);
  drawGoldPath(surface, [[540, 304], [740, 416]], 0.24);
  drawGoldPath(surface, [[540, 416], [740, 304]], 0.24);
  drawDiamond(surface, 640, 360, 24, 0.46);
}

function drawStoneFloor(surface, rand) {
  surface.fillPolygon([[96, 116], [1184, 116], [1138, 620], [142, 620]], rgba('#070b12', 0.56));
  surface.fillPolygon([[132, 142], [1148, 142], [1108, 594], [172, 594]], rgba('#101824', 0.42));

  const cols = [136, 232, 332, 432, 532, 632, 732, 832, 932, 1032];
  const rows = [142, 204, 266, 328, 390, 452, 514];
  for (let r = 0; r < rows.length; r++) {
    const y = rows[r] + Math.round((rand() - 0.5) * 6);
    const rowInset = Math.abs(r - 3) * 11;
    for (let c = 0; c < cols.length; c++) {
      const x = cols[c] + (r % 2 ? 44 : 0) + rowInset + Math.round((rand() - 0.5) * 10);
      if (x > 1088) continue;
      drawIsoSlab(surface, x, y, 92 + rand() * 20, 58 + rand() * 11, 0.18 + rand() * 0.62, rand);
    }
  }

  for (let i = 0; i < 72; i++) {
    const x = 150 + rand() * 960;
    const y = 142 + rand() * 460;
    const len = 22 + rand() * 84;
    const angle = -0.25 + rand() * Math.PI;
    surface.drawLine(x, y, x + Math.cos(angle) * len, y + Math.sin(angle) * len * 0.58, 1 + rand() * 1.15, rgba('#020617', 0.2 + rand() * 0.22));
  }

  surface.radialGlow(260, 500, 210, rgba('#fb923c', 0.16), 2.3);
  surface.radialGlow(1030, 250, 190, rgba('#38bdf8', 0.11), 2.25);
}

function drawWallBlock(surface, x, y, w, h, tone = 0.5) {
  const base = mix(rgba('#121821'), rgba('#2c3440'), tone);
  surface.fillRect(x, y, w, h, rgba('#020617', 0.42));
  surface.fillRect(x + 2, y + 2, w - 4, h - 4, base);
  surface.drawLine(x + 3, y + 3, x + w - 4, y + 3, 1.4, rgba('#64748b', 0.34));
  surface.drawLine(x + 3, y + h - 4, x + w - 4, y + h - 4, 1.6, rgba('#020617', 0.46));
  surface.drawLine(x + 3, y + 3, x + 3, y + h - 4, 1, rgba('#94a3b8', 0.14));
}

function drawWalls(surface, rand) {
  surface.fillRect(0, 0, 1280, 52, rgba('#020617', 0.78));
  surface.fillRect(0, 668, 1280, 52, rgba('#020617', 0.8));
  surface.fillRect(0, 0, 54, 720, rgba('#020617', 0.76));
  surface.fillRect(1226, 0, 54, 720, rgba('#020617', 0.8));

  drawRaisedFrame(surface, 70, 66, 1140, 600, rand);

  for (let x = 132; x < 1160; x += 74) {
    drawWallBlock(surface, x, 40 + Math.round(rand() * 4), 58, 44, 0.32 + rand() * 0.52);
    drawWallBlock(surface, x + 10, 72 + Math.round(rand() * 4), 62, 34, 0.22 + rand() * 0.42);
    drawWallBlock(surface, x - 4, 616 + Math.round(rand() * 4), 62, 34, 0.22 + rand() * 0.42);
    drawWallBlock(surface, x + 12, 646 + Math.round(rand() * 4), 58, 44, 0.32 + rand() * 0.52);
  }

  for (let y = 134; y < 596; y += 62) {
    drawWallBlock(surface, 34 + Math.round(rand() * 4), y, 48, 56, 0.28 + rand() * 0.52);
    drawWallBlock(surface, 66 + Math.round(rand() * 4), y + 12, 36, 54, 0.22 + rand() * 0.42);
    drawWallBlock(surface, 1186 + Math.round(rand() * 4), y + 12, 36, 54, 0.22 + rand() * 0.42);
    drawWallBlock(surface, 1210 + Math.round(rand() * 4), y, 48, 56, 0.28 + rand() * 0.52);
  }

  surface.drawLine(94, 112, 1186, 112, 3, rgba('#b88a3c', 0.42));
  surface.drawLine(108, 610, 1172, 610, 3, rgba('#b88a3c', 0.38));
  surface.drawLine(108, 118, 108, 604, 2.2, rgba('#b88a3c', 0.28));
  surface.drawLine(1172, 118, 1172, 604, 2.2, rgba('#b88a3c', 0.26));

  drawStairs(surface, 552, 76, 176, 70, 'top');
  drawStairs(surface, 552, 586, 176, 72, 'bottom');

  drawRunicPylon(surface, 86, 94, 'warm', rand);
  drawRunicPylon(surface, 1196, 94, 'cool', rand);
  drawRunicPylon(surface, 88, 630, 'warm', rand);
  drawRunicPylon(surface, 1194, 630, 'cool', rand);

  drawBanner(surface, 104, 604, -1);
  drawBanner(surface, 1176, 604, 1);
}

function drawStairs(surface, x, y, w, h, dir) {
  const steps = 7;
  for (let i = 0; i < steps; i++) {
    const yy = dir === 'top' ? y + i * (h / steps) : y + h - (i + 1) * (h / steps);
    const inset = i * 5;
    surface.fillRect(x + inset, yy, w - inset * 2, h / steps + 1, rgba(i % 2 ? '#111827' : '#1f2937', 0.66));
    surface.drawLine(x + inset, yy, x + w - inset, yy, 1.4, rgba('#64748b', 0.32));
    surface.drawLine(x + inset, yy + h / steps, x + w - inset, yy + h / steps, 1.5, rgba('#020617', 0.45));
  }
}

function drawTower(surface, x, y, tone) {
  const warm = tone === 'warm';
  const glow = warm ? rgba('#f97316', 0.38) : rgba('#38bdf8', 0.26);
  const trim = warm ? rgba('#f59e0b', 0.7) : rgba('#38bdf8', 0.65);
  surface.radialGlow(x, y, warm ? 128 : 104, glow, 2.1);
  surface.fillEllipse(x, y, 54, 54, rgba('#020617', 0.58));
  surface.strokeEllipse(x, y, 54, 54, 10, rgba('#334155', 0.82));
  surface.strokeEllipse(x, y, 36, 36, 3, trim);
  surface.fillEllipse(x, y, 21, 21, rgba(warm ? '#431407' : '#082f49', 0.94));
  surface.radialGlow(x, y, 42, warm ? rgba('#fb923c', 0.56) : rgba('#38bdf8', 0.44), 1.6);
  drawDiamond(surface, x, y, 14, warm ? 0.52 : 0.34);
}

function drawBanner(surface, x, y, side) {
  const points = side < 0
    ? [[x - 58, y + 26], [x + 24, y + 8], [x + 10, y + 82], [x - 72, y + 70]]
    : [[x + 58, y + 26], [x - 24, y + 8], [x - 10, y + 82], [x + 72, y + 70]];
  surface.fillPolygon(points, rgba('#5f1212', 0.68));
  surface.fillPolygon(points.map(([px, py], i) => [px + side * (i % 2 ? 8 : -3), py + 8]), rgba('#8b1d1d', 0.42));
  drawPath(surface, [points[0], points[1]], 2, rgba('#fca5a5', 0.26));
}

function scatterRubble(surface, rand) {
  for (let i = 0; i < 240; i++) {
    const edgeRoll = rand();
    let x = 80 + rand() * 1120;
    let y = 70 + rand() * 580;
    if (edgeRoll < 0.36) y = rand() < 0.5 ? 84 + rand() * 54 : 580 + rand() * 66;
    else if (edgeRoll < 0.62) x = rand() < 0.5 ? 58 + rand() * 62 : 1160 + rand() * 62;
    const r = rand() * 3.2 + 0.8;
    surface.fillEllipse(x, y, r * (1 + rand() * 1.2), r, rgba(rand() > 0.48 ? '#64748b' : '#1f2937', 0.24 + rand() * 0.26));
    if (rand() > 0.7) surface.fillCircle(x + rand() * 8 - 4, y + rand() * 6 - 3, 0.7 + rand() * 1.4, rgba('#f97316', 0.16));
  }
}

function generateArena() {
  const w = 1280;
  const h = 720;
  const arena = new Surface(w, h);
  const rand = seededRandom(20260605);
  const dark = rgba('#060911');
  const slate = rgba('#1b2432');

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const nx = (x - w / 2) / (w / 2);
      const ny = (y - h / 2) / (h / 2);
      const center = 1 - clamp01(Math.hypot(nx * 0.72, ny * 1.08));
      const vignette = smoothstep(1.12, 0.18, Math.hypot(nx, ny));
      const warmSide = clamp01(1 - Math.hypot((x - 170) / 420, (y - 552) / 300));
      const coldSide = clamp01(1 - Math.hypot((x - 1110) / 360, (y - 184) / 300));
      const grain = Math.sin(x * 0.23 + y * 0.11) * 0.5 + Math.sin(x * 0.047 - y * 0.19) * 0.5;
      let base = mix(dark, slate, center * 0.58 + 0.16 + grain * 0.028);
      base = mix(base, rgba('#33120c'), warmSide * 0.16);
      base = mix(base, rgba('#082f49'), coldSide * 0.12);
      arena.set(x, y, [
        Math.round(base[0] * (0.66 + vignette * 0.42)),
        Math.round(base[1] * (0.68 + vignette * 0.4)),
        Math.round(base[2] * (0.72 + vignette * 0.38)),
        255,
      ]);
    }
  }

  drawStoneFloor(arena, rand);

  arena.radialGlow(86, 520, 310, rgba('#ea580c', 0.36), 2.02);
  arena.radialGlow(240, 636, 260, rgba('#f97316', 0.22), 2.15);
  arena.radialGlow(1200, 116, 250, rgba('#38bdf8', 0.28), 2.05);
  arena.radialGlow(1178, 612, 220, rgba('#2563eb', 0.2), 2.1);
  arena.radialGlow(640, 360, 300, rgba('#f8d78a', 0.045), 2.55);

  drawWalls(arena, rand);

  const crackPaths = [
    [[168, 552], [274, 504], [370, 536], [472, 486], [554, 518]],
    [[202, 184], [314, 230], [434, 202], [526, 252], [604, 228]],
    [[708, 160], [812, 226], [934, 218], [1020, 280], [1122, 272]],
    [[780, 558], [858, 506], [950, 548], [1066, 512]],
    [[604, 94], [636, 216], [620, 318]],
    [[666, 626], [702, 522], [678, 448]],
    [[870, 318], [950, 342], [1036, 318], [1116, 360]],
    [[326, 330], [420, 362], [514, 344]],
  ];
  for (const path of crackPaths) drawLavaCrack(arena, path, rand, rand() > 0.55 ? 0.86 : 1.08);

  drawRuneBand(arena);
  scatterRubble(arena, rand);

  for (let i = 0; i < 260; i++) {
    const x = rand() * w;
    const y = rand() * h;
    const a = rand() * 0.1 + 0.02;
    arena.fillCircle(x, y, rand() * 1.6 + 0.45, rgba(rand() > 0.68 ? '#f97316' : '#94a3b8', a));
  }

  return arena;
}

mkdirSync(outDir, { recursive: true });
const heroSheetPath = resolve(outDir, 'ember-characters-spritesheet.png');
const forceFallbackHeroes = process.argv.includes('--force-placeholder-heroes');
if (!existsSync(heroSheetPath) || forceFallbackHeroes) {
  writePng(heroSheetPath, generateHeroes());
  console.log('Generated web/assets/ember-characters-spritesheet.png');
} else {
  console.log('Preserved existing web/assets/ember-characters-spritesheet.png');
}
writePng(resolve(outDir, 'arena-ember-fortress.png'), generateArena());
writePng(resolve(outDir, 'ember-enemies-spritesheet.png'), generateEnemies());

console.log('Generated web/assets/arena-ember-fortress.png');
console.log('Generated web/assets/ember-enemies-spritesheet.png');
