// Builds the two Lambda packages, each ONE plain JavaScript file made from this repo's own code (nothing from npm inside):
//   dist-lambda/probe/index.mjs       the probe (Stage 1c), from lambda/handler.ts
//   dist-lambda/collector/index.mjs   the collector (Stage 2), from lambda/collector.ts
// The workflow zips each one.
import { build } from 'esbuild';
import { mkdirSync, rmSync, statSync } from 'node:fs';

rmSync('dist-lambda', { recursive: true, force: true });
for (const [name, entry] of [
  ['probe', 'lambda/handler.ts'],
  ['collector', 'lambda/collector.ts'],
]) {
  mkdirSync(`dist-lambda/${name}`, { recursive: true });
  await build({
    entryPoints: [entry],
    bundle: true,
    platform: 'node',
    target: 'node22',
    format: 'esm',
    outfile: `dist-lambda/${name}/index.mjs`,
    legalComments: 'none',
    sourcemap: false,
    minify: false,
    logLevel: 'warning',
  });
  console.log(`dist-lambda/${name}/index.mjs: ${statSync(`dist-lambda/${name}/index.mjs`).size} bytes`);
}
