// Browser check (1 November 2026): the journey notes describe the route: Wokingham to Horsham, with and without Guildford as a via.
const { chromium } = require('playwright');
const URL0 = `http://localhost:${process.argv[2]}/`;
(async () => {
  const b = await chromium.launch();
  for (const [dev, opts] of [['computer', { viewport: { width: 1200, height: 900 } }], ['phone', { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 }]]) {
    for (const scheme of ['light', 'dark']) {
      const p = await (await b.newContext({ ...opts, colorScheme: scheme })).newPage();
      const errs = [];
      p.on('pageerror', (e) => errs.push(e.message));
      for (const h of ['route/@Wokingham/@Horsham', 'route/@Wokingham/@Horsham/@Guildford, Surrey', 'route/RG1/BS1']) {
        await p.goto(URL0 + '#' + h); await p.reload();
        await p.waitForSelector('.results-head h3, .message[role=alert]', { timeout: 60000 });
        const n = await p.locator('.notes').count() ? await p.locator('.notes').innerText() : await p.locator('.message[role=alert]').innerText();
        console.log(dev, scheme, h, '|', n.split('. For a different')[0].slice(0, 230), '| overflow', await p.evaluate(() => document.documentElement.scrollWidth - innerWidth));
        if (scheme === 'light' && h.endsWith('@Horsham')) await p.locator('.results-head').screenshot({ path: `/home/user/refueller/design/previews/route-words-${dev}.png` }).catch(() => {});
        if (scheme === 'light' && h.endsWith('@Horsham')) { const box = await p.locator('.results-head').boundingBox(); const nb = await p.locator('.notes').boundingBox(); await p.screenshot({ path: `/home/user/refueller/design/previews/route-words-${dev}.png`, clip: { x: 0, y: box.y - 10, width: opts.viewport.width, height: nb.y + nb.height - box.y + 20 } }); }
      }
      console.log(dev, scheme, 'errors', errs);
      await p.context().close();
    }
  }
  await b.close();
})();
