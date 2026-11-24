const { chromium } = require('playwright');
// Mock-ups (browser only): where "Share chart" sits on the compare page, and the table rows top-aligned (John, November 24th 2026).
// Run against `npx vite preview --port 4201`.
const OUT = '/home/user/refueller/design/previews/compare-share-place/';
const FIX = `.cmp-row{align-items:start}.cmp-n{align-items:flex-start}.cmp-n .cmp-sw{margin-top:.62em}`;
(async () => {
  const b = await chromium.launch();
  const out = [];
  for (const [dev, vp, touch] of [['phone', { width: 390, height: 844 }, true], ['computer', { width: 1200, height: 900 }, false]]) {
    for (const theme of ['dark', 'light']) {
      for (const opt of ['now', 'A', 'B']) {
        const ctx = await b.newContext({ viewport: vp, hasTouch: touch, isMobile: touch, deviceScaleFactor: 2, colorScheme: theme });
        const p = await ctx.newPage();
        p.on('pageerror', (e) => out.push('ERR ' + e));
        await p.goto('http://localhost:4201/#HP13');
        await p.waitForSelector('.cmp-way');
        await p.click('.cmp-way');
        await p.waitForSelector('.cmp-chart svg');
        const add = p.locator('text=+ Add the cheapest of the eight');
        if (await add.count()) { await add.click(); await p.waitForTimeout(400); }
        if (opt !== 'now') {
          await p.addStyleTag({ content: FIX + `.mock-share{display:flex;margin-top:14px}.mock-share.A{justify-content:flex-end;margin-bottom:-6px}.mock-share.B{justify-content:flex-start}` });
          await p.evaluate((opt) => {
            const s = document.querySelector('.cmp-controls .share-wrap');
            const t = document.querySelector('.cmp-table');
            const d = document.createElement('div');
            d.className = 'mock-share ' + opt;
            d.appendChild(s);
            if (opt === 'A') t.before(d); else t.after(d);
            s.style.marginLeft = '0';
          }, opt);
        }
        await p.waitForTimeout(200);
        const top = await p.evaluate(() => document.querySelector('.cmp-controls').getBoundingClientRect().top + scrollY - 16);
        const bot = await p.evaluate(() => { const els = [...document.querySelectorAll('.cmp-table, .mock-share')]; return Math.max(...els.map((e) => e.getBoundingClientRect().bottom)) + scrollY + 24; });
        out.push(`${dev} ${theme} ${opt}: sideways ${await p.evaluate(() => document.documentElement.scrollWidth > innerWidth)}`);
        await p.screenshot({ path: `${OUT}${opt}-${dev}-${theme}.png`, fullPage: true, clip: { x: 0, y: top, width: vp.width, height: bot - top } });
        await ctx.close();
      }
    }
  }
  await b.close();
  console.log(out.join('\n'));
})();
