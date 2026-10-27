// The Fuel Finder probe, as run by the "Probe Fuel Finder" workflow (PLAN Stage 1): reads the two secrets from the
// environment and prints COUNTS AND SHAPES ONLY. The probe itself is in lib/run-probe.ts.
import { fileURLToPath } from 'node:url';
import { CANDIDATE_HOSTS } from './lib/probe.ts';
import { runProbe } from './lib/run-probe.ts';

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
