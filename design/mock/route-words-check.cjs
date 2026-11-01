// Browser check (1 November 2026): the route described in places and roads, several journeys, both sizes and themes; and the time a
// journey takes with the processor slowed to phone speed (4x).
const { chromium } = require('playwright');
const URL0 = `http://localhost:${process.argv[2]}/`;
const trips = ['route/@Caversham/@Downham Market', 'route/@London/@Birmingham', 'route/@Wokingham/@Horsham', 'route/@Wokingham/@Horsham/@Guildford, Surrey', 'route/RG1/BS1', 'route/@Bath/@Southampton', 'route/@Carlisle/@Newcastle upon Tyne', 'route/@York/@Scarborough, North Yorkshire', 'route/CF10/BS1'];
(async () => {
  const b = await chromium.launch();
  for (const [dev, opts] of [['computer', { viewport: { width: 1200, height: 900 } }], ['phone', { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 }]]) {
    for (const scheme of ['light', 'dark']) {
      const ctx = await b.newContext({ ...opts, colorScheme: scheme });
      const p = await ctx.newPage();
      const errs = [];
      p.on('pageerror', (e) => errs.push(e.message));
      for (const h of trips) {
        await p.goto(URL0 + '#' + h); await p.reload();
        await p.waitForSelector('.results-head h3, .message[role=alert]', { timeout: 60000 });
        const n = (await p.locator('.notes').count()) ? await p.locator('.notes').innerText() : await p.locator('.message[role=alert]').innerText();
        if (scheme === 'light') console.log(dev, '|', n.split(' Prices collected')[0].split('. Of the')[0]);
      }
      console.log(dev, scheme, 'overflow', await p.evaluate(() => document.documentElement.scrollWidth - innerWidth), 'errors', errs);
      if (dev === 'phone' && scheme === 'light') {
        const cdp = await ctx.newCDPSession(p);
        await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
        for (const h of ['route/@Wokingham/@Horsham', 'route/@London/@Birmingham']) {
          await p.goto(URL0); await p.goto(URL0 + '#' + h); await p.reload();
          const t0 = Date.now();
          await p.waitForSelector('.results-head h3', { timeout: 120000 });
          console.log('   phone speed', h, ((Date.now() - t0) / 1000).toFixed(1), 's (with loading)');
        }
      }
      await ctx.close();
    }
  }
  await b.close();
})();
