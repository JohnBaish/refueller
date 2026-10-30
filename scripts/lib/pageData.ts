// The page's data (PLAN Stage 5), made from data/ at every build, so each collector commit makes Vercel rebuild the site
// with the new prices. The whole station list is too big for a phone to load on every visit (about 460 KB compressed), so
// it is split in two:
//   index.json        everything the search needs: each station's position and postcode area, the postcode districts,
//                     the bank holidays and when the prices were collected (about 100 KB compressed);
//   <area>.json       the details of each postcode area's stations (names, addresses, hours, prices), a few KB each.
// The page loads the index, finds the eight nearest stations, then loads only the areas those eight are in. Every visitor
// loads the same files whatever they type, so nothing about a search reaches the server.
//
// Left out here, once for all visitors: temporarily closed stations, and stations placed far from their own postcode
// district (src/lib/search.ts, positionAgrees). Prices and their "last updated" times go through exactly as collected.
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { outcodeOf, positionAgrees, type BankHolidays, type Outcodes, type Price, type Station } from '../../src/lib/search.ts';
import type { DetailRow, PageIndex, PriceCell } from '../../src/lib/pageTypes.ts';

export type { DetailRow, PageIndex, PriceCell };

export const SOURCES = ['data/stations.json', 'data/prices.json', 'data/outcodes.json', 'data/bank-holidays.json'];

const area = (postcode: string) => /^[A-Z]+/.exec(outcodeOf(postcode))?.[0] ?? '';
const round4 = (n: number) => Math.round(n * 1e4) / 1e4;
const cell = (p: Price | undefined): PriceCell => (p ? [p.p, p.u, p.x ? 1 : 0] : 0);

export function makePageData(stations: Station[], prices: Record<string, { e10?: Price; diesel?: Price }>, outcodes: Outcodes, bank: BankHolidays, meta: { collected: string; middle: PageIndex['middle']; unusualPence: number }) {
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
    const a = area(s.postcode) || 'other';
    if (!byArea.has(a)) {
      byArea.set(a, []);
      areas.push(a);
    }
    const rows = byArea.get(a)!;
    const hours = s.hours === null ? '' : new Set(s.hours).size === 1 ? s.hours[0] : s.hours.join('|');
    const bh = s.bankHoliday ? `${s.bankHoliday.type}|${s.bankHoliday.hours ?? ''}` : '';
    const flags = `${s.motorway ? 'm' : ''}${s.supermarket ? 's' : ''}`;
    const p = prices[s.id] ?? {};
    // Four decimal places (about 10 metres) is plenty for distances shown to a tenth of a mile, and keeps the index small.
    points.push([round4(s.lat), round4(s.lon), areas.indexOf(a), rows.length]);
    rows.push([s.name, s.brand, s.address.join('|'), s.postcode, hours, bh, flags, cell(p.e10), cell(p.diesel)]);
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
  };
  return { index, byArea };
}

// Writes public/data/index.json and public/data/<version>/<area>.json (public/data is not kept in git: it's made from data/).
export function writePageData(root: string) {
  const read = (f: string) => JSON.parse(readFileSync(join(root, f), 'utf8'));
  const st = read('data/stations.json');
  const pr = read('data/prices.json');
  const { index, byArea } = makePageData(st.stations, pr.prices, read('data/outcodes.json').outcodes, read('data/bank-holidays.json'), {
    collected: pr.collected,
    middle: pr.middle,
    unusualPence: pr.unusualPence,
  });
  const out = join(root, 'public', 'data');
  rmSync(out, { recursive: true, force: true });
  mkdirSync(join(out, index.version), { recursive: true });
  writeFileSync(join(out, 'index.json'), JSON.stringify(index));
  for (const [a, rows] of byArea) writeFileSync(join(out, index.version, `${a}.json`), JSON.stringify(rows));
  return index;
}
