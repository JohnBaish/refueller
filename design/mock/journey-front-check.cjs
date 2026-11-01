// Pictures of the journey planner open at the bottom of the main page (1 November 2026): the postcode screen and RG4's results,
// computer and phone, light and dark; and a journey typed there opens the journey page.
const { chromium } = require('playwright');
const OUT = '/home/user/refueller/design/previews/';
const URL0 = `http://localhost:${process.argv[2]}/`;
(async () => {
  const b = await chromium.launch();
  for (const [dev, opts] of [['computer', { viewport: { width: 1200, height: 900 } }], ['phone', { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 }]]) {
    for (const scheme of ['light', 'dark']) {
      const p = await (await b.newContext({ ...opts, colorScheme: scheme })).newPage();
      const errs = [];
      p.on('pageerror', (e) => errs.push(e.message));
      await p.goto(URL0); await p.waitForSelector('.journey-front');
      await p.screenshot({ path: OUT + `journey-front-start-${dev}-${scheme}.png`, fullPage: true });
      await p.goto(URL0 + '#RG4'); await p.reload(); await p.waitForSelector('.results-head h3');
      const order = await p.evaluate(() => { const j = document.querySelector('.journey-front'), a = document.querySelector('.about'); return !!(j && a && j.compareDocumentPosition(a) & Node.DOCUMENT_POSITION_FOLLOWING); });
      await p.locator('.journey-front').scrollIntoViewIfNeeded();
      await p.screenshot({ path: OUT + `journey-front-results-${dev}-${scheme}.png`, fullPage: dev === 'computer' });
      if (scheme === 'light') {
        await p.locator('#jf-from').fill('RG1'); await p.locator('#jf-to').fill('BS1');
        await p.locator('.journey-front button[type=submit]').click();
        await p.waitForSelector('.results-head h3', { timeout: 60000 });
        await p.waitForFunction(() => location.hash.startsWith('#route/'));
        console.log(dev, 'journey from the front page:', await p.evaluate(() => location.hash), await p.locator('.results-head h3').innerText());
      }
      console.log(dev, scheme, 'section above About:', order, '| overflow', await p.evaluate(() => document.documentElement.scrollWidth - innerWidth), '| errors', errs);
    }
  }
  await b.close();
})();
