// Checks for the 14-day price graph (src/lib/history.ts, scripts/build-history.ts, the history column in scripts/lib/pageData.ts).
// The worked examples are the real Reading prices of 30 October 2026 (design/previews/graph-*.png).
import assert from 'node:assert/strict';
import { makeHistory } from './build-history.ts';
import { makePageData } from './lib/pageData.ts';
import { average, dateWords, historySentence, steps, trim, windowFor, withPrice, type Hist } from '../src/lib/history.ts';
import type { Station } from '../src/lib/search.ts';

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

const end = Date.parse('2026-10-30T16:15:04Z');
const { start } = windowFor(end);

await check('dates in words, by UK clock time (BST before October 25th, GMT after)', () => {
  assert.equal(dateWords(Date.parse('2026-10-30T15:07:00Z'), true), '3.07pm on October 30th');
  assert.equal(dateWords(Date.parse('2026-10-20T15:07:00Z'), true), '4.07pm on October 20th');
  assert.equal(dateWords(Date.parse('2026-10-14T15:30:00Z'), false), 'October 14th');
  assert.equal(dateWords(Date.parse('2026-11-01T00:30:00Z'), false), 'November 1st');
});

await check('history: prices kept in order of setting, one per set time, trimmed to the window', () => {
  let h: Hist = [];
  h = withPrice(h, { p: 175.9, u: '2026-10-30T15:07:00.000Z' });
  h = withPrice(h, { p: 177.9, u: '2026-10-14T15:30:00.000Z' });
  h = withPrice(h, { p: 175.9, u: '2026-10-30T15:07:00.000Z' });
  assert.deepEqual(h, [[177.9, '2026-10-14T15:30:00.000Z'], [175.9, '2026-10-30T15:07:00.000Z']]);
  const long: Hist = [[180, '2026-10-01T09:00:00Z'], [179, '2026-10-10T09:00:00Z'], [178, '2026-10-20T09:00:00Z']];
  assert.deepEqual(trim(long, start), [[179, '2026-10-10T09:00:00Z'], [178, '2026-10-20T09:00:00Z']], 'keeps the last price before the window');
});

await check('history file: from the collections, only what the current prices can’t tell, only listed stations', () => {
  const v = (collected: string, prices: Record<string, { e10?: { p: number; u: string }; diesel?: { p: number; u: string } }>) => ({ collected, prices });
  const h = makeHistory([
    v('2026-10-30T16:15:04Z', { cav: { e10: { p: 175.9, u: '2026-10-30T15:07:00Z' }, diesel: { p: 200.9, u: '2026-10-30T15:07:00Z' } }, ron: { e10: { p: 176.9, u: '2026-10-01T15:55:00Z' } } }),
    v('2026-10-30T09:08:54Z', { cav: { e10: { p: 177.9, u: '2026-10-14T15:30:00Z' }, diesel: { p: 200.9, u: '2026-10-30T15:07:00Z' } }, ron: { e10: { p: 176.9, u: '2026-10-01T15:55:00Z' } }, gone: { e10: { p: 170, u: '2026-10-29T09:00:00Z' } } }),
  ]);
  assert.equal(h.recordedFrom, '2026-10-30T09:08:54Z');
  assert.deepEqual(h.stations, { cav: { e10: [[177.9, '2026-10-14T15:30:00Z'], [175.9, '2026-10-30T15:07:00Z']] } });
});

const cav = steps([[177.9, '2026-10-14T15:30:00.000Z'], [175.9, '2026-10-30T15:07:00.000Z']]);
const rex = steps([[173.9, '2026-10-29T15:00:00.000Z'], [172.9, '2026-10-30T14:30:00.000Z']]);

await check('the graph in words: the mock-ups’ two stations', () => {
  assert.equal(historySentence('unleaded', cav, start), 'Unleaded here has been 175.9p since 3.07pm on October 30th. Before that it was 177.9p, from October 14th.');
  assert.equal(
    historySentence('unleaded', rex, start),
    'Unleaded here has been 172.9p since 2.30pm on October 30th. Before that it was 173.9p, from 3pm on October 29th. Earlier prices weren’t recorded.',
  );
  assert.equal(historySentence('diesel', steps([[199.9, '2026-09-25T13:47:00Z']]), start), 'Diesel here has been 199.9p since September 25th.');
  const busy = steps([[180, '2026-10-10T09:00:00Z'], [178, '2026-10-20T09:00:00Z'], [181, '2026-10-24T09:00:00Z'], [179, '2026-10-28T09:00:00Z']]);
  assert.ok(historySentence('unleaded', busy, start).endsWith('It changed three times in the last 14 days, between 178.0p and 181.0p.'));
});

await check('the average: only once every station’s price is known, to a tenth of a penny', () => {
  const a = average([cav, rex, steps([[176.9, '2026-10-01T15:55:00Z']])], start, end)!;
  assert.equal(a.from, Date.parse('2026-10-29T15:00:00Z'), 'starts when the last of them becomes known');
  assert.deepEqual(a.steps.map((s) => s.p), [176.2, 175.9, 175.2]); // (177.9+173.9+176.9)/3, then Reading Extra and Caversham change
  const full = average([cav, steps([[176.9, '2026-10-01T15:55:00Z']])], start, end)!;
  assert.equal(full.from, start, 'from the window’s start when all are known');
  assert.equal(average([], start, end), null);
});

await check('page data: the history rides with each station, with the current price added; none when it is all there is', () => {
  const st = (id: string, lat: number): Station => ({ id, name: id, brand: 'X', address: ['A'], postcode: 'RG4 8RZ', lat, lon: -0.97, hours: null, bankHoliday: null });
  const prices = { cav: { e10: { p: 175.9, u: '2026-10-30T15:07:00.000Z' } }, ron: { e10: { p: 176.9, u: '2026-10-01T15:55:00.000Z' } } };
  const { byArea } = makePageData(
    [st('cav', 51.48), st('ron', 51.47)],
    prices,
    { RG4: [51.48, -0.97, 'Caversham'] },
    {},
    { collected: '2026-10-30T16:15:04.418Z', middle: { e10: 172, diesel: 200 }, unusualPence: 30 },
    { cav: { e10: [[177.9, '2026-10-14T15:30:00.000Z']] } },
  );
  const rows = byArea.get('RG')!;
  assert.deepEqual(rows[0][10], [[[177.9, '2026-10-14T15:30:00.000Z'], [175.9, '2026-10-30T15:07:00.000Z']], 0]);
  assert.equal(rows[1].length, 10, 'no history column when there is nothing to add');
});

console.log(failures === 0 ? '\nAll history checks passed.' : `\n${failures} history check(s) FAILED.`);
process.exitCode = failures === 0 ? 0 : 1;
