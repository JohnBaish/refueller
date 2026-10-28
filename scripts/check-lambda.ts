// Checks for the Lambda package (PLAN Stage 1c): the handler against a fake Fuel Finder server, and the real built bundle.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { pathToFileURL } from 'node:url';
import { makeHandler } from '../lambda/make-handler.ts';

let failures = 0;
async function check(name: string, fn: () => void | Promise<void>) {
  try {
    await fn();
    console.log(`ok   ${name}`);
  } catch (e) {
    failures++;
    console.log(`FAIL ${name}\n     ${(e as Error).message.split('\n').join('\n     ')}`);
  }
}

const ID = 'lambda-test-client-id-01';
const SECRET = 'lambda-test-client-secret-02';
const TOKEN = 'lambda-test-token-0123456789';

function sampleRecords(file: string): Record<string, unknown>[] {
  const m = /```json\n([\s\S]*?)\n```/.exec(readFileSync(new URL(`../design/${file}`, import.meta.url), 'utf8'));
  assert.ok(m);
  return JSON.parse(m[1]);
}
const stations = sampleRecords('fuel-finder-stations-sample-2026-10-24.md');
const prices = sampleRecords('fuel-finder-prices-sample-2026-10-24.md').map((p, i) => ({ ...p, node_id: stations[i].node_id }));

async function server(mode: 'good' | 'blocked') {
  const s = createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      const url = new URL(req.url ?? '/', 'http://x');
      const send = (status: number, value?: unknown) => {
        res.writeHead(status, { 'content-type': 'application/json', ...(mode === 'blocked' ? { server: 'CloudFront' } : {}) });
        res.end(value === undefined ? undefined : JSON.stringify(value));
      };
      if (mode === 'blocked') return send(403);
      if (req.method === 'POST' && url.pathname.endsWith('/generate_access_token')) {
        const sent = JSON.parse(body || '{}');
        if (sent.client_id !== ID || sent.client_secret !== SECRET) return send(401, { message: 'Unauthorized' });
        return send(200, { success: true, data: { access_token: TOKEN, token_type: 'Bearer', expires_in: 3600 } });
      }
      if (req.headers.authorization !== `Bearer ${TOKEN}`) return send(401, {});
      const n = Number(url.searchParams.get('batch-number'));
      if (url.pathname === '/api/v1/pfs') return send(200, n === 1 ? stations : []);
      if (url.pathname === '/api/v1/pfs/fuel-prices') return send(200, n === 1 ? prices : []);
      send(404, {});
    });
  });
  await new Promise<void>((r) => s.listen(0, '127.0.0.1', r));
  return { url: `http://127.0.0.1:${(s.address() as AddressInfo).port}`, close: () => new Promise<void>((r) => s.close(() => r())) };
}

const fast = { allowLocal: true, paceMs: 0, backoffMs: 1 };
const withEnv = async (env: Record<string, string | undefined>, fn: () => Promise<void>) => {
  const before = { ...process.env };
  for (const [k, v] of Object.entries(env)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  const log = console.log;
  console.log = () => {}; // the handler logs for CloudWatch; keep the check output tidy
  try {
    await fn();
  } finally {
    console.log = log;
    for (const k of Object.keys(env)) {
      if (before[k] === undefined) delete process.env[k];
      else process.env[k] = before[k];
    }
  }
};

await check('handler: missing settings give a plain answer and no request', async () => {
  const api = await server('good');
  try {
    await withEnv({ FUEL_FINDER_CLIENT_ID: undefined, FUEL_FINDER_CLIENT_SECRET: SECRET, AWS_REGION: 'eu-west-2' }, async () => {
      const r = (await makeHandler({ hosts: [api.url], ...fast })()) as { ok: boolean; problem?: string; ranOn: { awsRegion: string } };
      assert.equal(r.ok, false);
      assert.match(r.problem ?? '', /not both set/);
      assert.equal(r.ranOn.awsRegion, 'eu-west-2');
    });
  } finally {
    await api.close();
  }
});

await check('handler: a full run returns the summary, and no secret or token anywhere in it', async () => {
  const api = await server('good');
  try {
    await withEnv({ FUEL_FINDER_CLIENT_ID: ID, FUEL_FINDER_CLIENT_SECRET: SECRET, AWS_REGION: 'eu-west-2' }, async () => {
      const r = (await makeHandler({ hosts: [api.url], ...fast })()) as { ok: boolean; ranOn: { awsRegion: string }; summary: Record<string, any> };
      assert.equal(r.ok, true);
      assert.equal(r.ranOn.awsRegion, 'eu-west-2');
      assert.equal(r.summary.stations.totalRecords, 3);
      assert.equal(r.summary.prices.totalRecords, 3);
      const text = JSON.stringify(r);
      for (const secret of [ID, SECRET, TOKEN]) assert.equal(text.includes(secret), false, `returned ${secret}`);
      assert.equal(text.includes(String(stations[0].node_id)), false, 'returned a station code');
    });
  } finally {
    await api.close();
  }
});

await check('handler: a refused front door returns the diagnosis, ok false', async () => {
  const api = await server('blocked');
  const control = await server('good');
  try {
    await withEnv({ FUEL_FINDER_CLIENT_ID: ID, FUEL_FINDER_CLIENT_SECRET: SECRET }, async () => {
      const r = (await makeHandler({ hosts: [api.url], controlUrl: control.url, ...fast })()) as { ok: boolean; summary: Record<string, any> };
      assert.equal(r.ok, false);
      assert.equal(r.summary.tokenAttempts[0].headers.server, 'CloudFront');
      assert.ok(r.summary.diagnostics);
    });
  } finally {
    await Promise.all([api.close(), control.close()]);
  }
});

// --- The real built package -------------------------------------------------------------------------

execFileSync('node', ['scripts/build-lambda.mjs'], { stdio: 'pipe' });
const bundlePath = new URL('../dist-lambda/probe/index.mjs', import.meta.url);

await check('bundle: one small plain-JavaScript file that imports only Node built-ins', () => {
  const text = readFileSync(bundlePath, 'utf8');
  assert.ok(text.length > 5_000 && text.length < 100_000, `size ${text.length}`);
  const imports = [...text.matchAll(/^import .*? from "([^"]+)"/gm)].map((m) => m[1]);
  assert.ok(imports.length > 0 && imports.every((i) => i.startsWith('node:')), `imports ${imports.join(', ')}`);
  assert.equal(text.includes('process.argv'), false, 'command-line code in the bundle');
  for (const secret of [ID, SECRET, TOKEN]) assert.equal(text.includes(secret), false);
});

await check('bundle: loads, exports only `handler`, and answers when the settings are missing', async () => {
  const mod = await import(pathToFileURL(bundlePath.pathname).href);
  assert.deepEqual(Object.keys(mod), ['handler']);
  await withEnv({ FUEL_FINDER_CLIENT_ID: undefined, FUEL_FINDER_CLIENT_SECRET: undefined }, async () => {
    const r = await mod.handler();
    assert.equal(r.ok, false);
    assert.match(r.problem, /not both set/);
    assert.equal(r.ranOn.node, process.version);
  });
});

await check('bundle: the zip holds just index.mjs', () => {
  execFileSync('zip', ['-j', '-q', 'dist-lambda/refueller-probe.zip', 'dist-lambda/probe/index.mjs']);
  const listing = execFileSync('unzip', ['-Z1', 'dist-lambda/refueller-probe.zip']).toString().trim();
  assert.equal(listing, 'index.mjs');
});

const collectorPath = new URL('../dist-lambda/collector/index.mjs', import.meta.url);

await check('collector bundle: one plain-JavaScript file that imports only Node built-ins', () => {
  const text = readFileSync(collectorPath, 'utf8');
  assert.ok(text.length > 5_000 && text.length < 150_000, `size ${text.length}`);
  const imports = [...text.matchAll(/^import .*? from "([^"]+)"/gm)].map((m) => m[1]);
  assert.ok(imports.length > 0 && imports.every((i) => i.startsWith('node:')), `imports ${imports.join(', ')}`);
  assert.equal(text.includes('process.argv'), false, 'command-line code in the bundle');
  assert.ok(text.includes('https://api.github.com') && text.includes('https://www.fuel-finder.service.gov.uk'));
});

await check('collector bundle: loads, exports only `handler`, and names the missing settings', async () => {
  const mod = await import(pathToFileURL(collectorPath.pathname).href);
  assert.deepEqual(Object.keys(mod), ['handler']);
  await withEnv({ FUEL_FINDER_CLIENT_ID: undefined, FUEL_FINDER_CLIENT_SECRET: undefined, REFUELLER_GITHUB_TOKEN: undefined }, async () => {
    const r = await mod.handler({});
    assert.equal(r.ok, false);
    assert.equal(r.problem, 'not set: FUEL_FINDER_CLIENT_ID, FUEL_FINDER_CLIENT_SECRET, REFUELLER_GITHUB_TOKEN');
  });
});

await check('collector bundle: the zip holds just index.mjs', () => {
  execFileSync('zip', ['-j', '-q', 'dist-lambda/refueller-collector.zip', 'dist-lambda/collector/index.mjs']);
  const listing = execFileSync('unzip', ['-Z1', 'dist-lambda/refueller-collector.zip']).toString().trim();
  assert.equal(listing, 'index.mjs');
});

console.log(failures === 0 ? '\nAll Lambda checks passed.' : `\n${failures} Lambda check(s) FAILED.`);
process.exitCode = failures === 0 ? 0 : 1;
