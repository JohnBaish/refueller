// Browser check (1 November 2026): where a members-only Costco is the cheapest near an end, that end shows the cheapest anyone can buy
// and then the Costco; both sizes and themes.
const { chromium } = require('playwright');
const URL0 = `http://localhost:${process.argv[2]}/`;
(async () => {
  const b = await chromium.launch();
  for (const [dev, opts] of [['computer', { viewport: { width: 1200, height: 900 } }], ['phone', { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 }]]) {
    for (const scheme of ['light', 'dark']) {
      const p = await (await b.newContext({ ...opts, colorScheme: scheme })).newPage();
      const errs = [];
      p.on('pageerror', (e) => errs.push(e.message));
      for (const h of ['route/RG2/BS1', 'route/CV1/B7', 'route/AB32/DD1']) {
        await p.goto(URL0 + '#' + h); await p.reload();
        await p.waitForSelector('.results-head h3', { timeout: 60000 });
        const rows = await p.evaluate((dev) => {
          const out = []; let grp = '';
          const items = dev === 'computer' ? document.querySelectorAll('tbody tr') : document.querySelectorAll('.cards > *');
          for (const el of items) {
            const g = el.querySelector('.grp'); if (g) { grp = g.textContent; if (dev === 'computer') continue; }
            const n = el.querySelector('.sname'); if (!n) continue;
            const tags = [...el.querySelectorAll('.cheapest-tag, .members-tag, .tag')].map((t) => t.textContent.trim()).join('+');
            const rank = el.querySelector('.rank-text, .rank')?.textContent?.trim() ?? '';
            out.push(`${grp}: ${n.textContent}${el.querySelector('.members') ? ' [Members only]' : ''}${tags ? ' {' + tags + '}' : ''} ${rank}`);
          }
          return out;
        }, dev);
        console.log(dev, scheme, h, rows.length, 'rows');
        if (scheme === 'light') for (const r of rows) if (!/On the way/.test(r)) console.log('   ', r);
        console.log('   overflow', await p.evaluate(() => document.documentElement.scrollWidth - innerWidth));
        if (scheme === 'light' && h === 'route/RG2/BS1') await p.screenshot({ path: `/home/user/refueller/design/previews/journey-costco-ends-${dev}.png`, fullPage: true });
      }
      console.log(dev, scheme, 'errors', errs);
    }
  }
  await b.close();
})();
