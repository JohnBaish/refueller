// Turns the filled-in report-template.html into the fresh-look PDF (SKILL.md §6).
// Copy this file into a scratchpad folder that has Playwright installed
// (`npm i playwright` there; never `playwright install` — Chromium is already
// at /opt/pw-browsers/chromium) and run it there; Node looks for Playwright
// next to the script, not in the current folder:
//   node make-pdf.mjs <report.html> <out.pdf> <repo folder>
// Stops with an error if the brand fonts didn't load, so a PDF in fallback
// fonts is never sent.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

const [src, out, repo] = process.argv.slice(2);
if (!src || !out || !repo) {
  console.error('Usage: node make-pdf.mjs <report.html> <out.pdf> <repo folder>');
  process.exit(1);
}
const filled = resolve(src).replace(/\.html$/, '') + '.filled.html';
writeFileSync(filled, readFileSync(src, 'utf8').replaceAll('{{REPO}}', resolve(repo)));

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await browser.newPage();
await page.goto('file://' + filled);
// Load every brand face, including any the report doesn't happen to use (an unused face
// otherwise stays "unloaded"), so a wrong path is always caught.
await page.evaluate(() => Promise.allSettled([...document.fonts].map((f) => f.load())));
const fonts = await page.evaluate(() => [...document.fonts].map((f) => `${f.family} ${f.weight}: ${f.status}`));
console.log(fonts.join('\n'));
if (fonts.some((f) => !f.endsWith(': loaded'))) { // not just 'loaded': 'unloaded' ends with it too
  await browser.close();
  console.error('A brand font did not load — check the repo path and that npm ci has been run there.');
  process.exit(1);
}
await page.pdf({
  path: out, format: 'A5', preferCSSPageSize: true, printBackground: true,
  displayHeaderFooter: true, headerTemplate: '<span></span>',
  footerTemplate: '<div style="font-size:7pt;color:#888;width:100%;text-align:center"><span class="pageNumber"></span> / <span class="totalPages"></span></div>',
});
await browser.close();
console.log('Wrote', out);
