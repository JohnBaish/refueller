// The handler for the Fuel Finder probe on AWS Lambda (PLAN Stage 1c), as a function so the checks can point it at a fake server: the same probe as the GitHub workflow, run
// from an AWS address in London, which the Fuel Finder team have said is accepted (the API refuses non-UK addresses).
// It reads the two values from the function's environment variables, prints COUNTS AND SHAPES ONLY to the log,
// and returns the same redacted summary, so it can be copied from the console's Test result. It makes no change
// to anything and has no public address: it only runs when someone presses Test.
import { CANDIDATE_HOSTS, redact } from '../scripts/lib/probe.ts';
import { runProbe, type ProbeOptions } from '../scripts/lib/run-probe.ts';

type Overrides = Partial<Pick<ProbeOptions, 'hosts' | 'allowLocal' | 'paceMs' | 'backoffMs' | 'controlUrl'>>;

export function makeHandler(overrides: Overrides = {}) {
  return async function handler() {
    const clientId = process.env.FUEL_FINDER_CLIENT_ID ?? '';
    const clientSecret = process.env.FUEL_FINDER_CLIENT_SECRET ?? '';
    // Where it ran, so a London run can be told from any other (harmless: a region name and a version).
    const ranOn = { awsRegion: process.env.AWS_REGION ?? null, node: process.version };
    if (clientId === '' || clientSecret === '') {
      console.log('FUEL_FINDER_CLIENT_ID and FUEL_FINDER_CLIENT_SECRET are not both set in the function environment variables.');
      return { ok: false, problem: 'the two environment variables are not both set', ranOn };
    }
    const result = await runProbe({
      hosts: CANDIDATE_HOSTS,
      clientId,
      clientSecret,
      log: (line) => console.log(line),
      ...overrides,
    });
    // summaryText has already been through redact(); do it once more before returning, as a last line of defence.
    return { ok: result.ok, ranOn, summary: JSON.parse(redact(result.summaryText, [clientId, clientSecret])) as unknown };
  };
}
