// Checks for the averages at every level in "The wider picture" (src/lib/levels.ts; data/council-areas.json made by
// scripts/build-council-areas.ts): finding a postcode's council area, which levels show, and each row's fact, with the real files.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { inPlace, levelRows, localIndex, splitPostcode, theName, type AreaLookup, type Averages, type CouncilAreas } from '../src/lib/levels.ts';
import type { AveragesFile } from '../src/lib/averages.ts';

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
const read = <T>(f: string): T => JSON.parse(readFileSync(new URL(`../${f}`, import.meta.url), 'utf8'));
const ca = read<CouncilAreas>('data/council-areas.json');
const av = read<AveragesFile>('data/averages.json');
const nov1 = av.collections.find(([t]) => t.startsWith('2026-11-01T16:15'))!;
const first = av.collections[0];
const place = (pc: string) => {
  const i = localIndex(ca.areas[/^[A-Z]+/.exec(pc.toUpperCase())![0]], pc);
  return i === null ? null : ca.locals[i];
};
const rowsFor = (pc: string, eight: { now: [number | null, number | null]; then: [number | null, number | null] | null }, latest: Averages = nov1[1]) =>
  levelRows({ eight: { name: 'These eight stations', ...eight, since: 'October 30th' }, local: place(pc), locals: ca.locals, latest, first: first[1], since: 'October 30th' });

await check('postcodes split into district and inward code, with or without the space', () => {
  assert.deepEqual(splitPostcode('rg4 7ss'), ['RG4', '7SS']);
  assert.deepEqual(splitPostcode('RG47SS'), ['RG4', '7SS']);
  assert.deepEqual(splitPostcode('EC1A1BB'), ['EC1A', '1BB']);
  assert.deepEqual(splitPostcode('RG4'), ['RG4', '']);
});

await check('the lookup: an exception first, then the sector, then the district; a district alone uses the district', () => {
  const lk: AreaLookup = { d: { RG4: 1 }, s: { 'RG4 7': 2 }, p: { 'RG4 7ZZ': 3 } };
  assert.equal(localIndex(lk, 'RG4 7ZZ'), 3);
  assert.equal(localIndex(lk, 'RG4 7AB'), 2);
  assert.equal(localIndex(lk, 'RG4 9AB'), 1, 'a sector not in the file: the district');
  assert.equal(localIndex(lk, 'RG4'), 1);
  assert.equal(localIndex(lk, 'RG5 1AB'), null);
  assert.equal(localIndex(undefined, 'RG4 7AB'), null);
});

await check('the real council areas: Reading, Maidstone, Leeds, Camden, the City of London, Cardiff, the Western Isles', () => {
  assert.deepEqual(place('RG4 7SS'), ['Reading', 'Berkshire', 'South East England', 'England']);
  assert.deepEqual(place('ME14 1XX'), ['Maidstone', 'Kent', 'South East England', 'England'], 'a new or mistyped postcode: its sector');
  assert.deepEqual(place('LS1 4AP'), ['Leeds', 'West Yorkshire', 'Yorkshire and the Humber', 'England']);
  assert.deepEqual(place('NW1 2DB'), ['Camden', 'Greater London', 'Greater London', 'England']);
  assert.deepEqual(place('EC2V 7HH'), ['City of London', 'City of London', 'Greater London', 'England']);
  assert.deepEqual(place('CF10 1EP'), ['Cardiff', null, null, 'Wales']);
  assert.deepEqual(place('HS1 2BB'), ['Western Isles', null, null, 'Scotland']);
  assert.equal(ca.locals.length, 350);
  assert.equal(new Set(ca.locals.filter((l) => l[1]).map((l) => l[1])).size, 48, 'the 48 ceremonial counties');
});

await check('names in a sentence', () => {
  assert.equal(inPlace('Isle of Wight'), 'on the Isle of Wight');
  assert.equal(inPlace('West Yorkshire'), 'in West Yorkshire');
  assert.equal(inPlace('City of Edinburgh'), 'in the City of Edinburgh');
  assert.equal(inPlace('Western Isles'), 'in the Western Isles');
  assert.equal(theName('West Midlands region'), 'the West Midlands region');
});

await check('RG4 7SS on November 1st at 4.15pm: the rows and facts of the agreed mock-up', () => {
  const rows = rowsFor('RG4 7SS', { now: [174.4, 199.65], then: [175.15, 199.9] });
  assert.deepEqual(rows.map((r) => r.name), ['These eight stations', 'Reading', 'Berkshire', 'South East England', 'England', 'Great Britain']);
  assert.deepEqual(rows.map((r) => r.fact), [
    'Unleaded is down 0.8p since October 30th, when Refueller began recording.',
    'Unleaded is 1.3p less than the Berkshire average.',
    'The second dearest county in England for unleaded, after the Isle of Wight.',
    'The dearest of England’s nine regions for both fuels.',
    'Unleaded averages range from 169.5p in West Yorkshire to 179.0p on the Isle of Wight.',
    'Wales is the cheapest of the three nations for both fuels, and Scotland the dearest.',
  ]);
});

await check('a level covering the same council areas as the one above is shown once: Rutland; Greater London', () => {
  const r = rowsFor('LE15 6AA', { now: [175, 199], then: null }).map((x) => x.name);
  assert.deepEqual(r, ['These eight stations', 'Rutland', 'East Midlands', 'England', 'Great Britain']);
  const l = rowsFor('NW4 4BT', { now: [175, 199], then: null }).map((x) => x.name);
  assert.deepEqual(l, ['These eight stations', 'Barnet', 'Greater London', 'England', 'Great Britain']);
  // Camden has fewer than five stations, so its row is left out.
  assert.deepEqual(rowsFor('NW1 2DB', { now: [175, 199], then: null }).map((x) => x.name), ['These eight stations', 'Greater London', 'England', 'Great Britain']);
});

await check('Wales and Scotland go from the council area to the country; their council areas are ranked within it', () => {
  const r = rowsFor('CF10 1EP', { now: [172, 198], then: null });
  assert.deepEqual(r.map((x) => x.name), ['These eight stations', 'Cardiff', 'Wales', 'Great Britain']);
  assert.match(r[2].fact, /^Unleaded averages range from \d+\.\dp in .+ to \d+\.\dp in .+\.$/);
  for (const x of r) assert.ok(x.fact, `${x.name} has a fact`);
});

await check('a council area with fewer than five stations is left out; a place with no council area found gets the eight and Great Britain', () => {
  const thin: Averages = { ...nov1[1], 'C:Reading': [null, null] };
  assert.ok(!rowsFor('RG4 7SS', { now: [174.4, 199.65], then: null }, thin).some((x) => x.name === 'Reading'));
  const none = levelRows({ eight: { name: 'These eight stations', now: [174, 199], then: null, since: '' }, local: null, locals: ca.locals, latest: nov1[1], first: null, since: '' });
  assert.deepEqual(none.map((x) => x.name), ['These eight stations', 'Great Britain']);
});

await check('the rule’s order: an end of the group, then a gap of 1p or more, then a change of 0.5p or more, then the gap', () => {
  const locals: CouncilAreas['locals'] = [
    ['A', 'Shire', 'R1', 'England'], ['B', 'Shire', 'R1', 'England'], ['C', 'Shire', 'R1', 'England'], ['D', 'Shire', 'R1', 'England'],
    ['Z', 'Other', 'R1', 'England'],
  ];
  const latest: Averages = { 'C:A': [170, 200], 'C:B': [171, 201], 'C:C': [172.3, 202], 'C:D': [173, 203], 'K:Shire': [172, 202], 'R:R1': [172, 202], 'N:England': [172, 202], GB: [172, 202] };
  const go = (name: string, then: [number, number] | null) =>
    levelRows({ eight: { name: 'These eight stations', now: [172, 202], then: null, since: 'x' }, local: locals.find((l) => l[0] === name)!, locals, latest, first: then ? { [`C:${name}`]: then } : null, since: 'October 30th' })[1].fact;
  assert.equal(go('A', null), 'The cheapest of the four council areas in Shire for both fuels.');
  assert.equal(go('B', null), 'The second cheapest of the four council areas in Shire for both fuels, after A.');
  latest['C:E'] = [174, 204];
  locals.push(['E', 'Shire', 'R1', 'England']);
  assert.equal(go('C', [173, 202]), 'Unleaded is down 0.7p since October 30th, when Refueller began recording.', 'third of five: the gap is 0.3p, so the change');
  assert.equal(go('C', [172.5, 202]), 'Unleaded is 0.3p more than the Shire average.', 'no change of 0.5p: the gap however small');
});

await check('the eight’s change: “when Refueller began recording” only when their record starts then too', () => {
  const r = levelRows({ eight: { name: 'These eight stations', now: [171.6, 198.2], then: [172.2, 198.2], since: 'October 31st' }, local: place('B1 1BB'), locals: ca.locals, latest: { ...nov1[1], 'C:Birmingham': [171.6, 198.2] }, first: first[1], since: 'October 30th' });
  assert.equal(r[0].fact, 'Unleaded is down 0.6p since October 31st.');
});

if (failures) {
  console.log(`\n${failures} level check(s) failed.`);
  process.exit(1);
}
console.log('\nAll level checks passed.');
