// Mock-up pictures for the dark mode review (options 5 and 7) of Lightreader, Refueller and Hindcaster.
// Usage: node dark-review-shot-others.cjs <site> <css file or "now"> <out prefix>
// Serves expected: Lightreader on 4611, Refueller on 4612, Hindcaster on 4613 (vite preview).
const { chromium } = require('playwright');
const fs = require('fs');
const [,, site, cssFile, out] = process.argv;
const css = cssFile === 'now' ? '' : fs.readFileSync(cssFile, 'utf8');
const C = { width: 1200, height: 900 }, P = { width: 390, height: 844 };
const SITES = {
  lightreader: { init: "localStorage.setItem('lightreader.postcode','RG4')", shots: [
    { n: 'computer-rg4', vp: C, url: 'http://localhost:4611/', focus: null },
    { n: 'phone-rg4', vp: P, url: 'http://localhost:4611/', focus: null },
    { n: 'phone-light-at', vp: P, url: 'http://localhost:4611/', focus: '.light-at' } ] },
  refueller: { shots: [
    { n: 'computer-rg4', vp: C, url: 'http://localhost:4612/#RG4', click: 'table.stations .centre-link', focus: null },
    { n: 'phone-rg4', vp: P, url: 'http://localhost:4612/#RG4', click: '.sort-strip button:has-text("Unleaded price")', focus: '.cards', up: 260 },
    { n: 'phone-history', vp: P, url: 'http://localhost:4612/#RG4', click: '.pcard .centre-link', focus: '.calc', up: 500 } ] },
  hindcaster: { shots: [
    { n: 'computer-rg4', vp: C, url: 'http://localhost:4613/#postcode/RG4', focus: '.ya-section', up: 700 },
    { n: 'phone-rg4', vp: P, url: 'http://localhost:4613/#postcode/RG4', focus: '.ya-section' },
    { n: 'phone-berkshire', vp: P, url: 'http://localhost:4613/#county/berkshire', click: 'details.all-stations > summary', focus: 'details.all-stations' } ] },
};
(async () => {
  const b = await chromium.launch(); const s = SITES[site];
  for (const sh of s.shots) {
    const touch = sh.vp.width < 500;
    const ctx = await b.newContext({ viewport: sh.vp, deviceScaleFactor: 1, hasTouch: touch, isMobile: touch, colorScheme: 'dark' });
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    if (s.init) await p.addInitScript(s.init);
    await p.goto(sh.url); await p.waitForTimeout(4000);
    if (css) await p.addStyleTag({ content: css });
    if (sh.click) { const el = p.locator(sh.click).first(); if (await el.count()) { await el.click(); await p.waitForTimeout(1500); } }
    // Hindcaster: mark each year-ago card with its answer, from its own words (the built version would set a class)
    await p.evaluate(() => document.querySelectorAll('.ya-card').forEach(c => { const t = (c.querySelector('.ya-diff') || {}).textContent || ''; const m = t.match(/warmer|cooler|wetter|drier| less than| more than/); if (m) c.dataset.ya = ({' less than':'drier',' more than':'wetter'})[m[0]] || m[0]; }));
    await p.evaluate(() => window.scrollTo(0, 0)); await p.waitForTimeout(300);
    let y = 0;
    if (sh.focus) y = await p.evaluate(f => { const e = document.querySelector(f); return e ? e.getBoundingClientRect().top + scrollY : 0; }, sh.focus);
    const full = await p.evaluate(() => document.documentElement.scrollHeight);
    const top = Math.max(0, Math.min(full - 1500, y - (sh.up ?? 120)));
    await p.screenshot({ path: `${out}-${sh.n}.png`, fullPage: true, clip: { x: 0, y: top, width: sh.vp.width, height: Math.min(1500, full) } });
    const sw = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    console.log(site, cssFile === 'now' ? 'now' : 'opt57', sh.n, 'errors', errs.length, 'sideways', sw);
    await ctx.close();
  }
  await b.close();
})();
