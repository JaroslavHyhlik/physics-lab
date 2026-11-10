import type { Winch } from '../../physics/workPower';
import { alpha, type Palette } from '../../sim/palette';
import { drawArrow } from '../../sim/draw';
import { drawSankey } from '../../sim/sankey';
import { fmt } from '../../core/format';

export function drawWinch(ctx: CanvasRenderingContext2D, W: number, H: number, w: Winch, pal: Palette, sankey: boolean): void {
  ctx.fillStyle = pal.bg;
  ctx.fillRect(0, 0, W, H);
  const usable = H - 76;
  const side = sankey && W > 640;
  const SW = side ? W * 0.5 : W; // scene width
  const th = w.p.theta;
  const c = Math.cos(th);
  const s = Math.sin(th);
  const L = w.p.L;
  const scale = Math.min((SW - 120) / Math.max(L * c, 0.3 * L), (usable - 80) / Math.max(L * s, 0.15 * L));
  const ox = 40 + (SW - 120 - L * c * scale) / 2;
  const oy = 40 + (usable - 80) / 2 + (L * s * scale) / 2;
  const P = (d: number, up = 0) => [ox + d * c * scale - up * s, oy - d * s * scale - up * c] as const;
  // slope
  const [tx, ty] = P(L);
  ctx.fillStyle = alpha(pal.dark ? '#5d6678' : '#aab2c0', 0.45);
  ctx.beginPath();
  ctx.moveTo(ox, oy);
  ctx.lineTo(tx, ty);
  ctx.lineTo(tx, oy);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = pal.text3;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(ox - 20, oy);
  ctx.lineTo(tx + 30, oy);
  ctx.moveTo(ox, oy);
  ctx.lineTo(tx, ty);
  ctx.stroke();
  // winch at the top
  ctx.fillStyle = pal.ink;
  ctx.beginPath();
  ctx.arc(tx + 10 * s, ty - 10 * c, 9, 0, Math.PI * 2);
  ctx.fill();
  // crate
  const box = 22;
  const [bx, by] = P(w.s, box / 2);
  ctx.save();
  ctx.translate(bx, by);
  ctx.rotate(-th);
  ctx.fillStyle = pal.series[1];
  ctx.fillRect(-box / 2 - box, -box / 2, box, box);
  ctx.restore();
  // rope from crate front to winch
  const [rx, ry] = P(w.s, box / 2);
  ctx.strokeStyle = pal.text2;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(rx, ry);
  ctx.lineTo(tx + 10 * s - 9 * c, ty - 10 * c + 9 * s);
  ctx.stroke();
  // force arrow along the rope
  const F = w.force();
  const k = 70 / Math.max(w.p.Fmax, w.resist);
  drawArrow(ctx, rx, ry - 18, rx + c * F * k, ry - 18 - s * F * k, pal.series[2], 'F');
  ctx.fillStyle = pal.text3;
  ctx.font = '500 10px Inter Variable, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${fmt(L, 3)} m slope at ${((th * 180) / Math.PI).toFixed(0)}°`, (ox + tx) / 2, oy + 16);

  if (!sankey) return;
  const bxS = side ? W * 0.5 + 10 : 20;
  const byS = side ? 170 : usable * 0.55;
  const bw = side ? W * 0.5 - 30 : W - 40;
  const bh = side ? usable - 180 : usable * 0.42;
  ctx.fillStyle = pal.text3;
  ctx.font = '600 10px Inter Variable, system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('WHERE THE POWER GOES (SANKEY)', bxS, byS - 18);
  if (w.atTop || !w.moves || w.v <= 0) {
    ctx.fillStyle = pal.text2;
    ctx.fillText(w.atTop ? 'at the top: no more work is being done' : 'not moving: the motor cannot pull the load', bxS, byS + 10);
    return;
  }
  const v = w.v;
  const { m, g, mu } = w.p;
  const Pin = w.p.Pin;
  const Pmotor = Pin - F * v; // input power not delivered to the rope
  const Pp = m * g * s * v;
  const Pf = mu * m * g * c * v;
  const Pk = Math.max(0, F * v - Pp - Pf);
  drawSankey(
    ctx,
    bxS,
    byS,
    bw,
    bh,
    { label: 'electrical input', value: Pin, color: pal.series[0] },
    [
      { label: 'gain in Eₚ (useful)', value: Pp, color: pal.series[4] },
      { label: 'gain in Eₖ', value: Pk, color: pal.series[1] },
      { label: 'heat: friction', value: Pf, color: pal.series[5] },
      { label: 'heat: motor', value: Math.max(0, Pmotor), color: pal.series[3] },
    ],
    'W',
    (x) => fmt(x, 3),
    pal.text2,
  );
}
