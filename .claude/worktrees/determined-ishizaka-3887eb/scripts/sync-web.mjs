import { cp, mkdir, readdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const webDir = path.join(rootDir, 'web');
const docsDir = path.join(rootDir, 'docs');

const mirroredEntries = [
  'index.html',
  'styles.css',
  'manifest.webmanifest',
  'sw.js',
  'icons',
  'src',
];

async function ensureDir(dir) {
  await mkdir(dir, { recursive: true });
}

async function removeIfExists(targetPath) {
  await rm(targetPath, { recursive: true, force: true });
}

async function copyEntry(entry) {
  const from = path.join(webDir, entry);
  const to = path.join(docsDir, entry);
  await removeIfExists(to);
  await cp(from, to, { recursive: true, force: true });
}

async function verifyEntryExists(entry) {
  const fullPath = path.join(webDir, entry);
  await stat(fullPath);
}

async function main() {
  await removeIfExists(docsDir);
  await ensureDir(docsDir);

  for (const entry of mirroredEntries) {
    await verifyEntryExists(entry);
    await copyEntry(entry);
  }

  const mirroredList = await readdir(docsDir);
  console.log(`Synced web assets to docs: ${mirroredEntries.join(', ')}`);
  console.log(`Docs now contains ${mirroredList.length} top-level entries.`);
}

main().catch(error => {
  console.error('Failed to sync web assets to docs.');
  console.error(error);
  process.exitCode = 1;
});
