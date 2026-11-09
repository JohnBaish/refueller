const { chromium } = require('playwright');
// Five lines: RG4's four areas and the cheapest of the eight (John, November 9th 2026). Run against `npx vite preview --port 4201`.
const OUT = '/home/user/refueller/design/previews/compare-cheapest/';
(async () => {
  const b = await chromium.launch();
  const out = [];
  for (const [dev, vp, touch] of [['computer', { width: 1200, height: 900 }, false], ['phone', { width: 390, height: 844 }, true]]) {
    for (const theme of ['light', 'dark']) {
      const ctx = await b.newContext({ viewport: vp, hasTouch: touch, isMobile: touch, deviceScaleFactor: 2, colorScheme: theme });
      const p = await ctx.newPage();
      p.on('pageerror', (e) => out.push('ERR ' + e));
      await p.goto('http://localhost:4201/#RG4-7SS');
      await p.waitForSelector('.cmp-way');
      await p.click('.cmp-way');
      await p.waitForSelector('.cmp-chart svg');
      await p.click('text=+ Add the cheapest of the eight');
      await p.waitForTimeout(400);
      const lines = await p.$$eval('.cmp-line', (e) => e.length);
      const chips = await p.$$eval('.cmp-chip', (e) => e.length);
      out.push(`${dev} ${theme}: ${chips} chips, ${lines} lines; notes: ${await p.$$eval('.cmp-box .cmp-note', (e) => e.map((x) => x.innerText).join(' | '))}; sideways ${await p.evaluate(() => document.documentElement.scrollWidth > innerWidth)}`);
      await p.screenshot({ path: `${OUT}five-${dev}-${theme}.png`, fullPage: true });
      if (dev === 'computer' && theme === 'light') {
        await p.click('.cmp-controls >> text=Both');
        await p.waitForTimeout(300);
        await p.click('.cmp-chip.off >> text=Cheapest of the eight');
        await p.waitForTimeout(300);
        out.push(`  both with cheapest: ${await p.$$eval('.cmp-row:not(.cmp-head)', (e) => e.map((x) => x.innerText.replace(/\s+/g, ' ').trim()).join(' | '))}`);
        await p.screenshot({ path: `${OUT}five-both-computer-light.png`, fullPage: true });
        await p.click('.cmp-controls >> text=Unleaded');
        await p.reload();
        await p.waitForSelector('.cmp-chart svg');
        out.push(`  after reload: ${await p.$$eval('.cmp-chip', (e) => e.length)} chips`);
      }
      await ctx.close();
    }
  }
  await b.close();
  console.log(out.join('\n'));
})();
