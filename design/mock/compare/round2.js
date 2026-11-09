// Round 2 of the "Compare areas" mock-up (November 9th 2026): option A with John's answers. Mock-up only, not app code.
// ?fuel=e10|diesel|both  ?view=price|change (both only)  ?set=1|4  ?open=woodley  ?img=1 (the shared picture)
const qs2 = new URLSearchParams(location.search);
const FUEL = qs2.get('fuel') || 'e10';
const VIEW = qs2.get('view') || (FUEL === 'both' ? 'change' : 'price');
const SET = qs2.get('set') || '1';
const OPEN = qs2.get('open');
const IMG = qs2.get('img') === '1';
const narrow = innerWidth <= 720;
const SETS = {
  '1': { keys: ['C:Reading', 'K:Berkshire', 'R:South East England', 'GB'], back: 'RG4 7SS' },
  '5': { keys: ['C:Reading', 'GB'], back: 'RG5' },
  '4': { keys: ['C:Reading', 'C:Wokingham', 'GB'], back: 'RG5', note: 'Woodley is in Wokingham’s council area, so that’s the average shown.' },
};
const COUNCIL = 'council area';
const KIND = { 'C:': COUNCIL, 'K:': 'county', 'R:': 'region', 'N:': 'country' };
const show = (k) => (k === 'GB' ? 'Great Britain' : k.slice(2).replace(/^City of /, ''));
const kind = (k) => (k === 'GB' ? 'country' : KIND[k.slice(0, 2)]);
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const ord = (n) => n + (n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th');
const uk = (t) => new Date(new Date(t).toLocaleString('en-US', { timeZone: 'Europe/London' }));
const dayWords = (t) => { const d = uk(t); return `${MONTHS[d.getMonth()]} ${ord(d.getDate())}`; };
const axis = (t) => { const d = uk(t); return `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}`; };
const p1 = (v) => `${v.toFixed(1)}p`;
const signed = (v) => (Math.abs(v) < 0.05 ? '0.0p' : `${v < 0 ? '−' : '+'}${Math.abs(v).toFixed(1)}p`);
const FUELNAME = ['Unleaded', 'Diesel'];

fetch('compare-data.json').then((r) => r.json()).then((D) => {
  const set = SETS[SET];
  const keys = set.keys;
  // Colour follows the area in the order chosen; Great Britain always grey.
  let slot = 0;
  const col = {};
  keys.forEach((k) => { col[k] = k === 'GB' ? 'gb' : `k${slot++}`; });
  // With both fuels, two areas at a time: the first and Great Britain if chosen, otherwise the first two.
  const both = FUEL === 'both';
  const shown = both ? (keys.includes('GB') ? [keys[0], 'GB'] : keys.slice(0, 2)) : keys;
  const colour = (k) => (col[k] === 'gb' ? 'var(--g-avg)' : `var(--${col[k]})`);
  const sw = (k, dotted) => `<i class="sw${dotted ? ' dot' : ''}" style="border-color:${colour(k)}"></i>`;
  const times = D.times.map((t) => Date.parse(t));
  const series = (k, f) => D.series[k].map((v, i) => ({ t: times[i], p: v ? v[f] : null })).filter((x) => x.p !== null);
  const fuels = FUEL === 'both' ? [0, 1] : [FUEL === 'diesel' ? 1 : 0];
  // One line per area and fuel. Colour = area; with both fuels, diesel is dotted.
  const lines = shown.flatMap((k) => fuels.map((f) => {
    const pts = series(k, f);
    const base = pts[0].p;
    return { k, f, name: both ? `${show(k)} ${FUELNAME[f].toLowerCase()}` : show(k), dotted: both && f === 1,
      pts: VIEW === 'change' ? pts.map((z) => ({ t: z.t, p: z.p - base })) : pts };
  }));

  const chart = (w, hgt, labels) => {
    const [L, R, T, B] = [48, labels ? 190 : 56, 12, 26];
    const ps = lines.flatMap((l) => l.pts.map((x) => x.p));
    const lo = Math.floor(Math.min(...ps) - 0.6), hi = Math.ceil(Math.max(...ps) + 0.6);
    const [s, e] = [times[0], times.at(-1)];
    const x = (t) => L + ((t - s) / (e - s)) * (w - L - R), y = (p) => T + ((hi - p) / (hi - lo)) * (hgt - T - B);
    const step = hi - lo > 24 ? 10 : hi - lo > 12 ? 5 : hi - lo > 6 ? 2 : 1;
    let g = '';
    for (let p = Math.ceil(lo / step) * step; p <= hi; p += step) {
      const lab = VIEW === 'change' ? (p === 0 ? '0p' : `${p < 0 ? '−' : '+'}${Math.abs(p)}p`) : `${p}p`;
      g += `<line class="g-grid${VIEW === 'change' && p === 0 ? ' zero' : ''}" x1="${L}" x2="${w - R}" y1="${y(p)}" y2="${y(p)}"/><text class="g-ax" x="${L - 6}" y="${y(p) + 4}" text-anchor="end">${lab}</text>`;
    }
    const every = w < 500 ? 3 : 2;
    for (let d = 0; ; d += every) { const t = Date.parse(new Date(e).toISOString().slice(0, 10) + 'T12:00:00Z') - d * 864e5; if (t < s) break; g += `<text class="g-ax" x="${x(t)}" y="${hgt - 6}" text-anchor="middle">${axis(t)}</text>`; }
    lines.forEach((l) => {
      const pts = l.pts.map((z) => `${x(z.t)},${y(z.p)}`).join(' ');
      g += `<polyline class="k${l.dotted ? ' dotted' : ''}" style="stroke:${colour(l.k)}" points="${pts}"/>`;
      const z = l.pts.at(-1);
      g += `<circle class="kdot" style="fill:${colour(l.k)}" cx="${x(z.t)}" cy="${y(z.p)}" r="4"/>`;
    });
    const ends = lines.map((l) => ({ l, v: l.pts.at(-1).p, y: y(l.pts.at(-1).p) + 4 })).sort((a, b) => a.y - b.y);
    for (let i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < 15) ends[i].y = ends[i - 1].y + 15;
    ends.forEach((en) => { g += `<text class="g-lab" x="${w - R + 8}" y="${en.y}">${labels ? `${en.l.name} ` : ''}<tspan font-weight="700">${VIEW === 'change' ? signed(en.v) : p1(en.v)}</tspan></text>`; });
    return `<svg viewBox="0 0 ${w} ${hgt}" width="100%" class="avg-svg" style="--ar:${w / hgt}">${g}</svg>`;
  };
  const since = dayWords(times[0]);
  const table = () => `<div class="ktab"><div class="r hd"><span>${both ? 'Area and fuel' : 'Area'}</span><span class="p">Now</span><span class="c">Change since ${since}</span></div>${lines.map((l) => {
    const raw = series(l.k, l.f), d = raw.at(-1).p - raw[0].p;
    return `<div class="r"><span class="n">${sw(l.k, l.dotted)}${l.name}</span><span class="p">${p1(raw.at(-1).p)}</span><span class="c">${Math.abs(d) < 0.05 ? 'no change' : `${d < 0 ? 'down' : 'up'} ${p1(Math.abs(d))}`}</span></div>`; }).join('')}</div>`;
  const keyRow = () => `<div class="fuel-key">${shown.map((k) => `<span>${sw(k)}${show(k)}</span>`).join('')}<span class="sep"></span><span><i class="sw solid-ink"></i>Unleaded</span><span><i class="sw dot ink"></i>Diesel</span></div>`;

  // ---- the shared picture ----
  if (IMG) {
    document.body.classList.add('img');
    const fuelWords = both ? 'Unleaded and diesel' : FUELNAME[fuels[0]];
    document.body.innerHTML = `<div class="shot">
      <div class="shot-head"><div><div class="card-kicker">Refueller</div><h2>${fuelWords}: average prices</h2>
      <p>${shown.map(show).join(', ').replace(/, ([^,]*)$/, ' and $1')}, ${since} to ${dayWords(times.at(-1))}${VIEW === 'change' ? ', change since ' + since : ''}</p></div></div>
      ${both ? keyRow() : ''}
      <div class="hist">${chart(1100, 380, true)}</div>
      <p class="shot-foot">refueller.baish.net · Prices from the Government’s Fuel Finder service. Contains public sector information licensed under the Open Government Licence v3.0. Unusual prices not included.</p></div>`;
    document.body.dataset.ready = '1';
    return;
  }

  // ---- the page ----
  const back = `← Back to ${set.back}`;
  let h = `<div class="page-head" style="padding-bottom:0"><a class="back-link" href="#">${back}</a><div class="card-kicker">Fuel prices</div>
    <h2>Compare areas</h2>
    <p class="cmp-lead">Choose up to four towns, counties, regions or countries to see how their average prices have changed. Unusual prices are not included.</p></div>`;
  h += `<div class="cmp-box"><p class="cmp-h">Comparing</p><div class="chips">${keys.map((k) => {
    const off = both && !shown.includes(k);
    return `<span class="chip${off ? ' off' : ''}">${sw(k)}${show(k)} <small>${off ? 'tap to show' : kind(k)}</small><span class="x" aria-label="Remove">✕</span></span>`; }).join('')}
    ${keys.length < 4 ? `<button class="add">+ Add an area</button>` : ''}</div>`;
  if (OPEN === 'woodley') h += `<div class="addbox"><input class="input" value="Woodl"><ul class="sugg">
    <li class="on">Woodley, Wokingham <small>in Wokingham council area</small></li><li>Woodley, Stockport <small>in Stockport council area</small></li><li>Woodley, Hampshire <small>in Test Valley council area</small></li></ul></div>`;
  if (set.note && OPEN !== 'woodley') h += `<p class="note">${set.note}</p>`;
  if (both) h += `<p class="note"><b>Both fuels show two areas at a time.</b> Tap a faded one to show it instead.</p>`;
  else h += keys.length >= 4 ? `<p class="note">That’s four, the most a chart can show clearly. Remove one to add another.</p>` : `<p class="note">You can add ${['', 'three more', 'two more', 'one more'][keys.length]}.</p>`;
  h += `</div>`;
  h += `<div class="controls"><span class="fuels"><button class="fuel-btn" aria-pressed="${FUEL === 'e10'}">Unleaded</button><button class="fuel-btn" aria-pressed="${FUEL === 'diesel'}">Diesel</button><button class="fuel-btn" aria-pressed="${both}">Both</button></span>
    ${both ? `<span class="periods"><button aria-pressed="${VIEW === 'change'}">Change</button><button aria-pressed="${VIEW === 'price'}">Prices</button></span>` : ''}
    <span class="periods"><button aria-pressed="true">1 month</button></span>
    <button class="share-btn"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15V3"/><path d="m7 8 5-5 5 5"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/></svg>Share chart</button></div>`;
  h += `<p class="note" style="margin-top:0">Refueller began recording on ${since}, so for now the chart shows the ${Math.round((times.at(-1) - times[0]) / 864e5) + 1} days since then. Longer periods appear here as the record grows.</p>`;
  if (both && VIEW === 'change') h += `<p class="note">How much each price has moved since ${since}. The table gives the prices themselves.</p>`;
  if (both) h += keyRow();
  h += `<div class="hist chart-wrap">${chart(narrow ? 340 : 760, narrow ? 240 : 300, !narrow)}</div>` + table();
  h += `<a class="btn btn-secondary back" href="#">${back}</a>`;
  document.getElementById('m').innerHTML = h;
  document.body.dataset.ready = '1';
});
