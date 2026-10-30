// Checks for the "Worth driving here?" calculator (PLAN Stage 7, src/lib/calc.ts) and its road miles (data/road-miles.json,
// scripts/build-road-miles.ts). The sums are checked against the handover's worked example and the approved mock-ups.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { splitRoads } from './lib/pageData.ts';
import { cheaperFuels, milesBox, money, nearestSelling, pounds, readNumber, ROAD_CREDIT, sums, verdict } from '../src/lib/calc.ts';
import type { Row, Station } from '../src/lib/search.ts';

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
const close = (a: number, b: number, d = 0.05) => assert.ok(Math.abs(a - b) < d, `${a} is not about ${b}`);

await check("sums: the handover's example (40 litres at 135p, 45 mpg, 6 extra miles, 3p cheaper)", () => {
  const s = sums(54, 45, 6, 135, 132);
  close(s.litres, 40);
  close(s.saving, 120);
  close(s.fuelCost, 81.8);
  close(s.net, 38.2);
  close(s.breakEven, 2.05, 0.005);
  const v = verdict(54, 45, 6, 135, 132);
  assert.equal(v.kind, 'worth');
  assert.equal(v.text, 'you’d save about £1.20 on £54 of fuel. The extra 6 miles would use about 82p of fuel, so you’d be about 38p better off.');
  assert.equal(v.breakEven, 2.1, '"at least": 2.05 rounds up');
});

await check('verdicts: the mock-ups (Reading Extra against Emmer Green, 172.9p and 174.9p)', () => {
  const worth = verdict(90, 50, 4, 174.9, 172.9);
  assert.equal(worth.text, 'you’d save about £1.03 on £90 of fuel. The extra 4 miles would use about 64p of fuel, so you’d be about 39p better off.');
  const not = verdict(50, 36, 4, 174.9, 172.9);
  assert.equal(not.kind, 'not');
  assert.equal(not.text, 'the extra 4 miles would use about 88p of fuel, more than the 57p you’d save.');
  assert.equal(not.breakEven, 3.1);
  assert.equal(verdict(50, 36, 3.8, 174.9, 172.9).text.startsWith('the extra 3.8 miles'), true);
  assert.ok(verdict(50, 36, 1, 174.9, 172.9).text.includes('The extra mile would use'));
  const none = verdict(50, 36, 0, 174.9, 172.9);
  assert.equal(none.kind, 'worth');
  assert.equal(none.breakEven, null);
  // About even when the difference rounds to nothing.
  const even = sums(50, 36, 1, 174.9, 172.9);
  const miles = (even.saving / even.fuelCost) * 1;
  assert.equal(verdict(50, 36, miles, 174.9, 172.9).kind, 'even');
});

await check('words and typing: money, miles in the box, numbers typed', () => {
  assert.equal(money(57.2), '57p');
  assert.equal(money(102.9), '£1.03');
  assert.equal(money(99.6), '£1.00');
  assert.equal(pounds(50), '£50');
  assert.equal(pounds(42.5), '£42.50');
  assert.equal(milesBox(3.8), '3.8');
  assert.equal(milesBox(4), '4');
  assert.equal(milesBox(4.96), '5');
  assert.equal(milesBox(12.4), '12');
  assert.equal(readNumber('£50'), 50);
  assert.equal(readNumber(' 42.50 '), 42.5);
  assert.equal(readNumber('1,000'), 1000);
  assert.equal(readNumber('0'), null);
  assert.equal(readNumber('0', true), 0);
  assert.equal(readNumber(''), null);
  assert.equal(readNumber('-5'), null);
  assert.equal(readNumber('fifty'), null);
});

await check('compared with: the nearest open station selling the fuel at a usual price', () => {
  const u = '2026-10-30T09:00:00Z';
  const row = (id: string, open: boolean | null, e10?: { p: number; u: string; x?: 1 }): Row =>
    ({ station: { id } as Station, miles: 0, prices: e10 ? { e10 } : {}, open: { open } as Row['open'], cheapest: { e10: false, diesel: false } });
  const rows = [row('closed', false, { p: 160, u }), row('no-e10', true), row('unusual', true, { p: 120, u, x: 1 }), row('unknown-hours', null, { p: 175, u }), row('later', true, { p: 170, u })];
  assert.equal(nearestSelling(rows, 'e10')?.station.id, 'unknown-hours');
  assert.equal(nearestSelling(rows, 'diesel'), undefined);
});

await check('the link: only on a station cheaper than the nearest open one for a fuel', () => {
  const u = '2026-10-30T09:00:00Z';
  const row = (id: string, open: boolean, e10?: number, diesel?: number, x?: 1): Row =>
    ({
      station: { id } as Station,
      miles: 0,
      prices: { ...(e10 ? { e10: { p: e10, u, ...(x ? { x } : {}) } } : {}), ...(diesel ? { diesel: { p: diesel, u } } : {}) },
      open: { open } as Row['open'],
      cheapest: { e10: false, diesel: false },
    });
  const nearest = row('nearest', true, 174.9, 199.9);
  const same = row('same', true, 174.9, 199.9);
  const cheaperDiesel = row('cheaper-diesel', true, 176.9, 198.9);
  const unusual = row('unusual', true, 120, undefined, 1);
  const closedCheaper = row('closed', false, 170.9);
  const rows = [nearest, same, cheaperDiesel, unusual, closedCheaper];
  assert.deepEqual(cheaperFuels(nearest, rows), [], 'the nearest itself');
  assert.deepEqual(cheaperFuels(same, rows), [], 'the same price');
  assert.deepEqual(cheaperFuels(cheaperDiesel, rows), ['diesel']);
  assert.deepEqual(cheaperFuels(unusual, rows), [], 'an unusual price');
  assert.deepEqual(cheaperFuels(closedCheaper, rows), ['e10'], 'closed now but cheaper: still offered');
});

const roads = JSON.parse(readFileSync(new URL('../data/road-miles.json', import.meta.url), 'utf8'));

await check('road miles: the OS credit shown matches the licence file', () => {
  assert.equal(roads.credit, ROAD_CREDIT);
  const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
  assert.ok(app.includes('Road distances: {ROAD_CREDIT}.'));
});

await check('road miles: RG4 to its stations, as in the feasibility test (Emmer Green 0.6 miles, Reading Extra 2.5)', () => {
  const stations: { id: string; name: string }[] = JSON.parse(readFileSync(new URL('../data/stations.json', import.meta.url), 'utf8')).stations;
  const id = (name: string) => stations.find((s) => s.name === name)!.id;
  assert.equal(roads.districts.RG4[id('EMMER GREEN ESSO EXPRESS')], 6);
  assert.equal(roads.districts.RG4[id('READING EXTRA - PETROL FILLING STATION')], 25);
  assert.ok(Object.keys(roads.districts).length > 2800);
  assert.ok(Object.keys(roads.stations).length > 7000);
});

await check('road files: split by the area each row starts from', () => {
  const st = (id: string, postcode: string) => ({ id, postcode }) as Station;
  const by = splitRoads({ credit: '', built: '', districts: { RG4: { a: 6 }, B1: { b: 3 } }, stations: { aaaaaaaaaaaa: { b: 4 }, gone: { a: 1 } } }, [st('aaaaaaaaaaaa', 'RG1 8DF')]);
  assert.deepEqual(by.get('RG'), { RG4: { a: 6 }, aaaaaaaaaaaa: { b: 4 } });
  assert.deepEqual(by.get('B'), { B1: { b: 3 } });
  assert.equal(by.size, 2, 'a station no longer listed is dropped');
});

console.log(failures === 0 ? '\nAll calculator checks passed.' : `\n${failures} calculator check(s) FAILED.`);
if (failures) process.exitCode = 1;
