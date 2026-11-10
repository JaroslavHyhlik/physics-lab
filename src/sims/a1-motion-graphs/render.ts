import type { Mover } from '../../physics/motion';
import { alpha, type Palette } from '../../sim/palette';
import { drawArrow, niceStep } from '../../sim/draw';
import { fmt } from '../../core/format';

export class Series {
  t = new Float64Array(2400);
  x = new Float64Array(2400);
  v = new Float64Array(2400);
  a = new Float64Array(2400);
  n = 0;
  push(t: number, x: number, v: number, a: number) {
    if (this.n >= this.t.length) return;
    this.t[this.n] = t;
    this.x[this.n] = x;
    this.v[this.n] = v;
    this.a[this.n] = a;
    this.n++;
  }
  clear() {
    this.n = 0;
  }
  /** index of the last sample with time ≤ tc */
  index(tc: number): number {
    let lo = 0;
    let hi = this.n - 1;
    if (hi < 0) return -1;
    while (hi - lo > 1) {
      const m = (lo + hi) >> 1;
      if (this.t[m] <= tc) lo = m;
      else hi = m;
    }
    return this.t[hi] <= tc ? hi : lo;
  }
  /** trapezium-rule area of arr from t = 0 to the sample at index i */
  area(arr: Float64Array, i: number): number {
    let s = 0;
    for (let k = 1; k <= i; k++) s += 0.5 * (arr[k] + arr[k - 1]) * (this.t[k] - this.t[k - 1]);
    return s;
  }
}

export interface Layout {
  trackY: number;
  plots: { y: number; h: number }[];
  x0: number;
  x1: number;
  T: number;
}

export function layout(W: number, H: number, tNow: number): Layout {
  const usable = H - 76;
  const trackY = 46;
  const top = 92;
  const ph = (usable - top - 8) / 3;
  return {
    trackY,
    plots: [0, 1, 2].map((i) => ({ y: top + i * ph, h: ph - 14 })),
    x0: 64,
    x1: W - 20,
    T: Math.max(10, Math.ceil(tNow / 5) * 5),
  };
}

export function drawMotion(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  m: Mover,
  data: Series,
  pal: Palette,
  tools: boolean,
  tc: number,
): void {
  ctx.fillStyle = pal.bg;
  ctx.fillRect(0, 0, W, H);
  const L = layout(W, H, m.t);
  // ---- track ------------------------------------------------------------------------------
  // the track stops short of the readouts box on wide screens
  const trackEnd = W > 700 ? W - 250 : L.x1;
  const tx = (x: number) => L.x0 + ((x + 10) / 20) * (trackEnd - L.x0);
  ctx.strokeStyle = pal.gridStrong;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(tx(-10), L.trackY);
  ctx.lineTo(tx(10), L.trackY);
  ctx.stroke();
  ctx.font = '500 10px Inter Variable, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.lineWidth = 1;
  for (let x = -10; x <= 10; x += 2) {
    ctx.strokeStyle = pal.text3;
    ctx.beginPath();
    ctx.moveTo(tx(x), L.trackY);
    ctx.lineTo(tx(x), L.trackY + 6);
    ctx.stroke();
    ctx.fillStyle = pal.text3;
    ctx.fillText(`${x}`.replace('-', '−'), tx(x), L.trackY + 8);
  }
  ctx.fillText('x / m', trackEnd + 24, L.trackY + 8);
  const px = tx(m.x);
  ctx.fillStyle = pal.series[0];
  ctx.beginPath();
  ctx.arc(px, L.trackY - 13, 9, 0, Math.PI * 2);
  ctx.fill();
  if (Math.abs(m.v) > 0.02) drawArrow(ctx, px, L.trackY - 30, px + m.v * 18, L.trackY - 30, pal.series[1], 'v', 2);
  if (Math.abs(m.a) > 0.02) drawArrow(ctx, px, L.trackY - 30, px + m.a * 18, L.trackY - 30, pal.series[2], undefined, 1.5);

  // ---- plots ------------------------------------------------------------------------------
  const specs = [
    { arr: data.x, lab: 'x / m', col: pal.series[0] },
    { arr: data.v, lab: 'v / m s⁻¹', col: pal.series[1] },
    { arr: data.a, lab: 'a / m s⁻²', col: pal.series[2] },
  ];
  const ci = tools ? data.index(tc) : -1;
  specs.forEach((sp, k) => {
    const P = L.plots[k];
    let lo = 0;
    let hi = 0;
    for (let i = 0; i < data.n; i++) {
      lo = Math.min(lo, sp.arr[i]);
      hi = Math.max(hi, sp.arr[i]);
    }
    const pad = Math.max(0.5, (hi - lo) * 0.12);
    lo -= pad;
    hi += pad;
    const X = (t: number) => L.x0 + (t / L.T) * (L.x1 - L.x0);
    const Y = (v: number) => P.y + P.h - ((v - lo) / (hi - lo)) * P.h;
    // frame, zero line, grid
    ctx.strokeStyle = pal.grid;
    ctx.lineWidth = 1;
    const st = niceStep(P.h / (hi - lo), 26);
    ctx.font = '500 10px Inter Variable, system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let v = Math.ceil(lo / st) * st; v <= hi; v += st) {
      ctx.beginPath();
      ctx.moveTo(L.x0, Y(v));
      ctx.lineTo(L.x1, Y(v));
      ctx.stroke();
      ctx.fillStyle = pal.text3;
      ctx.fillText(fmt(Math.abs(v) < st / 2 ? 0 : v, 2), L.x0 - 6, Y(v));
    }
    ctx.strokeStyle = pal.gridStrong;
    ctx.beginPath();
    ctx.moveTo(L.x0, Y(0));
    ctx.lineTo(L.x1, Y(0));
    ctx.stroke();
    ctx.fillStyle = pal.text2;
    ctx.textAlign = 'left';
    ctx.fillText(sp.lab, L.x0 + 4, P.y + 6);
    // shaded area (v–t and a–t) up to the cursor
    if (ci > 0 && k > 0) {
      ctx.fillStyle = alpha(sp.col.startsWith('#') ? sp.col : '#888888', 0.18);
      ctx.beginPath();
      ctx.moveTo(X(data.t[0]), Y(0));
      for (let i = 0; i <= ci; i++) ctx.lineTo(X(data.t[i]), Y(sp.arr[i]));
      ctx.lineTo(X(data.t[ci]), Y(0));
      ctx.closePath();
      ctx.fill();
    }
    // curve
    ctx.strokeStyle = sp.col;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < data.n; i++) {
      const xx = X(data.t[i]);
      const yy = Y(sp.arr[i]);
      if (i === 0) ctx.moveTo(xx, yy);
      else ctx.lineTo(xx, yy);
    }
    ctx.stroke();
    // tangent (x–t and v–t) at the cursor
    if (ci > 0 && k < 2) {
      const slope = k === 0 ? data.v[ci] : data.a[ci];
      const t0 = data.t[ci];
      const y0 = sp.arr[ci];
      const dt = L.T * 0.12;
      ctx.strokeStyle = pal.hl;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(X(t0 - dt), Y(y0 - slope * dt));
      ctx.lineTo(X(t0 + dt), Y(y0 + slope * dt));
      ctx.stroke();
    }
    if (ci > 0) {
      ctx.font = '600 11px Inter Variable, system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillStyle = pal.hl;
      const msg =
        k === 0
          ? `gradient = ${fmt(data.v[ci], 3)} m s⁻¹ (= v)`
          : k === 1
            ? `gradient = ${fmt(data.a[ci], 3)} m s⁻² (= a) · area = ${fmt(data.area(data.v, ci), 3)} m (= Δx)`
            : `area = ${fmt(data.area(data.a, ci), 3)} m s⁻¹ (= Δv)`;
      ctx.fillText(msg, L.x1 - 4, P.y + 6);
    }
  });
  // time axis labels on the bottom plot and the cursor
  const last = L.plots[2];
  ctx.fillStyle = pal.text3;
  ctx.font = '500 10px Inter Variable, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  for (let t = 0; t <= L.T; t += niceStep((L.x1 - L.x0) / L.T, 50)) {
    ctx.fillText(`${t}`, L.x0 + (t / L.T) * (L.x1 - L.x0), last.y + last.h + 2);
  }
  ctx.textAlign = 'right';
  ctx.fillText('t / s', L.x1, last.y + last.h + 2);
  if (tools && data.n > 1) {
    const cx = L.x0 + (Math.min(tc, data.t[data.n - 1]) / L.T) * (L.x1 - L.x0);
    ctx.strokeStyle = pal.hl;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(cx, L.plots[0].y);
    ctx.lineTo(cx, last.y + last.h);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = pal.hl;
    ctx.beginPath();
    ctx.arc(cx, L.plots[0].y - 4, 6, 0, Math.PI * 2);
    ctx.fill();
  }
}
