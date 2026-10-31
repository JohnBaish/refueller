// Builds data/history.json for the 14-day price graph (src/lib/history.ts): every price each station has had in the last 14 days,
// with the time it was set, from the versions of data/prices.json in git (every collection is a commit to main). Fuel Finder keeps
// no earlier prices, so this is the only history there is (design/probe-result-history-2026-10-31.md). Rebuilt from git each
// time, so it can't drift: run by the "Price history" workflow after each collection, which fetches only the last 17 days of git.
//   node scripts/build-history.ts
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { HISTORY_DAYS, trim, withPrice, type Hist } from '../src/lib/history.ts';
import type { Price } from '../src/lib/search.ts';

type Version = { collected: string; prices: Record<string, { e10?: Price; diesel?: Price }> };

export function makeHistory(versions: Version[]) {
  const sorted = [...versions].sort((a, b) => Date.parse(a.collected) - Date.parse(b.collected));
  const latest = sorted[sorted.length - 1];
  const windowStart = Date.parse(latest.collected) - HISTORY_DAYS * 86_400_000;
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
  const since = new Date(Date.now() - (HISTORY_DAYS + 2) * 86_400_000).toISOString();
  const shas = git('log', `--since=${since}`, '--format=%H', '--', 'data/prices.json').split('\n').filter(Boolean);
  // The last collection before that too, if git has it, so the price at the window's start is known.
  const before = git('log', '-1', `--before=${since}`, '--format=%H', '--', 'data/prices.json').trim();
  if (before) shas.push(before);
  const versions: Version[] = shas.map((sha) => JSON.parse(git('show', `${sha}:data/prices.json`)));
  versions.push(JSON.parse(readFileSync(join(root, 'data/prices.json'), 'utf8')));
  const h = makeHistory(versions);
  const lines = Object.entries(h.stations).map(([id, v]) => `${JSON.stringify(id)}:${JSON.stringify(v)}`);
  writeFileSync(
    join(root, 'data/history.json'),
    `{"note":"Prices each station has had over the last ${HISTORY_DAYS} days besides its current one, with the time each was set, from our own collections (scripts/build-history.ts).",\n"recordedFrom":${JSON.stringify(h.recordedFrom)},\n"collected":${JSON.stringify(h.collected)},\n"stations":{\n${lines.join(',\n')}}}\n`,
  );
  console.log(`history: ${lines.length} stations, ${versions.length} collections read, from ${h.recordedFrom} to ${h.collected}`);
}
