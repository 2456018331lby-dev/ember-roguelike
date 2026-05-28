import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const webDir = resolve(root, 'web');
const docsDir = resolve(root, 'docs');

function copyDir(from, to) {
  cpSync(from, to, { recursive: true, force: true });
}

function syncDocs() {
  mkdirSync(docsDir, { recursive: true });
  for (const entry of readdirSync(docsDir)) {
    if (entry === 'next-phase-plan.md') continue;
    rmSync(resolve(docsDir, entry), { recursive: true, force: true });
  }
  copyDir(webDir, docsDir);
  console.log('Synced web -> docs');
}

function syncAndroid() {
  const capCli = resolve(root, 'node_modules', '@capacitor', 'cli', 'bin', 'capacitor');
  if (!existsSync(capCli)) {
    throw new Error('Capacitor CLI not found in node_modules. Run npm install first.');
  }

  execFileSync('node', [capCli, 'sync', 'android'], {
    cwd: root,
    stdio: 'inherit',
  });
}

syncDocs();
syncAndroid();
