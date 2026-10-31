// The page's data (PLAN Stage 5), made from data/ at every build, so each collector commit makes Vercel rebuild the site
// with the new prices. The whole station list is too big for a phone to load on every visit (about 460 KB compressed), so
// it is split in two:
//   index.json        everything the search needs: each station's position and postcode area, the postcode districts,
//                     the bank holidays and when the prices were collected (about 100 KB compressed);
//   <area>.json       the details of each postcode area's stations (names, addresses, hours, prices), a few KB each.
//   roads-<built>/<area>.json  the calculator's road miles (data/road-miles.json) from that area's postcode districts and
//                     stations, loaded only when a "Worth driving here?" panel opens (about 6 KB compressed for RG).
// The page loads the index, finds the eight nearest stations, then loads only the areas those eight are in. Every visitor
// loads the same files whatever they type, so nothing about a search reaches the server.
//
// Also here: high prices in the Highlands and Islands and on Scilly aren't marked unusual. Left out here, once for all visitors: temporarily closed stations, and stations placed far from their own postcode
// district (src/lib/search.ts, positionAgrees). Prices and their "last updated" times go through exactly as collected.
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { higherPricesUsual, positionAgrees, postcodeArea, type BankHolidays, type Outcodes, type Price, type Station } from '../../src/lib/search.ts';
import type { DetailRow, PageIndex, PriceCell, RoadFile } from '../../src/lib/pageTypes.ts';
import { trim, windowFor, withPrice, type Hist } from '../../src/lib/history.ts';

export type { DetailRow, PageIndex, PriceCell };

export const SOURCES = ['data/postcodes/README.md', 'data/stations.json', 'data/prices.json', 'data/outcodes.json', 'data/bank-holidays.json', 'data/road-miles.json', 'data/history.json'];

const round4 = (n: number) => Math.round(n * 1e4) / 1e4;
const cell = (p: Price | undefined): PriceCell => (p ? [p.p, p.u, p.x ? 1 : 0] : 0);
// The collector marks a price "unusual" by the middle price for all Great Britain; a high price where higher prices are usual
// (src/lib/search.ts, higherPricesUsual) loses that mark here, so it is shown plainly and can be the cheapest.
const unmark = (p: Price | undefined, middle: number | null): Price | undefined =>
  p && p.x && typeof middle === 'number' && p.p > middle ? { p: p.p, u: p.u } : p;

export function makePageData(stations: Station[], prices: Record<string, { e10?: Price; diesel?: Price }>, outcodes: Outcodes, bank: BankHolidays, meta: { collected: string; middle: PageIndex['middle']; unusualPence: number }, history: Record<string, { e10?: Hist; diesel?: Hist }> = {}) {
  const windowStart = windowFor(Date.parse(meta.collected)).start;
  // The 14 days' prices with the current one added (as shown, unusual marks aside); 0 when the current price is all there is.
  const hist = (h: Hist | undefined, p: Price | undefined): Hist | 0 => {
    if (!h || !p) return 0;
    const all = trim(withPrice(h, p), windowStart);
    return all.length > 1 ? all : 0;
  };
  const leftOut = { temporarilyClosed: 0, farFromPostcode: 0 };
  const byArea = new Map<string, DetailRow[]>();
  const points: PageIndex['points'] = [];
  const areas: string[] = [];
  for (const s of stations) {
    if (s.temporarilyClosed) {
      leftOut.temporarilyClosed++;
      continue;
    }
    if (!positionAgrees(s, outcodes)) {
      leftOut.farFromPostcode++;
      continue;
    }
    const a = postcodeArea(s.postcode);
    if (!byArea.has(a)) {
      byArea.set(a, []);
      areas.push(a);
    }
    const rows = byArea.get(a)!;
    const hours = s.hours === null ? '' : new Set(s.hours).size === 1 ? s.hours[0] : s.hours.join('|');
    const bh = s.bankHoliday ? `${s.bankHoliday.type}|${s.bankHoliday.hours ?? ''}` : '';
    const flags = `${s.motorway ? 'm' : ''}${s.supermarket ? 's' : ''}`;
    const given = prices[s.id] ?? {};
    const p = higherPricesUsual(s.postcode) ? { e10: unmark(given.e10, meta.middle.e10), diesel: unmark(given.diesel, meta.middle.diesel) } : given;
    // Four decimal places (about 10 metres) is plenty for distances shown to a tenth of a mile, and keeps the index small.
    points.push([round4(s.lat), round4(s.lon), areas.indexOf(a), rows.length]);
    const h = history[s.id];
    const row: DetailRow = [s.name, s.brand, s.address.join('|'), s.postcode, hours, bh, flags, cell(p.e10), cell(p.diesel), s.id];
    if (h) {
      const pair: [Hist | 0, Hist | 0] = [hist(h.e10, given.e10), hist(h.diesel, given.diesel)];
      if (pair[0] || pair[1]) row.push(pair);
    }
    rows.push(row);
  }
  const index: PageIndex = {
    version: meta.collected.replace(/[^0-9TZ]/g, '').slice(0, 15),
    collected: meta.collected,
    middle: meta.middle,
    unusualPence: meta.unusualPence,
    bank,
    outcodes: Object.fromEntries(Object.entries(outcodes).map(([k, [lat, lon, place]]) => [k, [round4(lat), round4(lon), place]])),
    areas,
    points,
    leftOut,
    roads: null,
    history: null,
    postcodes: null,
  };
  return { index, byArea };
}

// The road miles (data/road-miles.json, scripts/build-road-miles.ts) split by the postcode area of where they start from,
// so the calculator loads only one small file: a district's area ("RG4" is in RG), or a station's own postcode area.
type RoadMiles = { credit: string; built: string; districts: RoadFile; stations: RoadFile };
export function splitRoads(roads: RoadMiles, stations: Station[]) {
  const areaOf = new Map(stations.map((s) => [s.id, postcodeArea(s.postcode)]));
  const byArea = new Map<string, RoadFile>();
  const add = (area: string | undefined, key: string, row: Record<string, number>) => {
    if (!area) return; // a station no longer listed
    if (!byArea.has(area)) byArea.set(area, {});
    byArea.get(area)![key] = row;
  };
  for (const [k, row] of Object.entries(roads.districts)) add(/^[A-Z]+/.exec(k)?.[0], k, row);
  for (const [k, row] of Object.entries(roads.stations)) add(areaOf.get(k), k, row);
  return byArea;
}

// Writes public/data/index.json and public/data/<version>/<area>.json (public/data is not kept in git: it's made from data/).
export function writePageData(root: string) {
  const read = (f: string) => JSON.parse(readFileSync(join(root, f), 'utf8'));
  const st = read('data/stations.json');
  const pr = read('data/prices.json');
  const hist = existsSync(join(root, 'data/history.json')) ? read('data/history.json') : null;
  const { index, byArea } = makePageData(
    st.stations,
    pr.prices,
    read('data/outcodes.json').outcodes,
    read('data/bank-holidays.json'),
    { collected: pr.collected, middle: pr.middle, unusualPence: pr.unusualPence },
    hist?.stations ?? {},
  );
  // Our own record begins with the first collection kept in the history file (or this one, without it).
  index.history = { recordedFrom: hist?.recordedFrom ?? pr.collected };
  const out = join(root, 'public', 'data');
  rmSync(out, { recursive: true, force: true });
  mkdirSync(join(out, index.version), { recursive: true });
  for (const [a, rows] of byArea) writeFileSync(join(out, index.version, `${a}.json`), JSON.stringify(rows));
  if (existsSync(join(root, 'data/road-miles.json'))) {
    const roads: RoadMiles = read('data/road-miles.json');
    index.roads = { folder: `roads-${roads.built}`, credit: roads.credit };
    mkdirSync(join(out, index.roads.folder));
    for (const [a, file] of splitRoads(roads, st.stations)) writeFileSync(join(out, index.roads.folder, `${a}.json`), JSON.stringify(file));
  }
  // Full postcodes (data/postcodes/, scripts/build-postcodes.ts): copied as they are, one file per area, in a folder named by the
  // date they were made, so a rebuilt set is never mixed with an old one in a browser's cache.
  const pc = join(root, 'data/postcodes');
  if (existsSync(join(pc, 'README.md'))) {
    const made = /Made (\d{4}-\d{2}-\d{2})/.exec(readFileSync(join(pc, 'README.md'), 'utf8'))?.[1] ?? 'unknown';
    index.postcodes = { folder: `postcodes-${made}` };
    mkdirSync(join(out, index.postcodes.folder));
    for (const f of readdirSync(pc).filter((f) => f.endsWith('.json'))) copyFileSync(join(pc, f), join(out, index.postcodes.folder, f));
  }
  writeFileSync(join(out, 'index.json'), JSON.stringify(index));
  return index;
}
