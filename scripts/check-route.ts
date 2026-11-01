// Checks for "Find cheaper fuel near the route" (src/lib/route.ts, scripts/build-route-roads.ts, data/route-roads.json): the
// road speeds and joining, the real routes from the mock-ups, the choice of the eight, the badges, the words and the address.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { joinChains, speedMph } from './build-route-roads.ts';
import { endChoice, journey, makeNetwork, readRouteHash, routeCheapest, routeEight, routeHash, routeMiles, todayText, toPlace, type RouteFile, type RouteRow, ROUTE_CORRIDOR_METRES } from '../src/lib/route.ts';
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

await check('via means "passes near", not a stop: Reading to Exeter via Andover keeps to the A303; via Royal Wootton Bassett is the M4 as before', () => {
  const places = JSON.parse(readFileSync(new URL('../data/places.json', import.meta.url), 'utf8')).places as [string, string, string, number, number][];
  const place = (name: string) => {
    const p = places.find((x) => x[0] === name)!;
    return toPlace(p[3], p[4]);
  };
  const direct = journey(net, [at('RG1'), at('EX1')], []);
  const andover = journey(net, [at('RG1'), place('Andover'), at('EX1')], []);
  const rwb = journey(net, [at('RG1'), place('Royal Wootton Bassett'), at('EX1')], []);
  assert.ok(direct.ok && andover.ok && rwb.ok);
  assert.ok(andover.miles < direct.miles - 10, `via Andover the A303 is shorter in miles (${andover.miles.toFixed(0)} against ${direct.miles.toFixed(0)})`);
  close(rwb.miles, direct.miles, 0.5);
  // A town off any main road by more than about 3 miles can't be a via; a far-flung one is reported as such.
  const sea = journey(net, [at('RG1'), toPlace(50.2, -3.5), at('EX1')], []);
  assert.ok(!sea.ok && sea.problem === 'via-far');
});

await check('close to the drawn route: Caversham to Downham Market via Hatfield keeps Slough (M4) and drops High Wycombe (M40) (John, 1 November)', () => {
  const places = JSON.parse(readFileSync(new URL('../data/places.json', import.meta.url), 'utf8')).places as [string, string, string, number, number][];
  const p = (name: string, area: string) => {
    const x = places.find((q) => q[0] === name && q[2] === area)!;
    return toPlace(x[3], x[4]);
  };
  const slough = toPlace(51.5065, -0.62824); // Asda Slough Superstore
  const wycombe = toPlace(51.61155, -0.77718); // Asda High Wycombe Superstore
  const j = journey(net, [p('Caversham', 'Reading'), p('Hatfield', 'Hertfordshire'), at('PE38')], [slough, wycombe]);
  assert.ok(j.ok);
  assert.ok(j.offRoute[0] <= ROUTE_CORRIDOR_METRES, `Slough ${j.offRoute[0].toFixed(0)} m from the route`);
  assert.ok(j.minutes[1] <= 6 && j.offRoute[1] > ROUTE_CORRIDOR_METRES, `High Wycombe ${j.minutes[1].toFixed(1)} minutes, ${j.offRoute[1].toFixed(0)} m from the route`);
});

await check('no road: the Isles of Scilly are reached only by sea or air', () => {
  const j = journey(net, [at('TR1'), at('TR21')], []);
  assert.equal(j.ok, false);
});

const st = (id: string, over: Partial<Station> = {}): Station => ({ id, name: id.toUpperCase(), brand: 'X', address: ['A ROAD'], postcode: 'RG1 1AA', lat: 51.45, lon: -0.97, hours: null, bankHoliday: null, ...over });
const u = '2026-10-31T10:00:00Z';
const row = (id: string, p: number | null, along: number, extra: number, over: Partial<Station> = {}, x = false, minutes = 2, offRoute = 0): RouteRow => ({ station: st(id, over), prices: p === null ? {} : { e10: { p, u, ...(x ? { x: 1 as const } : {}) } }, along, extra, minutes, offRoute });

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

await check('the eight: a station more than about two miles from the drawn route is left out, even when cheap', () => {
  // A station off the route is left out of the eight even when cheap and a short detour.
  const r = routeEight([row('near', 170, 1, 0.5, {}, false, 2, 500), row('far', 160, 2, 0.5, {}, false, 2, 5000)], 'e10');
  assert.deepEqual(r.rows.map((x) => x.station.id), ['near']);
});

await check('each end: the cheapest of the eight nearest anyone can buy, nearest first on a tie; left out of the eight on the way', () => {
  const near = (id: string, p: number | null, fromEnd: number, over: Partial<Station> = {}) => ({ ...row(id, p, 0, 0, over), fromEnd });
  const eight = [near('a', 171, 0.4), near('costco', 160, 1, { brand: 'COSTCO WHOLESALE' }), near('b', 168, 2), near('c', 168, 1.5), near('d', null, 0.2)];
  assert.equal(endChoice(eight, 'e10')!.station.id, 'c');
  assert.equal(endChoice([near('costco', 160, 1, { brand: 'COSTCO WHOLESALE' }), near('d', null, 0.2)], 'e10'), null);
  const r = routeEight([row('c', 168, 1, 0.5), row('e', 170, 5, 0.5)], 'e10', new Set(['c']));
  assert.deepEqual(r.rows.map((x) => x.station.id), ['e']);
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
  const t = readRouteHash('route/RG1-8FR/BS1/@Oxford')!;
  assert.equal(routeHash(t), 'route/RG1-8FR/BS1/@Oxford');
  assert.deepEqual(readRouteHash('route'), { kind: 'route' });
  assert.deepEqual(readRouteHash('route/RG1'), { kind: 'route' });
  assert.equal(readRouteHash('RG4'), null);
  const places = readRouteHash('route/@Reading/@Exeter/@Andover')!;
  assert.deepEqual(places, { kind: 'route', from: { place: 'Reading' }, to: { place: 'Exeter' }, via: { place: 'Andover' } });
  assert.equal(routeHash(places), 'route/@Reading/@Exeter/@Andover');
  assert.equal(readRouteHash('route/RG1/EX4/SP10')!.via, undefined, 'via takes a place only');
  const twin = readRouteHash('route/RG1/@Habost, Na h-Eileanan an Iar (HS2)~58.2,-6.3')!;
  assert.deepEqual(twin.to, { place: 'Habost, Na h-Eileanan an Iar (HS2)', at: '58.2,-6.3' });
});

if (failures) {
  console.log(`\n${failures} route check(s) failed.`);
  process.exit(1);
}
console.log('\nAll route checks passed.');
