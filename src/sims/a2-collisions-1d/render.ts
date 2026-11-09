import type { Collision1D } from '../../physics/collision1d';
import type { View } from '../../sim/view';
import { alpha, type Palette } from '../../sim/palette';
import { drawArrow, drawSymbol } from '../../sim/draw';
import { fmt } from '../../core/format';

export interface CollisionDrawOptions {
  arrows: boolean;
  bars: boolean;
  cm: boolean;
  p0: number; // initial total momentum magnitude scale
}

const H = 0.22; // cart body height [m]
const BUMP = 0.06; // bumper rest length [m]

export function drawCollision(ctx: CanvasRenderingContext2D, view: View, c: Collision1D, pal: Palette, o: CollisionDrawOptions): void {
  ctx.fillStyle = pal.bg;
  ctx.fillRect(0, 0, view.width, view.height);
  const w = c.p.w;
  // track
  const ty = view.sy(0);
  ctx.fillStyle = alpha(pal.dark ? '#5d6678' : '#aab2c0', 0.5);
  ctx.fillRect(0, ty, view.width, 6);
  ctx.strokeStyle = pal.gridStrong;
  ctx.lineWidth = 1;
  for (let x = Math.ceil(view.left * 2) / 2; x <= view.right; x += 0.5) {
    const px = view.sx(x);
    ctx.beginPath();
    ctx.moveTo(px, ty + 6);
    ctx.lineTo(px, ty + (Math.abs(x % 1) < 1e-9 ? 16 : 11));
    ctx.stroke();
    if (Math.abs(x % 1) < 1e-9) {
      ctx.fillStyle = pal.text3;
      ctx.font = '500 10px Inter Variable, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(`${x.toFixed(0).replace('-', '−')} m`, px, ty + 18);
    }
  }

  // bumper compression: each bumper takes half of the overlap
  const d = Math.max(0, c.overlap());
  const comp = Math.min(BUMP * 0.9, d / 2);
  const cart = (x: number, m: number, color: string, side: 1 | -1, label: string) => {
    const bodyW = w - BUMP;
    const xBody = side === 1 ? x - w / 2 : x - w / 2 + BUMP; // body left edge (bumper on the facing side)
    const px = view.sx(xBody);
    const py = view.sy(0.05 + H);
    const pw = bodyW * view.scale;
    const ph = H * view.scale;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(px, py, pw, ph, 5);
    ctx.fill();
    // wheels
    ctx.fillStyle = pal.ink;
    for (const f of [0.22, 0.78]) {
      ctx.beginPath();
      ctx.arc(px + f * pw, view.sy(0.035), 0.035 * view.scale, 0, Math.PI * 2);
      ctx.fill();
    }
    // spring bumper on the facing side
    const len = BUMP - comp;
    const x0 = side === 1 ? xBody + bodyW : xBody;
    const x1 = side === 1 ? x0 + len : x0 - len;
    const yb = view.sy(0.05 + H / 2);
    ctx.strokeStyle = pal.text2;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    const n = 6;
    for (let i = 0; i <= n; i++) {
      const xx = view.sx(x0 + ((x1 - x0) * i) / n);
      const yy = yb + (i === 0 || i === n ? 0 : i % 2 ? -5 : 5);
      if (i === 0) ctx.moveTo(xx, yy);
      else ctx.lineTo(xx, yy);
    }
    ctx.stroke();
    ctx.fillStyle = pal.text2;
    ctx.fillRect(view.sx(x1) - 1.5, yb - 8, 3, 16);
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 11px Inter Variable, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${label} · ${fmt(m, 2)} kg`, px + pw / 2, py + ph / 2);
  };
  cart(c.y[0], c.p.m1, pal.series[0], 1, '1');
  cart(c.y[2], c.p.m2, pal.series[1], -1, '2');

  // velocity arrows
  if (o.arrows) {
    const k = 55; // px per m s⁻¹
    for (const [x, v, col, name] of [
      [c.y[0], c.y[1], pal.series[0], 'v_1'],
      [c.y[2], c.y[3], pal.series[1], 'v_2'],
    ] as const) {
      const px = view.sx(x);
      const py = view.sy(0.05 + H) - 22;
      if (Math.abs(v) * k > 3) drawArrow(ctx, px, py, px + v * k, py, col);
      drawSymbol(ctx, name, px, py - 16, col, 13);
      ctx.fillStyle = col;
      ctx.font = '600 11px Inter Variable, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${fmt(v, 3)} m s⁻¹`, px, py - 32);
    }
  }
  // centre of mass
  if (o.cm) {
    const xcm = (c.p.m1 * c.y[0] + c.p.m2 * c.y[2]) / (c.p.m1 + c.p.m2);
    const px = view.sx(xcm);
    ctx.strokeStyle = pal.series[4];
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(px, view.sy(0.05 + H) - 4);
    ctx.lineTo(px, ty + 4);
    ctx.stroke();
    ctx.fillStyle = pal.series[4];
    ctx.beginPath();
    ctx.arc(px, view.sy(0.05 + H / 2), 5, 0, Math.PI * 2);
    ctx.fill();
  }

  // momentum bars (signed, from a common zero line)
  if (o.bars) {
    const scale = Math.min(150, view.width * 0.22) / Math.max(o.p0, 1e-9);
    const x0 = view.width / 2;
    let y = view.sy(0) + 46;
    if (y + 60 > view.height - 70) y = Math.max(70, view.height - 140);
    ctx.font = '600 11px Inter Variable, system-ui, sans-serif';
    ctx.textBaseline = 'middle';
    ctx.strokeStyle = pal.gridStrong;
    ctx.beginPath();
    ctx.moveTo(x0, y - 8);
    ctx.lineTo(x0, y + 48);
    ctx.stroke();
    const rows: [string, number, string][] = [
      ['p₁', c.p.m1 * c.y[1], pal.series[0]],
      ['p₂', c.p.m2 * c.y[3], pal.series[1]],
      ['total p', c.momentum, pal.series[4]],
    ];
    rows.forEach(([name, p, col], i) => {
      const yy = y + i * 18;
      ctx.fillStyle = col;
      ctx.fillRect(Math.min(x0, x0 + p * scale), yy - 6, Math.abs(p * scale), 12);
      ctx.textAlign = 'right';
      ctx.fillText(name, x0 - Math.max(0, -p * scale) - 6, yy);
      ctx.textAlign = 'left';
      ctx.fillText(`${fmt(p, 3)} kg m s⁻¹`, x0 + Math.max(0, p * scale) + 6, yy);
    });
  }
}
