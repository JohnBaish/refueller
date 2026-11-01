// Checks for "Average prices" (src/lib/averages.ts, data/averages.json made by scripts/build-history.ts): which prices count, the
// mean for Great Britain and each postcode area, keeping 30 days, the eight stations' series, and the real file's figures.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { areaOf, averagesFor, counts, eightSeries, keepRecent, pence1, seriesOf, AVERAGE_DAYS, type AveragesFile } from '../src/lib/averages.ts';
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

await check('postcode areas: RG4 7HN is RG, B7 5SA is B, w1a 1aa is W', () => {
  assert.equal(areaOf('RG4 7HN'), 'RG');
  assert.equal(areaOf('B7 5SA'), 'B');
  assert.equal(areaOf('w1a 1aa'), 'W');
});

await check('which prices count: unusual ones don’t, except a higher price on the islands (as on the page)', () => {
  assert.ok(counts({ p: 170, u }, 'RG4 7HN', 172));
  assert.ok(!counts({ p: 299.9, u, x: 1 }, 'RG4 7HN', 172));
  assert.ok(counts({ p: 209, u, x: 1 }, 'TR21 0JY', 172), 'Scilly, higher than the middle');
  assert.ok(!counts({ p: 110, u, x: 1 }, 'TR21 0JY', 172), 'Scilly, far lower: still unusual');
  assert.ok(!counts(undefined, 'RG4 7HN', 172));
});

await check('the mean for Great Britain and each area, to two decimals; null where none sells the fuel', () => {
  const a = averagesFor(
    {
      a: { e10: { p: 170, u }, diesel: { p: 200, u } },
      b: { e10: { p: 171, u } },
      c: { e10: { p: 299.9, u, x: 1 }, diesel: { p: 199, u } },
      d: { e10: { p: 168.5, u } },
    },
    { a: 'RG4 7HN', b: 'RG1 8FR', c: 'RG30 1AW', d: 'B7 5SA' },
    { e10: 171, diesel: 199 },
  );
  assert.deepEqual(a.RG, [170.5, 199.5], 'the unusual 299.9p left out');
  assert.deepEqual(a.B, [168.5, null]);
  assert.deepEqual(a.GB, [169.83, 199.5]);
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

await check('the real file: Great Britain and RG at the first collections (October 30th), as worked out for the mock-ups', () => {
  const file: AveragesFile = JSON.parse(readFileSync(new URL('../data/averages.json', import.meta.url), 'utf8'));
  const gb = seriesOf(file, 'GB', 'e10');
  assert.ok(gb.length >= 1);
  const first = file.collections.find(([at]) => at === '2026-10-30T10:15:04.214Z' || at.startsWith('2026-10-30T10:15'));
  if (first) {
    // RG has no island stations, so these match the mock-ups' means exactly.
    assert.deepEqual(first[1].RG, [176.74, 201.32]);
  }
  for (const [, a] of file.collections) assert.ok(Object.keys(a).length > 100, 'every area present');
});

if (failures) {
  console.log(`\n${failures} average check(s) failed.`);
  process.exit(1);
}
console.log('\nAll average checks passed.');
