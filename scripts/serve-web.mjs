import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..', 'web');
const port = Number(process.env.PORT || 5173);
const host = process.env.HOST || '127.0.0.1';

const MIME_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
};

function send(res, status, body, contentType = 'text/plain; charset=utf-8') {
  res.writeHead(status, {
    'Cache-Control': 'no-store',
    'Content-Type': contentType,
  });
  res.end(body);
}

function resolvePath(urlPath) {
  const clean = decodeURIComponent(urlPath.split('?')[0] || '/');
  const relative = clean === '/' ? 'index.html' : clean.replace(/^\/+/, '');
  const target = path.resolve(root, relative);
  return target.startsWith(root) ? target : null;
}

const server = http.createServer(async (req, res) => {
  const target = resolvePath(req.url || '/');
  if (!target) return send(res, 403, 'forbidden');

  try {
    const stats = await fs.stat(target).catch(() => null);
    const filePath = stats?.isDirectory() ? path.join(target, 'index.html') : target;
    const data = await fs.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    send(res, 200, data, MIME_TYPES[ext] || 'application/octet-stream');
  } catch {
    send(res, 404, 'not found');
  }
});

server.listen(port, host, () => {
  console.log(`Ember web served at http://${host}:${port}`);
});
