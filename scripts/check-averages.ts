// Checks for "Average prices" (src/lib/averages.ts, data/averages.json made by scripts/build-history.ts): which prices count, the
// mean for Great Britain and each postcode area, keeping 30 days, the eight stations' series, and the real file's figures.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { averagesFor, counts, eightSeries, keepRecent, pence1, AVERAGE_DAYS, type AveragesFile } from '../src/lib/averages.ts';
import type { Locality } from '../src/lib/levels.ts';
import { steps, trim } from '../src/lib/history.ts';

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
const u = '2026-10-30T09:00:00Z';

await check('which prices count: unusual ones don’t, except a higher price on the islands (as on the page)', () => {
  assert.ok(counts({ p: 170, u }, 'RG4 7HN', 172));
  assert.ok(!counts({ p: 299.9, u, x: 1 }, 'RG4 7HN', 172));
  assert.ok(counts({ p: 209, u, x: 1 }, 'TR21 0JY', 172), 'Scilly, higher than the middle');
  assert.ok(!counts({ p: 110, u, x: 1 }, 'TR21 0JY', 172), 'Scilly, far lower: still unusual');
  assert.ok(!counts(undefined, 'RG4 7HN', 172));
});

await check('the mean for Great Britain and every level, to two decimals; null where fewer than five stations sell the fuel', () => {
  const reading: Locality = ['Reading', 'Berkshire', 'South East England', 'England'];
  const leeds: Locality = ['Leeds', 'West Yorkshire', 'Yorkshire and the Humber', 'England'];
  const prices: Record<string, { e10?: { p: number; u: string; x?: 1 }; diesel?: { p: number; u: string; x?: 1 } }> = {};
  const postcodes: Record<string, string> = {};
  for (let i = 0; i < 6; i++) {
    prices[`r${i}`] = { e10: { p: 170 + i, u }, ...(i < 4 ? { diesel: { p: 200, u } } : {}) };
    postcodes[`r${i}`] = 'RG4 7HN';
  }
  prices.u = { e10: { p: 299.9, u, x: 1 } };
  postcodes.u = 'RG1 8FR';
  prices.l = { e10: { p: 160, u } };
  postcodes.l = 'LS1 1AA';
  const a = averagesFor(prices, postcodes, { e10: 171, diesel: 199 }, (pc) => (pc.startsWith('LS') ? leeds : reading));
  assert.deepEqual(a['C:Reading'], [172.5, null], 'six unleaded (the unusual 299.9p left out), only four diesel');
  assert.deepEqual(a['K:Berkshire'], [172.5, null]);
  assert.deepEqual(a['N:England'], [170.71, null], 'Leeds counts in England: (170 + … + 175 + 160) / 7');
  assert.deepEqual(a['C:Leeds'], [null, null], 'one station is fewer than five');
  assert.deepEqual(a.GB, [170.71, null]);
});

await check(`only the last ${AVERAGE_DAYS} days kept, oldest first`, () => {
  const rows = [
    ['2026-11-30T10:15:00Z', { GB: [1, 1] }],
    ['2026-10-30T10:15:00Z', { GB: [2, 2] }],
    ['2026-10-31T10:15:00Z', { GB: [3, 3] }],
  ] as [string, Record<string, [number, number]>][];
  assert.deepEqual(keepRecent(rows).map((r) => r[0]), ['2026-10-31T10:15:00Z', '2026-11-30T10:15:00Z']);
});

await check('the eight: each station’s price in force at each collection, only once every one has a known price', () => {
  const t = (s: string) => Date.parse(s);
  const times = [t('2026-10-30T10:15:00Z'), t('2026-10-31T10:15:00Z'), t('2026-11-01T10:15:00Z')];
  const a = [{ t: t('2026-10-20T08:00:00Z'), p: 170 }, { t: t('2026-10-31T09:00:00Z'), p: 168 }];
  const b = [{ t: t('2026-10-30T12:00:00Z'), p: 174 }];
  assert.deepEqual(eightSeries([a, b], times), [
    { t: times[1], p: 171 },
    { t: times[2], p: 171 },
  ]);
  assert.deepEqual(eightSeries([], times), []);
});

await check('the price history graph still sees only its 14 days, though the files now hold 30', () => {
  const h: [number, string][] = [[180, '2026-10-01T09:00:00Z'], [178, '2026-10-10T09:00:00Z'], [176, '2026-10-25T09:00:00Z']];
  const start = Date.parse('2026-10-17T10:15:00Z');
  assert.deepEqual(steps(trim(h, start)).map((s) => s.p), [178, 176]);
});

await check('pence to one decimal', () => {
  assert.equal(pence1(172.54), '172.5p');
  assert.equal(pence1(199.19), '199.2p');
  assert.equal(pence1(176.26), '176.3p');
});

await check('the real file: every level at every collection since October 30th; Reading and Great Britain at the latest', () => {
  const file: AveragesFile = JSON.parse(readFileSync(new URL('../data/averages.json', import.meta.url), 'utf8'));
  assert.ok(file.collections[0][0].startsWith('2026-10-30T09:08'), 'kept from the first collection');
  for (const [, a] of file.collections) assert.ok(Object.keys(a).length > 300, 'every level present');
  const nov1 = file.collections.find(([at]) => at.startsWith('2026-11-01T16:15'));
  if (nov1) {
    // As worked out for the mock-ups from OS Open Names (Reading's 19 stations).
    assert.deepEqual(nov1[1]['C:Reading'], [174.26, 200.1]);
    assert.deepEqual(nov1[1]['R:South East England'].map((v) => Math.round(v! * 10) / 10), [173.8, 200.2]);
  }
});

if (failures) {
  console.log(`\n${failures} average check(s) failed.`);
  process.exit(1);
}
console.log('\nAll average checks passed.');
