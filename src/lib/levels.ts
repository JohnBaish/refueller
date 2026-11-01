// Averages at every level (John, November 1st 2026, option B of the mock-ups): under "The wider picture", the average unleaded and
// diesel price at the eight stations shown, then in the council area, the county, the region and the country the place is in, and
// in Great Britain, each with one fact (design/previews/levels/). Pure functions, shared by the build and the page.
//
// Where a postcode is (data/council-areas.json, made by scripts/build-council-areas.ts from OS Open Names): its council area (the
// district or borough where there is one, as Maidstone in Kent; otherwise the unitary authority, as Reading), with that area's
// ceremonial county and region (England only) and its country. Looked up by the full postcode where it isn't in its sector's
// usual council area, else by its sector ("RG4 7"), else by its district ("RG4"), so a new or mistyped postcode still finds one.

/** A council area: [name, ceremonial county or null, region or null, country]. */
export type Locality = [string, string | null, string | null, string];
/** One postcode area's lookups, each to an index in the list of council areas. */
export type AreaLookup = { d: Record<string, number>; s: Record<string, number>; p: Record<string, number> };
export type CouncilAreas = { locals: Locality[]; areas: Record<string, AreaLookup> };

/** "rg4 7ss" -> ["RG4", "7SS"]; a district alone -> ["RG4", ""]. */
export function splitPostcode(postcode: string): [string, string] {
  const t = postcode.toUpperCase().replace(/\s+/g, '');
  const m = /^([A-Z]{1,2}\d[A-Z\d]?)(\d[A-Z]{2})$/.exec(t);
  return m ? [m[1], m[2]] : [t, ''];
}

/** The council area a postcode (or district) is in, as an index into the list, or null. */
export function localIndex(lookup: AreaLookup | undefined, postcode: string): number | null {
  if (!lookup) return null;
  const [out, inward] = splitPostcode(postcode);
  if (inward) {
    const exact = lookup.p[`${out} ${inward}`];
    if (exact !== undefined) return exact;
    const sector = lookup.s[`${out} ${inward[0]}`];
    if (sector !== undefined) return sector;
  }
  return lookup.d[out] ?? null;
}

export type LevelKind = 'C' | 'K' | 'R' | 'N';
/** The keys a council area's stations count towards: "C:Reading", "K:Berkshire", "R:South East England", "N:England". */
export function levelKeys(l: Locality): string[] {
  const [name, county, region, country] = l;
  return [`C:${name}`, ...(county ? [`K:${county}`] : []), ...(region ? [`R:${region}`] : []), `N:${country}`];
}
export const keyName = (key: string) => (key === 'GB' ? 'Great Britain' : key.slice(2));

// A level's average is shown only when at least this many stations sell the fuel there at a usual price (John agreed, November 1st).
export const MIN_STATIONS = 5;

/** [unleaded, diesel], each a mean with two decimals or null. */
export type Pair = [number | null, number | null];
export type Averages = Record<string, Pair>;

// ----- The list and its facts -----

export type LevelRow = { key: string; name: string; now: Pair; fact: string };
type Fuel = 0 | 1;
const FUEL_WORD = ['unleaded', 'diesel'];
const NUM = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
const num = (n: number) => (n < NUM.length ? NUM[n] : String(n));
const round1 = (p: number) => Math.round(p * 10) / 10;
export const pence = (p: number) => `${round1(p).toFixed(1)}p`;
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

/** A name as it reads in a sentence: "the Isle of Wight", "the City of Edinburgh", "the Western Isles", "Berkshire". */
export const theName = (name: string) => (/^(Isles? of |City of |County of |City and County of |West Midlands )|Isles$|Islands$/.test(name) ? `the ${name}` : name);
/** "in Berkshire", "on the Isle of Wight", "in the City of Edinburgh". */
export const inPlace = (name: string) => `${/^Isles? of /.test(name) ? 'on' : 'in'} ${theName(name)}`;

/** The other levels a level is ranked among, with how the group is named. */
type Siblings = { keys: string[]; group: (n: number) => string; kind: LevelKind };
function siblingsOf(key: string, locals: Locality[]): Siblings | null {
  const kind = key[0] as LevelKind;
  const name = key.slice(2);
  if (kind === 'C') {
    const me = locals.find((l) => l[0] === name);
    if (!me) return null;
    const [, county, region, country] = me;
    // Council areas in the same county; where there's no county (Scotland, Wales), in the same country.
    const same = locals.filter((l) => (county ? l[1] === county : !l[1] && l[2] === region && l[3] === country));
    const where = county ?? country;
    return { kind, keys: same.map((l) => `C:${l[0]}`), group: (n) => (county || region ? `the ${num(n)} council areas ${inPlace(where === country ? region! : where)}` : `${where}’s ${n} council areas`) };
  }
  if (kind === 'K') {
    const all = [...new Set(locals.map((l) => l[1]).filter((c): c is string => !!c))];
    return { kind, keys: all.map((c) => `K:${c}`), group: () => 'county in England' };
  }
  if (kind === 'R') {
    const all = [...new Set(locals.map((l) => l[2]).filter((r): r is string => !!r))];
    return { kind, keys: all.map((r) => `R:${r}`), group: (n) => `England’s ${num(n)} regions` };
  }
  return null;
}

/** A level's place among its siblings for one fuel: 1 is cheapest; with the one before it ("after …"). */
function rankOf(key: string, sib: Siblings, avg: Averages, f: Fuel) {
  const vals = sib.keys.map((k) => [k, avg[k]?.[f]] as const).filter((x): x is readonly [string, number] => typeof x[1] === 'number');
  const mine = avg[key]?.[f];
  if (typeof mine !== 'number' || vals.length < 3) return null;
  const sorted = [...vals].sort((a, b) => a[1] - b[1]);
  const at = sorted.findIndex(([k]) => k === key);
  const fromTop = sorted.length - 1 - at;
  if (at <= 1) return { dir: 'cheapest', pos: at + 1, n: sorted.length, after: at === 1 ? sorted[0][0] : null };
  if (fromTop <= 1) return { dir: 'dearest', pos: fromTop + 1, n: sorted.length, after: fromTop === 1 ? sorted[sorted.length - 1][0] : null };
  return null;
}

function rankFact(key: string, sib: Siblings, avg: Averages): string | null {
  const r = [rankOf(key, sib, avg, 0), rankOf(key, sib, avg, 1)];
  const both = r[0] && r[1] && r[0].dir === r[1].dir && r[0].pos === r[1].pos;
  // The better of the two: the end itself before second place; unleaded first when they're as good.
  const pick: Fuel | null = both ? 0 : r[0] && (!r[1] || r[0].pos <= r[1].pos) ? 0 : r[1] ? 1 : null;
  if (pick === null) return null;
  const x = r[pick]!;
  const fuels = both ? 'both fuels' : FUEL_WORD[pick];
  const after = x.after && (!both || r[0]!.after === r[1]!.after) ? `, after ${theName(keyName(x.after))}` : '';
  const which = `${x.pos === 2 ? 'second ' : ''}${x.dir}`;
  if (sib.kind === 'K') return `The ${which} ${sib.group(x.n)} for ${fuels}${after}.`;
  return `The ${which} of ${sib.group(x.n)} for ${fuels}${after}.`;
}

/** "Unleaded is 1.3p less than the Berkshire average." from the bigger gap; null when neither is at least `min`. */
function gapFact(now: Pair, parent: { name: string; now: Pair }, min: number): string | null {
  const gaps = ([0, 1] as Fuel[]).map((f) => (now[f] !== null && parent.now[f] !== null ? round1(now[f]!) - round1(parent.now[f]!) : null));
  const f: Fuel = gaps[1] !== null && (gaps[0] === null || Math.abs(gaps[1]!) > Math.abs(gaps[0]!)) ? 1 : 0;
  const g = gaps[f];
  if (g === null || Math.abs(g) < min - 1e-9) return null;
  const avg = parent.name === 'Great Britain' ? 'the Great Britain average' : `the ${theName(parent.name).replace(/^the /, '')} average`;
  if (Math.abs(g) < 0.05) return gaps.every((x) => x !== null && Math.abs(x) < 0.05) ? `Both fuels are the same as ${avg}.` : `${cap(FUEL_WORD[f])} is the same as ${avg}.`;
  return `${cap(FUEL_WORD[f])} is ${round1(Math.abs(g)).toFixed(1)}p ${g < 0 ? 'less' : 'more'} than ${avg}.`;
}

/** "Unleaded is down 0.8p since October 30th, when Refueller began recording." from the bigger change. */
function changeFact(now: Pair, then: Pair | null, since: string, min: number, began = true): string | null {
  if (!then) return null;
  const ch = ([0, 1] as Fuel[]).map((f) => (now[f] !== null && then[f] !== null ? round1(now[f]!) - round1(then[f]!) : null));
  const f: Fuel = ch[1] !== null && (ch[0] === null || Math.abs(ch[1]!) > Math.abs(ch[0]!)) ? 1 : 0;
  const c = ch[f];
  if (c === null || Math.abs(c) < min - 1e-9) return null;
  const when = began ? ', when Refueller began recording' : '';
  if (Math.abs(c) < 0.05) return `Both fuels are the same as on ${since}${when}.`;
  return `${cap(FUEL_WORD[f])} is ${c < 0 ? 'down' : 'up'} ${round1(Math.abs(c)).toFixed(1)}p since ${since}${when}.`;
}

/** A country's row: "Unleaded averages range from 169.5p in West Yorkshire to 179.0p on the Isle of Wight." (counties in England,
 *  council areas in Scotland and Wales). */
function rangeFact(country: string, locals: Locality[], avg: Averages): string | null {
  const keys =
    country === 'England'
      ? [...new Set(locals.filter((l) => l[3] === country && l[1]).map((l) => `K:${l[1]}`))]
      : locals.filter((l) => l[3] === country).map((l) => `C:${l[0]}`);
  const vals = keys.map((k) => [k, avg[k]?.[0]] as const).filter((x): x is readonly [string, number] => typeof x[1] === 'number');
  if (vals.length < 3) return null;
  vals.sort((a, b) => a[1] - b[1]);
  const [lo, hi] = [vals[0], vals[vals.length - 1]];
  return `Unleaded averages range from ${pence(lo[1])} ${inPlace(keyName(lo[0]))} to ${pence(hi[1])} ${inPlace(keyName(hi[0]))}.`;
}

/** Great Britain's row: "Wales is the cheapest of the three nations for both fuels, and Scotland the dearest." */
function nationsFact(avg: Averages): string | null {
  const ends = ([0, 1] as Fuel[]).map((f) => {
    const vals = ['England', 'Scotland', 'Wales'].map((c) => [c, avg[`N:${c}`]?.[f]] as const).filter((x): x is readonly [string, number] => typeof x[1] === 'number');
    if (vals.length < 3) return null;
    vals.sort((a, b) => a[1] - b[1]);
    return [vals[0][0], vals[2][0]];
  });
  if (!ends[0] || !ends[1]) return null;
  const [u, d] = ends as [string[], string[]];
  if (u[0] === d[0] && u[1] === d[1]) return `${u[0]} is the cheapest of the three nations for both fuels, and ${u[1]} the dearest.`;
  return `For unleaded, ${u[0]} is the cheapest of the three nations and ${u[1]} the dearest; for diesel, ${d[0]} is the cheapest and ${d[1]} the dearest.`;
}

/**
 * The rows for a place: the eight first, then its council area, county, region and country, then Great Britain. A level is left out
 * when it has no average for either fuel (fewer than five stations), or when it covers the same council areas as the level above
 * (Rutland is both; so is Greater London, county and region), keeping the higher one. Each row's fact, by John's rule: a place at
 * either end of its group first, then a gap of at least 1p from the row below it in the list (the level above), then a change of at
 * least 0.5p since recording began, then the gap however small.
 */
export function levelRows(opts: {
  eight: { name: string; now: Pair; then: Pair | null; since: string };
  local: Locality | null;
  locals: Locality[];
  latest: Averages;
  first: Averages | null;
  since: string;
}): LevelRow[] {
  const { local, locals, latest, first, since } = opts;
  const covers = (key: string) => {
    const [kind, name] = [key[0], key.slice(2)];
    const idx = (l: Locality) => (kind === 'C' ? l[0] : kind === 'K' ? l[1] : kind === 'R' ? l[2] : kind === 'N' ? l[3] : 'GB');
    return locals
      .filter((l) => key === 'GB' || idx(l) === name)
      .map((l) => l[0])
      .sort()
      .join('|');
  };
  let keys = local ? levelKeys(local) : [];
  keys = keys.filter((k, i) => !(i + 1 < keys.length && (covers(k) === covers(keys[i + 1]) || keyName(k) === keyName(keys[i + 1]))));
  keys = keys.filter((k) => latest[k] && (latest[k][0] !== null || latest[k][1] !== null));
  const levels = [...keys.map((k) => ({ key: k, name: keyName(k), now: latest[k] })), { key: 'GB', name: 'Great Britain', now: latest.GB ?? [null, null] }];
  const rows: LevelRow[] = [];
  const all = [{ key: 'eight', name: opts.eight.name, now: opts.eight.now }, ...levels];
  all.forEach((lv, i) => {
    const parent = all[i + 1];
    let fact: string | null = null;
    if (lv.key === 'GB') fact = nationsFact(latest) ?? changeFact(lv.now, first?.GB ?? null, since, 0);
    else if (lv.key.startsWith('N:')) fact = rangeFact(lv.key.slice(2), locals, latest);
    else {
      const sib = lv.key === 'eight' ? null : siblingsOf(lv.key, locals);
      const then = lv.key === 'eight' ? opts.eight.then : (first?.[lv.key] ?? null);
      const from = lv.key === 'eight' ? opts.eight.since : since;
      // The eight's record may start later than ours (until every one of their prices is known): then just the date.
      const began = lv.key !== 'eight' || opts.eight.since === since;
      fact = (sib && rankFact(lv.key, sib, latest)) ?? (parent && gapFact(lv.now, parent, 1)) ?? changeFact(lv.now, then, from, 0.5, began) ?? (parent && gapFact(lv.now, parent, 0));
    }
    rows.push({ key: lv.key, name: lv.name, now: lv.now, fact: fact ?? '' });
  });
  return rows;
}
