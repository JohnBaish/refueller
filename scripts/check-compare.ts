// Checks for "Compare areas over time" (src/lib/compare.ts), with the real files where they matter.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  asChange, changeWords, defaultKeys, freeSlot, groupOf, matchAreas, periodsAvailable, pointsFor, readSaved, seriesGroups, shownPair,
  signedPence, swapIn, withSlots, readCheapest, stepPoints,
} from '../src/lib/compare.ts';
import type { AveragesFile } from '../src/lib/averages.ts';
import type { CouncilAreas } from '../src/lib/levels.ts';

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
const latest = av.collections[av.collections.length - 1][1];
const has = (k: string) => !!latest[k] && latest[k].some((v) => v !== null);
const local = (name: string) => ca.locals.find((l) => l[0] === name)!;

await check('starting areas: council area, county, region and Great Britain; Scotland and Wales use the country', () => {
  assert.deepEqual(defaultKeys(local('Reading'), has), ['C:Reading', 'K:Berkshire', 'R:South East England', 'GB']);
  assert.deepEqual(defaultKeys(local('City of Edinburgh'), has), ['C:City of Edinburgh', 'N:Scotland', 'GB']);
  assert.deepEqual(defaultKeys(null, has), ['GB']);
});

await check('a level named like the one before it is shown once (Rutland, Greater London)', () => {
  const r = defaultKeys(local('Rutland'), has);
  assert.equal(r.filter((k) => k.endsWith('Rutland')).length, 1, r.join());
  const camden = ca.locals.find((l) => l[1] === 'Greater London' && has(`C:${l[0]}`))!;
  const g = defaultKeys(camden, has);
  assert.equal(g.filter((k) => k.endsWith('Greater London')).length, 1, g.join());
});

await check('both fuels: the first area and Great Britain, or the first two; a picked pair is kept; a tap swaps', () => {
  assert.deepEqual(shownPair(['C:Reading', 'K:Berkshire', 'R:South East England', 'GB'], null), ['C:Reading', 'GB']);
  assert.deepEqual(shownPair(['K:Berkshire', 'K:Oxfordshire', 'R:South East England'], null), ['K:Berkshire', 'K:Oxfordshire']);
  assert.deepEqual(shownPair(['C:Reading', 'K:Berkshire', 'GB'], ['K:Berkshire', 'GB']), ['K:Berkshire', 'GB']);
  assert.deepEqual(shownPair(['C:Reading', 'GB'], ['K:Berkshire', 'GB']), ['C:Reading', 'GB']);
  assert.deepEqual(swapIn(['C:Reading', 'GB'], 'K:Berkshire'), ['K:Berkshire', 'GB']);
  assert.deepEqual(swapIn(['K:Berkshire', 'K:Oxfordshire'], 'R:South East England'), ['R:South East England', 'K:Berkshire']);
});

await check('colours stay with their area: a new one takes the first free slot', () => {
  const s = withSlots(['C:Reading', 'K:Berkshire', 'GB'], {});
  assert.deepEqual(s, { 'C:Reading': 0, 'K:Berkshire': 1 });
  assert.equal(freeSlot({ 'K:Berkshire': 1 }, ['K:Berkshire', 'GB']), 0);
  assert.deepEqual(withSlots(['K:Berkshire', 'C:Wokingham'], { 'K:Berkshire': 1 }), { 'K:Berkshire': 1, 'C:Wokingham': 0 });
});

await check('periods appear only once the whole period is recorded', () => {
  const day = 86_400_000;
  const ids = (d: number) => periodsAvailable(0, d * day).map((p) => p.id).join();
  assert.equal(ids(10), '1m');
  assert.equal(ids(90), '1m');
  assert.equal(ids(91), '1m,3m');
  assert.equal(ids(365), '1m,3m,6m,1y');
});

await check('points within the period, and the change from the first', () => {
  const times = ['2026-10-01T09:00:00Z', '2026-10-20T09:00:00Z', '2026-11-08T16:15:00Z'];
  const pts = pointsFor(times, [[170, null], [null, 199], [168.4, 198.5]], 0, 30, Date.parse(times[2]));
  assert.deepEqual(pts.map((p) => p.p), [168.4]);
  const all = pointsFor(times, [[170, null], [169, 199], [168.44, 198.5]], 0, 60, Date.parse(times[2]));
  assert.deepEqual(asChange(all).map((p) => p.p), [0, -1, -1.56]);
  assert.equal(changeWords(all), 'down 1.6p');
  assert.equal(changeWords([{ t: 0, p: 170 }, { t: 1, p: 170.02 }]), 'no change');
  assert.equal(signedPence(-1.56), '−1.6p');
  assert.equal(signedPence(0.24), '+0.2p');
  assert.equal(signedPence(0.01), '0.0p');
});

await check('records grouped so a choice tells the website no more than its region or country', () => {
  assert.equal(groupOf('C:Reading', ca.locals), 'south-east-england');
  assert.equal(groupOf('K:Berkshire', ca.locals), 'south-east-england');
  assert.equal(groupOf('C:City of Edinburgh', ca.locals), 'scotland');
  assert.equal(groupOf('R:South East England', ca.locals), 'national');
  assert.equal(groupOf('GB', ca.locals), 'national');
  const groups = seriesGroups(av.collections, ca.locals);
  for (const [g, f] of groups) {
    assert.ok(/^[a-z-]+$/.test(g), g);
    assert.equal(f.times.length, av.collections.length);
    for (const s of Object.values(f.areas)) assert.equal(s.length, av.collections.length);
  }
  const every = [...groups.values()].flatMap((f) => Object.keys(f.areas));
  assert.equal(new Set(every).size, every.length, 'each area in one group only');
  assert.ok(every.includes('GB') && every.includes('C:Reading'));
});

await check('typing finds areas by name, Great Britain as "GB" too', () => {
  const keys = Object.keys(latest);
  assert.equal(matchAreas(keys, 'berk')[0], 'K:Berkshire');
  assert.ok(matchAreas(keys, 'south east').includes('R:South East England'));
  assert.equal(matchAreas(keys, 'gb')[0], 'GB');
  assert.deepEqual(matchAreas(keys, 'b'), []);
});

await check('a saved choice is read back carefully: unknown areas dropped, odd values replaced', () => {
  const s = readSaved(JSON.stringify({ keys: ['C:Reading', 'C:Nowhere', 'GB'], slots: { 'C:Reading': 2 }, fuel: 'both', view: 'price', period: '6m', pair: ['C:Reading', 'GB'] }), has)!;
  assert.deepEqual(s.keys, ['C:Reading', 'GB']);
  assert.equal(s.slots['C:Reading'], 2);
  assert.equal(s.fuel, 'both');
  assert.equal(s.view, 'price');
  assert.equal(readSaved(JSON.stringify({ keys: ['C:Nowhere'] }), has), null);
  assert.equal(readSaved('not json', has), null);
  assert.equal(readSaved(JSON.stringify({ keys: ['GB'], fuel: 'petrol' }), has)!.fuel, 'e10');
});

await check('a saved choice remembers the place it was made from', () => {
  const s = readSaved(JSON.stringify({ keys: ['GB'], from: 'RG4-7SS' }), has)!;
  assert.equal(s.from, 'RG4-7SS');
  assert.equal(readSaved(JSON.stringify({ keys: ['GB'] }), has)!.from, null);
});

await check('the cheapest of the eight: only for the page it came from, priced at each collection once known', () => {
  const kept = JSON.stringify({ from: 'PE38', near: 'PE38', e10: { name: 'Tesco', steps: [{ t: Date.parse('2026-11-01T10:00:00Z'), p: 170.9 }] }, diesel: null });
  assert.equal(readCheapest(kept, 'RG4'), null);
  assert.equal(readCheapest(kept, null), null);
  assert.equal(readCheapest('nonsense', 'PE38'), null);
  const c = readCheapest(kept, 'PE38')!;
  const times = ['2026-10-31T10:15:00Z', '2026-11-01T10:15:00Z', '2026-11-02T10:15:00Z'];
  const pts = stepPoints(times, [...c.e10!.steps, { t: Date.parse('2026-11-02T08:00:00Z'), p: 168.9 }], 30, Date.parse(times[2]));
  assert.deepEqual(pts.map((p) => p.p), [170.9, 168.9]);
  assert.deepEqual(stepPoints(times, c.e10!.steps, 1, Date.parse(times[2])).map((p) => p.p), [170.9, 170.9]);
});

console.log(failures ? `\n${failures} failed` : '\nall compare checks passed');
if (failures) process.exit(1);
