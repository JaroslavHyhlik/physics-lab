import type { Coaster } from '../../physics/coaster';
import type { View } from '../../sim/view';
import { alpha, type Palette } from '../../sim/palette';
import { drawGridAxes } from '../../sim/draw';

export interface CoasterDrawOptions {
  bars: boolean;
  gforce: boolean;
  E0: number;
  /** precomputed track polyline with a flag per point: would need a negative N there */
  poly: Float64Array;
  neg: Uint8Array;
}

export function drawCoaster(ctx: CanvasRenderingContext2D, view: View, c: Coaster, pal: Palette, o: CoasterDrawOptions): void {
  ctx.fillStyle = pal.bg;
  ctx.fillRect(0, 0, view.width, view.height);
  drawGridAxes(ctx, view, pal, 'x / m', 'height / m');
  // track (red where the car would need to be held on)
  const n = o.poly.length / 2;
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  for (let i = 1; i < n; i++) {
    ctx.strokeStyle = o.neg[i] ? pal.positive : pal.text2;
    ctx.beginPath();
    ctx.moveTo(view.sx(o.poly[2 * i - 2]), view.sy(o.poly[2 * i - 1]));
    ctx.lineTo(view.sx(o.poly[2 * i]), view.sy(o.poly[2 * i + 1]));
    ctx.stroke();
  }
  ctx.lineCap = 'butt';
  // start height line
  const h0 = c.track.at(c.p.s0).y;
  ctx.strokeStyle = alpha(pal.hl.startsWith('#') ? pal.hl : '#f59e0b', 0.6);
  ctx.setLineDash([6, 6]);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, view.sy(h0));
  ctx.lineTo(view.width, view.sy(h0));
  ctx.stroke();
  ctx.setLineDash([]);
  // car oriented along the track, sitting on the normal side
  const p = c.pos;
  const ang = Math.atan2(p.ty, p.tx);
  ctx.save();
  ctx.translate(view.sx(p.x), view.sy(p.y));
  ctx.rotate(-ang);
  const N = c.N;
  ctx.fillStyle = N < 0 ? pal.positive : pal.series[0];
  ctx.beginPath();
  ctx.roundRect(-14, -16, 28, 13, 4);
  ctx.fill();
  ctx.fillStyle = pal.ink;
  ctx.beginPath();
  ctx.arc(-8, -3, 3, 0, Math.PI * 2);
  ctx.arc(8, -3, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  if (o.gforce) {
    const gf = N / (c.p.m * c.p.g);
    ctx.font = '700 12px Inter Variable, system-ui, sans-serif';
    ctx.fillStyle = N < 0 ? pal.positive : pal.ink;
    ctx.textAlign = 'center';
    ctx.fillText(`${gf.toFixed(2)} g`, view.sx(p.x) - p.ty * 34, view.sy(p.y) - p.tx * 34);
  }
  if (o.bars) {
    const items = [
      { v: c.Ek, col: pal.series[1], l: 'Eₖ' },
      { v: c.Ep, col: pal.series[2], l: 'Eₚ' },
      { v: c.heat, col: pal.series[3], l: 'thermal' },
      { v: c.Ek + c.Ep + c.heat, col: pal.series[4], l: 'total' },
    ];
    const h = Math.min(130, view.height * 0.3);
    const x0 = 66;
    const y0 = view.height - 92;
    if (y0 - h < 100) return;
    ctx.fillStyle = alpha(pal.surface.startsWith('#') ? pal.surface : '#ffffff', 0.85);
    ctx.fillRect(x0 - 8, y0 - h - 22, items.length * 44 + 8, h + 44);
    ctx.font = '600 10px Inter Variable, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    items.forEach((b, i) => {
      const x = x0 + i * 44;
      ctx.fillStyle = pal.grid;
      ctx.fillRect(x, y0 - h, 28, h);
      const bh = Math.max(0, Math.min(1, b.v / Math.max(o.E0, 1e-9))) * h;
      ctx.fillStyle = b.col;
      ctx.fillRect(x, y0 - bh, 28, bh);
      ctx.fillStyle = pal.text2;
      ctx.fillText(b.l, x + 14, y0 + 4);
    });
  }
}
