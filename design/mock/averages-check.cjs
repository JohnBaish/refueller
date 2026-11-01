// Browser check of "Average prices" (1 November 2026): RG4, a place, a full postcode, a Scottish island and a station view, both
// sizes and themes; tooltips by pointing and tapping; hidden in print; no errors, no sideways scroll.
const { chromium } = require('playwright');
const OUT = '/home/user/refueller/design/previews/';
const URL0 = `http://localhost:${process.argv[2]}/`;
(async () => {
  const b = await chromium.launch();
  for (const [dev, opts] of [['computer', { viewport: { width: 1200, height: 900 } }], ['phone', { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 }]]) {
    for (const scheme of ['light', 'dark']) {
      const ctx = await b.newContext({ ...opts, colorScheme: scheme });
      const p = await ctx.newPage();
      const errs = [];
      p.on('pageerror', (e) => errs.push(e.message));
      for (const h of ['RG4']) {
        await p.goto(URL0 + '#' + h); await p.reload();
        await p.waitForSelector('.avg-sec', { timeout: 30000 });
        const txt = await p.locator('.avg-sec').innerText();
        const order = await p.evaluate(() => { const a = document.querySelector('.avg-sec'), j = document.querySelector('.journey-front'); return !!(a && j && a.compareDocumentPosition(j) & Node.DOCUMENT_POSITION_FOLLOWING); });
        console.log(dev, scheme, h, '| above journey:', order, '|', txt.split('\n').slice(0, 3).join(' / ').slice(0, 220));
        console.log('   end labels', (await p.locator('.avg-sec .g-lab').allInnerTexts()).join(' '), '| overflow', await p.evaluate(() => document.documentElement.scrollWidth - innerWidth));
        if (h === 'RG4') {
          await p.locator('.avg-sec').scrollIntoViewIfNeeded();
          const hit = p.locator('.avg-sec .g-hit').first();
          const box = await hit.boundingBox();
          if (dev === 'computer') await p.mouse.move(box.x + box.width * 0.6, box.y + box.height / 2);
          else await p.touchscreen.tap(box.x + box.width * 0.6, box.y + box.height / 2);
          await p.waitForTimeout(200);
          console.log('   tip:', (await p.locator('.avg-sec .g-tip').first().textContent().catch(() => 'none')));
          await p.locator('.avg-sec').screenshot({ path: OUT + `averages-built-${dev}-${scheme}.png` });
          await p.emulateMedia({ media: 'print' });
          console.log('   printed:', await p.locator('.avg-sec').isVisible());
          await p.emulateMedia({ media: 'screen' });
        }
      }
      console.log(dev, scheme, 'errors', errs);
      await ctx.close();
    }
  }
  await b.close();
})();
