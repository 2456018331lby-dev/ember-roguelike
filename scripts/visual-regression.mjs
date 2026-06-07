import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { inflateSync } from 'node:zlib';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const screenshotsDir = resolve(root, 'output', 'visual-smoke');
const baselinePath = resolve(root, 'tests', 'visual-regression-baseline.json');

const requiredScreenshots = [
  'menu-desktop.png',
  'character-select-desktop.png',
  'gameplay-desktop.png',
  'reward-desktop.png',
  'rest-desktop.png',
  'boss-wave-desktop.png',
  'boss-fight-desktop.png',
  'boss-fight-highwave-desktop.png',
  'result-desktop.png',
  'menu-mobile.png',
  'character-select-mobile.png',
  'gameplay-mobile.png',
  'reward-mobile.png',
  'rest-mobile.png',
  'boss-fight-mobile.png',
  'result-mobile.png',
];

const strictScreenshots = new Set([
  'character-select-desktop.png',
  'character-select-mobile.png',
]);

const args = new Set(process.argv.slice(2));
const updateBaseline = args.has('--update');
const skipCapture = args.has('--skip-capture');

function assertPng(condition, message) {
  if (!condition) throw new Error(message);
}

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

function unfilterScanlines(raw, width, height, channels) {
  const stride = width * channels;
  const pixels = Buffer.alloc(stride * height);
  let sourceOffset = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[sourceOffset++];
    const rowOffset = y * stride;
    const prevOffset = rowOffset - stride;
    for (let x = 0; x < stride; x++) {
      const rawValue = raw[sourceOffset++];
      const left = x >= channels ? pixels[rowOffset + x - channels] : 0;
      const up = y > 0 ? pixels[prevOffset + x] : 0;
      const upLeft = y > 0 && x >= channels ? pixels[prevOffset + x - channels] : 0;
      let value = rawValue;
      if (filter === 1) value = rawValue + left;
      else if (filter === 2) value = rawValue + up;
      else if (filter === 3) value = rawValue + Math.floor((left + up) / 2);
      else if (filter === 4) value = rawValue + paeth(left, up, upLeft);
      else if (filter !== 0) throw new Error(`Unsupported PNG filter ${filter}`);
      pixels[rowOffset + x] = value & 0xff;
    }
  }
  return pixels;
}

async function readPngPixels(filePath) {
  const png = await readFile(filePath);
  assertPng(png.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])), `${filePath} is not a PNG`);

  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  let interlace = 0;
  const idatChunks = [];

  while (offset < png.length) {
    const length = png.readUInt32BE(offset);
    const type = png.subarray(offset + 4, offset + 8).toString('ascii');
    const data = png.subarray(offset + 8, offset + 8 + length);
    offset += 12 + length;

    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      interlace = data[12];
    } else if (type === 'IDAT') {
      idatChunks.push(data);
    } else if (type === 'IEND') {
      break;
    }
  }

  assertPng(bitDepth === 8, `Unsupported PNG bit depth ${bitDepth} in ${filePath}`);
  assertPng(interlace === 0, `Interlaced PNG is not supported: ${filePath}`);
  const channels = colorType === 6 ? 4 : colorType === 2 ? 3 : 0;
  assertPng(channels > 0, `Unsupported PNG color type ${colorType} in ${filePath}`);

  const raw = inflateSync(Buffer.concat(idatChunks));
  const pixels = unfilterScanlines(raw, width, height, channels);
  const rgba = Buffer.alloc(width * height * 4);
  for (let i = 0, j = 0; i < pixels.length; i += channels, j += 4) {
    rgba[j] = pixels[i];
    rgba[j + 1] = pixels[i + 1];
    rgba[j + 2] = pixels[i + 2];
    rgba[j + 3] = channels === 4 ? pixels[i + 3] : 255;
  }

  return { width, height, rgba, fileBytes: png.length };
}

function round(value, digits = 4) {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

async function measureScreenshot(name) {
  const filePath = join(screenshotsDir, name);
  if (!existsSync(filePath)) throw new Error(`Missing screenshot: ${filePath}`);
  const { width, height, rgba, fileBytes } = await readPngPixels(filePath);
  let r = 0;
  let g = 0;
  let b = 0;
  let luma = 0;
  let dark = 0;
  let light = 0;
  let saturated = 0;
  const pixels = width * height;

  for (let i = 0; i < rgba.length; i += 4) {
    const pr = rgba[i];
    const pg = rgba[i + 1];
    const pb = rgba[i + 2];
    const pl = pr * 0.2126 + pg * 0.7152 + pb * 0.0722;
    r += pr;
    g += pg;
    b += pb;
    luma += pl;
    if (pl < 42) dark++;
    if (pl > 178) light++;
    if (Math.max(pr, pg, pb) - Math.min(pr, pg, pb) > 80) saturated++;
  }

  return {
    mode: strictScreenshots.has(name) ? 'strict' : 'metric',
    width,
    height,
    fileBytes,
    pixelHash: createHash('sha256').update(rgba).digest('hex'),
    metrics: {
      r: round(r / pixels, 2),
      g: round(g / pixels, 2),
      b: round(b / pixels, 2),
      luma: round(luma / pixels, 2),
      darkRatio: round(dark / pixels),
      lightRatio: round(light / pixels),
      saturatedRatio: round(saturated / pixels),
    },
  };
}

async function runVisualSmoke() {
  await new Promise((resolveRun, rejectRun) => {
    const child = spawn(process.execPath, [resolve(root, 'scripts', 'visual-smoke.mjs')], {
      cwd: root,
      stdio: 'inherit',
    });
    child.on('error', rejectRun);
    child.on('exit', code => {
      if (code === 0) resolveRun();
      else rejectRun(new Error(`test:visual-smoke exited with code ${code}`));
    });
  });
}

async function collectCurrent() {
  const screenshots = {};
  for (const name of requiredScreenshots) {
    screenshots[name] = await measureScreenshot(name);
  }
  return {
    version: 1,
    description: 'Stable screens use exact decoded RGBA hashes; animated screens use decoded pixel metrics with tolerances.',
    screenshots,
  };
}

function fail(message, failures) {
  failures.push(message);
}

function compareMetric(name, key, current, expected, tolerance, failures) {
  const delta = Math.abs(current - expected);
  if (delta > tolerance) {
    fail(`${name} ${key} changed by ${round(delta, 3)} (expected ${expected}, current ${current}, tolerance ${tolerance})`, failures);
  }
}

function compareScreenshot(name, current, expected, failures) {
  if (!expected) {
    fail(`${name} is missing from baseline`, failures);
    return;
  }
  if (current.width !== expected.width || current.height !== expected.height) {
    fail(`${name} dimensions changed ${expected.width}x${expected.height} -> ${current.width}x${current.height}`, failures);
  }
  if (current.mode !== expected.mode) {
    fail(`${name} mode changed ${expected.mode} -> ${current.mode}`, failures);
  }

  if (expected.mode === 'strict') {
    if (current.pixelHash !== expected.pixelHash) {
      fail(`${name} decoded pixel hash changed`, failures);
    }
    return;
  }

  compareMetric(name, 'fileBytes', current.fileBytes, expected.fileBytes, 140000, failures);
  compareMetric(name, 'luma', current.metrics.luma, expected.metrics.luma, 18, failures);
  compareMetric(name, 'r', current.metrics.r, expected.metrics.r, 22, failures);
  compareMetric(name, 'g', current.metrics.g, expected.metrics.g, 22, failures);
  compareMetric(name, 'b', current.metrics.b, expected.metrics.b, 22, failures);
  compareMetric(name, 'darkRatio', current.metrics.darkRatio, expected.metrics.darkRatio, 0.16, failures);
  compareMetric(name, 'lightRatio', current.metrics.lightRatio, expected.metrics.lightRatio, 0.12, failures);
  compareMetric(name, 'saturatedRatio', current.metrics.saturatedRatio, expected.metrics.saturatedRatio, 0.14, failures);
}

if (!skipCapture) {
  await runVisualSmoke();
}

const current = await collectCurrent();

if (updateBaseline) {
  await mkdir(dirname(baselinePath), { recursive: true });
  await writeFile(baselinePath, `${JSON.stringify(current, null, 2)}\n`);
  console.log(`Visual regression baseline updated: ${baselinePath}`);
  process.exit(0);
}

if (!existsSync(baselinePath)) {
  throw new Error(`Missing visual regression baseline. Run: node scripts/visual-regression.mjs --update`);
}

const baseline = JSON.parse(await readFile(baselinePath, 'utf8'));
const failures = [];
for (const name of requiredScreenshots) {
  compareScreenshot(name, current.screenshots[name], baseline.screenshots?.[name], failures);
}

for (const name of Object.keys(baseline.screenshots || {})) {
  if (!requiredScreenshots.includes(name)) fail(`${name} exists in baseline but is no longer captured`, failures);
}

if (failures.length) {
  console.error('Visual regression check failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Visual regression check passed: strict pixel hashes and decoded pixel metrics match baseline.');
