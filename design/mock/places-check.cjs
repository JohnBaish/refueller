// Browser check of place names in the journey planner (1 November 2026): suggestions as you type (keys, mouse, tap), the examples
// in the boxes, Reading to Exeter via Andover, same-name places, Via with a postcode, both sizes and themes, and no request
// carrying what was typed.
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
      const asked = [];
      p.on('pageerror', (e) => errs.push(e.message));
      p.on('request', (r) => asked.push(r.url()));
      const log = (...a) => console.log(dev, scheme, ...a);
      await p.goto(URL0 + '#route'); await p.reload(); await p.waitForSelector('#jf-from');
      log('examples:', await p.locator('#jf-from').getAttribute('placeholder'), '|', await p.locator('#jf-via').getAttribute('placeholder'), '|', await p.locator('#jf-to').getAttribute('placeholder'));
      log('hint:', await p.locator('.hint').innerText());
      // From: type and choose with the keyboard (computer) or a tap (phone).
      await p.locator('#jf-from').fill('Readi');
      await p.waitForSelector('#jf-from-list li');
      log('suggestions for "Readi":', (await p.locator('#jf-from-list li').allInnerTexts()).map((t) => t.replace('\n', ' · ')).join(' | '));
      if (dev === 'computer') { await p.keyboard.press('ArrowDown'); await p.keyboard.press('Enter'); } else await p.locator('#jf-from-list li').first().tap();
      log('From now:', await p.locator('#jf-from').inputValue());
      await p.locator('#jf-via').fill('andov');
      await p.waitForSelector('#jf-via-list li');
      if (scheme === 'light') await p.screenshot({ path: OUT + `places-suggest-${dev}.png` });
      await (dev === 'computer' ? p.locator('#jf-via-list li').first().click() : p.locator('#jf-via-list li').first().tap());
      await p.locator('#jf-to').fill('Exeter');
      await p.locator('.search.journey button').click();
      await p.waitForSelector('.results-head h3', { timeout: 60000 });
      log('heading:', await p.locator('.results-head h3').innerText(), '| address', decodeURIComponent(p.url().replace(/^[^#]*/, '')));
      log('notes:', (await p.locator('.notes').innerText()).slice(0, 120));
      log('ends:', await p.locator('.grp').allTextContents());
      log('overflow', await p.evaluate(() => document.documentElement.scrollWidth - innerWidth));
      if (scheme === 'light') await p.screenshot({ path: OUT + `places-result-${dev}.png`, fullPage: dev === 'computer' });
      if (scheme === 'light') {
        // Newport alone, Via with a postcode, an unknown place, and a postcode in From with a place in To.
        for (const [from, via, to] of [['RG1', '', 'Newport'], ['RG1', 'SP10', 'EX4'], ['RG1', '', 'Xyzzyton'], ['RG1 8FR', 'Royal Wootton Bassett', 'EX4 6TJ']]) {
          await p.goto(URL0 + '#route'); await p.reload(); await p.waitForSelector('#jf-from');
          await p.locator('#jf-from').fill(from); await p.locator('#jf-via').fill(via); await p.locator('#jf-to').fill(to);
          await p.waitForTimeout(400); await p.locator('h2').click();
          await p.locator('.search.journey button').click();
          await p.waitForSelector('.problem, .results-head h3', { timeout: 60000 });
          const prob = await p.locator('.problem').count();
          log(`[${from} | ${via} | ${to}]`, prob ? 'problem: ' + (await p.locator('.problem').innerText()) : 'heading: ' + (await p.locator('.results-head h3').innerText()) + ' | ' + (await p.locator('.notes').innerText()).slice(0, 60));
        }
      }
      const leaks = asked.filter((u) => /reading|exeter|andover|newport|xyzzy|wootton/i.test(u.replace(/#.*$/, '')));
      log('errors', errs, '| requests carrying what was typed', leaks);
      await ctx.close();
    }
  }
  await b.close();
})();
