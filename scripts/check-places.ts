// Checks for place names in the journey planner (src/lib/places.ts, scripts/build-places.ts, data/places.json): the list, the
// matching and suggestions, same-name places, and telling a postcode from a place.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { areaName, placeFrom } from './build-places.ts';
import { findPlace, looksLikePostcode, makePlaceIndex, norm, placeAt, placeLabel, suggest, type PlaceFile } from '../src/lib/places.ts';

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

const file: PlaceFile = JSON.parse(readFileSync(new URL('../data/places.json', import.meta.url), 'utf8'));
const ix = makePlaceIndex(file);
const outcodes = JSON.parse(readFileSync(new URL('../data/outcodes.json', import.meta.url), 'utf8'));

await check('the list: cities, towns, suburbs and villages, no hamlets; the OS credit as on the page', () => {
  assert.ok(file.places.length > 30000 && file.places.length < 31000, `${file.places.length} places`);
  assert.deepEqual([...new Set(file.places.map((p) => p[5]))].sort(), ['c', 's', 't', 'v']);
  assert.equal(file.credit, outcodes.credits[0], 'the same OS line as the postcode positions');
});

await check('reading Open Names: English name shown, Welsh name kept; council areas in English', () => {
  const f = Array(30).fill('');
  Object.assign(f, { 2: 'Caerdydd', 3: 'cym', 4: 'Cardiff', 5: 'eng', 6: 'populatedPlace', 7: 'City', 8: '318000', 9: '176000', 16: 'CF10', 24: 'Caerdydd - Cardiff' });
  const p = placeFrom(f)!;
  assert.equal(p[0], 'Cardiff');
  assert.equal(p[1], 'Caerdydd');
  assert.equal(p[2], 'Cardiff');
  assert.equal(p[5], 'c');
  assert.equal(p[6], 'CF10');
  assert.equal(placeFrom(Object.assign([...f], { 7: 'Hamlet' })), null, 'hamlets left out');
  assert.equal(areaName('', 'Merton'), 'Merton', 'a London borough where there is no county');
});

await check('real places: Andover, Exeter, Reading, Caversham, Wimbledon, Cardiff by either name', () => {
  for (const [typed, label] of [
    ['Andover', 'Andover'],
    ['exeter', 'Exeter'],
    ['Reading', 'Reading'],
    ['Caversham', 'Caversham'],
    ['wimbledon', 'Wimbledon'],
    ['Caerdydd', 'Cardiff'],
    ['Royal Wootton Bassett', 'Royal Wootton Bassett'],
    ['Clapham, Greater London', 'Clapham, Greater London'],
  ]) {
    const r = findPlace(ix, typed);
    assert.ok(r.ok, typed);
    assert.equal(placeLabel(r.place), label);
  }
});

await check('same-name places must be chosen: Newport alone is ambiguous, "Newport, Isle of Wight" is not', () => {
  const r = findPlace(ix, 'Newport');
  assert.ok(!r.ok && r.problem === 'several' && r.places.length > 5);
  const w = findPlace(ix, 'Newport, Isle of Wight');
  assert.ok(w.ok && w.place.area === 'Isle of Wight');
  const c = findPlace(ix, 'Newport, Newport');
  assert.ok(c.ok && c.place.kind === 'c', 'the Welsh city, by its full label');
  assert.ok(!findPlace(ix, 'Clapham').ok, 'four Claphams');
  const sutton = findPlace(ix, 'Sutton, Shropshire (TF9)');
  assert.ok(sutton.ok && sutton.place.district === 'TF9', 'three Suttons in Shropshire, told apart by postcode district');
  const labels = new Map<string, number>();
  for (const k of ix.keys) labels.set(k.label, (labels.get(k.label) ?? 0) + 1);
  const clashes = [...labels].filter(([, n]) => n > 1);
  assert.ok(clashes.length < 60, `only a few labels are shared (${clashes.length})`);
  for (const [l] of clashes) {
    const same = ix.all.filter((_, i) => ix.keys[i].label === l);
    assert.ok(!findPlace(ix, l).ok, `${l}: typed alone, it must be chosen from the list`);
    for (const p of same) {
      const r = findPlace(ix, l, placeAt(p));
      assert.ok(r.ok && r.place === p, `${l}: each one found by the position kept with it`);
    }
  }
  assert.ok(!findPlace(ix, 'Xyzzyton').ok);
});

await check('suggestions: from two letters; whole name first, cities and towns before villages; a later word matches', () => {
  assert.deepEqual(suggest(ix, 'a'), []);
  const and = suggest(ix, 'andov');
  assert.equal(placeLabel(and[0]), 'Andover');
  const ex = suggest(ix, 'Exeter');
  assert.equal(placeLabel(ex[0]), 'Exeter');
  assert.ok(suggest(ix, 'wootton b').some((p) => p.name === 'Royal Wootton Bassett'), 'a later word');
  const newp = suggest(ix, 'newport');
  assert.equal(newp.length, 8);
  assert.ok(['c', 't'].includes(newp[0].kind), 'a city or town first');
  assert.equal(norm('St. Albans'), norm('Saint Albans'));
});

await check('postcode or place: RG1, RG1 8FR and "ec1a 1bb" are postcodes; Reading and Andover are not', () => {
  for (const p of ['RG1', 'RG1 8FR', 'ec1a 1bb', 'SW1A', ' rg4 7hn ']) assert.ok(looksLikePostcode(p), p);
  for (const p of ['Reading', 'Andover', 'St Ives', 'Newport, Isle of Wight']) assert.ok(!looksLikePostcode(p), p);
});

if (failures) {
  console.log(`\n${failures} place check(s) failed.`);
  process.exit(1);
}
console.log('\nAll place checks passed.');
