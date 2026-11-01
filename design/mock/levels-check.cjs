const { chromium } = require('playwright');
// Checks "The wider picture" with the averages at every level (built page, `npx vite preview --port 4193`), November 1st 2026.
const OUT = '/home/user/refueller/design/previews/levels/';
const PLACES = [['RG4-7SS', 'rg4'], ['RG4', 'rg4-district'], ['@Caversham', 'caversham'], ['CF10-1EP', 'cardiff'], ['EH1-1YZ', 'edinburgh'], ['NW4-4BT', 'barnet'], ['LE15-6AA', 'rutland'], ['TR21-0JY', 'scilly'], ['B1-1BB', 'birmingham']];
(async () => {
  const b = await chromium.launch();
  const errors = [];
  for (const [w, touch] of [[1200, false], [390, true]]) for (const theme of ['light', 'dark']) {
    const ctx = await b.newContext({ viewport: { width: w, height: 900 }, hasTouch: touch, isMobile: touch, deviceScaleFactor: 2, colorScheme: theme });
    const p = await ctx.newPage();
    p.on('pageerror', (e) => errors.push(String(e)));
    const asked = [];
    p.on('request', (r) => asked.push(r.url()));
    for (const [hash, name] of PLACES) {
      if (theme === 'dark' && !['RG4-7SS', 'CF10-1EP'].includes(hash)) continue;
      await p.goto(`http://localhost:4193/#${hash}`);
      await p.goto(`http://localhost:4193/#${hash}`);
      await p.reload();
      await p.waitForSelector('.lv-box', { timeout: 20000 });
      await p.waitForTimeout(300);
      const rows = await p.$$eval('.lv-row:not(.lv-head)', (rs) => rs.map((r) => [r.querySelector('.lv-name').textContent, [...r.querySelectorAll('.lv-p')].map((x) => x.textContent).join(' / '), r.querySelector('.lv-fact')?.textContent ?? '(no fact)']));
      const sw = await p.evaluate(() => document.documentElement.scrollWidth);
      if (sw > w) errors.push(`sideways scroll ${hash} ${w}: ${sw}`);
      const lines = await p.$$eval('.avg-sec polyline', (l) => l.length);
      if (w > 720 && theme === 'light') console.log(`\n${hash} (${lines} chart lines)\n` + rows.map((r) => `  ${r[0]} | ${r[1]} | ${r[2]}`).join('\n'));
      if (['RG4-7SS', 'CF10-1EP', 'EH1-1YZ'].includes(hash)) {
        const el = await p.$('.avg-sec');
        const bx = await el.boundingBox();
        await p.screenshot({ path: `${OUT}built-${name}-${w > 720 ? 'computer' : 'phone'}-${theme}.png`, fullPage: true, clip: { x: 0, y: bx.y - 30, width: w, height: bx.height + 60 } });
      }
    }
    // Tooltip on the chart still works.
    await p.goto('http://localhost:4193/#RG4-7SS'); await p.reload(); await p.waitForSelector('.avg-sec .g-hit');
    const hit = await p.$('.avg-sec .g-hit'); const hb = await hit.boundingBox();
    if (touch) await p.touchscreen.tap(hb.x + hb.width * 0.9, hb.y + 20); else await p.mouse.move(hb.x + hb.width * 0.9, hb.y + 20);
    const tip = await p.$$eval('.avg-sec .g-tip text', (t) => t.map((x) => x.textContent));
    if (w > 720 && theme === 'light') console.log('\ntip:', tip.join(' | '));
    const sent = asked.filter((u) => /councils-|averages-/.test(u)).map((u) => u.replace('http://localhost:4193', ''));
    if (w > 720 && theme === 'light') console.log('\nfiles asked for:', [...new Set(sent)].join(' '));
    if (asked.some((u) => /7SS|Caversham|1EP/i.test(u))) errors.push('a request carried what was typed');
    await ctx.close();
  }
  await b.close();
  console.log('\n' + (errors.length ? errors.join('\n') : 'no errors, no sideways scroll, nothing typed sent'));
})();
