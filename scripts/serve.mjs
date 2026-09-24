import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { networkInterfaces } from 'node:os';
import { spawn } from 'node:child_process';
import { root, dist, siteFiles } from './files.mjs';
import { site } from './site.mjs';

const args = new Set(process.argv.slice(2));
const port = Number(process.env.PORT || site.port);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be between 1 and 65535');
const base = args.has('--dist') ? dist : root;
const allowed = new Set(await siteFiles(base));
const url = 'http://' + site.hostname + ':' + port + '/';
const shouldOpen = args.has('--open') && !args.has('--no-open');
const mime = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.md': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav', '.ogg': 'audio/ogg',
};
function openBrowser() {
  if (!shouldOpen) return;
  const command = process.platform === 'win32' ? 'powershell.exe' : process.platform === 'darwin' ? 'open' : 'xdg-open';
  const params = process.platform === 'win32'
    ? ['-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden', '-Command', "Start-Process '" + url + "'"]
    : [url];
  const child = spawn(command, params, { windowsHide: true, stdio: 'ignore' });
  child.on('error', () => console.log('Open this address in your browser: ' + url));
  child.unref();
}
const server = http.createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Game-Id', site.id);
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { Allow: 'GET, HEAD' }).end();
    return;
  }
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch {
    res.writeHead(400).end();
    return;
  }
  if (pathname.includes('\\') || pathname.includes('\0')) {
    res.writeHead(400).end();
    return;
  }
  const name = pathname === '/' ? 'index.html' : pathname.slice(1);
  if (!allowed.has(name)) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found');
    return;
  }
  try {
    const body = await readFile(path.join(base, name));
    res.writeHead(200, {
      'Content-Type': mime[path.extname(name).toLowerCase()] || 'application/octet-stream',
      'Content-Length': body.length,
      'Cache-Control': 'no-cache',
    });
    res.end(req.method === 'HEAD' ? undefined : body);
  } catch {
    res.writeHead(404).end();
  }
});
server.on('error', async error => {
  if (error.code === 'EADDRINUSE') {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1500) });
      await response.body?.cancel();
      if (response.ok && response.headers.get('X-Game-Id') === site.id) {
        console.log('Game is already running: ' + url);
        openBrowser();
        return;
      }
    } catch {}
    console.error('Port ' + port + ' is in use. Close the other server or set PORT to another port.');
  } else console.error(error.message);
  process.exitCode = 1;
});
server.listen(port, args.has('--lan') ? '0.0.0.0' : '127.0.0.1', () => {
  console.log(site.title + ': ' + url);
  console.log('Keep this window open. Press Ctrl+C to stop.');
  if (args.has('--lan')) {
    for (const entries of Object.values(networkInterfaces())) {
      for (const item of entries || []) {
        if (item.family === 'IPv4' && !item.internal && !item.address.startsWith('169.254.')) {
          console.log('LAN: http://' + item.address + ':' + port + '/');
        }
      }
    }
  }
  openBrowser();
});
