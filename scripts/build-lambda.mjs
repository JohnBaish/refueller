// Builds the Lambda package: lambda/handler.ts and what it imports, bundled into ONE plain JavaScript file
// (dist-lambda/index.mjs), with nothing else from this repo or from npm inside it. A zip of it is made by the workflow.
import { build } from 'esbuild';
import { mkdirSync, rmSync, statSync } from 'node:fs';

rmSync('dist-lambda', { recursive: true, force: true });
mkdirSync('dist-lambda', { recursive: true });
await build({
  entryPoints: ['lambda/handler.ts'],
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  outfile: 'dist-lambda/index.mjs',
  legalComments: 'none',
  sourcemap: false,
  minify: false,
  logLevel: 'info',
});
console.log(`dist-lambda/index.mjs: ${statSync('dist-lambda/index.mjs').size} bytes`);
