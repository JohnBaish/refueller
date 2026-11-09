const { chromium } = require('playwright');
// Checks the built "Compare areas over time" page (November 9th 2026). Run against `npx vite preview --port 4197`.
const OUT = '/home/user/refueller/design/previews/compare-built/';
const B = 'http://localhost:4197/';
const out = [];
const fail = (m) => out.push('FAIL ' + m);
const ok = (m) => out.push('ok   ' + m);
(async () => {
  const b = await chromium.launch();
  const errors = [];
  const sizes = [['computer', { width: 1200, height: 900 }, false], ['phone', { width: 390, height: 844 }, true], ['sideways', { width: 844, height: 390 }, true]];
  for (const [dev, viewport, touch] of sizes) for (const theme of ['light', 'dark']) {
    if (dev === 'sideways' && theme === 'dark') continue;
    const ctx = await b.newContext({ viewport, hasTouch: touch, isMobile: touch, deviceScaleFactor: 2, colorScheme: theme, acceptDownloads: true });
    const p = await ctx.newPage();
    const urls = [];
    p.on('pageerror', (e) => errors.push(`${dev} ${String(e)}`));
    p.on('console', (m) => m.type() === 'error' && !/insights|404/.test(m.text()) && errors.push(`${dev} console ${m.text()}`));
    p.on('request', (r) => urls.push(r.url()));
    const sw = async (what) => { if ((await p.evaluate(() => document.documentElement.scrollWidth)) > viewport.width) fail(`${dev} ${theme} sideways scroll on ${what}`); };
    await p.goto(B + '#RG4-7SS');
    await p.waitForSelector('.cmp-way', { timeout: 20000 });
    const way = await p.$('.cmp-way');
    await way.scrollIntoViewIfNeeded();
    if (theme === 'light') {
      await (await p.$('.avg-sec')).screenshot({ path: `${OUT}main-${dev}.png` });
    }
    await sw('main');
    await way.click();
    await p.waitForSelector('.cmp-chart svg', { timeout: 20000 });
    const chips = await p.$$eval('.cmp-chip', (els) => els.map((e) => e.innerText.replace(/\s+/g, ' ').trim()));
    (/Reading.*Berkshire.*South East England.*Great Britain/.test(chips.join('|')) ? ok : fail)(`${dev} ${theme} default chips: ${chips.join(' / ')}`);
    const nLines = await p.$$eval('.cmp-line', (e) => e.length);
    (nLines === 4 ? ok : fail)(`${dev} ${theme} four lines (${nLines})`);
    const head = await p.$eval('.cmp-head', (e) => e.innerText.replace(/\s+/g, ' '));
    (/Change since October 30th/i.test(head) ? ok : fail)(`${dev} table head "${head}"`);
    await sw('compare');
    await p.screenshot({ path: `${OUT}compare-unleaded-${dev}-${theme}.png`, fullPage: true });
    await p.click('.cmp-controls >> text=Both');
    await p.waitForTimeout(200);
    const both = await p.evaluate(() => ({ lines: document.querySelectorAll('.cmp-line').length, dotted: document.querySelectorAll('.cmp-line.dot').length, off: document.querySelectorAll('.cmp-chip.off').length }));
    (both.lines === 4 && both.dotted === 2 && both.off === 2 ? ok : fail)(`${dev} both: ${JSON.stringify(both)}`);
    ((await p.$$eval('.cmp-zero', (e) => e.length)) === 1 ? ok : fail)(`${dev} change view has its 0p line`);
    await sw('both');
    await p.screenshot({ path: `${OUT}compare-both-change-${dev}-${theme}.png`, fullPage: true });
    if (theme === 'light') {
      await p.click('.cmp-pills >> text=Prices');
      await p.waitForTimeout(150);
      ((await p.$$eval('.cmp-zero', (e) => e.length)) === 0 ? ok : fail)(`${dev} prices view`);
      await p.screenshot({ path: `${OUT}compare-both-price-${dev}.png`, fullPage: true });
      await p.click('.cmp-pills >> text=Change');
      await p.click('.cmp-chip.off >> text=Berkshire');
      await p.waitForTimeout(150);
      const lab = await p.$$eval('.cmp-n', (e) => e.map((x) => x.innerText.trim()));
      (lab.some((l) => l.startsWith('Berkshire')) && lab.some((l) => l.startsWith('Great Britain')) && !lab.some((l) => l.startsWith('Reading')) ? ok : fail)(`${dev} swap in Berkshire: ${lab.join(', ')}`);
      await p.click('.cmp-controls >> text=Diesel');
      await p.click('[aria-label="Remove Berkshire"]');
      await p.click('.cmp-add');
      await p.fill('#cmp-add', 'Woodl');
      await p.waitForSelector('.suggest li:has-text("Wokingham council area")', { timeout: 15000 });
      ok(`${dev} suggestions: ${(await p.$$eval('.suggest li', (e) => e.map((x) => x.innerText.replace(/\s+/g, ' ')))).join(' / ')}`);
      await sw('suggestions');
      await p.screenshot({ path: `${OUT}compare-woodley-list-${dev}.png`, fullPage: true });
      await p.click('.suggest li:has-text("in Wokingham council area")');
      await p.waitForTimeout(500);
      const note = await p.$$eval('.cmp-note', (e) => e.map((x) => x.innerText).join(' | '));
      (/is in Wokingham’s council area, so that’s the average shown/.test(note) ? ok : fail)(`${dev} Woodley note: ${note}`);
      await p.waitForSelector('.cmp-line');
      await p.screenshot({ path: `${OUT}compare-woodley-${dev}.png`, fullPage: true });
      await p.reload();
      await p.waitForSelector('.cmp-chart svg', { timeout: 20000 });
      const after = await p.$$eval('.cmp-chip', (els) => els.map((e) => e.innerText.replace(/\s+/g, ' ').trim()).join(' / '));
      const fuel = await p.$eval('.cmp-controls [aria-pressed="true"].fuel-btn', (e) => e.innerText);
      (/Wokingham/.test(after) && !/Berkshire/.test(after) && fuel === 'Diesel' ? ok : fail)(`${dev} kept after reload: ${after}, ${fuel}`);
      const dl = p.waitForEvent('download', { timeout: 8000 }).catch(() => null);
      await p.click('.cmp-share');
      const d = await dl;
      if (d) { await d.saveAs(`${OUT}shared-compare-${dev}.png`); ok(`${dev} share saved ${d.suggestedFilename()}`); } else fail(`${dev} share gave no picture`);
      await p.waitForTimeout(300);
      ok(`${dev} share status: ${await p.$$eval('[role=status]', (e) => e.map((x) => x.innerText).join(' '))}`);
      await p.click('.back-big');
      await p.waitForSelector('.avg-share button', { timeout: 20000 });
      const dl2 = p.waitForEvent('download', { timeout: 8000 }).catch(() => null);
      await p.click('.avg-share button');
      const d2 = await dl2;
      if (d2) { await d2.saveAs(`${OUT}shared-main-${dev}.png`); ok(`${dev} main share saved`); } else fail(`${dev} main share gave no picture`);
      ok(`${dev} series files: ${[...new Set(urls.filter((u) => u.includes('/series-')).map((u) => u.split('/').pop()))].join(', ')}`);
    }
    await ctx.close();
  }
  for (const [hash, want] of [['EH1-1YZ', /City of Edinburgh.*Scotland.*Great Britain/], ['@Caversham', /Reading.*Berkshire.*South East England.*Great Britain/], ['', /^Great Britain/]]) {
    const ctx = await b.newContext({ viewport: { width: 1200, height: 900 } });
    const p = await ctx.newPage();
    p.on('pageerror', (e) => errors.push(`${hash} ${String(e)}`));
    if (hash) { await p.goto(B + '#' + hash); await p.waitForSelector('.cmp-way', { timeout: 20000 }); await p.click('.cmp-way'); }
    else { await p.goto(B + '#compare'); }
    await p.waitForSelector('.cmp-chip', { timeout: 20000 });
    const chips = await p.$$eval('.cmp-chip', (els) => els.map((e) => e.innerText.replace(/\s+/g, ' ').trim()).join(' / '));
    (want.test(chips) ? ok : fail)(`start from "${hash || 'nothing'}": ${chips}`);
    await ctx.close();
  }
  await b.close();
  console.log(out.join('\n'));
  console.log(errors.length ? 'ERRORS\n' + errors.join('\n') : 'no page errors');
})();
