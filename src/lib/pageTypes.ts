// The page's data files, as made by scripts/lib/pageData.ts at build time and read by the page (src/lib/load.ts).
import type { Hist } from './history.ts';
import type { BankHolidays, Outcodes, Price, Station } from './search.ts';

// A station's details as the page needs them, in a short fixed order to keep the files small.
// [name, brand, address lines joined by "|", postcode, hours ("|"-joined, one entry when every day is the same; "" when not
//  given), bank-holiday type and hours ("type|hours" or ""), flags ("m" motorway, "s" supermarket), unleaded, diesel,
//  the station's own code (the first 12 characters of Fuel Finder's, as in data/; it stays the same from one collection to the
//  next, so a "Find stations near this one" address keeps working), the price history (src/lib/history.ts: [unleaded, diesel],
//  each the prices of the last 14 days with their set times, or 0 when the current price is the only one known)]
// where a price is [pence, last updated as given, 1 if unusual] or 0 when the station doesn't sell that fuel.
export type DetailRow = [string, string, string, string, string, string, string, PriceCell, PriceCell, string, [Hist | 0, Hist | 0]?];
export type PriceCell = [number, string, 0 | 1] | 0;

export type PageIndex = {
  version: string; // when the prices were collected, made safe for a folder name
  collected: string;
  middle: { e10: number | null; diesel: number | null };
  unusualPence: number;
  bank: BankHolidays;
  outcodes: Outcodes;
  areas: string[]; // postcode areas, e.g. "RG"
  points: [number, number, number, number][]; // latitude, longitude, area (index into `areas`), row in that area's file
  leftOut: { temporarilyClosed: number; farFromPostcode: number };
  // Road miles for the calculator (data/road-miles.json): the folder of per-area files, e.g. "roads-2026-10-30", and the OS
  // credit line; null when the table is missing.
  roads: { folder: string; credit: string } | null;
  // When our own price record begins (data/history.json), for the graph's note; null without a history file.
  history: { recordedFrom: string } | null;
  // Every postcode's position (data/postcodes/), one file per area in this folder, e.g. "postcodes-2026-10-31"; null without.
  postcodes: { folder: string } | null;
};

// One postcode area's road miles: from each postcode district middle (key "RG4") and each station (its 12-character code)
// in that area to its 12 nearest stations, in tenths of a mile.
export type RoadFile = Record<string, Record<string, number>>;

// The page's side of DetailRow: back into a Station and its prices (src/lib/search.ts types).
export function fromDetail(row: DetailRow, lat: number, lon: number): { station: Station; prices: { e10?: Price; diesel?: Price }; history: { e10?: Hist; diesel?: Hist } } {
  const [name, brand, address, postcode, hours, bh, flags, e10, diesel, id, hist] = row;
  const h = hours === '' ? null : hours.includes('|') ? hours.split('|') : Array(7).fill(hours);
  const [bhType, bhHours] = bh === '' ? ['', ''] : bh.split('|');
  const price = (c: PriceCell): Price | undefined => (c === 0 ? undefined : c[2] ? { p: c[0], u: c[1], x: 1 } : { p: c[0], u: c[1] });
  const station: Station = {
    id,
    name,
    brand,
    address: address.split('|'),
    postcode,
    lat,
    lon,
    hours: h,
    bankHoliday: bh === '' ? null : { type: bhType, hours: bhHours || null },
    ...(flags.includes('m') ? { motorway: true as const } : {}),
    ...(flags.includes('s') ? { supermarket: true as const } : {}),
  };
  const prices: { e10?: Price; diesel?: Price } = {};
  if (price(e10)) prices.e10 = price(e10);
  if (price(diesel)) prices.diesel = price(diesel);
  const history: { e10?: Hist; diesel?: Hist } = {};
  if (hist && hist[0]) history.e10 = hist[0];
  if (hist && hist[1]) history.diesel = hist[1];
  return { station, prices, history };
}

