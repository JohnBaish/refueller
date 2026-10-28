// The collector's handler on AWS Lambda (PLAN Stage 2), as a function so the checks can point it at fake servers. Started
// twice a day by AWS's scheduler in London. It reads the three values from the function's environment variables, runs the
// collector and returns its result (counts only). It never throws: AWS would otherwise run it again, twice more.
import { collect, type CollectOptions } from '../scripts/lib/collect.ts';
import { redact } from '../scripts/lib/probe.ts';

type Overrides = Partial<Pick<CollectOptions, 'fuelFinder' | 'githubApi' | 'bankHolidaysUrl' | 'allowLocal' | 'paceMs' | 'backoffMs' | 'now'>>;

export function makeCollectorHandler(overrides: Overrides = {}) {
  return async function handler() {
    const clientId = process.env.FUEL_FINDER_CLIENT_ID ?? '';
    const clientSecret = process.env.FUEL_FINDER_CLIENT_SECRET ?? '';
    const githubToken = process.env.REFUELLER_GITHUB_TOKEN ?? '';
    const ranOn = { awsRegion: process.env.AWS_REGION ?? null, node: process.version };
    const missing = [
      ['FUEL_FINDER_CLIENT_ID', clientId],
      ['FUEL_FINDER_CLIENT_SECRET', clientSecret],
      ['REFUELLER_GITHUB_TOKEN', githubToken],
    ].filter(([, v]) => v === '').map(([k]) => k);
    if (missing.length > 0) {
      console.log(`Not set in the function's environment variables: ${missing.join(', ')}`);
      return { ok: false, problem: `not set: ${missing.join(', ')}`, ranOn };
    }
    try {
      const result = await collect({ clientId, clientSecret, githubToken, log: (l) => console.log(l), ...overrides });
      return JSON.parse(redact(JSON.stringify({ ...result, ranOn }), [clientId, clientSecret, githubToken])) as unknown;
    } catch (e) {
      const problem = redact(`unexpected error: ${(e as Error).message}`, [clientId, clientSecret, githubToken]);
      console.log(problem);
      return { ok: false, problem, ranOn };
    }
  };
}
