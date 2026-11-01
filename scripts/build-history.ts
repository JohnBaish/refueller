// Builds data/history.json for the 14-day price graph (src/lib/history.ts): every price each station has had in the last 30 days
// (the graph shows 14; "Average prices" needs the eight stations' prices over 30, src/lib/averages.ts),
// with the time it was set, from the versions of data/prices.json in git (every collection is a commit to main). Fuel Finder keeps
// no earlier prices, so this is the only history there is (design/probe-result-history-2026-10-31.md). Rebuilt from git each
// time, so it can't drift: run by the "Price history" workflow after each collection, which fetches only the last 33 days of git.
// It also writes data/averages.json: the average price in Great Britain and in each postcode area at every collection in the last 30
// days, from the versions of data/prices.json and data/stations.json.
//   node scripts/build-history.ts
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { HISTORY_DAYS, trim, withPrice, type Hist } from '../src/lib/history.ts';
import { AVERAGE_DAYS, averagesFor, keepRecent, type Averages } from '../src/lib/averages.ts';
import type { Price } from '../src/lib/search.ts';

type Version = { collected: string; middle?: { e10?: number; diesel?: number }; prices: Record<string, { e10?: Price; diesel?: Price }> };

// Prices are kept for 30 days: the graph shows 14 of them, the eight stations' averages 30.
export const KEEP_DAYS = Math.max(HISTORY_DAYS, AVERAGE_DAYS);

export function makeHistory(versions: Version[]) {
  const sorted = [...versions].sort((a, b) => Date.parse(a.collected) - Date.parse(b.collected));
  const latest = sorted[sorted.length - 1];
  const windowStart = Date.parse(latest.collected) - KEEP_DAYS * 86_400_000;
  const stations: Record<string, { e10?: Hist; diesel?: Hist }> = {};
  for (const v of sorted)
    for (const [id, p] of Object.entries(v.prices)) {
      const h = (stations[id] ??= {});
      for (const f of ['e10', 'diesel'] as const) if (p[f]) h[f] = withPrice(h[f] ?? [], p[f]);
    }
  for (const h of Object.values(stations)) for (const f of ['e10', 'diesel'] as const) if (h[f]) h[f] = trim(h[f]!, windowStart);
  // Stations that have left the list stay out. A fuel whose only price is the current one is left out too: the page knows the
  // current price already (data/prices.json), so this file holds only what that file can't tell.
  for (const [id, h] of Object.entries(stations)) {
    for (const f of ['e10', 'diesel'] as const) if ((h[f]?.length ?? 0) < 2) delete h[f];
    if (!(id in latest.prices) || (!h.e10 && !h.diesel)) delete stations[id];
  }
  return { recordedFrom: sorted[0].collected, collected: latest.collected, stations };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const root = new URL('..', import.meta.url).pathname;
  const git = (...a: string[]) => execFileSync('git', a, { cwd: root, encoding: 'utf8', maxBuffer: 64 << 20 });
  const since = new Date(Date.now() - (KEEP_DAYS + 2) * 86_400_000).toISOString();
  const shas = git('log', `--since=${since}`, '--format=%H', '--', 'data/prices.json').split('\n').filter(Boolean);
  // The last collection before that too, if git has it, so the price at the window's start is known.
  const before = git('log', '-1', `--before=${since}`, '--format=%H', '--', 'data/prices.json').trim();
  if (before) shas.push(before);
  const versions: Version[] = shas.map((sha) => JSON.parse(git('show', `${sha}:data/prices.json`)));
  versions.push(JSON.parse(readFileSync(join(root, 'data/prices.json'), 'utf8')));
  // Each collection's averages, with the station list of the same commit (for postcodes).
  const postcodesOf = (text: string) => Object.fromEntries((JSON.parse(text).stations as { id: string; postcode: string }[]).map((s) => [s.id.slice(0, 12), s.postcode]));
  const rows: [string, Averages][] = shas.map((sha, i) => [versions[i].collected, averagesFor(versions[i].prices, postcodesOf(git('show', `${sha}:data/stations.json`)), versions[i].middle)]);
  const now = versions[versions.length - 1];
  rows.push([now.collected, averagesFor(now.prices, postcodesOf(readFileSync(join(root, 'data/stations.json'), 'utf8')), now.middle)]);
  const kept = keepRecent([...new Map(rows.map((r) => [r[0], r])).values()]);
  writeFileSync(
    join(root, 'data/averages.json'),
    `{"note":"The mean unleaded and diesel price at each collection in the last ${AVERAGE_DAYS} days, for Great Britain (GB) and each postcode area: [unleaded, diesel], unusual prices not included (scripts/build-history.ts).",\n"collections":[\n${kept.map((r) => JSON.stringify(r)).join(',\n')}]}\n`,
  );
  console.log(`averages: ${kept.length} collections`);
  const h = makeHistory(versions);
  const lines = Object.entries(h.stations).map(([id, v]) => `${JSON.stringify(id)}:${JSON.stringify(v)}`);
  writeFileSync(
    join(root, 'data/history.json'),
    `{"note":"Prices each station has had over the last ${KEEP_DAYS} days besides its current one, with the time each was set, from our own collections (scripts/build-history.ts).",\n"recordedFrom":${JSON.stringify(h.recordedFrom)},\n"collected":${JSON.stringify(h.collected)},\n"stations":{\n${lines.join(',\n')}}}\n`,
  );
  console.log(`history: ${lines.length} stations, ${versions.length} collections read, from ${h.recordedFrom} to ${h.collected}`);
}
