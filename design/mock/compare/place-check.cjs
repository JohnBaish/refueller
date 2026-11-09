const { chromium } = require('playwright');
// Your scenario (John, November 9th 2026): RG4, compare, change things, back, PE38, compare. Run against `npx vite preview --port 4200`.
const OUT = '/home/user/refueller/design/previews/compare-cheapest/';
const B = 'http://localhost:4200/';
(async () => {
  const b = await chromium.launch();
  const out = [];
  for (const [dev, vp, touch] of [['computer', { width: 1200, height: 900 }, false], ['phone', { width: 390, height: 844 }, true]]) {
    for (const theme of ['light', 'dark']) {
      if (dev === 'computer' && theme === 'dark') continue;
      const ctx = await b.newContext({ viewport: vp, hasTouch: touch, isMobile: touch, deviceScaleFactor: 2, colorScheme: theme });
      const p = await ctx.newPage();
      p.on('pageerror', (e) => out.push('ERR ' + e));
      const chips = () => p.$$eval('.cmp-chip', (e) => e.map((x) => x.innerText.replace(/\s+/g, ' ').replace(' ✕', '').trim()).join(' / '));
      await p.goto(B + '#RG4-7SS');
      await p.waitForSelector('.cmp-way');
      await p.click('.cmp-way');
      await p.waitForSelector('.cmp-chart svg');
      out.push(`${dev} ${theme} RG4 first: ${await chips()}`);
      const addCheap = await p.$('text=+ Add the cheapest of the eight');
      out.push(`  offer: ${addCheap ? (await addCheap.innerText()).trim() : 'none'}`);
      await addCheap.click();
      await p.waitForTimeout(200);
      out.push(`  when full: ${await p.$$eval('.cmp-note', (e) => e.map((x) => x.innerText).join(' | '))}`);
      await p.click('[aria-label="Remove Berkshire"]');
      await p.click('text=+ Add the cheapest of the eight');
      await p.waitForTimeout(300);
      await p.click('.cmp-controls >> text=Diesel');
      await p.waitForTimeout(300);
      out.push(`  after adding: ${await chips()}`);
      out.push(`  table: ${(await p.$$eval('.cmp-row:not(.cmp-head)', (e) => e.map((x) => x.innerText.replace(/\s+/g, ' ').trim()))).join(' | ')}`);
      await p.screenshot({ path: `${OUT}rg4-cheapest-${dev}-${theme}.png`, fullPage: true });
      await p.click('.back-big');
      await p.waitForSelector('.cmp-way');
      await p.goto(B + '#PE38');
      await p.waitForSelector('.cmp-way');
      await p.click('.cmp-way');
      await p.waitForSelector('.cmp-chart svg');
      out.push(`  PE38 next: ${await chips()}; fuel ${await p.$eval('.cmp-controls [aria-pressed="true"].fuel-btn', (e) => e.innerText)}`);
      out.push(`  PE38 offer: ${((await (await p.$('text=+ Add the cheapest of the eight'))?.innerText()) ?? 'none').trim()}`);
      await p.screenshot({ path: `${OUT}pe38-${dev}-${theme}.png`, fullPage: true });
      await p.goto(B + '#RG4-7SS');
      await p.waitForSelector('.cmp-way');
      await p.click('.cmp-way');
      await p.waitForSelector('.cmp-chart svg');
      out.push(`  RG4 again: ${await chips()}`);
      await p.click('.cmp-controls >> text=Both');
      await p.waitForTimeout(300);
      out.push(`  both: ${await p.$$eval('.cmp-row:not(.cmp-head)', (e) => e.map((x) => x.innerText.replace(/\s+/g, ' ').trim()).join(' | '))}`);
      out.push(`  sideways scroll: ${await p.evaluate(() => document.documentElement.scrollWidth > innerWidth)}`);
      await ctx.close();
    }
  }
  await b.close();
  console.log(out.join('\n'));
})();
