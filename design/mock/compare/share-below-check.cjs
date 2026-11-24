const { chromium } = require('playwright');
// Check (John, November 24th 2026): "Share chart" below the compare table on the left; rows top-aligned. Run against `npx vite preview --port 4201`.
const OUT = '/home/user/refueller/design/previews/compare-share-place/';
(async () => {
  const b = await chromium.launch();
  const out = [];
  for (const [dev, vp, touch] of [['phone', { width: 390, height: 844 }, true], ['sideways', { width: 844, height: 390 }, true], ['computer', { width: 1200, height: 900 }, false]]) {
    for (const theme of ['dark', 'light']) {
      const ctx = await b.newContext({ viewport: vp, hasTouch: touch, isMobile: touch, deviceScaleFactor: 2, colorScheme: theme });
      if (!touch) await ctx.grantPermissions(['clipboard-read', 'clipboard-write']);
      const p = await ctx.newPage();
      p.on('pageerror', (e) => out.push('ERR ' + e));
      await p.goto('http://localhost:4201/#HP13');
      await p.waitForSelector('.cmp-way');
      await p.click('.cmp-way');
      await p.waitForSelector('.cmp-chart svg');
      const add = p.locator('text=+ Add the cheapest of the eight');
      if (await add.count()) { await add.click(); await p.waitForTimeout(400); }
      const r = await p.evaluate(() => {
        const t = document.querySelector('.cmp-table').getBoundingClientRect();
        const s = document.querySelector('.cmp-share').getBoundingClientRect();
        const rows = [...document.querySelectorAll('.cmp-row')].map((e) => e.getBoundingClientRect());
        const overlap = rows.some((r, i) => i && [...rows[i].height ? [r] : []] && document.querySelectorAll('.cmp-row')[i].querySelector('.cmp-n')?.getBoundingClientRect().bottom > r.bottom + 1);
        return { below: s.top > t.bottom, left: Math.round(s.left - t.left), inControls: !!document.querySelector('.cmp-controls .cmp-share'), overlap, side: document.documentElement.scrollWidth > innerWidth };
      });
      let copied = '';
      if (!touch) { await p.click('.cmp-share'); await p.waitForTimeout(800); copied = await p.$eval('.share-status', (e) => e.textContent); }
      out.push(`${dev} ${theme}: ${JSON.stringify(r)} ${copied}`);
      const top = await p.evaluate(() => document.querySelector('.cmp-controls').getBoundingClientRect().top + scrollY - 16);
      const bot = await p.evaluate(() => document.querySelector('.cmp-share-row').getBoundingClientRect().bottom + scrollY + 40);
      await p.screenshot({ path: `${OUT}built-${dev}-${theme}.png`, fullPage: true, clip: { x: 0, y: top, width: vp.width, height: bot - top } });
      await ctx.close();
    }
  }
  await b.close();
  console.log(out.join('\n'));
})();
