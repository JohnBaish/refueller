// Checks for "Find cheaper fuel near the route" (src/lib/route.ts, scripts/build-route-roads.ts, data/route-roads.json): the
// road speeds and joining, the real routes from the mock-ups, the choice of the eight, the badges, the words and the address.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { joinChains, speedMph } from './build-route-roads.ts';
import { journey, makeNetwork, readRouteHash, routeCheapest, routeEight, routeHash, routeMiles, todayText, toPlace, type RouteFile, type RouteRow } from '../src/lib/route.ts';
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
const close = (a: number, b: number, d: number) => assert.ok(Math.abs(a - b) <= d, `${a} is not within ${d} of ${b}`);

await check('road speeds: motorways fastest, roundabouts slowest, the primary route network faster', () => {
  assert.equal(speedMph('Motorway', 'Collapsed Dual Carriageway', true), 62);
  assert.equal(speedMph('Motorway', 'Slip Road', true), 35);
  assert.equal(speedMph('A Road', 'Roundabout', true), 15);
  assert.equal(speedMph('A Road', 'Dual Carriageway', true), 55);
  assert.equal(speedMph('A Road', 'Single Carriageway', true), 45);
  assert.equal(speedMph('A Road', 'Single Carriageway', false), 35);
  assert.equal(speedMph('B Road', 'Single Carriageway', false), 30);
});

await check('joining: a chain through two-road points becomes one link, lengths and times added', () => {
  // a - b - c - d, and a branch c - e: b is a two-road point, so a-b-c joins; c has three roads, so it stays.
  const l = (a: string, b: string, metres: number, seconds: number) => ({ a, b, metres, seconds, ea: [0, 0] as [number, number], eb: [0, 0] as [number, number] });
  const { points, edges } = joinChains([l('a', 'b', 100, 10), l('b', 'c', 200, 20), l('c', 'd', 50, 5), l('c', 'e', 70, 7)]);
  assert.equal(points.length, 4, 'a, c, d, e');
  const lengths = edges.map((e) => [e[2], e[3]]).sort((x, y) => x[0] - y[0]);
  assert.deepEqual(lengths, [
    [50, 5],
    [70, 7],
    [300, 30],
  ]);
});

const roads: RouteFile = JSON.parse(readFileSync(new URL('../data/route-roads.json', import.meta.url), 'utf8'));
const outcodes = JSON.parse(readFileSync(new URL('../data/outcodes.json', import.meta.url), 'utf8')).outcodes;
const net = makeNetwork(roads);
const at = (oc: string) => toPlace(outcodes[oc][0], outcodes[oc][1]);

await check('the road file: the size of the feasibility test, and the OS credit word for word from the licence file', () => {
  assert.equal(roads.n.length / 2, 76543);
  assert.equal(roads.e.length / 4, 113204);
  assert.equal(roads.credit, 'Contains Ordnance Survey data © Crown copyright and database right 2026');
});

await check('real routes as in the mock-ups: Reading to Bristol by the M4, Cardiff to Bristol over the bridge', () => {
  // A station on the M4 near Swindon (MFG Fleming Way's position) and one at Marlborough on the A4 (MFG Marlborough).
  const fleming = toPlace(51.5626, -1.77236);
  const marlborough = toPlace(51.41992, -1.72523);
  const rb = journey(net, [at('RG1'), at('BS1')], [fleming, marlborough]);
  assert.ok(rb.ok);
  close(rb.miles, 77.8, 0.2);
  assert.ok(rb.extra[1] > 3, `Marlborough is off the quickest route (${rb.extra[1].toFixed(1)} extra miles)`);
  const cb = journey(net, [at('CF10'), at('BS1')], []);
  assert.ok(cb.ok);
  close(cb.miles, 42.1, 0.2);
});

await check('towns: a detour through London or Birmingham counts by its time, not just its miles (John, RG1 to PE38)', () => {
  const southall = toPlace(51.5813, -0.3593);
  const smallHeath = toPlace(52.47334, -1.86689);
  const pe = journey(net, [at('RG1'), at('PE38')], [southall]);
  assert.ok(pe.ok);
  assert.ok(pe.extra[0] <= 3 && pe.minutes[0] > 6, `Southall: ${pe.extra[0].toFixed(1)} miles, ${pe.minutes[0].toFixed(1)} minutes`);
  const m = journey(net, [at('RG1'), at('M1')], [smallHeath]);
  assert.ok(m.ok);
  assert.ok(m.minutes[0] > 6, `Reading to Manchester goes round Birmingham, not through it (Small Heath ${m.minutes[0].toFixed(1)} minutes off)`);
});

await check('via: the journey goes through it, and is longer than going direct', () => {
  const direct = journey(net, [at('RG1'), at('BS1')], []);
  const via = journey(net, [at('RG1'), at('OX1'), at('BS1')], []);
  assert.ok(direct.ok && via.ok);
  assert.ok(via.miles > direct.miles + 10, `${via.miles} via Oxford, ${direct.miles} direct`);
});

await check('no road: the Isles of Scilly are reached only by sea or air', () => {
  const j = journey(net, [at('TR1'), at('TR21')], []);
  assert.equal(j.ok, false);
});

const st = (id: string, over: Partial<Station> = {}): Station => ({ id, name: id.toUpperCase(), brand: 'X', address: ['A ROAD'], postcode: 'RG1 1AA', lat: 51.45, lon: -0.97, hours: null, bankHoliday: null, ...over });
const u = '2026-10-31T10:00:00Z';
const row = (id: string, p: number | null, along: number, extra: number, over: Partial<Station> = {}, x = false, minutes = 2): RouteRow => ({ station: st(id, over), prices: p === null ? {} : { e10: { p, u, ...(x ? { x: 1 as const } : {}) } }, along, extra, minutes });

await check('the eight: the cheapest within three extra miles, at a usual price, then in the order you reach them', () => {
  const rows = [
    row('a', 170, 10, 1),
    row('b', 160, 50, 3.5), // too far off the route
    row('c', 150, 60, 0.5, {}, true), // unusual
    row('d', 168, 70, 2.9),
    row('f', 140, 15, 2.5, {}, false, 10), // few miles, but ten minutes through a town
    row('e', null, 5, 0.1), // doesn't sell it
    ...Array.from({ length: 8 }, (_, i) => row(`z${i}`, 175 + i, 20 + i, 1)),
  ];
  const r = routeEight(rows, 'e10');
  assert.equal(r.within, 10);
  assert.equal(r.rows.length, 8);
  assert.deepEqual(r.rows.map((x) => x.station.id), ['a', 'z0', 'z1', 'z2', 'z3', 'z4', 'z5', 'd']);
});

await check('badges: as the main list, Costco "members only" and the lowest anyone can buy', () => {
  const rows = [row('c', 165, 10, 1, { brand: 'COSTCO WHOLESALE' }), row('a', 167, 20, 1), row('b', 169, 30, 1)];
  assert.deepEqual(routeCheapest(rows, 'e10'), [true, true, false]);
  assert.deepEqual(routeCheapest(rows.slice(1), 'e10'), [true, false]);
});

await check('words: miles and today’s hours', () => {
  assert.equal(routeMiles(0.02), 'less than 0.1 miles');
  assert.equal(routeMiles(2.94), '2.9 miles');
  assert.equal(routeMiles(38.6), '39 miles');
  const sat = Date.parse('2026-10-31T16:15:00Z'); // a Saturday
  const week = (h: string) => Array(7).fill(h);
  assert.equal(todayText(st('a', { hours: week('06:00-23:00') }), sat, {}), 'Today 6am to 11pm');
  assert.equal(todayText(st('a', { hours: week('00:00-23:59') }), sat, {}), 'Open 24 hours today');
  assert.equal(todayText(st('a', { hours: week('24h') }), sat, {}), 'Open 24 hours today');
  assert.equal(todayText(st('a', { hours: [...week('06:00-22:00').slice(0, 5), 'closed', 'closed'] }), sat, {}), 'Closed today');
  assert.equal(todayText(st('a'), sat, {}), 'Opening hours not given');
});

await check('the address: route/RG1/BS1, a full postcode, a via, and a bare "route"', () => {
  assert.deepEqual(readRouteHash('route/rg1/bs1'), { kind: 'route', from: { outcode: 'RG1' }, to: { outcode: 'BS1' }, via: undefined });
  const t = readRouteHash('route/RG1-8FR/BS1/OX1')!;
  assert.equal(routeHash(t), 'route/RG1-8FR/BS1/OX1');
  assert.deepEqual(readRouteHash('route'), { kind: 'route' });
  assert.deepEqual(readRouteHash('route/RG1'), { kind: 'route' });
  assert.equal(readRouteHash('RG4'), null);
});

if (failures) {
  console.log(`\n${failures} route check(s) failed.`);
  process.exit(1);
}
console.log('\nAll route checks passed.');
