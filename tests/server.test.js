import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

async function availablePort() {
  const probe = net.createServer();
  await new Promise((resolve, reject) => { probe.once('error', reject); probe.listen(0, '127.0.0.1', resolve); });
  const port = probe.address().port;
  await new Promise((resolve) => probe.close(resolve));
  return port;
}

function request(port, path, method = 'GET') {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port, path, method }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString('utf8') }));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.setTimeout(3000, () => req.destroy(new Error('Local test request timed out.')));
    req.end();
  });
}

test('local server serves the game and handles malformed or private paths without exiting', async (t) => {
  const port = await availablePort();
  const child = spawn(process.execPath, [fileURLToPath(new URL('../server.mjs', import.meta.url))], {
    env: { ...process.env, PORT: String(port) },
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let diagnostics = '';
  child.stderr.on('data', (chunk) => { diagnostics += chunk; });
  t.after(async () => {
    if (child.exitCode !== null || child.signalCode !== null) return;
    const exited = new Promise((resolve) => child.once('exit', resolve));
    child.kill();
    await exited;
  });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Server did not start: ${diagnostics}`)), 5000);
    child.once('error', (error) => { clearTimeout(timer); reject(error); });
    child.once('exit', () => { clearTimeout(timer); reject(new Error(`Server exited before startup: ${diagnostics}`)); });
    child.stdout.once('data', () => { clearTimeout(timer); resolve(); });
  });

  await t.test('home and modules have the correct content types; HEAD omits its body', async () => {
    const home = await request(port, '/');
    assert.equal(home.status, 200);
    assert.match(home.headers['content-type'], /^text\/html/);
    assert.match(home.body, /山海食谱铺/);
    const module = await request(port, '/src/engine.js');
    assert.equal(module.status, 200);
    assert.match(module.headers['content-type'], /^text\/javascript/);
    assert.equal(module.headers['x-content-type-options'], 'nosniff');
    const head = await request(port, '/src/engine.js', 'HEAD');
    assert.equal(head.status, 200);
    assert.equal(head.body, '');
    assert.equal(head.headers['content-type'], module.headers['content-type']);
  });

  await t.test('missing files, directory URLs and malformed encoding are rejected', async () => {
    assert.equal((await request(port, '/missing-game-file.png')).status, 404);
    assert.equal((await request(port, '/src/')).status, 404);
    assert.equal((await request(port, '/%E0%A4%A')).status, 400);
  });

  await t.test('private metadata stays inaccessible with either path separator', async () => {
    for (const path of ['/.git/HEAD', '/%5c.git%5cHEAD', '/src%5c..%5c.git%5cHEAD']) {
      const response = await request(port, path);
      assert.ok([400, 403, 404].includes(response.status), `Private path ${path} returned ${response.status}`);
    }
  });

  await t.test('NUL bytes are rejected without crashing subsequent game requests', async () => {
    const malformed = await request(port, '/src/%00');
    assert.equal(malformed.status, 400);
    assert.equal((await request(port, '/')).status, 200);
  });
});
