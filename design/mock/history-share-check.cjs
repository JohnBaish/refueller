const { chromium } = require('playwright');
const out = process.argv[2];
(async () => {
  const b = await chromium.launch();
  const runs = [
    { name: 'phone', opt: { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 } },
    { name: 'side', opt: { viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 } },
    { name: 'computer', opt: { viewport: { width: 1200, height: 860 } } },
  ];
  for (const scheme of ['light', 'dark']) for (const r of runs) for (const hash of ['RG4-7SS', '@Caversham']) {
    const ctx = await b.newContext({ ...r.opt, colorScheme: scheme, permissions: ['clipboard-read', 'clipboard-write'] });
    const p = await ctx.newPage();
    const errs = [];
    p.on('pageerror', (e) => errs.push(e.message));
    await p.addInitScript(() => {
      window.__shared = [];
      navigator.canShare = () => true;
      navigator.share = async (d) => { window.__shared.push({ title: d.title, text: d.text, url: d.url, file: d.files[0].name, size: d.files[0].size }); };
    });
    await p.goto(`http://localhost:4417/#${hash}`);
    await p.getByRole('button', { name: 'Price history' }).first().click();
    const btn = p.locator('.calc.hist .cmp-share');
    await btn.waitFor();
    const label = (await btn.innerText()).trim();
    let res;
    if (r.name === 'computer') {
      await btn.click();
      await p.locator('.calc.hist .share-status', { hasText: 'Copied' }).waitFor();
      res = await p.evaluate(async () => { const it = await navigator.clipboard.read(); const bl = await it[0].getType('image/png'); const u = URL.createObjectURL(bl); const img = new Image(); img.src = u; await img.decode(); return { w: img.width, h: img.height, data: await new Promise((r2) => { const fr = new FileReader(); fr.onload = () => r2(fr.result); fr.readAsDataURL(bl); }) }; });
      if (scheme === 'light' && hash === 'RG4-7SS') require('fs').writeFileSync(`${out}/picture-unleaded.png`, Buffer.from(res.data.split(',')[1], 'base64'));
      res = { w: res.w, h: res.h };
    } else {
      await p.locator('.calc.hist .fuel-btn', { hasText: 'Diesel' }).click(); await p.waitForTimeout(200); const pv = await p.evaluate(() => { const c = document.createElement('canvas'); return 0; });
      await btn.click();
      await p.waitForFunction(() => window.__shared.length > 0);
      res = await p.evaluate(() => window.__shared[0]); if (scheme==='light' && r.name==='phone' && hash==='RG4-7SS') { const d = await p.evaluate(async () => 1); }
    }
    const sw = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    await btn.scrollIntoViewIfNeeded();
    if (hash === 'RG4-7SS') await p.locator('.calc.hist').screenshot({ path: `${out}/panel-${r.name}-${scheme}.png` });
    await p.emulateMedia({ media: 'print' });
    const printed = await btn.isVisible();
    console.log(scheme, r.name, hash, JSON.stringify({ label, res, sideways: sw, printed, errs }));
    await ctx.close();
  }
  await b.close();
})();
