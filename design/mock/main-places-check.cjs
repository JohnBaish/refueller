// Browser check of place names in the main search (1 November 2026): suggestions, a place's results and calculator note,
// remembered choice, postcodes still working, messages, both sizes and themes, and no request carrying what was typed.
const { chromium } = require('playwright');
const OUT = '/home/user/refueller/design/previews/';
const URL0 = `http://localhost:${process.argv[2]}/`;
(async () => {
  const b = await chromium.launch();
  for (const [dev, opts] of [['computer', { viewport: { width: 1200, height: 900 } }], ['phone', { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 }]]) {
    for (const scheme of ['light', 'dark']) {
      const ctx = await b.newContext({ ...opts, colorScheme: scheme });
      const p = await ctx.newPage();
      const errs = [], asked = [];
      p.on('pageerror', (e) => errs.push(e.message));
      p.on('request', (r) => asked.push(r.url()));
      const log = (...a) => console.log(dev, scheme, ...a);
      await p.goto(URL0); await p.waitForSelector('#where');
      log('example:', await p.locator('#where').getAttribute('placeholder'), '| hint:', await p.locator('.hint').innerText());
      await p.locator('#where').fill('Caversh');
      await p.waitForSelector('#where-list li');
      log('suggestions:', (await p.locator('#where-list li').allInnerTexts()).map((t) => t.replace('\n', ' · ')).join(' | '));
      if (scheme === 'light') await p.screenshot({ path: OUT + `main-places-suggest-${dev}.png` });
      if (dev === 'computer') { await p.keyboard.press('ArrowDown'); await p.keyboard.press('Enter'); await p.keyboard.press('Enter'); }
      else { await p.locator('#where-list li').first().tap(); await p.locator('.search button').tap(); }
      await p.waitForSelector('.results-head h3', { timeout: 30000 });
      log('heading:', await p.locator('.results-head h3').innerText(), '| address', decodeURIComponent(p.url().replace(/^[^#]*/, '')));
      log('notes:', (await p.locator('.notes').innerText()).slice(0, 80));
      const worth = p.locator('text=Worth driving here?').first();
      if (await worth.count()) {
        await worth.click();
        await p.waitForSelector('.calc');
        await p.waitForTimeout(500);
        const t = await p.locator('.calc').innerText();
        log('calc note:', (t.match(/The extra miles[^.]*\./) || ['(none)'])[0]);
        if (scheme === 'light') await p.screenshot({ path: OUT + `main-places-calc-${dev}.png`, fullPage: dev === 'computer' });
      } else log('no calculator link on this list');
      log('overflow', await p.evaluate(() => document.documentElement.scrollWidth - innerWidth));
      // Remembered: open the bare page again.
      await p.goto(URL0); await p.waitForSelector('.results-head h3', { timeout: 30000 });
      log('reopened on:', await p.locator('.results-head h3').innerText(), '| box', await p.locator('#where').inputValue());
      if (scheme === 'light') {
        for (const typed of ['rg4 7hn', 'RG4', 'Newport', 'Newport, Isle of Wight', 'Xyzzyton', 'BT1', 'Theale, West Berkshire', 'Sheringham']) {
          await p.locator('#where').fill(typed);
          await p.waitForTimeout(300);
          await p.locator('h2').click();
          await p.locator('.search button').click();
          await p.waitForTimeout(1200);
          const prob = await p.locator('.problem').count();
          let extra = '';
          if (!prob && /Theale|Sheringham/.test(typed)) {
            const w = p.locator('text=Worth driving here?').first();
            if (await w.count()) { await w.click(); await p.waitForSelector('.calc'); extra = ' | ' + ((await p.locator('.calc').innerText()).match(/The extra miles[^.]*\./) || [''])[0]; }
          }
          log(`[${typed}]`, prob ? 'problem: ' + (await p.locator('.problem').innerText()) : 'heading: ' + (await p.locator('.results-head h3').innerText()) + extra);
        }
      }
      const leaks = asked.filter((u) => /cavers|newport|xyzzy|theale|shering|7hn/i.test(u.replace(/#.*$/, '')));
      log('errors', errs, '| requests carrying what was typed', leaks);
      await ctx.close();
    }
  }
  await b.close();
})();
