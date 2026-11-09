// "Share chart" (John, November 9th 2026): a picture of a chart, with a heading, the areas and dates, and the credit line, always in
// the light colours, made on the visitor's device. On a touch screen it goes to the phone's own share sheet; on a computer it's copied
// (or saved, where the browser won't copy). Nothing is sent anywhere until the visitor chooses where it goes.
import { axisDate } from './history.ts';
import { scaleFor, type Point } from './compare.ts';

const C = { bg: '#f5ead8', text: '#201e1d', muted: '#645c50', grid: 'rgba(32,30,29,0.13)', zero: 'rgba(32,30,29,0.45)', accent: '#c67139' };
/** The chart colours in light mode (global.css): the four area slots, Great Britain, and the eight stations. */
export const LIGHT = { k: ['#c05a14', '#2a64a8', '#3d7a3a', '#8a3f7f'], gb: '#5f5a52', eight: '#c05a14' };
export const CREDIT = 'refueller.baish.net · Prices from the Government’s Fuel Finder service. Contains public sector information licensed under the Open Government Licence v3.0. Unusual prices not included.';

export type ImgLine = { label: string; colour: string; style: 'solid' | 'dotted' | 'dashed'; pts: Point[] };
export type ImgPanel = { title?: string; lines: ImgLine[]; change: boolean };
export type KeyItem = { label: string; colour: string; style: 'solid' | 'dotted' | 'dashed' };

const W = 1200;
const PAD = 50;
const FIG = 'Figtree, system-ui, sans-serif';

function wrap(ctx: CanvasRenderingContext2D, text: string, width: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const t = line ? `${line} ${w}` : w;
    if (ctx.measureText(t).width > width && line) {
      lines.push(line);
      line = w;
    } else line = t;
  }
  if (line) lines.push(line);
  return lines;
}

function stroke(ctx: CanvasRenderingContext2D, style: ImgLine['style'], colour: string) {
  ctx.strokeStyle = colour;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  if (style === 'dotted') {
    ctx.lineWidth = 3.5;
    ctx.setLineDash([0.1, 6.5]);
  } else if (style === 'dashed') {
    ctx.lineWidth = 2.2;
    ctx.setLineDash([6, 5]);
  } else {
    ctx.lineWidth = 2.8;
    ctx.setLineDash([]);
  }
}

const pen = (p: number, change: boolean) => {
  const r = Math.round(p * 10) / 10;
  if (!change) return `${r.toFixed(1)}p`;
  return r === 0 ? '0.0p' : `${r < 0 ? '−' : '+'}${Math.abs(r).toFixed(1)}p`;
};

function drawPanel(ctx: CanvasRenderingContext2D, panel: ImgPanel, x0: number, y0: number, w: number, h: number, named: boolean) {
  let top = y0;
  if (panel.title) {
    ctx.fillStyle = C.text;
    ctx.font = `700 19px ${FIG}`;
    ctx.fillText(panel.title, x0, top + 18);
    top += 32;
  }
  const lines = panel.lines.filter((l) => l.pts.length);
  if (!lines.length) return;
  ctx.font = `14px ${FIG}`;
  const longest = Math.max(...lines.map((l) => ctx.measureText(`${named ? `${l.label} ` : ''}${pen(l.pts[l.pts.length - 1].p, panel.change)}`).width));
  const [L, R, T, B] = [52, longest + 22, 8, 30];
  const ph = h - (top - y0);
  const all = lines.flatMap((l) => l.pts);
  const { lo, hi, step } = scaleFor(all.map((p) => p.p));
  const t0 = Math.min(...all.map((p) => p.t));
  const t1 = Math.max(...all.map((p) => p.t));
  const span = Math.max(t1 - t0, 1);
  const x = (t: number) => x0 + L + ((t - t0) / span) * (w - L - R);
  const y = (p: number) => top + T + ((hi - p) / (hi - lo)) * (ph - T - B);
  ctx.setLineDash([]);
  ctx.font = `13px ${FIG}`;
  ctx.textAlign = 'right';
  for (let p = Math.ceil(lo / step) * step; p <= hi; p += step) {
    ctx.strokeStyle = panel.change && p === 0 ? C.zero : C.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x0 + L, y(p));
    ctx.lineTo(x0 + w - R, y(p));
    ctx.stroke();
    ctx.fillStyle = C.muted;
    ctx.fillText(panel.change ? (p === 0 ? '0p' : `${p < 0 ? '−' : '+'}${Math.abs(p)}p`) : `${p}p`, x0 + L - 8, y(p) + 4);
  }
  // Dates at UK midday, counted back from the last day, at most about six.
  const day = 86_400_000;
  const lastDay = Date.parse(`${new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(new Date(t1))}T12:00:00Z`);
  const days = Math.max(1, Math.round((lastDay - t0) / day) + 1);
  const every = Math.max(1, Math.ceil(days / (w < 700 ? 4 : 6)));
  ctx.textAlign = 'center';
  for (let d = 0; ; d += every) {
    const t = lastDay - d * day;
    if (t < t0 - day / 2) break;
    ctx.fillText(axisDate(Math.max(t0, Math.min(t1, t))), x(Math.max(t0, Math.min(t1, t))), top + ph - 8);
  }
  for (const l of lines) {
    stroke(ctx, l.style, l.colour);
    ctx.beginPath();
    l.pts.forEach((p, i) => (i ? ctx.lineTo(x(p.t), y(p.p)) : ctx.moveTo(x(p.t), y(p.p))));
    ctx.stroke();
    ctx.setLineDash([]);
    const last = l.pts[l.pts.length - 1];
    ctx.fillStyle = l.colour;
    ctx.beginPath();
    ctx.arc(x(last.t), y(last.p), 4, 0, Math.PI * 2);
    ctx.fill();
  }
  // End labels, moved apart where they'd overlap.
  const ends = lines.map((l) => ({ l, v: l.pts[l.pts.length - 1].p, y: y(l.pts[l.pts.length - 1].p) + 5 })).sort((a, b) => a.y - b.y);
  for (let i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < 17) ends[i].y = ends[i - 1].y + 17;
  ctx.textAlign = 'left';
  for (const e of ends) {
    ctx.fillStyle = C.muted;
    ctx.font = `14px ${FIG}`;
    const name = named ? `${e.l.label} ` : '';
    ctx.fillText(name, x0 + w - R + 10, e.y);
    const nameW = ctx.measureText(name).width;
    ctx.font = `700 14px ${FIG}`;
    ctx.fillText(pen(e.v, panel.change), x0 + w - R + 10 + nameW, e.y);
  }
}

/** The picture: heading, a line of areas and dates, an optional key, one or two charts side by side, and the credit line. */
export function makeImage(o: { heading: string; sub: string; key?: KeyItem[]; panels: ImgPanel[]; named: boolean }): HTMLCanvasElement {
  const scale = 2;
  const chartH = o.panels.some((p) => p.title) ? 420 : 400;
  const keyH = o.key?.length ? 34 : 0;
  const H = 150 + keyH + chartH + 70;
  const canvas = document.createElement('canvas');
  canvas.width = W * scale;
  canvas.height = H * scale;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(scale, scale);
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, W, H);
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = C.accent;
  ctx.font = `600 13px ${FIG}`;
  ctx.fillText('REFUELLER', PAD, 52);
  ctx.fillStyle = C.text;
  ctx.font = `34px Caprasimo, Georgia, serif`;
  ctx.fillText(o.heading, PAD, 94);
  ctx.fillStyle = C.muted;
  ctx.font = `17px ${FIG}`;
  ctx.fillText(o.sub, PAD, 124);
  let y = 150;
  if (o.key?.length) {
    let x = PAD;
    ctx.font = `15px ${FIG}`;
    for (const k of o.key) {
      stroke(ctx, k.style, k.colour);
      ctx.beginPath();
      ctx.moveTo(x, y + 4);
      ctx.lineTo(x + 24, y + 4);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = C.text;
      ctx.fillText(k.label, x + 32, y + 9);
      x += 32 + ctx.measureText(k.label).width + 26;
    }
    y += keyH;
  }
  const gap = 40;
  const pw = (W - 2 * PAD - gap * (o.panels.length - 1)) / o.panels.length;
  o.panels.forEach((p, i) => drawPanel(ctx, p, PAD + i * (pw + gap), y, pw, chartH, o.named));
  ctx.strokeStyle = C.grid;
  ctx.lineWidth = 1;
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(PAD, H - 50);
  ctx.lineTo(W - PAD, H - 50);
  ctx.stroke();
  ctx.fillStyle = C.muted;
  ctx.font = `13px ${FIG}`;
  wrap(ctx, CREDIT, W - 2 * PAD).forEach((t, i) => ctx.fillText(t, PAD, H - 28 + i * 17));
  return canvas;
}

export type Delivered = 'shared' | 'copied' | 'saved' | 'cancelled';
const touch = () => typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
/** The share button's own word: "Share" on a touch screen (the phone's share sheet), "Copy" on a computer. */
export const shareVerb = () => (touch() ? 'Share' : 'Copy');

function save(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** Hands the picture over: the share sheet on a touch screen, else the clipboard, else a saved file. Call straight from the tap. */
export async function deliver(canvas: HTMLCanvasElement, filename: string, title: string): Promise<Delivered> {
  const blob = new Promise<Blob>((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('No picture'))), 'image/png'));
  if (touch()) {
    const b = await blob;
    const file = new File([b], filename, { type: 'image/png' });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title });
        return 'shared';
      } catch (e) {
        if ((e as Error).name === 'AbortError') return 'cancelled';
      }
    }
    save(b, filename);
    return 'saved';
  }
  try {
    // The picture is handed over as a promise, made inside the click, which Safari needs.
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    return 'copied';
  } catch {
    save(await blob, filename);
    return 'saved';
  }
}

/** "refueller-2026-11-09.png" */
export const imageName = (ms: number) => `refueller-${new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(new Date(ms))}.png`;
