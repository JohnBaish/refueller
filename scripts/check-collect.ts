// Checks for the collector (PLAN Stage 2): the cleaning rules, then whole runs against a fake Fuel Finder and a fake
// GitHub on this machine. The station and price records are made up, in the shapes the real API returned on 27 October.
import assert from 'node:assert/strict';
import { createServer, type IncomingMessage } from 'node:http';
import type { AddressInfo } from 'node:net';
import { bankHolidayDates, clean, dayEntry, inGreatBritain, median, permanentlyClosed, shortIds, weekHours } from './lib/clean.ts';
import { collect, runFilePath, type CollectOptions } from './lib/collect.ts';
import { makeCollectorHandler } from '../lambda/make-collector.ts';

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

const NOW = Date.parse('2026-10-28T10:15:00Z');
const day = (open: string, close: string, is24 = false) => ({ open, close, is_24_hours: is24 });
const week = (d: object) => ({ monday: d, tuesday: d, wednesday: d, thursday: d, friday: d, saturday: d, sunday: d });
const id = (n: number) => `${String(n).padStart(6, '0')}${'ab'.repeat(29)}`;

function station(n: number, extra: Record<string, unknown> = {}, loc: Record<string, unknown> = {}) {
  return {
    node_id: id(n),
    public_phone_number: null,
    trading_name: `STATION ${n}`,
    brand_name: 'ESSO',
    temporary_closure: false,
    permanent_closure: false,
    permanent_closure_date: null,
    is_motorway_service_station: false,
    is_supermarket_service_station: false,
    location: { address_line_1: `${n} HIGH STREET`, address_line_2: null, city: 'READING', country: 'ENGLAND', county: null, postcode: 'RG4 7AA', latitude: 51.4712345678, longitude: -0.9712345678, ...loc },
    amenities: [],
    opening_times: { usual_days: week(day('06:00:00', '22:00:00')), bank_holiday: { type: 'standard', open_time: '08:00:00', close_time: '20:00:00', is_24_hours: false } },
    fuel_types: ['E10', 'B7_STANDARD'],
    ...extra,
  };
}
const priceRec = (n: number, list: { fuel_type: string; price: unknown }[]) => ({
  node_id: id(n),
  trading_name: `STATION ${n}`,
  fuel_prices: list.map((f) => ({ ...f, price_last_updated: '2026-10-20T09:01:02.345Z', price_change_effective_timestamp: '2026-10-20T09:00:00.000Z' })),
});

// --- The rules ----------------------------------------------------------------------------------------------------------

await check('Great Britain by postcode: Northern Ireland, Isle of Man and Channel Islands left out', () => {
  for (const pc of ['RG4 7AA', 'rg47aa', 'EH1 1YZ', 'CF10 1AA', 'B1 1AA', 'ZE1 0AA']) assert.equal(inGreatBritain(pc), true, pc);
  for (const pc of ['BT1 1AA', 'bt7 1nn', 'IM1 1AA', 'GY1 1AA', 'JE2 3AA', '', null, '12345']) assert.equal(inGreatBritain(pc), false, String(pc));
});

await check('opening hours: seconds dropped, 24-hour flag wins, 00:00 to 00:00 is closed, past midnight kept', () => {
  assert.equal(dayEntry(day('06:00:01', '23:00:01')), '06:00-23:00');
  assert.equal(dayEntry(day('00:00:00', '23:59:00', true)), '24h');
  assert.equal(dayEntry(day('00:00:00', '00:00:00', true)), '24h');
  assert.equal(dayEntry(day('00:00:00', '00:00:00')), 'closed');
  assert.equal(dayEntry(day('22:00:00', '02:00:00')), '22:00-02:00');
  assert.equal(dayEntry(day('nonsense', '02:00:00')), null);
  assert.equal(dayEntry(day('09:00:00', '09:00:00')), null);
});

await check('opening hours: some days 00:00 to 00:00 are closed days; every day means "not given"', () => {
  const someClosed = { opening_times: { usual_days: { ...week(day('07:00:00', '21:00:00')), sunday: day('00:00:00', '00:00:00') } } };
  assert.deepEqual(weekHours(someClosed), ['07:00-21:00', '07:00-21:00', '07:00-21:00', '07:00-21:00', '07:00-21:00', '07:00-21:00', 'closed']);
  assert.equal(weekHours({ opening_times: { usual_days: week(day('00:00:00', '00:00:00')) } }), null);
  assert.equal(weekHours({ opening_times: { usual_days: { monday: day('07:00:00', '21:00:00') } } }), null, 'missing days');
  assert.equal(weekHours({}), null);
});

await check('closures: flag, past date and future date', () => {
  assert.equal(permanentlyClosed({ permanent_closure: true }, NOW), true);
  assert.equal(permanentlyClosed({ permanent_closure: null }, NOW), false);
  assert.equal(permanentlyClosed({ permanent_closure: true, permanent_closure_date: '2026-12-01' }, NOW), false, 'future date: open until then');
  assert.equal(permanentlyClosed({ permanent_closure: false, permanent_closure_date: '2026-10-01' }, NOW), true, 'past date');
});

await check('median and short keys', () => {
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([4, 1, 2, 3]), 2.5);
  assert.equal(median([]), null);
  const ids = shortIds(['aaaaaaaaaaaa1', 'aaaaaaaaaaaa2', 'bbbbbbbbbbbb1']);
  assert.equal(ids.get('bbbbbbbbbbbb1'), 'bbbbbbbbbbbb', 'unique prefix shortened');
  assert.equal(ids.get('aaaaaaaaaaaa1'), 'aaaaaaaaaaaa1', 'clashing prefix kept whole');
});

await check('clean: the rules together, with prices and times unchanged', () => {
  const stations = [
    station(1),
    station(2, {}, { postcode: 'BT1 1AA', latitude: 54.6, longitude: -5.93, country: 'NORTHERN IRELAND' }),
    station(3, { permanent_closure: true }),
    station(4, { temporary_closure: true, is_motorway_service_station: true }),
    station(5), // only an out-of-range price
    station(6), // one fuel only
    station(7, {}, { latitude: 51.47, longitude: 0.97 }), // wrong-signed longitude can still be in the box; checked later against the postcode
    station(8, {}, { latitude: 0, longitude: 0 }),
    station(9, { opening_times: { usual_days: week(day('00:00:00', '00:00:00')) } }),
    station(10), // E10 far below the middle price: unusual
    station(1), // a repeat of station 1
  ];
  const prices = [
    priceRec(1, [{ fuel_type: 'E10', price: 172.9 }, { fuel_type: 'B7_STANDARD', price: 198.9 }, { fuel_type: 'E5', price: 189.9 }]),
    priceRec(2, [{ fuel_type: 'E10', price: 170.9 }]),
    priceRec(3, [{ fuel_type: 'E10', price: 170.9 }]),
    priceRec(4, [{ fuel_type: 'e10', price: 175.9 }, { fuel_type: 'b7_standard', price: 201.9 }]),
    priceRec(5, [{ fuel_type: 'E10', price: 17.29 }, { fuel_type: 'B7_STANDARD', price: 1989 }]),
    priceRec(6, [{ fuel_type: 'B7_STANDARD', price: 196.9 }]),
    priceRec(7, [{ fuel_type: 'E10', price: 171.9 }]),
    priceRec(8, [{ fuel_type: 'E10', price: 171.9 }]),
    priceRec(9, [{ fuel_type: 'E10', price: 173.9 }]),
    priceRec(10, [{ fuel_type: 'E10', price: 132.9 }]),
  ];
  const c = clean(stations, prices, NOW);
  assert.equal(c.counts.outsideGreatBritain, 1);
  assert.equal(c.counts.permanentlyClosed, 1);
  assert.equal(c.counts.noUsablePosition, 1);
  assert.equal(c.counts.noPriceForEitherFuel, 1);
  assert.equal(c.counts.pricesOutsideRange, 2);
  assert.equal(c.counts.stationsKept, 6);
  assert.equal(c.counts.temporarilyClosed, 1);
  assert.equal(c.counts.hoursNotGiven, 1);
  assert.deepEqual(c.middle, { e10: 172.9, diesel: 198.9 });
  const byName = Object.fromEntries(c.stations.map((s) => [s.name, s]));
  const p1 = c.prices[byName['STATION 1'].id];
  assert.deepEqual(p1, { e10: { p: 172.9, u: '2026-10-20T09:01:02.345Z' }, diesel: { p: 198.9, u: '2026-10-20T09:01:02.345Z' } }, 'price and time as given, E5 not kept');
  assert.equal(c.prices[byName['STATION 10'].id].e10?.x, 1, 'unusual');
  assert.equal(c.counts.unusualPrices, 1);
  assert.deepEqual(Object.keys(c.prices[byName['STATION 6'].id]), ['diesel']);
  assert.equal(byName['STATION 4'].temporarilyClosed, true);
  assert.equal(byName['STATION 4'].motorway, true);
  assert.equal(byName['STATION 9'].hours, null);
  assert.equal(byName['STATION 1'].lat, 51.47123);
  assert.deepEqual(byName['STATION 1'].address, ['1 HIGH STREET', 'READING']);
  assert.deepEqual(byName['STATION 1'].bankHoliday, { type: 'standard', hours: '08:00-20:00' });
  assert.equal(byName['STATION 1'].id.length, 12);
});

await check('unusual: exactly 30p from the middle is not marked, more than 30p is', () => {
  const st = [1, 2, 3, 4].map((n) => station(n));
  const c = clean(st, [priceRec(1, [{ fuel_type: 'E10', price: 170 }]), priceRec(2, [{ fuel_type: 'E10', price: 170 }]), priceRec(3, [{ fuel_type: 'E10', price: 200 }]), priceRec(4, [{ fuel_type: 'E10', price: 140 }])], NOW);
  const marks = Object.values(c.prices).map((p) => [p.e10?.p, p.e10?.x ?? 0]);
  assert.deepEqual(marks.sort(), [[140, 0], [170, 0], [170, 0], [200, 0]].sort(), JSON.stringify(marks));
  const c2 = clean(st, [priceRec(1, [{ fuel_type: 'E10', price: 170 }]), priceRec(2, [{ fuel_type: 'E10', price: 170 }]), priceRec(3, [{ fuel_type: 'E10', price: 200.1 }]), priceRec(4, [{ fuel_type: 'E10', price: 139.8 }])], NOW);
  assert.equal(c2.counts.unusualPrices, 2);
});

await check('bank holidays: this year on, both divisions', () => {
  const feed = {
    'england-and-wales': { events: [{ date: '2025-12-25' }, { date: '2026-12-25' }, { date: '2027-01-01' }] },
    scotland: { events: [{ date: '2026-11-30' }] },
    'northern-ireland': { events: [] },
  };
  assert.deepEqual(bankHolidayDates(feed, NOW), { 'england-and-wales': ['2026-12-25', '2027-01-01'], scotland: ['2026-11-30'] });
  assert.equal(bankHolidayDates({ scotland: {} }, NOW), null);
});

await check('run log file by UK month', () => {
  assert.equal(runFilePath(Date.parse('2026-10-31T23:30:00Z')), 'data/runs/2026-10.jsonl', 'GMT: still October');
  assert.equal(runFilePath(Date.parse('2026-09-30T23:30:00Z')), 'data/runs/2026-10.jsonl', 'BST: already October');
});

// --- Whole runs against fake servers ------------------------------------------------------------------------------------

const ID = 'collector-test-client-id-01';
const SECRET = 'collector-test-client-secret-02';
const TOKEN = 'collector-test-ff-token-0123456789';
const GH = 'collector-test-github-token-abcdef';

type Seen = { server: string; method: string; path: string; auth: string; body: string };
const readBody = (req: IncomingMessage) => new Promise<string>((r) => {
  let b = '';
  req.on('data', (c) => (b += c));
  req.on('end', () => r(b));
});

function many(count: number) {
  const st = [];
  const pr = [];
  for (let n = 100; n < 100 + count; n++) {
    st.push(station(n));
    pr.push(priceRec(n, [{ fuel_type: 'E10', price: 160 + (n % 25) }, { fuel_type: 'B7_STANDARD', price: 185 + (n % 25) }]));
  }
  return { st, pr };
}

async function fakeFuelFinder(mode: 'good' | 'blocked' | 'few' | 'first404', seen: Seen[]) {
  const data = mode === 'few' ? many(1200) : many(4200);
  const s = createServer(async (req, res) => {
    const body = await readBody(req);
    const url = new URL(req.url ?? '/', 'http://x');
    seen.push({ server: 'fuelfinder', method: req.method ?? '', path: url.pathname + url.search, auth: JSON.stringify(req.headers), body });
    const send = (status: number, value?: unknown) => {
      res.writeHead(status, { 'content-type': 'application/json' });
      res.end(value === undefined ? '' : JSON.stringify(value));
    };
    if (mode === 'blocked') return send(403);
    if (req.method === 'POST' && url.pathname === '/api/v1/oauth/generate_access_token') {
      const sent = JSON.parse(body || '{}');
      if (sent.client_id !== ID || sent.client_secret !== SECRET) return send(401, { message: 'Unauthorized' });
      return send(200, { success: true, data: { access_token: TOKEN, token_type: 'Bearer', expires_in: 3600 } });
    }
    if (req.headers.authorization !== `Bearer ${TOKEN}`) return send(401, {});
    const n = Number(url.searchParams.get('batch-number'));
    const list = url.pathname === '/api/v1/pfs' ? data.st : url.pathname === '/api/v1/pfs/fuel-prices' ? data.pr : null;
    if (!list) return send(404, {});
    if (mode === 'first404') return send(404, { success: false });
    const batch = list.slice((n - 1) * 500, n * 500);
    if (batch.length === 0) return send(404, { success: false, data: null, message: 'not found', error: 'x' });
    send(200, batch);
  });
  await new Promise<void>((r) => s.listen(0, '127.0.0.1', r));
  return { url: `http://127.0.0.1:${(s.address() as AddressInfo).port}`, close: () => new Promise<void>((r) => s.close(() => r())) };
}

// A fake GitHub: one branch, files kept in memory, commits as snapshots.
async function fakeGitHub(seen: Seen[], opts: { files?: Record<string, string>; raceOnce?: boolean } = {}) {
  let n = 0;
  const objects = new Map<string, unknown>();
  const sha = (prefix: string) => `${prefix}${String(++n).padStart(39, '0')}`;
  let files: Record<string, string> = { 'README.md': 'hello\n', ...(opts.files ?? {}) };
  let tipTree = sha('t');
  objects.set(tipTree, files);
  let tip = sha('c');
  objects.set(tip, { tree: tipTree, message: 'start' });
  let race = opts.raceOnce ?? false;
  const commits: { message: string; files: Record<string, string> }[] = [];
  const s = createServer(async (req, res) => {
    const body = await readBody(req);
    const url = new URL(req.url ?? '/', 'http://x');
    seen.push({ server: 'github', method: req.method ?? '', path: url.pathname + url.search, auth: JSON.stringify(req.headers), body });
    const send = (status: number, value?: unknown, raw?: string) => {
      res.writeHead(status, { 'content-type': raw === undefined ? 'application/json' : 'text/plain' });
      res.end(raw ?? JSON.stringify(value ?? {}));
    };
    if (req.headers.authorization !== `Bearer ${GH}`) return send(401, { message: 'Bad credentials' });
    const p = url.pathname.replace('/repos/JohnBaish/refueller', '');
    if (req.method === 'GET' && p === '/git/ref/heads/main') return send(200, { object: { sha: tip } });
    if (req.method === 'GET' && p.startsWith('/git/commits/')) {
      const c = objects.get(p.slice(13)) as { tree: string } | undefined;
      return c ? send(200, { tree: { sha: c.tree } }) : send(404);
    }
    if (req.method === 'GET' && p.startsWith('/contents/')) {
      const path = decodeURIComponent(p.slice(10));
      return path in files ? send(200, undefined, files[path]) : send(404, { message: 'Not Found' });
    }
    if (req.method === 'POST' && p === '/git/trees') {
      const b = JSON.parse(body);
      const base = objects.get(b.base_tree) as Record<string, string>;
      const next = { ...base };
      for (const e of b.tree) next[e.path] = e.content;
      const t = sha('t');
      objects.set(t, next);
      return send(201, { sha: t });
    }
    if (req.method === 'POST' && p === '/git/commits') {
      const b = JSON.parse(body);
      const c = sha('c');
      objects.set(c, { tree: b.tree, message: b.message, parent: b.parents[0] });
      return send(201, { sha: c });
    }
    if (req.method === 'PATCH' && p === '/git/refs/heads/main') {
      const b = JSON.parse(body);
      const c = objects.get(b.sha) as { tree: string; message: string; parent: string };
      if (race) {
        // Someone else saved to main meanwhile.
        race = false;
        files = { ...files, 'OTHER.md': 'someone else\n' };
        tipTree = sha('t');
        objects.set(tipTree, files);
        tip = sha('c');
        objects.set(tip, { tree: tipTree, message: 'other' });
        return send(422, { message: 'Update is not a fast forward' });
      }
      if (c.parent !== tip) return send(422, { message: 'Update is not a fast forward' });
      tip = b.sha;
      files = objects.get(c.tree) as Record<string, string>;
      commits.push({ message: c.message, files });
      return send(200, { object: { sha: tip } });
    }
    send(404, { message: 'Not Found' });
  });
  await new Promise<void>((r) => s.listen(0, '127.0.0.1', r));
  return {
    url: `http://127.0.0.1:${(s.address() as AddressInfo).port}`,
    files: () => files,
    commits,
    close: () => new Promise<void>((r) => s.close(() => r())),
  };
}

async function fakeBankHolidays() {
  const s = createServer((_req, res) => {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ 'england-and-wales': { events: [{ date: '2026-12-25' }] }, scotland: { events: [{ date: '2026-11-30' }] } }));
  });
  await new Promise<void>((r) => s.listen(0, '127.0.0.1', r));
  return { url: `http://127.0.0.1:${(s.address() as AddressInfo).port}/bank-holidays.json`, close: () => new Promise<void>((r) => s.close(() => r())) };
}

async function run(ffMode: 'good' | 'blocked' | 'few' | 'first404', ghOpts: Parameters<typeof fakeGitHub>[1] = {}) {
  const seen: Seen[] = [];
  const ff = await fakeFuelFinder(ffMode, seen);
  const gh = await fakeGitHub(seen, ghOpts);
  const bh = await fakeBankHolidays();
  const lines: string[] = [];
  const opts: CollectOptions = { clientId: ID, clientSecret: SECRET, githubToken: GH, now: NOW, fuelFinder: ff.url, githubApi: gh.url, bankHolidaysUrl: bh.url, allowLocal: true, paceMs: 0, backoffMs: 1, log: (l) => lines.push(l) };
  try {
    const result = await collect(opts);
    return { result, seen, files: gh.files(), commits: gh.commits, lines };
  } finally {
    await Promise.all([ff.close(), gh.close(), bh.close()]);
  }
}

const runLog = 'data/runs/2026-10.jsonl';

await check('a good run saves the three data files and the run line in one commit', async () => {
  const r = await run('good', { files: { [runLog]: '{"at":"earlier","ok":true}\n' } });
  assert.equal(r.result.ok, true, JSON.stringify(r.result));
  assert.equal(r.commits.length, 1);
  assert.match(r.commits[0].message, /^Data: 2026-10-28 10:15 UTC$/);
  const stations = JSON.parse(r.files['data/stations.json']);
  const prices = JSON.parse(r.files['data/prices.json']);
  assert.equal(stations.collected, '2026-10-28T10:15:00.000Z');
  assert.equal(stations.stations.length, 4200);
  assert.equal(Object.keys(prices.prices).length, 4200);
  assert.equal(prices.unusualPence, 30);
  assert.deepEqual(JSON.parse(r.files['data/bank-holidays.json']), { 'england-and-wales': ['2026-12-25'], scotland: ['2026-11-30'] });
  const runLines = r.files[runLog].trim().split('\n');
  assert.equal(runLines.length, 2, 'appended to the existing log');
  const last = JSON.parse(runLines[1]);
  assert.equal(last.ok, true);
  assert.equal(last.counts.stationsKept, 4200);
  assert.equal(last.fuelFinderRequests, 1 + 10 + 10, 'sign-in plus 9 batches and the end 404 for each list');
  assert.equal(r.files['README.md'], 'hello\n', 'other files untouched');
});

await check('a good run: each secret goes only to its own server, and none is saved, logged or returned', async () => {
  const r = await run('good');
  for (const s of r.seen) {
    const text = s.auth + s.body + s.path;
    if (s.server === 'github') {
      assert.equal(text.includes(SECRET) || text.includes(ID) || text.includes(TOKEN), false, `Fuel Finder value sent to GitHub: ${s.path}`);
    } else {
      assert.equal(text.includes(GH), false, `GitHub key sent to Fuel Finder: ${s.path}`);
    }
  }
  const saved = JSON.stringify(r.files) + JSON.stringify(r.result) + r.lines.join('\n');
  for (const secret of [ID, SECRET, TOKEN, GH]) assert.equal(saved.includes(secret), false, `${secret} leaked`);
});

await check('a refused sign-in leaves the data files alone and saves only the run line', async () => {
  const before = { 'data/stations.json': 'OLD STATIONS\n', 'data/prices.json': 'OLD PRICES\n' };
  const r = await run('blocked', { files: before });
  assert.equal(r.result.ok, false);
  assert.match(r.result.run.problem ?? '', /sign-in refused: HTTP 403/);
  assert.equal(r.commits.length, 1);
  assert.match(r.commits[0].message, /run failed/);
  assert.equal(r.files['data/stations.json'], 'OLD STATIONS\n');
  assert.equal(r.files['data/prices.json'], 'OLD PRICES\n');
  assert.equal(r.files['data/bank-holidays.json'], undefined);
  assert.equal(JSON.parse(r.files[runLog]).ok, false);
});

await check('too few records: the files are not replaced', async () => {
  const r = await run('few', { files: { 'data/prices.json': 'OLD PRICES\n' } });
  assert.equal(r.result.ok, false);
  assert.match(r.result.run.problem ?? '', /too few records/);
  assert.equal(r.files['data/prices.json'], 'OLD PRICES\n');
});

await check('a 404 on the very first batch is a failure, not an empty list', async () => {
  const r = await run('first404');
  assert.equal(r.result.ok, false);
  assert.match(r.result.run.problem ?? '', /stations: batch 1 failed \(HTTP 404\)/);
});

await check('if main moves while saving, it starts again from the new tip and keeps the other change', async () => {
  const r = await run('good', { raceOnce: true });
  assert.equal(r.result.ok, true, JSON.stringify(r.result));
  assert.equal(r.files['OTHER.md'], 'someone else\n');
  assert.ok(r.files['data/prices.json']);
});

await check('the collector refuses hosts that are not its own', async () => {
  await assert.rejects(() => collect({ clientId: ID, clientSecret: SECRET, githubToken: GH, fuelFinder: 'https://evil.example', githubApi: 'https://evil.example', log: () => {} }).then((r) => {
    if (!r.ok && /not on the list/.test(r.run.problem ?? '') && /not on the list/.test(r.saved.problem ?? '')) throw new Error('refused');
  }), /refused/);
});

await check('handler: a missing setting gives a plain answer and contacts nothing', async () => {
  const before = { ...process.env };
  process.env.FUEL_FINDER_CLIENT_ID = ID;
  process.env.FUEL_FINDER_CLIENT_SECRET = SECRET;
  delete process.env.REFUELLER_GITHUB_TOKEN;
  const log = console.log;
  console.log = () => {};
  try {
    const r = (await makeCollectorHandler({ fuelFinder: 'http://127.0.0.1:9', allowLocal: true })()) as { ok: boolean; problem: string };
    assert.equal(r.ok, false);
    assert.equal(r.problem, 'not set: REFUELLER_GITHUB_TOKEN');
  } finally {
    console.log = log;
    process.env = before;
  }
});

console.log(failures === 0 ? '\nAll collector checks passed.' : `\n${failures} collector check(s) FAILED.`);
process.exitCode = failures === 0 ? 0 : 1;
