// The Fuel Finder probe (PLAN Stage 1). Run from the "Probe Fuel Finder" workflow, because
// this session's container can't reach the API. It signs in once, pages through every
// station batch and every price batch one request at a time, and prints COUNTS AND SHAPES
// ONLY: the repo is public, and so are its Actions logs (SPEC §2a).
//
// What keeps the secrets safe:
//  - they are only ever sent to the hosts in CANDIDATE_HOSTS (see lib/probe.ts), never to a
//    redirect target (redirects are not followed);
//  - the token is held in memory and never printed;
//  - every line printed passes through redact() first.
import { appendFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  CANDIDATE_HOSTS,
  hostAllowed,
  isObj,
  redact,
  safeHeaders,
  USER_AGENT,
  summarisePrices,
  summariseStations,
  trimmedSizeEstimate,
  type Obj,
} from './lib/probe.ts';

export type ProbeOptions = {
  hosts: string[];
  clientId: string;
  clientSecret: string;
  allowLocal?: boolean; // checks only: lets a test server on this machine stand in
  paceMs?: number; // gap between requests; the limit is 100 a minute, one at a time
  backoffMs?: number;
  maxBatches?: number;
  maxRequests?: number;
  now?: number;
  stepSummaryPath?: string;
  controlUrl?: string; // a harmless public page, to see whether this machine can reach the internet at all
  diagnose?: boolean;
  log: (line: string) => void;
};

type Reply = { status: number; headers: Headers; text: string; ms: number; error?: string };

const errCode = (e: unknown): string => {
  const cause = (e as { cause?: { code?: string } } | null)?.cause;
  return cause?.code ?? (e as Error | null)?.name ?? 'error';
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// The array of records, whether the reply is the array itself or wraps it in `data`.
export function unwrap(json: unknown): unknown[] | null {
  if (Array.isArray(json)) return json;
  if (isObj(json) && Array.isArray(json.data)) return json.data;
  return null;
}

function parse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

const keysOf = (v: unknown): string[] => (isObj(v) ? Object.keys(v).slice(0, 12) : []);

const utcDate = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

export async function runProbe(opts: ProbeOptions) {
  const { hosts, clientId, clientSecret, allowLocal = false, paceMs = 800, backoffMs = 2000 } = opts;
  const maxBatches = opts.maxBatches ?? 80;
  const maxRequests = opts.maxRequests ?? 250;
  const now = opts.now ?? Date.now();
  const secrets = [clientId, clientSecret];
  const log = (line: string) => opts.log(redact(line, secrets));

  let requests = 0;
  let lastAt = 0;
  const headerNotes: Record<string, string> = {};

  async function call(url: string, init: RequestInit, retries: number, retryNetwork: boolean): Promise<Reply> {
    if (!hostAllowed(url, allowLocal)) throw new Error('refusing to send to a host that is not on the list');
    for (let attempt = 0; ; attempt++) {
      if (++requests > maxRequests) throw new Error('request limit reached');
      const wait = paceMs - (Date.now() - lastAt);
      if (wait > 0) await sleep(wait);
      lastAt = Date.now();
      const t0 = Date.now();
      let reply: Reply;
      try {
        // redirect: 'manual' so a secret can never follow a redirect to another host.
        const res = await fetch(url, { ...init, redirect: 'manual', signal: AbortSignal.timeout(30_000) });
        reply = { status: res.status, headers: res.headers, text: await res.text(), ms: Date.now() - t0 };
        res.headers.forEach((value, name) => {
          if (/rate|limit|retry|quota|throttle/i.test(name) || ['content-type', 'content-encoding', 'cache-control', 'last-modified', 'age'].includes(name)) {
            headerNotes[name] ??= value.slice(0, 80);
          }
        });
      } catch (e) {
        reply = { status: 0, headers: new Headers(), text: '', ms: Date.now() - t0, error: errCode(e) };
        if (!retryNetwork || attempt >= retries) return reply;
        await sleep(backoffMs * 2 ** attempt);
        continue;
      }
      const retryable = reply.status === 429 || reply.status === 500 || reply.status === 502 || reply.status === 503 || reply.status === 504;
      if (!retryable || attempt >= retries) return reply;
      const ra = Number(reply.headers.get('retry-after'));
      await sleep(Number.isFinite(ra) && ra >= 0 && reply.headers.has('retry-after') ? Math.min(ra * 1000, 30_000) : backoffMs * 2 ** attempt);
    }
  }

  // --- 1. Sign in: find the host that answers, using the government hosts only ---------------
  const attempts: { host: string; result: string }[] = [];
  let base = '';
  let token = '';
  let refresh = '';
  const tokenInfo: Record<string, unknown> = {};
  let credentialsRejected = false;

  for (const host of hosts) {
    const url = `${host}/api/v1/oauth/generate_access_token`;
    const reply = await call(
      url,
      { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json', 'user-agent': USER_AGENT }, body: JSON.stringify({ client_id: clientId, client_secret: clientSecret }) },
      1,
      false,
    );
    const result = reply.status === 0 ? `no answer (${reply.error})` : `HTTP ${reply.status}${reply.text === '' ? ' (empty body)' : ''}`;
    attempts.push({ host: new URL(host).hostname, result, ...(reply.status !== 200 && reply.status !== 0 ? { headers: safeHeaders(reply.headers) } : {}) });
    log(`token request to ${new URL(host).hostname}: ${result}`);
    if (reply.status === 200) {
      const json = parse(reply.text);
      const data = isObj(json) && isObj(json.data) ? json.data : isObj(json) ? json : {};
      if (typeof data.access_token === 'string' && data.access_token !== '') {
        token = data.access_token;
        secrets.push(token);
        if (typeof data.refresh_token === 'string' && data.refresh_token !== '') {
          refresh = data.refresh_token;
          secrets.push(refresh);
        }
        base = host;
        Object.assign(tokenInfo, {
          topLevelKeys: keysOf(json),
          dataKeys: isObj(json) && isObj(json.data) ? keysOf(json.data) : [],
          expiresIn: data.expires_in ?? null,
          refreshExpiresIn: data.refresh_token_expires_in ?? null,
          hasRefreshToken: refresh !== '',
          tokenType: data.token_type ?? null,
        });
        break;
      }
    }
    if (reply.status === 401 || reply.status === 400) {
      log('the host answered but did not accept the credentials: stopping');
      credentialsRejected = true;
      break;
    }
  }

  // Why was the sign-in refused? Plain requests with NO credentials at all, to the hosts that
  // answered, plus one harmless public page as a control. Only statuses and safe headers are kept.
  async function diagnose(answering: string[]) {
    const out: Record<string, unknown> = {};
    const probes: [string, string][] = [['siteHome', '/'], ['apiWithoutToken', '/api/v1/pfs?batch-number=1'], ['motoristPage', '/motorist/price-report']];
    for (const hostname of answering) {
      const host = hosts.find((h) => new URL(h).hostname === hostname);
      if (!host) continue;
      const results: Record<string, unknown> = {};
      for (const [label, path] of probes) {
        const reply = await call(`${host}${path}`, { method: 'GET', headers: { 'user-agent': USER_AGENT } }, 0, false);
        results[label] = { status: reply.status || reply.error, bodyLength: reply.text.length, headers: safeHeaders(reply.headers) };
      }
      out[hostname] = results;
    }
    try {
      const res = await fetch(opts.controlUrl ?? 'https://www.gov.uk/', { method: 'GET', redirect: 'manual', headers: { 'user-agent': USER_AGENT }, signal: AbortSignal.timeout(15_000) });
      out.controlPublicPage = { status: res.status };
    } catch (e) {
      out.controlPublicPage = { status: errCode(e) };
    }
    return out;
  }

  const summary: Record<string, unknown> = {
    tokenAttempts: attempts,
    host: base === '' ? null : new URL(base).hostname,
    token: tokenInfo,
  };
  const finish = (ok: boolean) => {
    summary.ok = ok;
    summary.requestsMade = requests;
    summary.responseHeadersSeen = headerNotes;
    const text = redact(JSON.stringify(summary, null, 2), secrets);
    log('=== PROBE SUMMARY (counts and shapes only) ===');
    log(text);
    log('=== END OF SUMMARY ===');
    if (opts.stepSummaryPath) {
      appendFileSync(opts.stepSummaryPath, `# Fuel Finder probe\n\nResult: **${ok ? 'complete' : 'incomplete'}**\n\n\`\`\`json\n${text}\n\`\`\`\n`);
    }
    return { ok, summary };
  };

  if (token === '') {
    log('no access token obtained');
    // A 400 or 401 means the service itself was reached and said no: nothing to diagnose.
    if ((opts.diagnose ?? true) && !credentialsRejected) summary.diagnostics = await diagnose(attempts.filter((a) => !a.result.startsWith('no answer')).map((a) => a.host));
    return finish(false);
  }

  // --- 2. Data calls, one at a time, with the token --------------------------------------------
  const authInit = (): RequestInit => ({ method: 'GET', headers: { authorization: `Bearer ${token}`, accept: 'application/json', 'user-agent': USER_AGENT } });

  async function refreshToken(): Promise<boolean> {
    if (refresh === '') return false;
    const reply = await call(
      `${base}/api/v1/oauth/regenerate_access_token`,
      { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json', 'user-agent': USER_AGENT }, body: JSON.stringify({ client_id: clientId, refresh_token: refresh }) },
      1,
      false,
    );
    const json = parse(reply.text);
    const data = isObj(json) && isObj(json.data) ? json.data : isObj(json) ? json : {};
    const ok = reply.status === 200 && typeof data.access_token === 'string' && data.access_token !== '';
    summary.regenerate = { status: reply.status || reply.error, ok, dataKeys: keysOf(data), hasNewRefreshToken: typeof data.refresh_token === 'string' };
    if (ok) {
      token = data.access_token as string;
      secrets.push(token);
      if (typeof data.refresh_token === 'string' && data.refresh_token !== '') {
        refresh = data.refresh_token;
        secrets.push(refresh);
      }
    }
    return ok;
  }

  async function get(path: string): Promise<Reply> {
    let reply = await call(`${base}${path}`, authInit(), 3, true);
    if (reply.status === 401 && (await refreshToken())) reply = await call(`${base}${path}`, authInit(), 3, true);
    return reply;
  }

  async function fetchAll(path: string, label: string) {
    const records: Obj[] = [];
    const sizes: number[] = [];
    let bytes = 0;
    let ms = 0;
    let failure: Record<string, unknown> | null = null;
    let envelope = '';
    for (let n = 1; n <= maxBatches; n++) {
      const reply = await get(`${path}?batch-number=${n}`);
      if (reply.status !== 200) {
        failure = { batch: n, status: reply.status || reply.error, bodyLength: reply.text.length, bodyKeys: keysOf(parse(reply.text)) };
        break;
      }
      const json = parse(reply.text);
      const arr = unwrap(json);
      if (!arr) {
        failure = { batch: n, status: 200, problem: 'unexpected shape', topLevelType: Array.isArray(json) ? 'array' : typeof json, keys: keysOf(json) };
        break;
      }
      envelope ||= Array.isArray(json) ? 'a plain array' : `an object with ${keysOf(json).join(', ')}`;
      sizes.push(arr.length);
      bytes += Buffer.byteLength(reply.text);
      ms += reply.ms;
      for (const r of arr) if (isObj(r)) records.push(r);
      log(`${label}: batch ${n} -> ${arr.length} records`);
      if (arr.length === 0) break;
    }
    return { records, info: { envelope, batches: sizes.length, batchSizes: sizes, totalRecords: records.length, bytes, seconds: Math.round(ms / 100) / 10, failure } };
  }

  const stationsRun = await fetchAll('/api/v1/pfs', 'stations');
  const pricesRun = await fetchAll('/api/v1/pfs/fuel-prices', 'prices');
  summary.stations = { ...stationsRun.info, ...(stationsRun.records.length > 0 ? summariseStations(stationsRun.records) : {}) };
  summary.prices = { ...pricesRun.info, ...(pricesRun.records.length > 0 ? summarisePrices(pricesRun.records, stationsRun.records, now) : {}) };
  if (stationsRun.records.length > 0 && pricesRun.records.length > 0) {
    summary.estimatedPageFile = trimmedSizeEstimate(stationsRun.records, pricesRun.records);
  }

  // --- 3. The "incremental" calls take a date: how much does a date return? ---------------------
  const incremental: Record<string, unknown> = {};
  for (const [label, path, date] of [
    ['pricesSinceYesterday', '/api/v1/pfs/fuel-prices', utcDate(now - 86_400_000)],
    ['pricesSinceToday', '/api/v1/pfs/fuel-prices', utcDate(now)],
    ['stationsSinceYesterday', '/api/v1/pfs', utcDate(now - 86_400_000)],
  ] as const) {
    const reply = await get(`${path}?batch-number=1&effective-start-timestamp=${date}`);
    const arr = reply.status === 200 ? unwrap(parse(reply.text)) : null;
    incremental[label] = { date, status: reply.status || reply.error, firstBatchRecords: arr ? arr.length : null };
  }
  summary.incremental = incremental;

  // --- 4. Try the refresh call once, to record how it behaves ------------------------------------
  if (!summary.regenerate) await refreshToken();

  const ok = !(stationsRun.info.failure || pricesRun.info.failure) && stationsRun.records.length > 0 && pricesRun.records.length > 0;
  return finish(ok);
}

async function main() {
  const clientId = process.env.FUEL_FINDER_CLIENT_ID ?? '';
  const clientSecret = process.env.FUEL_FINDER_CLIENT_SECRET ?? '';
  if (clientId === '' || clientSecret === '') {
    console.log('FUEL_FINDER_CLIENT_ID and FUEL_FINDER_CLIENT_SECRET are not both set.');
    process.exitCode = 1;
    return;
  }
  const result = await runProbe({
    hosts: CANDIDATE_HOSTS,
    clientId,
    clientSecret,
    stepSummaryPath: process.env.GITHUB_STEP_SUMMARY,
    log: (line) => console.log(line),
  });
  if (!result.ok) process.exitCode = 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
