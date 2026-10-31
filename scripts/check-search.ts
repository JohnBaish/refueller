// Checks for the page's search rules (PLAN Stage 3, src/lib/search.ts) and the postcode districts (data/outcodes.json).
// Worked examples checked by hand; the RG4 run uses a fixed copy of the real stations around RG4 (scripts/fixtures/).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fromBritishGrid, toBritishGrid } from './lib/grid.ts';
import { encodeDistrict } from './build-postcodes.ts';
import { decodeDistrict } from '../src/lib/postcodes.ts';
import { readdirSync } from 'node:fs';
import { makePageData } from './lib/pageData.ts';
import {
  clockText,
  division,
  isOld,
  milesText,
  nearestEight,
  openState,
  higherPricesUsual,
  hoursLookWrong,
  hoursProblem,
  nearestFrom,
  postcodeArea,
  openText,
  outcodeOf,
  positionAgrees,
  readPostcode,
  tidyAddress,
  tidyName,
  updatedText,
  rankPrices,
  rankText,
  type BankHolidays,
  type Outcodes,
  type Station,
  type Row,
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
  for (const t of [' RG4 ', 'rg4']) assert.deepEqual(readPostcode(t, outcodes), { ok: true, outcode: 'RG4' }, t);
  for (const t of ['rg4 7hn', 'RG47HN', ' rg4  7HN ']) assert.deepEqual(readPostcode(t, outcodes), { ok: true, outcode: 'RG4', inward: '7HN' }, t);
  assert.deepEqual(readPostcode('sw1a 1aa', outcodes), { ok: true, outcode: 'SW1A', inward: '1AA' });
  assert.deepEqual(readPostcode('W1A1AA', outcodes), { ok: true, outcode: 'W1A', inward: '1AA' });
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
  assert.equal(tidyName('PC&AT Hudson'), 'PC&AT Hudson', 'a name in mixed capitals and small letters is left exactly as typed');
  assert.equal(tidyName('trewellard garage petrol station'), 'Trewellard Garage Petrol Station', 'all small letters: treated like capitals');
  assert.equal(tidyName('r s morphet ltd'), 'R S Morphet Ltd');
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
  // The explanation under "More" (John, 30 October).
  assert.equal(
    hoursProblem(whittington),
    'The station gives its hours on Mondays, Tuesdays, Thursdays and Fridays as 6pm to 10pm, but on Wednesdays as 6am to 10pm. 6pm is exactly 12 hours after 6am, so 6pm may have been entered by mistake.',
  );
  assert.equal(
    hoursProblem(st({ hours: [...week('18:30-21:30').slice(0, 6), '07:00-16:30'] })),
    'The station gives its hours on Mondays to Saturdays as 6.30pm to 9.30pm. Very few petrol stations open only in the evening, so these hours may have been entered by mistake.',
  );
  assert.equal(
    hoursProblem(st({ hours: ['06:00-10:00', ...week('06:00-22:00').slice(1)], bankHoliday: { type: 'bank holiday', hours: '06:00-22:00' } })),
    'The station gives its hours on Mondays as 6am to 10am, but on Tuesdays to Sundays and bank holidays as 6am to 10pm. 10am is exactly 12 hours before 10pm, so 10am may have been entered by mistake.',
  );
  assert.equal(hoursProblem(st()), null);
});

await check('updated: hours and days, and old after 45 whole days', () => {
  const now = at('2026-10-30T12:30:00Z');
  assert.equal(updatedText('2026-10-30T12:00:00Z', now), 'Same price for less than an hour');
  assert.equal(updatedText('2026-10-30T11:00:00Z', now), 'Same price for 1 hour');
  assert.equal(updatedText('2026-10-29T15:30:00Z', now), 'Same price for 21 hours');
  assert.equal(updatedText('2026-10-29T12:00:00Z', now), 'Same price for 1 day');
  assert.equal(updatedText('2026-09-26T12:00:00Z', now), 'Same price for 34 days');
  assert.equal(isOld('2026-09-15T10:00:00Z', now), false, '45 days');
  assert.equal(isOld('2026-09-14T10:00:00Z', now), true, '46 days');
});

await check('price position: usual prices lowest first, words for the lowest and pence above it', () => {
  const row = (e10?: number, x = false) => ({ prices: e10 === undefined ? {} : { e10: { p: e10, u: '2026-10-30T10:00:00Z', x } } }) as unknown as Row;
  const rows = [row(175.9), row(172.9), row(), row(299.9, true), row(172.9), row(176.0)];
  const all = rankPrices(rows, 'e10');
  assert.deepEqual(all, [172.9, 172.9, 175.9, 176.0], 'unusual and missing prices left out');
  assert.equal(rankText(172.9, all), 'Lowest of four', 'ties at the lowest are both lowest');
  assert.equal(rankText(175.9, all), '3.0p above the lowest');
  assert.equal(rankText(173.0, [172.9, 173.0]), '0.1p above the lowest', 'tenths not lost to rounding');
  assert.equal(rankText(1, [1, 1, 1, 1, 1, 1, 1, 1]), 'Lowest of eight');
  assert.deepEqual(rankPrices([row()], 'e10'), []);
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

await check('higher prices usual: Highlands and Islands and Scilly not marked unusual when high; low still marked', () => {
  for (const pc of ['ZE2 9AR', 'HS1 2AA', 'KW15 1AA', 'IV51 9JS', 'PA77 6UP', 'PA20 0AA', 'PH33 6AA', 'KA27 8AA', 'TR21 0JY']) assert.equal(higherPricesUsual(pc), true, pc);
  for (const pc of ['PA1 1AA', 'PA19 1AA', 'PH1 1AA', 'PH18 5AA', 'TR1 1AA', 'TR20 8AA', 'TR26 1AA', 'KA1 1AA', 'RG9 5QL', 'AB10 1AA']) assert.equal(higherPricesUsual(pc), false, pc);
  const [lat, lon] = outcodes.HS1;
  const island = st({ id: 'island', postcode: 'HS1 2AA', lat, lon });
  const [rlat, rlon] = outcodes.RG9;
  const mainland = st({ id: 'mainland', postcode: 'RG9 5QL', lat: rlat, lon: rlon });
  const u = '2026-10-30T09:00:00Z';
  const prices = { island: { e10: { p: 208.8, u, x: 1 as const }, diesel: { p: 150, u, x: 1 as const } }, mainland: { diesel: { p: 230, u, x: 1 as const } } };
  const { index, byArea } = makePageData([island, mainland], prices, outcodes, bank, { collected: u, middle: { e10: 171.9, diesel: 199.9 }, unusualPence: 30 });
  const row = (id: string) => { const [, , a, i] = index.points[[island, mainland].findIndex((x) => x.id === id)]; return byArea.get(index.areas[a])![i]; };
  assert.deepEqual(row('island')[7], [208.8, u, 0], 'high island price: mark removed');
  assert.deepEqual(row('island')[8], [150, u, 1], 'low island price: still marked');
  assert.deepEqual(row('mainland')[8], [230, u, 1], 'mainland: still marked');
});

await check('centre on a station: the eight from its own position, itself first; areas from postcodes', () => {
  assert.equal(postcodeArea('RG4 8RZ'), 'RG');
  assert.equal(postcodeArea('B1 1AA'), 'B');
  assert.equal(postcodeArea('CW13HD'), 'CW');
  const u = '2026-10-30T09:00:00Z';
  const [lat, lon] = outcodes.RG4;
  const here = st({ id: 'aaaaaaaaaaaa', lat, lon });
  const others = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((k) => st({ id: `b${k}`.padEnd(12, '0'), lat: lat + k * 0.01, lon }));
  const prices = Object.fromEntries([here, ...others].map((s, k) => [s.id, { e10: { p: 170 + k, u } }]));
  const rows = nearestFrom(lat, lon, [...others, here], prices, outcodes, bank, at('2026-10-30T12:00:00Z'));
  assert.equal(rows.length, 8);
  assert.equal(rows[0].station.id, 'aaaaaaaaaaaa', 'the station itself first');
  assert.equal(rows[0].miles, 0);
  assert.equal(rows[0].cheapest.e10, true, 'and marked cheapest when it is');
  assert.equal(rows[7].station.id, 'b70000000000', 'the ninth left out');
});

await check('full postcodes: positions packed and unpacked exactly; the real file has every district, and RG4 7HN where OS puts it', () => {
  const list: [string, number, number][] = [['7HN', 51.48289, -0.9697], ['5AA', 51.4668, -0.9654], ['9ZZ', 51.5, -1]];
  const back = decodeDistrict(encodeDistrict(list));
  for (const [i, la, lo] of list) {
    const [a, b] = back.get(i)!;
    assert.ok(Math.abs(a - la) < 6e-5 && Math.abs(b - lo) < 6e-5, i);
  }
  const files = readdirSync(new URL('../data/postcodes/', import.meta.url)).filter((f) => f.endsWith('.json'));
  const all: Record<string, string> = Object.assign({}, ...files.map((f) => JSON.parse(readFileSync(new URL(`../data/postcodes/${f}`, import.meta.url), 'utf8'))));
  const missing = Object.keys(outcodes).filter((o) => !(o in all));
  assert.deepEqual(missing, [], 'districts with no postcode file entry');
  // RG4 7HN in OS Open Names: easting 470234, northing 175930.
  const want = fromBritishGrid(470234, 175930);
  const [lat, lon] = decodeDistrict(all.RG4).get('7HN')!;
  assert.ok(Math.abs(lat - want.latitude) < 1e-4 && Math.abs(lon - want.longitude) < 1e-4, `${lat},${lon}`);
  assert.equal(decodeDistrict(all.RG4).get('7ZZ'), undefined);
});

console.log(failures === 0 ? '\nAll search checks passed.' : `\n${failures} search check(s) FAILED.`);
process.exitCode = failures === 0 ? 0 : 1;
