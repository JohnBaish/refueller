// Browser check of the built journey planner (31 October 2026): the way in, the form, real journeys, messages, both sizes and
// themes, sideways scroll, errors, and that no request carries what was typed.
const { chromium } = require('playwright');
const OUT = '/home/user/refueller/design/previews/';
const PORT = process.argv[2];
const URL = `http://localhost:${PORT}/`;

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
      const over = () => p.evaluate(() => document.documentElement.scrollWidth - innerWidth);

      await p.goto(URL); await p.evaluate(() => localStorage.clear()); await p.goto(URL + '#'); await p.reload();
      await p.waitForSelector('.journey-link');
      log('start link:', await p.locator('.journey-link').innerText());
      if (scheme === 'light') await p.screenshot({ path: OUT + `journey-built-start-${dev}.png`, fullPage: true });
      await p.click('.journey-link a');
      await p.waitForSelector('.search.journey');
      log('form page heading:', await p.locator('h2').innerText(), '| address', p.url().replace(/^[^#]*/, ""));

      // Reading to Bristol, typed.
      const boxes = p.locator('.search.journey input');
      await boxes.nth(0).fill('rg1');
      await boxes.nth(2).fill('BS1');
      const t0 = Date.now();
      await p.click('.search.journey button');
      await p.waitForSelector('.results-head h3', { timeout: 30000 });
      log('RG1 to BS1 in', Date.now() - t0, 'ms:', await p.locator('.results-head h3').innerText(), '| address', p.url().replace(/^[^#]*/, ""));
      log('  notes:', (await p.locator('.notes').innerText()).slice(0, 150));
      const rows = await p.evaluate((phone) => {
        const items = phone ? [...document.querySelectorAll('.pcard')] : [...document.querySelectorAll('tbody tr')];
        return items.map((el) => el.querySelector('.sname').textContent + ' ' + el.querySelector('.price').textContent + ' ' + (el.innerText.match(/(\d+|less than 0\.1|\d\.\d) miles from the start/) || [''])[0]);
      }, dev === 'phone');
      log('  rows:', rows.join(' | '));
      log('  overflow', await over());
      await p.screenshot({ path: OUT + `journey-built-RG1-BS1-${dev}-${scheme}.png`, fullPage: dev === 'computer' });
      if (dev === 'phone' && scheme === 'light') await p.locator('.pcard').first().screenshot({ path: OUT + `journey-built-card-phone.png` });

      // Diesel.
      await p.click('.route-fuel .fuel-btn:nth-child(2)');
      log('diesel heading col/label:', dev === 'computer' ? await p.locator('thead th').nth(3).innerText() : await p.locator('.pcard .lbl').first().innerText(), '| first price', await p.locator('.price').first().innerText());

      if (scheme === 'light') {
        // A via, a full postcode, and a full postcode that doesn't exist.
        await p.goto(URL + '#route/RG1-8FR/BS1/OX1'); await p.waitForSelector('.results-head h3', { timeout: 30000 });
        log('via:', await p.locator('.results-head h3').innerText(), '|', (await p.locator('.notes').innerText()).slice(0, 80));
        await p.goto(URL + '#route/RG1-7ZZ/BS1'); await p.waitForSelector('.notes', { timeout: 30000 });
        log('not found:', (await p.locator('.notes').innerText()).slice(0, 110));
        // Cardiff to Bristol: Costco.
        await p.goto(URL + '#route/CF10/BS1'); await p.waitForSelector('.results-head h3', { timeout: 30000 });
        await p.click('.route-fuel .fuel-btn:nth-child(1)');
        log('CF10 to BS1 badges:', (await p.locator('.cheap-tag').allTextContents()).join(', '), '| members notes', await p.locator('.members').count());
        if (dev === 'computer') await p.screenshot({ path: OUT + `journey-built-CF10-BS1-computer.png`, fullPage: true });
        // No road: Truro to the Isles of Scilly.
        await p.goto(URL + '#route/TR1/TR21'); await p.waitForSelector('.message', { timeout: 30000 });
        log('no road:', await p.locator('.message').innerText());
        // A typing mistake.
        await p.goto(URL + '#route'); await p.reload(); await p.waitForSelector('.search.journey');
        await p.locator('.search.journey input').nth(0).fill('RG1');
        await p.locator('.search.journey input').nth(2).fill('BT1');
        await p.click('.search.journey button');
        await p.waitForSelector('.problem');
        log('problem:', await p.locator('.problem').innerText());
        // The way in below a list of results, and the remembered postcode not replaced by a journey.
        await p.goto(URL + '#RG4'); await p.reload(); await p.waitForSelector('.sname');
        log('below the list:', await p.locator('.journey-link').count(), '| remembered', await p.evaluate(() => localStorage.getItem('refueller.choice')));
        await p.goto(URL + '#route/RG1/BS1'); await p.waitForSelector('.results-head h3', { timeout: 30000 });
        log('remembered after a journey:', await p.evaluate(() => localStorage.getItem('refueller.choice')));
        await p.emulateMedia({ media: 'print' });
        log('print hides the way in on results:', await p.goto(URL + '#RG4').then(() => p.reload()).then(() => p.waitForSelector('.sname')).then(() => p.locator('.journey-link').isVisible()));
        await p.emulateMedia({ media: 'screen' });
      }
      const leaks = asked.filter((u) => /RG1|BS1|BT1|OX1|CF10|TR21/i.test(u.replace(/#.*$/, '')) && !/\/data\/\d|postcodes-|\/(RG|BS|OX|CF|TR|SN|BA|GL|NP)\.json/.test(u));
      log('errors', errs, '| requests carrying what was typed', leaks);
      log('road file requested', asked.filter((u) => /route-.*\.json/.test(u)).length, 'time(s)');
      await ctx.close();
    }
  }
  await b.close();
})();
