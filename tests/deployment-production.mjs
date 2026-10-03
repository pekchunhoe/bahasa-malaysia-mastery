// Run after npm run build: node --test tests/deployment-production.mjs
// Exercises published bytes and HTTP delivery; this is not a browser UI test.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const out = fileURLToPath(new URL('../dist/', import.meta.url));
async function files(dir) {
  const result = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) result.push(...await files(file)); else result.push(file);
  }
  return result;
}

test('production metadata is content-derived and matches the injected watcher with the notice included', async () => {
  const { version } = JSON.parse(await readFile(path.join(out, 'version.json'), 'utf8'));
  assert.match(version, /^bmMastery-[a-f0-9]{12}$/);
  const digest = createHash('sha256');
  for (const file of (await files(out)).filter(file => path.relative(out, file) !== 'version.json').sort()) {
    const relative = path.relative(out, file).replaceAll('\\', '/');
    let bytes = await readFile(file);
    if (relative === 'js/deployment-version.js') {
      const source = bytes.toString('utf8');
      assert.ok(source.includes(`const BUILD_VERSION = "${version}";`));
      assert.ok(source.includes('BUILD_VERSION !== "__BUILD_VERSION__"'));
      bytes = Buffer.from(source.replace(version, '__BUILD_VERSION__'));
    }
    digest.update(relative); digest.update(bytes);
  }
  assert.equal(version, `bmMastery-${digest.digest('hex').slice(0, 12)}`);
  assert.match(await readFile(path.join(out, 'components/deployment-update.js'), 'utf8'), /Versi baharu tersedia/);
  assert.match(await readFile(path.join(out, 'js/app.js'), 'utf8'), /watchForDeploymentUpdate\(createDeploymentUpdateNotice/);
  assert.match(await readFile(path.join(out, 'styles/app.css'), 'utf8'), /\.deployment-update-notice/);
  const config = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'));
  assert.equal(config.outputDirectory, 'dist');
  assert.ok(config.headers.find(rule => rule.source === '/version.json').headers.some(header => header.key === 'Cache-Control' && header.value === 'no-store'));
  assert.ok(config.headers.find(rule => rule.source === '/(.*)').headers.some(header => header.key === 'Cache-Control' && header.value === 'no-cache, must-revalidate'));
});

test('production HTTP serves the current version and reloadable app assets on the deployed paths', async t => {
  const child = spawn(process.execPath, ['tools/serve.mjs', '--dist'], {
    cwd: new URL('..', import.meta.url), env: { ...process.env, PORT: '4191', GEMINI_API_KEY: '' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  t.after(() => child.kill());
  await new Promise((resolve, reject) => {
    let output = '';
    const timer = setTimeout(() => reject(new Error('Production server startup timed out')), 10000);
    child.stdout.on('data', data => {
      output += data;
      if (output.includes('http://localhost:4191')) { clearTimeout(timer); resolve(); }
    });
    child.once('error', error => { clearTimeout(timer); reject(error); });
    child.once('exit', code => { clearTimeout(timer); reject(new Error(`Server exited: ${code}`)); });
  });
  const base = 'http://127.0.0.1:4191';
  const metadataURL = new URL('../version.json', `${base}/js/deployment-version.js`);
  const response = await fetch(metadataURL, { cache: 'no-store' });
  assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store');
  const metadata = await response.json();
  assert.deepEqual(metadata, JSON.parse(await readFile(path.join(out, 'version.json'), 'utf8')));
  for (const resource of ['index.html', 'js/app.js', 'js/deployment-version.js', 'components/deployment-update.js', 'styles/app.css']) {
    const asset = await fetch(`${base}/${resource}`);
    assert.equal(asset.status, 200, resource);
    assert.match(asset.headers.get('cache-control'), /no-cache/);
    assert.equal(await asset.text(), await readFile(path.join(out, resource), 'utf8'));
  }
});
