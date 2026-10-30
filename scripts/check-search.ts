// Checks for the page's search rules (PLAN Stage 3, src/lib/search.ts) and the postcode districts (data/outcodes.json).
// Worked examples checked by hand; the RG4 run uses a fixed copy of the real stations around RG4 (scripts/fixtures/).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fromBritishGrid, toBritishGrid } from './lib/grid.ts';
import {
  clockText,
  division,
  isOld,
  milesText,
  nearestEight,
  openState,
  hoursLookWrong,
  openText,
  outcodeOf,
  positionAgrees,
  readPostcode,
  tidyAddress,
  tidyName,
  updatedText,
  type BankHolidays,
  type Outcodes,
  type Station,
} from '../src/lib/search.ts';

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

const outcodes: Outcodes = JSON.parse(readFileSync(new URL('../data/outcodes.json', import.meta.url), 'utf8')).outcodes;
const bank: BankHolidays = { 'england-and-wales': ['2026-12-25', '2026-12-28'], scotland: ['2026-11-30', '2026-12-25'] };
const week = (h: string) => [h, h, h, h, h, h, h];
const st = (over: Partial<Station> = {}): Station => ({ id: 'x', name: 'X', brand: 'X', address: ['A ROAD', 'READING'], postcode: 'RG4 8RZ', lat: 51.48, lon: -0.97, hours: week('07:00-22:30'), bankHoliday: null, ...over });
const at = (iso: string) => Date.parse(iso);

await check('postcode districts: every district in Great Britain, none in Northern Ireland, known places', () => {
  assert.ok(Object.keys(outcodes).length > 2800, `${Object.keys(outcodes).length}`);
  assert.equal(Object.keys(outcodes).some((o) => o.startsWith('BT')), false);
  assert.equal(outcodes.RG4[2], 'Caversham');
  assert.equal(outcodes.ZE1[2], 'Lerwick');
  assert.equal(outcodes.TR21[2], 'Hugh Town');
  for (const [o, [lat, lon]] of Object.entries(outcodes)) assert.ok(lat > 49.8 && lat < 61 && lon > -8.7 && lon < 2, o);
});

await check('grid: British National Grid there and back agrees to less than a metre', () => {
  for (const [lat, lon] of [[51.48289, -0.9697], [60.15144, -1.17141], [49.91914, -6.2986], [55.9508, -3.1928]]) {
    const g = toBritishGrid(lat, lon);
    const back = fromBritishGrid(g.easting, g.northing);
    assert.ok(Math.abs(back.latitude - lat) < 1e-5 && Math.abs(back.longitude - lon) < 1e-5, `${lat},${lon}`);
  }
});

await check('postcodes: only the first half is used, Northern Ireland and unknowns explained', () => {
  for (const t of ['rg4 7hn', 'RG47HN', ' RG4 ', 'rg4']) assert.deepEqual(readPostcode(t, outcodes), { ok: true, outcode: 'RG4' }, t);
  assert.deepEqual(readPostcode('sw1a 1aa', outcodes), { ok: true, outcode: 'SW1A' });
  assert.deepEqual(readPostcode('W1A1AA', outcodes), { ok: true, outcode: 'W1A' });
  assert.deepEqual(readPostcode('BT1 1AA', outcodes), { ok: false, problem: 'northern-ireland' });
  assert.deepEqual(readPostcode('QQ1', outcodes), { ok: false, problem: 'not-found' });
  assert.deepEqual(readPostcode('hello', outcodes), { ok: false, problem: 'not-a-postcode' });
  assert.deepEqual(readPostcode('  ', outcodes), { ok: false, problem: 'empty' });
});

await check('words: miles, clock times, names and addresses', () => {
  assert.equal(milesText(0.04), 'less than 0.1 miles');
  assert.equal(milesText(0.44), '0.4 miles');
  assert.equal(milesText(1), '1.0 miles');
  assert.equal(milesText(4.96), '5.0 miles');
  assert.equal(milesText(5.2), '5 miles');
  assert.equal(milesText(12.5), '13 miles');
  assert.equal(clockText('09:30'), '9.30am');
  assert.equal(clockText('15:00'), '3pm');
  assert.equal(clockText('12:00'), 'midday');
  assert.equal(clockText('00:00'), 'midnight');
  assert.equal(clockText('23:59'), 'midnight');
  assert.equal(clockText('22:30'), '10.30pm');
  assert.equal(tidyName('EMMER GREEN ESSO EXPRESS'), 'Emmer Green Esso Express');
  assert.equal(tidyName('BP-KRISCOREADING'), 'BP-Kriscoreading');
  assert.equal(tidyName('MFG LEANDER'), 'MFG Leander');
  assert.equal(tidyName('Checkpoint Service station'), 'Checkpoint Service station', 'mixed case left as given');
  assert.equal(tidyName('READING EXTRA - PETROL FILLING STATION'), 'Reading Extra – Petrol Filling Station');
  assert.equal(tidyAddress(st({ address: ['150 OXFORD ROAD', 'READING', 'READING'], postcode: 'RG1 7PJ' })), '150 Oxford Road, Reading, RG1 7PJ');
  // John, 30 October: initials kept (PE33 9RF, KT12 1RZ).
  assert.equal(tidyName('PC&AT Hudson'), 'PC&AT Hudson', 'a name with small letters is left exactly as typed');
  assert.equal(tidyName('TGC - WALTON HOUSE'), 'TGC – Walton House');
  assert.equal(tidyName('PGG ESSO'), 'PGG Esso');
  assert.equal(tidyName('J&J MOTORS LTD'), 'J&J Motors Ltd');
  assert.equal(tidyName('D.J.JOHNSON'), 'D.J.Johnson');
  assert.equal(tidyName('ST. JOHNS RD'), 'St. Johns Rd');
  assert.equal(tidyName('CWM GARAGE'), 'Cwm Garage');
});

await check('hours that look wrong: 12-hour slips and evening-only days; genuine short hours left alone', () => {
  const now = at('2026-10-30T12:30:00Z');
  const whittington = st({ hours: ['18:00-22:00', '18:00-22:00', '06:00-22:00', '18:00-22:00', '18:00-22:00', '07:00-22:00', '07:00-22:00'] });
  assert.equal(hoursLookWrong(whittington), true);
  assert.equal(openText(openState(whittington, now, bank)), 'Opening hours look wrong');
  assert.equal(hoursLookWrong(st({ hours: [...week('18:30-21:30').slice(0, 6), '07:00-16:30'] })), true, 'Asda Harwich: evening only on weekdays');
  assert.equal(hoursLookWrong(st({ hours: ['06:00-10:00', ...week('06:00-22:00').slice(1)] })), true, 'closes 12 hours early');
  assert.equal(hoursLookWrong(st({ hours: week('07:00-22:30'), bankHoliday: { type: 'bank holiday', hours: '19:00-22:30' } })), true, 'bank-holiday hours too');
  assert.equal(hoursLookWrong(st({ hours: ['closed', '12:00-14:00', 'closed', '12:00-14:00', 'closed', '12:00-14:00', 'closed'] })), false, 'Coll: genuinely short');
  assert.equal(hoursLookWrong(st({ hours: ['14:00-17:00', 'closed', '14:00-17:00', 'closed', '14:00-17:00', 'closed', '14:00-16:00'] })), false, 'an afternoon shop');
  assert.equal(hoursLookWrong(st({ hours: week('22:00-06:00') })), false, 'open overnight');
  assert.equal(hoursLookWrong(st()), false);
  assert.equal(hoursLookWrong(st({ hours: week('24h') })), false);
});

await check('updated: hours and days, and old after 30 whole days', () => {
  const now = at('2026-10-30T12:30:00Z');
  assert.equal(updatedText('2026-10-30T12:00:00Z', now), 'Price set less than an hour ago');
  assert.equal(updatedText('2026-10-30T11:00:00Z', now), 'Price set 1 hour ago');
  assert.equal(updatedText('2026-10-29T15:30:00Z', now), 'Price set 21 hours ago');
  assert.equal(updatedText('2026-10-29T12:00:00Z', now), 'Price set 1 day ago');
  assert.equal(updatedText('2026-09-26T12:00:00Z', now), 'Price set 34 days ago');
  assert.equal(isOld('2026-09-30T10:00:00Z', now), false, '30 days');
  assert.equal(isOld('2026-09-29T10:00:00Z', now), true, '31 days');
});

await check('open: ordinary hours, closing time, and closed until the next opening', () => {
  const s = st();
  // Friday 30 October 2026, GMT.
  assert.deepEqual(openState(s, at('2026-10-30T12:30:00Z'), bank), { open: true, until: '22:30' });
  assert.equal(openText(openState(s, at('2026-10-30T12:30:00Z'), bank)), 'Open until 10.30pm');
  assert.equal(openText(openState(s, at('2026-10-30T23:30:00Z'), bank)), 'Closed until 7am tomorrow');
  assert.equal(openText(openState(s, at('2026-10-30T06:30:00Z'), bank)), 'Closed until 7am');
  assert.equal(openText(openState(s, at('2026-10-30T22:30:00Z'), bank)), 'Closed until 7am tomorrow', 'closes at 10.30pm exactly');
  const weekdays = st({ hours: ['07:00-19:00', '07:00-19:00', '07:00-19:00', '07:00-19:00', '07:00-19:00', 'closed', 'closed'] });
  assert.equal(openText(openState(weekdays, at('2026-10-30T20:00:00Z'), bank)), 'Closed until Monday 7am');
  assert.equal(openText(openState(st({ hours: week('closed') }), at('2026-10-30T12:00:00Z'), bank)), 'Closed');
  assert.equal(openText(openState(st({ hours: null }), at('2026-10-30T12:00:00Z'), bank)), 'Opening hours not given');
});

await check('open: 24 hours, and hours that run past midnight', () => {
  assert.equal(openText(openState(st({ hours: week('24h') }), at('2026-10-30T03:00:00Z'), bank)), 'Open 24 hours');
  const lateFriday = st({ hours: ['06:00-22:00', '06:00-22:00', '06:00-22:00', '06:00-22:00', '06:00-02:00', '08:00-20:00', '08:00-20:00'] });
  assert.equal(openText(openState(lateFriday, at('2026-10-30T23:30:00Z'), bank)), 'Open until 2am', 'Friday night');
  assert.equal(openText(openState(lateFriday, at('2026-10-31T01:30:00Z'), bank)), 'Open until 2am', 'early Saturday, on Friday\'s hours');
  assert.equal(openText(openState(lateFriday, at('2026-10-31T03:00:00Z'), bank)), 'Closed until 8am');
  const allButSunday = st({ hours: ['24h', '24h', '24h', '24h', '24h', '24h', '07:00-22:00'] });
  assert.equal(openText(openState(allButSunday, at('2026-10-31T15:00:00Z'), bank)), 'Open until midnight', 'Saturday, before a shorter Sunday');
});

await check('open: summer time, and the night the clocks go forward', () => {
  const s = st();
  // Friday 26 June 2026, BST: 6.30am UK is 05:30 UTC.
  assert.equal(openText(openState(s, at('2026-06-26T05:30:00Z'), bank)), 'Closed until 7am');
  assert.equal(openText(openState(s, at('2026-06-26T06:30:00Z'), bank)), 'Open until 10.30pm', '7.30am UK');
  // Sunday 28 March 2027: 1am GMT becomes 2am BST. 06:30 UTC is 7.30am UK.
  assert.equal(openText(openState(s, at('2027-03-28T06:30:00Z'), bank)), 'Open until 10.30pm');
});

await check('open: bank holidays, England and Wales or Scotland by postcode', () => {
  const bh = { type: 'bank holiday', hours: '10:00-16:00' };
  const eng = st({ bankHoliday: bh });
  const scot = st({ bankHoliday: bh, postcode: 'EH1 1YZ' });
  assert.equal(division('EH1 1YZ'), 'scotland');
  assert.equal(division('TD15 1AA'), 'england-and-wales');
  assert.equal(division('TD5 7AA'), 'scotland');
  assert.equal(division('G1 1AA'), 'scotland');
  assert.equal(division('GL1 1AA'), 'england-and-wales');
  // Christmas Day 2026 (a Friday), both divisions: 9am is before the bank-holiday opening.
  assert.equal(openText(openState(eng, at('2026-12-25T09:00:00Z'), bank)), 'Closed until 10am');
  assert.equal(openText(openState(eng, at('2026-12-25T12:00:00Z'), bank)), 'Open until 4pm');
  // St Andrew's Day (Monday 30 November 2026): Scotland only.
  assert.equal(openText(openState(scot, at('2026-11-30T17:00:00Z'), bank)), 'Closed until 7am tomorrow');
  assert.equal(openText(openState(eng, at('2026-11-30T17:00:00Z'), bank)), 'Open until 10.30pm');
  // Sunday 27 December, evening: the next opening is the bank holiday Monday's 10am in England.
  assert.equal(openText(openState(eng, at('2026-12-27T23:00:00Z'), bank)), 'Closed until 10am tomorrow');
  // No bank-holiday entry: the usual hours.
  assert.equal(openText(openState(st(), at('2026-12-25T12:00:00Z'), bank)), 'Open until 10.30pm');
});

await check('position check: a station far from its own postcode district is left out', () => {
  assert.equal(positionAgrees(st({ postcode: 'RG4 8RZ', lat: 51.48, lon: -0.97 }), outcodes), true);
  assert.equal(positionAgrees(st({ postcode: 'RG4 8RZ', lat: 51.48, lon: 0.97 }), outcodes), false, 'wrong-signed longitude');
  assert.equal(positionAgrees(st({ postcode: 'QQ9 9QQ' }), outcodes), true, 'unknown district: nothing to compare');
  assert.equal(positionAgrees(st({ postcode: 'RG48RZ', lat: 51.48, lon: 0.97 }), outcodes), false, 'postcode without a space');
  assert.equal(positionAgrees(st({ postcode: 'ZE2 9TW', lat: 60.76945, lon: -0.83442 }), outcodes), true, 'Shetland: 34 miles from the middle of ZE2, but right');
  assert.equal(positionAgrees(st({ postcode: 'LE11 3GE', lat: 52.76366, lon: -1.9362 }), outcodes), false, 'Loughborough placed 30 miles west');
  assert.equal(outcodeOf('CW13HD'), 'CW1');
  assert.equal(tidyAddress(st({ address: ['1 HIGH ST'], postcode: 'CW13HD' })), '1 High St, CW1 3HD');
  assert.equal(outcodeOf('sw1a 1aa'), 'SW1A');
  assert.equal(division('TD151AA'), 'england-and-wales');
});

await check('RG4 with the real stations: the eight, the closed ones at night, the cheapest', () => {
  const fx = JSON.parse(readFileSync(new URL('./fixtures/rg4-2026-10-30.json', import.meta.url), 'utf8'));
  const day = nearestEight('RG4', fx.stations, fx.prices, outcodes, bank, at('2026-10-30T12:30:00Z'));
  assert.equal(day.place, 'Caversham');
  assert.equal(day.rows.length, 8);
  assert.deepEqual(day.rows.map((r) => tidyName(r.station.name)).slice(0, 3), ['Emmer Green Esso Express', 'Caversham Esso Express', 'MFG Leander']);
  assert.equal(milesText(day.rows[0].miles), '0.4 miles');
  assert.equal(day.closedNow, 0);
  assert.ok(day.rows.every((r, i) => i === 0 || r.miles >= day.rows[i - 1].miles), 'nearest first');
  const night = nearestEight('RG4', fx.stations, fx.prices, outcodes, bank, at('2026-10-30T23:30:00Z'));
  assert.equal(night.closedNow, 4);
  assert.equal(openText(night.rows[0].open), 'Closed until 7am tomorrow');
  assert.equal(openText(night.rows[3].open), 'Closed until 6am tomorrow');
  const cheapE10 = night.rows.filter((r) => r.cheapest.e10).map((r) => r.prices.e10?.p);
  const cheapDiesel = night.rows.filter((r) => r.cheapest.diesel).map((r) => r.prices.diesel?.p);
  assert.ok(cheapE10.length >= 1 && cheapE10.every((p) => p === Math.min(...night.rows.flatMap((r) => (r.prices.e10 ? [r.prices.e10.p] : [])))));
  assert.ok(cheapDiesel.length >= 1);
});

await check('the eight: temporarily closed left out; an unusual price never marked cheapest', () => {
  const stations = [
    st({ id: 'a', lat: 51.483, lon: -0.97 }),
    st({ id: 'b', lat: 51.484, lon: -0.97, temporarilyClosed: true }),
    st({ id: 'c', lat: 51.485, lon: -0.97 }),
  ];
  const prices = { a: { e10: { p: 139.9, u: '2026-10-29T00:00:00Z', x: 1 as const } }, b: { e10: { p: 120, u: '2026-10-29T00:00:00Z' } }, c: { e10: { p: 172.9, u: '2026-10-29T00:00:00Z' } } };
  const r = nearestEight('RG4', stations, prices, outcodes, bank, at('2026-10-30T12:00:00Z'));
  assert.deepEqual(r.rows.map((x) => x.station.id), ['a', 'c']);
  assert.deepEqual(r.rows.map((x) => x.cheapest.e10), [false, true]);
});

await check('the page footer carries the credit lines from the Open Names licence file, word for word', () => {
  const credits: string[] = JSON.parse(readFileSync(new URL('../data/outcodes.json', import.meta.url), 'utf8')).credits;
  const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8').replace(/\s+/g, ' ');
  assert.equal(credits.length, 3);
  for (const c of credits) assert.ok(app.includes(c.endsWith('.') ? c : `${c}.`), c);
});

console.log(failures === 0 ? '\nAll search checks passed.' : `\n${failures} search check(s) FAILED.`);
process.exitCode = failures === 0 ? 0 : 1;
