// The collector (PLAN Stage 2): run twice a day by AWS in London (the Fuel Finder API refuses addresses outside the UK).
// Each run signs in to Fuel Finder, fetches every station and every price, trims them with the rules in clean.ts, and
// saves three files into this repo's `main` branch through GitHub's API, in one commit:
//   data/stations.json   the Great Britain stations the page can show (changes rarely)
//   data/prices.json     their E10 and standard diesel prices, each with its "last updated" time as given
//   data/runs/YYYY-MM.jsonl   one line per run: counts only, so the runs can be checked later
// plus data/bank-holidays.json when GOV.UK's feed can be read. Vercel rebuilds the site from each commit.
//
// If anything goes wrong with Fuel Finder, the data files are left as they were and only the run's line is saved, so the
// page keeps the last good prices and their times. Nothing is ever printed or saved except counts: the repo is public.
//
// What keeps the secrets safe:
//  - the Fuel Finder values go only to the Fuel Finder host, the GitHub key only to api.github.com, and nothing to any
//    other host; redirects are never followed;
//  - nothing secret is printed or returned: every log line and the returned result pass through redact().
import { gzipSync } from 'node:zlib';
import { bankHolidayDates, clean, newestPrice, UNUSUAL_PENCE, type Counts } from './clean.ts';
import { isObj, redact, type Obj } from './probe.ts';

export const FUEL_FINDER = 'https://www.fuel-finder.service.gov.uk';
export const GITHUB_API = 'https://api.github.com';
export const BANK_HOLIDAYS_URL = 'https://www.gov.uk/bank-holidays.json';
export const REPO = 'JohnBaish/refueller';
export const BRANCH = 'main';
export const USER_AGENT = 'Refueller-collector/0.1 (+https://github.com/JohnBaish/refueller)';

// Below these, a run is taken as faulty and the data files are not replaced (on 27 October: 8,146 stations fetched,
// about 6,200 kept in Great Britain).
export const MIN_FETCHED = 4000;
export const MIN_KEPT = 3000;

export type CollectOptions = {
  clientId: string;
  clientSecret: string;
  githubToken: string;
  now?: number;
  fuelFinder?: string; // checks only: a test server on this machine
  githubApi?: string; // checks only
  bankHolidaysUrl?: string; // checks only
  allowLocal?: boolean; // checks only
  paceMs?: number; // gap between Fuel Finder requests; the limit is 100 a minute, one at a time
  backoffMs?: number;
  log?: (line: string) => void;
};

export type RunRecord = {
  at: string;
  ok: boolean;
  problem?: string;
  counts?: Counts;
  middle?: { e10: number | null; diesel: number | null };
  newestPrice?: string | null;
  bankHolidays?: 'saved' | 'not read';
  fuelFinderRequests: number;
  seconds: number;
};

type Reply = { status: number; text: string; error?: string };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const parse = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
};
const errCode = (e: unknown): string => (e as { cause?: { code?: string } } | null)?.cause?.code ?? (e as Error | null)?.name ?? 'error';

// A test server on this machine (the checks only).
function isLocal(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === 'http:' && (u.hostname === '127.0.0.1' || u.hostname === 'localhost') && u.username === '' && u.password === '';
  } catch {
    return false;
  }
}

// Each kind of request may go to one fixed address only (or, in the checks, to a test server on this machine).
function allowed(url: string, fixed: string, allowLocal: boolean): boolean {
  if (allowLocal && isLocal(url)) return true;
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && u.origin === new URL(fixed).origin && u.username === '' && u.password === '';
  } catch {
    return false;
  }
}

async function send(url: string, init: RequestInit, timeoutMs = 30_000): Promise<Reply> {
  try {
    // redirect: 'manual' so a secret can never follow a redirect to another host.
    const res = await fetch(url, { ...init, redirect: 'manual', signal: AbortSignal.timeout(timeoutMs) });
    return { status: res.status, text: await res.text() };
  } catch (e) {
    return { status: 0, text: '', error: errCode(e) };
  }
}

// --- Fuel Finder --------------------------------------------------------------------------------------------------------

export async function fetchFuelFinder(opts: CollectOptions, log: (l: string) => void, secrets: string[]) {
  const base = opts.fuelFinder ?? FUEL_FINDER;
  const allowLocal = opts.allowLocal ?? false;
  const paceMs = opts.paceMs ?? 800;
  const backoffMs = opts.backoffMs ?? 5000;
  if (!allowed(base, FUEL_FINDER, allowLocal)) throw new Error('refusing a Fuel Finder host that is not on the list');
  let requests = 0;
  let lastAt = 0;

  // One request, polite to the limits, with at most one retry (after a 429 or a server error, or no answer).
  async function call(path: string, init: RequestInit): Promise<Reply> {
    for (let attempt = 0; ; attempt++) {
      if (++requests > 120) throw new Error('request limit reached');
      const wait = paceMs - (Date.now() - lastAt);
      if (wait > 0) await sleep(wait);
      lastAt = Date.now();
      const reply = await send(`${base}${path}`, init);
      const retryable = reply.status === 0 || reply.status === 429 || reply.status >= 500;
      if (!retryable || attempt >= 1) return reply;
      await sleep(backoffMs);
    }
  }

  const json = { 'content-type': 'application/json', accept: 'application/json', 'user-agent': USER_AGENT };
  const signIn = await call('/api/v1/oauth/generate_access_token', { method: 'POST', headers: json, body: JSON.stringify({ client_id: opts.clientId, client_secret: opts.clientSecret }) });
  const tok = parse(signIn.text);
  const data = isObj(tok) && isObj(tok.data) ? tok.data : isObj(tok) ? tok : {};
  if (signIn.status !== 200 || typeof data.access_token !== 'string' || data.access_token === '') {
    return { ok: false as const, problem: `sign-in refused: ${signIn.status === 0 ? `no answer (${signIn.error})` : `HTTP ${signIn.status}`}`, requests };
  }
  let token = data.access_token;
  secrets.push(token);
  const refresh = typeof data.refresh_token === 'string' ? data.refresh_token : '';
  if (refresh !== '') secrets.push(refresh);
  log('signed in to Fuel Finder');

  const authGet = (): RequestInit => ({ method: 'GET', headers: { authorization: `Bearer ${token}`, accept: 'application/json', 'user-agent': USER_AGENT } });
  let refreshed = false;
  async function get(path: string): Promise<Reply> {
    let reply = await call(path, authGet());
    if (reply.status === 401 && refresh !== '' && !refreshed) {
      refreshed = true;
      const r = await call('/api/v1/oauth/regenerate_access_token', { method: 'POST', headers: json, body: JSON.stringify({ client_id: opts.clientId, refresh_token: refresh }) });
      const rj = parse(r.text);
      const rd = isObj(rj) && isObj(rj.data) ? rj.data : {};
      if (r.status === 200 && typeof rd.access_token === 'string' && rd.access_token !== '') {
        token = rd.access_token;
        secrets.push(token);
        reply = await call(path, authGet());
      }
    }
    return reply;
  }

  // Every batch until the end of the list. The API marks the end with a 404 on the batch after the last (seen on
  // 27 October); an empty batch is also taken as the end. A 404 on the very first batch is a failure.
  async function all(path: string, label: string): Promise<Obj[] | string> {
    const out: Obj[] = [];
    for (let n = 1; n <= 60; n++) {
      const reply = await get(`${path}?batch-number=${n}`);
      if (reply.status === 404 && n > 1) break;
      if (reply.status !== 200) return `${label}: batch ${n} failed (${reply.status === 0 ? `no answer, ${reply.error}` : `HTTP ${reply.status}`})`;
      const body = parse(reply.text);
      const arr = Array.isArray(body) ? body : isObj(body) && Array.isArray(body.data) ? body.data : null;
      if (!arr) return `${label}: batch ${n} had an unexpected shape`;
      if (arr.length === 0) break;
      for (const r of arr) if (isObj(r)) out.push(r);
      if (n === 60) return `${label}: more than 60 batches`;
    }
    log(`${label}: ${out.length} records`);
    return out;
  }

  const stations = await all('/api/v1/pfs', 'stations');
  if (typeof stations === 'string') return { ok: false as const, problem: stations, requests };
  const prices = await all('/api/v1/pfs/fuel-prices', 'prices');
  if (typeof prices === 'string') return { ok: false as const, problem: prices, requests };
  return { ok: true as const, stations, prices, requests };
}

// --- GitHub: save files to `main` in one commit -------------------------------------------------------------------------

export async function commitFiles(opts: CollectOptions, files: Record<string, string>, message: string, runLine: string, runPath: string, log: (l: string) => void) {
  const api = opts.githubApi ?? GITHUB_API;
  const allowLocal = opts.allowLocal ?? false;
  if (!allowed(api, GITHUB_API, allowLocal)) throw new Error('refusing a GitHub host that is not on the list');
  const headers = {
    authorization: `Bearer ${opts.githubToken}`,
    accept: 'application/vnd.github+json',
    'x-github-api-version': '2022-11-28',
    'user-agent': USER_AGENT,
  };
  const gh = async (method: string, path: string, body?: unknown, extra: Record<string, string> = {}) => {
    const url = `${api}/repos/${REPO}${path}`;
    if (!allowed(url, GITHUB_API, allowLocal)) throw new Error('refusing to send to another host');
    return send(url, { method, headers: { ...headers, ...extra, ...(body === undefined ? {} : { 'content-type': 'application/json' }) }, body: body === undefined ? undefined : JSON.stringify(body) }, 60_000);
  };

  // Twice at most: if someone else saved to `main` in between, start again from the new tip.
  for (let attempt = 0; attempt < 2; attempt++) {
    const ref = await gh('GET', `/git/ref/heads/${BRANCH}`);
    const refJson = parse(ref.text);
    const tip = isObj(refJson) && isObj(refJson.object) ? String(refJson.object.sha ?? '') : '';
    if (ref.status !== 200 || tip === '') return { ok: false, problem: `GitHub: couldn't read ${BRANCH} (HTTP ${ref.status || ref.error})` };
    const commit = await gh('GET', `/git/commits/${tip}`);
    const commitJson = parse(commit.text);
    const baseTree = isObj(commitJson) && isObj(commitJson.tree) ? String(commitJson.tree.sha ?? '') : '';
    if (commit.status !== 200 || baseTree === '') return { ok: false, problem: `GitHub: couldn't read the latest commit (HTTP ${commit.status || commit.error})` };

    // This month's run log so far, to add today's line to.
    const existing = await gh('GET', `/contents/${runPath}?ref=${tip}`, undefined, { accept: 'application/vnd.github.raw+json' });
    if (existing.status !== 200 && existing.status !== 404) return { ok: false, problem: `GitHub: couldn't read the run log (HTTP ${existing.status || existing.error})` };
    const before = existing.status === 200 ? existing.text : '';
    const all = { ...files, [runPath]: `${before}${before === '' || before.endsWith('\n') ? '' : '\n'}${runLine}\n` };

    const tree = await gh('POST', '/git/trees', { base_tree: baseTree, tree: Object.entries(all).map(([path, content]) => ({ path, mode: '100644', type: 'blob', content })) });
    const treeJson = parse(tree.text);
    const treeSha = isObj(treeJson) ? String(treeJson.sha ?? '') : '';
    if (tree.status !== 201 || treeSha === '') return { ok: false, problem: `GitHub: couldn't write the files (HTTP ${tree.status || tree.error})` };
    const made = await gh('POST', '/git/commits', { message, tree: treeSha, parents: [tip] });
    const madeJson = parse(made.text);
    const newSha = isObj(madeJson) ? String(madeJson.sha ?? '') : '';
    if (made.status !== 201 || newSha === '') return { ok: false, problem: `GitHub: couldn't make the commit (HTTP ${made.status || made.error})` };
    const moved = await gh('PATCH', `/git/refs/heads/${BRANCH}`, { sha: newSha, force: false });
    if (moved.status === 200) {
      log(`saved to ${BRANCH}: ${newSha.slice(0, 7)}`);
      return { ok: true, commit: newSha };
    }
    if (moved.status !== 422 && moved.status !== 409) return { ok: false, problem: `GitHub: couldn't move ${BRANCH} (HTTP ${moved.status || moved.error})` };
    log(`${BRANCH} moved while saving; trying once more`);
  }
  return { ok: false, problem: `GitHub: ${BRANCH} kept moving while saving` };
}

// --- One run ---------------------------------------------------------------------------------------------------------

// One run log a month, by the UK calendar.
export function runFilePath(now: number): string {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit' }).formatToParts(new Date(now));
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `data/runs/${part('year')}-${part('month')}.jsonl`;
}

export async function collect(opts: CollectOptions) {
  const started = Date.now();
  const now = opts.now ?? started;
  const secrets = [opts.clientId, opts.clientSecret, opts.githubToken];
  const log = (line: string) => (opts.log ?? console.log)(redact(line, secrets));
  const at = new Date(now).toISOString();
  const record: RunRecord = { at, ok: false, fuelFinderRequests: 0, seconds: 0 };
  const files: Record<string, string> = {};

  try {
    const ff = await fetchFuelFinder(opts, log, secrets);
    record.fuelFinderRequests = ff.requests;
    if (!ff.ok) {
      record.problem = ff.problem;
    } else if (ff.stations.length < MIN_FETCHED || ff.prices.length < MIN_FETCHED) {
      record.problem = `too few records fetched (${ff.stations.length} stations, ${ff.prices.length} price records), so the files were not replaced`;
    } else {
      const c = clean(ff.stations, ff.prices, now);
      record.counts = c.counts;
      record.middle = c.middle;
      record.newestPrice = newestPrice(c.prices);
      if (c.counts.stationsKept < MIN_KEPT) {
        record.problem = `too few stations kept (${c.counts.stationsKept}), so the files were not replaced`;
      } else {
        record.ok = true;
        // One station or one price per line, so each run's changes are small and easy to read in the history.
        files['data/stations.json'] = `{"collected":${JSON.stringify(at)},"stations":[\n${c.stations.map((s) => JSON.stringify(s)).join(',\n')}\n]}\n`;
        files['data/prices.json'] =
          `{"collected":${JSON.stringify(at)},"middle":${JSON.stringify(c.middle)},"unusualPence":${UNUSUAL_PENCE},"prices":{\n` +
          `${Object.entries(c.prices).map(([id, p]) => `${JSON.stringify(id)}:${JSON.stringify(p)}`).join(',\n')}\n}}\n`;
      }
    }
  } catch (e) {
    record.problem = `unexpected error: ${(e as Error).message}`;
  }

  // GOV.UK's bank holidays (no credentials). If they can't be read, the saved copy stays.
  if (record.ok) {
    const url = opts.bankHolidaysUrl ?? BANK_HOLIDAYS_URL;
    const bh = allowed(url, BANK_HOLIDAYS_URL, opts.allowLocal ?? false) ? await send(url, { method: 'GET', headers: { 'user-agent': USER_AGENT, accept: 'application/json' } }, 15_000) : { status: 0, text: '' };
    const dates = bh.status === 200 ? bankHolidayDates(parse(bh.text), now) : null;
    if (dates) files['data/bank-holidays.json'] = `${JSON.stringify(dates, null, 1)}\n`;
    record.bankHolidays = dates ? 'saved' : 'not read';
  }

  record.seconds = Math.round((Date.now() - started) / 100) / 10;
  const runLine = redact(JSON.stringify(record), secrets);
  log(record.ok ? `run ok: ${record.counts?.stationsKept} stations kept` : `run failed: ${record.problem}`);
  if (record.ok) {
    const zipped = gzipSync(files['data/stations.json'] + files['data/prices.json']).length;
    log(`data files: ${Math.round(zipped / 1024)} KB compressed`);
  }

  const message = record.ok ? `Data: ${at.slice(0, 16).replace('T', ' ')} UTC` : `Data: run failed ${at.slice(0, 16).replace('T', ' ')} UTC (files unchanged)`;
  let saved: { ok: boolean; problem?: string; commit?: string };
  try {
    saved = await commitFiles(opts, files, message, runLine, runFilePath(now), log);
  } catch (e) {
    saved = { ok: false, problem: `unexpected error while saving: ${(e as Error).message}` };
  }
  if (!saved.ok) log(`not saved: ${saved.problem}`);
  return JSON.parse(redact(JSON.stringify({ ok: record.ok && saved.ok, run: record, saved: saved.ok ? { commit: saved.commit } : { problem: saved.problem } }), secrets)) as {
    ok: boolean;
    run: RunRecord;
    saved: { commit?: string; problem?: string };
  };
}
