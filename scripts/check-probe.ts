// `npm run check`: tries the probe's rules on known examples, and runs the whole probe against a
// fake Fuel Finder server on this machine (the real one can't be reached from here). The
// examples are the documentation samples John pasted (design/fuel-finder-*-sample-*.md).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { runProbe } from './probe.ts';
import {
  CANDIDATE_HOSTS,
  classifyDay,
  classifyHours,
  hostAllowed,
  percentile,
  redact,
  summarisePrices,
  summariseStations,
  toMinutes,
  trimmedSizeEstimate,
  type Obj,
} from './lib/probe.ts';

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

function sample(file: string): Obj[] {
  const text = readFileSync(new URL(`../design/${file}`, import.meta.url), 'utf8');
  const m = /```json\n([\s\S]*?)\n```/.exec(text);
  assert.ok(m, `no JSON block in ${file}`);
  return JSON.parse(m[1]) as Obj[];
}

const stations = sample('fuel-finder-stations-sample-2026-10-24.md');
const priceSample = sample('fuel-finder-prices-sample-2026-10-24.md');
// The two samples use different station codes, so give the prices the stations' codes (as the real
// API does), and add one price record for a station that isn't in the list.
const prices: Obj[] = priceSample.map((p, i) => ({ ...p, node_id: stations[i].node_id }));
prices.push({ ...priceSample[0], node_id: 'f'.repeat(64) });
const NOW = Date.parse('2026-02-18T16:00:00Z');

await check('only government hosts may receive a secret', () => {
  for (const h of CANDIDATE_HOSTS) assert.equal(hostAllowed(`${h}/api/v1/pfs`), true, h);
  for (const bad of [
    'http://www.fuel-finder.service.gov.uk',
    'https://evil.example',
    'https://www.fuel-finder.service.gov.uk.evil.example',
    'https://evil.example/www.fuel-finder.service.gov.uk',
    'https://www.fuel-finder.service.gov.uk@evil.example',
    'https://user:pw@www.fuel-finder.service.gov.uk',
    'https://www.fuel-finder.service.gov.uk:8443',
    'http://127.0.0.1:9',
    'not a url',
  ]) {
    assert.equal(hostAllowed(bad), false, bad);
  }
  assert.equal(hostAllowed('http://127.0.0.1:9', true), true);
  assert.equal(hostAllowed('http://evil.example', true), false);
});

await check('redact removes secrets and ignores very short ones', () => {
  assert.equal(redact('id=abc123XYZ secret=abc123XYZ', ['abc123XYZ']), 'id=*** secret=***');
  assert.equal(redact('a b c', ['a']), 'a b c');
  assert.equal(redact('keep this', ['']), 'keep this');
});

await check('times: seconds ignored, odd values rejected', () => {
  assert.equal(toMinutes('06:00:01'), 360);
  assert.equal(toMinutes('6:30'), 390);
  assert.equal(toMinutes('23:59:00'), 1439);
  assert.equal(toMinutes('25:00'), null);
  assert.equal(toMinutes('n/a'), null);
  assert.equal(toMinutes(null), null);
});

await check('days: 24 hours, 00:00 to 00:00, past midnight, ordinary', () => {
  assert.equal(classifyDay({ open: '00:00:00', close: '23:59:00', is_24_hours: true }), '24h');
  assert.equal(classifyDay({ open: '00:00', close: '00:00', is_24_hours: true }), '24h');
  assert.equal(classifyDay({ open: '00:00:00', close: '00:00:00', is_24_hours: false }), 'zero-zero');
  assert.equal(classifyDay({ open: '06:00:01', close: '23:00:01', is_24_hours: false }), 'normal');
  assert.equal(classifyDay({ open: '22:00', close: '02:00', is_24_hours: false }), 'past-midnight');
  assert.equal(classifyDay({ open: '08:00', close: '08:00', is_24_hours: false }), 'same-time');
  assert.equal(classifyDay({ open: 'x', close: '08:00', is_24_hours: false }), 'unparseable');
  assert.equal(classifyDay(undefined), 'missing');
});

await check('stations: hours classes (the documentation samples)', () => {
  assert.deepEqual(stations.map(classifyHours), ['some-zero-zero', 'ordinary', 'ordinary']);
  assert.equal(classifyHours({}), 'no-hours');
  assert.equal(classifyHours({ opening_times: { usual_days: { monday: { open: '06:00', close: '22:00', is_24_hours: false } } } }), 'incomplete');
});

await check('stations: summary of the three samples', () => {
  const s = summariseStations(stations);
  assert.equal(s.total, 3);
  assert.equal(s.duplicateIds, 0);
  assert.deepEqual(s.countries, { ENGLAND: 3 }); // "England" and "ENGLAND" are one country
  assert.equal(s.gbStations, 3);
  assert.deepEqual(s.permanentClosure, { false: 1, null: 2 });
  assert.deepEqual(s.fuelTypesShape, { array: 3 });
  assert.deepEqual(s.hoursClasses, { 'some-zero-zero': 1, ordinary: 2 });
  assert.deepEqual(s.dayClasses, { 'zero-zero': 6, '24h': 1, normal: 14 });
  assert.deepEqual(s.timeFormats, { 'HH:MM:SS': 42 });
  assert.deepEqual(s.bankHolidayType, { 'bank holiday': 1, standard: 2 });
  assert.equal(s.testLikeNames, 2);
  assert.equal(s.nullOrEmptyCounty, 1);
  assert.equal(s.postcodeInsideAddressLine1, 1);
  assert.equal(s.positionOutsideUk, 0);
  assert.equal(s.noPosition, 0);
});

await check('stations: a position outside the UK, a missing one, a duplicate, a flag', () => {
  const odd = [
    { node_id: 'a', location: { latitude: 10, longitude: 10, country: 'England' }, temporary_closure: true },
    { node_id: 'a', location: { latitude: 0, longitude: 0, country: 'Wales' }, fuel_types: { E10: true, B7_STANDARD: false } },
    { node_id: 'b', location: {} },
  ];
  const s = summariseStations(odd);
  assert.equal(s.positionOutsideUk, 1);
  assert.equal(s.noPosition, 2);
  assert.equal(s.duplicateIds, 1);
  assert.equal(s.temporaryClosureTrue, 1);
  assert.deepEqual(s.fuelCodeCounts, { 'E10 (flag)': 1 });
});

await check('prices: shapes, stats, ages and the join', () => {
  const p = summarisePrices(prices, stations, NOW);
  assert.equal(p.records, 4);
  assert.equal(p.priceEntries, 10);
  assert.deepEqual(p.priceTypes, { number: 10 });
  assert.equal(p.priceStats.E10.count, 3);
  assert.equal(p.priceStats.E10.min, 132.9);
  assert.equal(p.priceStats.B7_STANDARD.max, 141.9);
  assert.equal(p.priceStats.E5.outside100to300, 0);
  assert.equal(p.badOrUnexpectedTimestampFormat, 0);
  assert.equal(p.entriesOlderThan7Days, 0);
  assert.ok(Math.abs((p.ageHours.E10.p50 ?? 0) - 23.95) < 0.01, `age ${p.ageHours.E10.p50}`);
  assert.equal(p.join.priceRecordsWithoutStation, 1);
  assert.equal(p.join.stationsWithoutAnyPriceRecord, 0);
  assert.equal(p.join.stationsWithE10Price, 2);
  assert.equal(p.join.stationsWithDieselPrice, 2);
  assert.equal(p.join.stationsWithBoth, 1);
  assert.deepEqual(p.join.fuelTypesListVersusPrices.E10, { listedWithoutPrice: 0, priceNotListed: 1 });
  assert.deepEqual(p.join.fuelTypesListVersusPrices.B7_STANDARD, { listedWithoutPrice: 1, priceNotListed: 2 });
  // A fortnight later every price is more than seven days old; a bad price is counted.
  assert.equal(summarisePrices(prices, stations, Date.parse('2026-03-01T00:00:00Z')).entriesOlderThan7Days, 10);
  const bad = summarisePrices([{ node_id: 'x', fuel_prices: [{ fuel_type: 'e10', price: 12.9, price_last_updated: 'yesterday', price_change_effective_timestamp: '' }] }], [], NOW);
  assert.equal(bad.priceStats.E10.outside100to300, 1); // lower-case code still counts as E10
  assert.equal(bad.badOrUnexpectedTimestampFormat, 1);
});

await check('percentile, and the size estimate', () => {
  assert.equal(percentile([1, 2, 3, 4], 50), 2);
  assert.equal(percentile([1, 2, 3, 4], 99), 4);
  assert.equal(percentile([], 50), null);
  const e = trimmedSizeEstimate(stations, prices);
  assert.equal(e.stationsInFile, 3);
  assert.ok(e.jsonBytes > 100 && e.gzipBytes > 0);
});

// --- The whole probe, against a fake server on this machine ---------------------------------------------

const ID = 'test-client-id-0001';
const SECRET = 'test-client-secret-0002';
const GOOD = 'tok-good-0123456789';
const NEW = 'tok-new-0123456789';
const REFRESH = 'ref-good-0123456789';

type Behaviour = { tokenStatus?: number; rateLimitOnce?: boolean; expireOldToken?: boolean; wrapPrices?: boolean };

async function listen(handler: (req: IncomingMessage, res: ServerResponse, body: string) => void) {
  const seen: { method: string; url: string; auth: string | undefined; ua: string | undefined; body: string }[] = [];
  const server = createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      seen.push({ method: req.method ?? '', url: req.url ?? '', auth: req.headers.authorization, ua: req.headers['user-agent'], body });
      handler(req, res, body);
    });
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return { url, seen, close: () => new Promise<void>((r) => server.close(() => r())) };
}

const json = (res: ServerResponse, status: number, value: unknown, headers: Record<string, string> = {}) => {
  res.writeHead(status, { 'content-type': 'application/json', ...headers });
  res.end(JSON.stringify(value));
};

async function fakeApi(b: Behaviour = {}) {
  let limited = false;
  return listen((req, res, body) => {
    const url = new URL(req.url ?? '/', 'http://x');
    if (req.method === 'POST' && url.pathname === '/api/v1/oauth/generate_access_token') {
      const sent = JSON.parse(body || '{}');
      if ((b.tokenStatus ?? 200) !== 200 || sent.client_id !== ID || sent.client_secret !== SECRET) {
        return json(res, b.tokenStatus ?? 401, { success: false, message: 'Unauthorized - Invalid client credentials' });
      }
      return json(res, 200, { success: true, data: { access_token: GOOD, token_type: 'Bearer', expires_in: 3600, refresh_token: REFRESH, refresh_token_expires_in: 172800 }, message: 'Operation successful' });
    }
    if (req.method === 'POST' && url.pathname === '/api/v1/oauth/regenerate_access_token') {
      const sent = JSON.parse(body || '{}');
      if (sent.client_id !== ID || sent.refresh_token !== REFRESH) return json(res, 400, { success: false, message: 'Invalid refresh token or client id' });
      return json(res, 200, { success: true, data: { access_token: NEW, token_type: 'Bearer', expires_in: 3600 }, message: 'Operation successful' });
    }
    const auth = req.headers.authorization;
    const authOk = b.expireOldToken ? auth === `Bearer ${NEW}` : auth === `Bearer ${GOOD}` || auth === `Bearer ${NEW}`;
    if (req.method !== 'GET' || !authOk) return json(res, 401, { success: false, message: 'Unauthorized' });
    const n = Number(url.searchParams.get('batch-number'));
    const incremental = url.searchParams.has('effective-start-timestamp');
    if (url.pathname === '/api/v1/pfs') {
      if (incremental) return json(res, 200, [stations[0]]);
      if (n === 2 && b.rateLimitOnce && !limited) {
        limited = true;
        return json(res, 429, { success: false, message: 'Too Many Requests' }, { 'retry-after': '0', 'x-ratelimit-remaining': '0' });
      }
      return json(res, 200, n === 1 ? [stations[0], stations[1]] : n === 2 ? [stations[2]] : []);
    }
    if (url.pathname === '/api/v1/pfs/fuel-prices') {
      const page = incremental ? [prices[0]] : n === 1 ? [prices[0], prices[1]] : n === 2 ? [prices[2], prices[3]] : [];
      return json(res, 200, b.wrapPrices ? { success: true, data: page } : page);
    }
    json(res, 404, { message: 'not found' });
  });
}

const probe = async (hosts: string[], extra: Partial<Parameters<typeof runProbe>[0]> = {}) => {
  const lines: string[] = [];
  const result = await runProbe({ hosts, clientId: ID, clientSecret: SECRET, allowLocal: true, paceMs: 0, backoffMs: 1, now: NOW, log: (l) => lines.push(l), ...extra });
  return { ...result, lines, text: lines.join('\n') };
};

await check('probe: a full run against the fake server', async () => {
  const api = await fakeApi({ wrapPrices: true });
  try {
    const r = await probe([api.url]);
    assert.equal(r.ok, true);
    const s = r.summary as Record<string, any>;
    assert.equal(s.stations.batches, 3); // the last, empty batch ends the paging
    assert.deepEqual(s.stations.batchSizes, [2, 1, 0]);
    assert.equal(s.stations.totalRecords, 3);
    assert.equal(s.prices.totalRecords, 4);
    assert.equal(s.prices.envelope.startsWith('an object with'), true); // a wrapped reply is read too
    assert.equal(s.token.expiresIn, 3600);
    assert.equal(s.token.hasRefreshToken, true);
    assert.equal(s.incremental.pricesSinceYesterday.date, '2026-02-17');
    assert.equal(s.incremental.pricesSinceYesterday.firstBatchRecords, 1);
    assert.equal(s.regenerate.ok, true);
    assert.equal(s.estimatedPageFile.stationsInFile, 3);
    assert.ok(s.requestsMade > 8);
    // every request says honestly who is asking
    assert.ok(api.seen.every((x) => x.ua?.startsWith('Refueller-probe/')), 'a request without the honest user agent');
    // every data request carried the token, and nothing else was asked for
    assert.ok(api.seen.filter((x) => x.method === 'GET').every((x) => x.auth === `Bearer ${GOOD}` || x.auth === `Bearer ${NEW}`));
  } finally {
    await api.close();
  }
});

await check('probe: no secret, token or raw name is ever printed', async () => {
  const api = await fakeApi();
  try {
    const r = await probe([api.url]);
    for (const secret of [ID, SECRET, GOOD, NEW, REFRESH]) assert.equal(r.text.includes(secret), false, `printed ${secret}`);
    assert.equal(r.text.includes(String(stations[2].node_id)), false, 'printed a station code');
    assert.equal(r.text.includes('LOUGHBOROUGH'), false, 'printed a station name');
    assert.equal(r.text.includes('Shell'), false, 'printed a station name');
    assert.ok(r.text.includes('PROBE SUMMARY'));
  } finally {
    await api.close();
  }
});

await check('probe: a 429 is waited out and retried', async () => {
  const api = await fakeApi({ rateLimitOnce: true });
  try {
    const r = await probe([api.url]);
    assert.equal(r.ok, true);
    assert.equal(api.seen.filter((x) => x.url.startsWith('/api/v1/pfs?batch-number=2')).length, 2);
    assert.ok((r.summary.responseHeadersSeen as Record<string, string>)['x-ratelimit-remaining'] !== undefined);
  } finally {
    await api.close();
  }
});

await check('probe: a redirect is never followed, and the next host is tried', async () => {
  const trap = await listen((_req, res) => json(res, 200, { trap: true }));
  const redirector = await listen((_req, res) => {
    res.writeHead(302, { location: `${trap.url}/steal` });
    res.end();
  });
  const api = await fakeApi();
  try {
    const r = await probe([redirector.url, api.url]);
    assert.equal(r.ok, true);
    assert.equal(trap.seen.length, 0, 'the redirect target received a request');
    assert.equal((r.summary.tokenAttempts as { result: string }[])[0].result, 'HTTP 302 (empty body)');
  } finally {
    await Promise.all([trap.close(), redirector.close(), api.close()]);
  }
});

await check('probe: wrong credentials stop everything and no data is asked for', async () => {
  const api = await fakeApi({ tokenStatus: 401 });
  try {
    const r = await probe([api.url]);
    assert.equal(r.ok, false);
    assert.equal(api.seen.filter((x) => x.method === 'GET').length, 0);
    assert.ok(r.text.includes('did not accept the credentials'));
  } finally {
    await api.close();
  }
});

await check('probe: an expired token is renewed from the refresh token, once', async () => {
  const api = await fakeApi({ expireOldToken: true });
  try {
    const r = await probe([api.url]);
    assert.equal(r.ok, true);
    assert.equal(api.seen.filter((x) => x.url.includes('regenerate')).length, 1);
    assert.equal((r.summary.regenerate as { ok: boolean }).ok, true);
  } finally {
    await api.close();
  }
});

await check('probe: a blocked front door is diagnosed without credentials and without leaking', async () => {
  const hits: { method: string; url: string; auth: string | undefined; body: string }[] = [];
  const blocked = await listen((req, res) => {
    hits.push({ method: req.method ?? '', url: req.url ?? '', auth: req.headers.authorization, body: '' });
    res.writeHead(403, { server: 'CloudFront', 'x-cache': 'Error from cloudfront', 'x-amz-cf-pop': 'IAD61-P12', 'content-length': '0', 'set-cookie': 'session=abcdef123456' });
    res.end();
  });
  const control = await listen((_req, res) => json(res, 200, {}));
  try {
    const r = await probe([blocked.url], { controlUrl: control.url });
    assert.equal(r.ok, false);
    const s = r.summary as Record<string, any>;
    const attempt = s.tokenAttempts[0];
    assert.equal(attempt.result, 'HTTP 403 (empty body)');
    assert.equal(attempt.headers.server, 'CloudFront');
    assert.equal(attempt.headers['x-amz-cf-pop'], 'IAD61-P12');
    assert.equal('set-cookie' in attempt.headers, false, 'a cookie header was kept');
    const d = s.diagnostics[new URL(blocked.url).hostname];
    assert.equal(d.siteHome.status, 403);
    assert.equal(d.apiWithoutToken.status, 403);
    assert.equal(d.motoristPage.status, 403);
    assert.equal(s.diagnostics.controlPublicPage.status, 200);
    // the diagnostic requests carry no credentials: only the one sign-in request had a body
    const withSecret = hits.filter((h) => h.method === 'POST');
    assert.equal(withSecret.length, 1);
    assert.ok(hits.filter((h) => h.method === 'GET').every((h) => h.auth === undefined));
    for (const secret of [ID, SECRET]) assert.equal(r.text.includes(secret), false);
  } finally {
    await Promise.all([blocked.close(), control.close()]);
  }
});

await check('probe: a host that is not on the list is refused before any request', async () => {
  await assert.rejects(runProbe({ hosts: ['https://evil.example'], clientId: ID, clientSecret: SECRET, paceMs: 0, log: () => {} }), /not on the list/);
});

await check('probe: nothing answering ends cleanly, with no token', async () => {
  const dead = await listen(() => {});
  const url = dead.url;
  await dead.close(); // nothing listens there any more
  const r = await probe([url]);
  assert.equal(r.ok, false);
  assert.ok(r.text.includes('no access token obtained'));
});

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) FAILED.`);
process.exitCode = failures === 0 ? 0 : 1;
