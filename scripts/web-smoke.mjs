import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { inflateSync } from 'node:zlib';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const webRoot = resolve(root, 'web');
const failures = [];

const REQUIRED_ENEMY_TILES = {
  slime: [0, 0],
  bat: [1, 0],
  skeleton: [2, 0],
  golem: [3, 0],
  archer: [0, 1],
  fire_mage: [1, 1],
  healer: [2, 1],
  summoner: [3, 1],
  charger: [0, 2],
  bomber: [1, 2],
  dragon: [2, 2],
  lich: [3, 2],
  demon: [0, 3],
};

const REQUIRED_DIMENSIONS = {
  'assets/ember-characters-spritesheet.png': [512, 256],
  'assets/ember-enemies-spritesheet.png': [512, 512],
  'assets/arena-ember-fortress.png': [1280, 720],
};

function assert(condition, message) {
  if (!condition) failures.push(message);
}

function webPath(rel) {
  return resolve(webRoot, rel.replace(/^\.\//, ''));
}

async function readWebText(rel) {
  return await readFile(webPath(rel), 'utf8');
}

function parseSwAssets(swText) {
  const match = swText.match(/const\s+ASSETS\s*=\s*\[([\s\S]*?)\];/);
  assert(Boolean(match), 'sw.js should define an ASSETS array');
  if (!match) return new Set();

  const assets = new Set();
  for (const item of match[1].matchAll(/['"]([^'"]+)['"]/g)) assets.add(item[1]);
  return assets;
}

function normalizeAsset(asset) {
  if (asset === './') return 'index.html';
  return asset.replace(/^\.\//, '');
}

function assetUrlPath(asset) {
  if (asset === './') return '/';
  return `/${normalizeAsset(asset).replace(/\\/g, '/')}`;
}

async function collectModuleDependencies(entryRel) {
  const seen = new Set();

  async function visit(rel) {
    const normalized = rel.replace(/\\/g, '/').replace(/^\.\//, '');
    if (seen.has(normalized)) return;
    seen.add(normalized);

    const text = await readWebText(normalized);
    const baseDir = normalized.split('/').slice(0, -1).join('/');
    const importPattern = /import\s+(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]/g;
    for (const match of text.matchAll(importPattern)) {
      const spec = match[1];
      if (!spec.startsWith('./') && !spec.startsWith('../')) continue;
      if (!spec.endsWith('.mjs')) continue;
      const next = resolvePosix(baseDir, spec);
      if (next.startsWith('src/')) await visit(next);
    }
  }

  await visit(entryRel);
  return new Set([...seen].map(rel => `./${rel}`));
}

function resolvePosix(baseDir, spec) {
  const parts = `${baseDir}/${spec}`.split('/');
  const out = [];
  for (const part of parts) {
    if (!part || part === '.') continue;
    if (part === '..') out.pop();
    else out.push(part);
  }
  return out.join('/');
}

function parsePng(buffer, label) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  assert(buffer.subarray(0, 8).equals(signature), `${label} should be a PNG`);

  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  const idats = [];
  let offset = 8;

  while (offset + 12 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    offset += length + 12;

    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
    } else if (type === 'IDAT') {
      idats.push(data);
    } else if (type === 'IEND') {
      break;
    }
  }

  assert(width > 0 && height > 0, `${label} should have PNG dimensions`);
  assert(bitDepth === 8 && colorType === 6, `${label} should be 8-bit RGBA PNG`);
  if (bitDepth !== 8 || colorType !== 6) return { width, height, pixels: Buffer.alloc(0) };

  const inflated = inflateSync(Buffer.concat(idats));
  const stride = width * 4;
  const pixels = Buffer.alloc(stride * height);
  let rawOffset = 0;
  let previous = Buffer.alloc(stride);

  for (let y = 0; y < height; y++) {
    const filter = inflated[rawOffset++];
    const source = inflated.subarray(rawOffset, rawOffset + stride);
    rawOffset += stride;
    const row = Buffer.alloc(stride);

    for (let i = 0; i < stride; i++) {
      const left = i >= 4 ? row[i - 4] : 0;
      const up = previous[i] || 0;
      const upLeft = i >= 4 ? previous[i - 4] || 0 : 0;
      let predictor = 0;
      if (filter === 1) predictor = left;
      else if (filter === 2) predictor = up;
      else if (filter === 3) predictor = Math.floor((left + up) / 2);
      else if (filter === 4) predictor = paeth(left, up, upLeft);
      else assert(filter === 0, `${label} uses unsupported PNG filter ${filter}`);
      row[i] = (source[i] + predictor) & 0xff;
    }

    row.copy(pixels, y * stride);
    previous = row;
  }

  return { width, height, pixels };
}

function paeth(left, up, upLeft) {
  const p = left + up - upLeft;
  const pa = Math.abs(p - left);
  const pb = Math.abs(p - up);
  const pc = Math.abs(p - upLeft);
  if (pa <= pb && pa <= pc) return left;
  if (pb <= pc) return up;
  return upLeft;
}

function countAlpha(png, x0 = 0, y0 = 0, width = png.width, height = png.height) {
  let count = 0;
  for (let y = y0; y < y0 + height; y++) {
    for (let x = x0; x < x0 + width; x++) {
      if (png.pixels[(y * png.width + x) * 4 + 3] > 8) count++;
    }
  }
  return count;
}

async function validatePngAssets() {
  for (const [rel, [expectedWidth, expectedHeight]] of Object.entries(REQUIRED_DIMENSIONS)) {
    const file = webPath(rel);
    assert(existsSync(file), `${rel} should exist`);
    if (!existsSync(file)) continue;
    const png = parsePng(await readFile(file), rel);
    assert(png.width === expectedWidth && png.height === expectedHeight, `${rel} should be ${expectedWidth}x${expectedHeight}`);
    assert(countAlpha(png) > expectedWidth * expectedHeight * 0.04, `${rel} should contain visible pixels`);

    if (rel === 'assets/ember-enemies-spritesheet.png') {
      for (const [kind, [col, row]] of Object.entries(REQUIRED_ENEMY_TILES)) {
        const visible = countAlpha(png, col * 128, row * 128, 128, 128);
        assert(visible > 650, `enemy tile "${kind}" should contain visible pixels`);
      }
    }
  }
}

async function validateServiceWorker() {
  const swText = await readWebText('sw.js');
  const assets = parseSwAssets(swText);
  assert(/const\s+CACHE\s*=\s*['"]ember-v\d+['"]/.test(swText), 'sw.js should use a versioned ember cache name');
  assert(swText.includes('url.origin !== self.location.origin'), 'sw.js should not intercept cross-origin requests');
  assert(swText.includes("new Response('', { status: 504"), 'sw.js should return a Response for uncached offline GET requests');
  assert(!swText.includes('.addAll('), 'sw.js should not use cache.addAll because Android WebView can reject the whole install');
  assert(swText.includes('cache.add(asset)'), 'sw.js should precache assets individually');
  assert(swText.includes('precacheAssets().catch(() => {})'), 'sw.js install should tolerate cache storage failures');
  assert(swText.includes("cache.put(event.request, clone))\n        .catch(() => {})"), 'sw.js runtime cache writes should not create unhandled WebView errors');
  assert(assets.size === new Set(assets).size, 'sw.js ASSETS should not contain duplicates');

  const requiredBaseAssets = [
    './',
    './index.html',
    './styles.css',
    './manifest.webmanifest',
    './sw.js',
    './icons/icon.svg',
  ];
  for (const asset of requiredBaseAssets) assert(assets.has(asset), `sw.js should precache ${asset}`);

  const moduleAssets = await collectModuleDependencies('src/main.mjs');
  for (const asset of moduleAssets) assert(assets.has(asset), `sw.js should precache imported module ${asset}`);

  const mainText = await readWebText('src/main.mjs');
  for (const match of mainText.matchAll(/new URL\(['"]\.\.\/assets\/([^'"]+)['"]/g)) {
    const asset = `./assets/${match[1]}`;
    assert(assets.has(asset), `sw.js should precache art asset ${asset}`);
  }

  const manifest = JSON.parse(await readWebText('manifest.webmanifest'));
  for (const icon of manifest.icons || []) {
    const asset = icon.src.startsWith('./') ? icon.src : `./${icon.src}`;
    assert(assets.has(asset), `sw.js should precache manifest icon ${asset}`);
  }

  for (const asset of assets) {
    const rel = normalizeAsset(asset);
    assert(existsSync(webPath(rel)), `precache asset should exist: ${asset}`);
  }
}

async function validateEnemyMapping() {
  const mainText = await readWebText('src/main.mjs');
  assert(mainText.includes('ember-enemies-spritesheet.png'), 'main.mjs should load enemy spritesheet');
  assert(mainText.includes('function drawEnemySprite'), 'main.mjs should define drawEnemySprite fallback path');
  assert(mainText.includes('difficulty-option'), 'main.mjs should render difficulty options');
  assert(mainText.includes('selectedDifficultyId'), 'main.mjs should pass selected difficulty into runs');
  for (const kind of Object.keys(REQUIRED_ENEMY_TILES)) {
    assert(new RegExp(`${kind}\\s*:`).test(mainText), `main.mjs should map enemy sprite "${kind}"`);
  }
}

async function validateMainCoreBindings() {
  const mainText = await readWebText('src/main.mjs');
  const match = mainText.match(/import\s*\{([\s\S]*?)\}\s*from\s*['"]\.\/game_core\.mjs['"]/);
  assert(Boolean(match), 'main.mjs should import named game_core bindings');
  if (!match) return;

  const imported = new Set(match[1]
    .split(',')
    .map(name => name.trim().split(/\s+as\s+/).pop()?.trim())
    .filter(Boolean));
  const requiredUiActions = [
    'applyCardChoice',
    'applyForgeChoice',
    'applyShopChoice',
    'applyRestChoice',
    'rerollRewardChoices',
    'getDifficultyPresets',
    'dash',
  ];

  for (const name of requiredUiActions) {
    assert(imported.has(name), `main.mjs should import ${name} before binding UI handlers`);
  }
}

async function validateChoiceStateRouting() {
  const mainText = await readWebText('src/main.mjs');
  assert(mainText.includes('function syncOverlayForRunState'), 'main.mjs should centralize overlay routing after state changes');

  const routedChoiceCalls = [
    ['applyCardChoice', /applyCardChoice\(run,\s*card\);\s*syncOverlayForRunState\(\{\s*resumeIfPlaying:\s*true\s*\}\);/],
    ['applyForgeChoice', /applyForgeChoice\(run,\s*choice\);\s*syncOverlayForRunState\(\{\s*resumeIfPlaying:\s*true\s*\}\);/],
    ['applyShopChoice', /applyShopChoice\(run,\s*choice\);\s*syncOverlayForRunState\(\{\s*resumeIfPlaying:\s*true\s*\}\);/],
    ['applyRestChoice', /applyRestChoice\(run,\s*choice\);\s*syncOverlayForRunState\(\{\s*resumeIfPlaying:\s*true\s*\}\);/],
  ];

  for (const [name, pattern] of routedChoiceCalls) {
    assert(pattern.test(mainText), `main.mjs ${name} click handler should route through syncOverlayForRunState`);
  }

  const directHideAfterChoice = /apply(?:Card|Forge|Shop|Rest)Choice\(run,[\s\S]{0,180}rewardEl\.classList\.add\('hidden'\)/;
  assert(!directHideAfterChoice.test(mainText), 'choice handlers should not directly hide reward overlay after mutating run.state');
}

async function validateParticleRenderingCoverage() {
  const mainText = await readWebText('src/main.mjs');
  const coreText = await readWebText('src/game_core.mjs');
  const emitted = new Set();
  for (const match of coreText.matchAll(/particles\.push\(\s*\{[\s\S]*?type:\s*['"]([^'"]+)['"]/g)) {
    emitted.add(match[1]);
  }

  const rendered = new Set();
  for (const match of mainText.matchAll(/case\s+['"]([^'"]+)['"]\s*:/g)) {
    rendered.add(match[1]);
  }

  assert(emitted.size > 0, 'game_core.mjs should emit particle types for combat feedback');
  for (const type of emitted) {
    assert(rendered.has(type), `main.mjs drawParticles should render emitted particle type "${type}"`);
  }
}

async function findOpenPort() {
  return await new Promise((resolvePort, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      server.close(() => resolvePort(port));
    });
  });
}

async function waitForHttp(url) {
  for (let i = 0; i < 40; i++) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // Retry while the child server starts.
    }
    await new Promise(resolveDelay => setTimeout(resolveDelay, 100));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function validateServer() {
  const port = await findOpenPort();
  const child = spawn(process.execPath, [resolve(root, 'scripts', 'serve-web.mjs')], {
    cwd: root,
    env: { ...process.env, HOST: '127.0.0.1', PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let stderr = '';
  child.stderr.on('data', chunk => {
    stderr += chunk.toString();
  });

  try {
    const base = `http://127.0.0.1:${port}`;
    await waitForHttp(`${base}/`);

    const probes = [
      ['/', 'text/html'],
      ['/src/main.mjs', 'text/javascript'],
      ['/src/game_core.mjs', 'text/javascript'],
      ['/assets/ember-enemies-spritesheet.png', 'image/png'],
      ['/manifest.webmanifest', 'application/manifest+json'],
    ];

    for (const [urlPath, expectedType] of probes) {
      const response = await fetch(`${base}${urlPath}`);
      assert(response.ok, `${urlPath} should return HTTP 200`);
      const type = response.headers.get('content-type') || '';
      assert(type.includes(expectedType), `${urlPath} should return ${expectedType}, got ${type || 'empty content-type'}`);
    }

    const swAssets = parseSwAssets(await readWebText('sw.js'));
    for (const asset of swAssets) {
      const response = await fetch(`${base}${assetUrlPath(asset)}`);
      assert(response.ok, `served precache asset should return HTTP 200: ${asset}`);
    }
  } finally {
    child.kill();
  }

  assert(!stderr.trim(), `serve-web.mjs should not write stderr: ${stderr.trim()}`);
}

await validatePngAssets();
await validateServiceWorker();
await validateEnemyMapping();
await validateMainCoreBindings();
await validateChoiceStateRouting();
await validateParticleRenderingCoverage();
await validateServer();

if (failures.length) {
  console.error('Web smoke check failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Web smoke check passed: assets, spritesheets, service worker precache, UI state routing, and local MIME serving are valid.');
