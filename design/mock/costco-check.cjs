const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  for (const [dev, opts] of [['computer', { viewport: { width: 1200, height: 900 } }], ['phone', { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 }]]) for (const scheme of ['light', 'dark']) {
    const ctx = await b.newContext({ ...opts, colorScheme: scheme }); const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
    await p.goto('http://localhost:4191/#RG2'); await p.reload(); await p.waitForSelector('.sname');
    const n = await p.locator('.members').count();
    const el = dev === 'computer' ? p.locator('tbody tr', { has: p.locator('.members') }).first() : p.locator('.pcard', { has: p.locator('.members') }).first();
    if (n) await el.screenshot({ path: `/home/user/refueller/design/previews/costco-${dev}-${scheme}.png` });
    console.log(dev, scheme, 'members notes', n, 'overflow', await p.evaluate(() => document.documentElement.scrollWidth - innerWidth), errs);
    await ctx.close();
  }
  await b.close();
})();
