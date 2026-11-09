import type { Pendulum } from '../../physics/pendulum';
import type { View } from '../../sim/view';
import { alpha, type Palette } from '../../sim/palette';
import { drawArrow } from '../../sim/draw';

export interface PendulumDrawOptions {
  ghost: boolean;
  vectors: boolean;
  trail: Float32Array; // [x0,y0,x1,y1,...] world coords, ring order handled by caller
  trailLen: number;
  trailStart: number;
  E0: number; // initial total energy, for the energy bars
}

export function drawPendulum(
  ctx: CanvasRenderingContext2D,
  view: View,
  p: Pendulum,
  pal: Palette,
  o: PendulumDrawOptions,
): void {
  const { l } = p.p;
  ctx.fillStyle = pal.bg;
  ctx.fillRect(0, 0, view.width, view.height);

  const px = view.sx(0);
  const py = view.sy(0);
  const bobR = Math.max(9, Math.min(22, 9 + 6 * Math.cbrt(p.p.m)));

  // vertical reference line
  ctx.save();
  ctx.setLineDash([4, 6]);
  ctx.strokeStyle = pal.gridStrong;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(px, py);
  ctx.lineTo(px, view.sy(-l * 1.08));
  ctx.stroke();
  ctx.restore();

  // trail
  if (o.trailLen > 1) {
    const cap = o.trail.length / 2;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    for (let i = 1; i < o.trailLen; i++) {
      const a = (o.trailStart + i - 1) % cap;
      const b = (o.trailStart + i) % cap;
      ctx.strokeStyle = alpha(pal.series[0], (0.45 * i) / o.trailLen);
      ctx.beginPath();
      ctx.moveTo(view.sx(o.trail[2 * a]), view.sy(o.trail[2 * a + 1]));
      ctx.lineTo(view.sx(o.trail[2 * b]), view.sy(o.trail[2 * b + 1]));
      ctx.stroke();
    }
  }

  // ghost (small-angle approximation)
  if (o.ghost) {
    const gx = view.sx(l * Math.sin(p.thetaSmall));
    const gy = view.sy(-l * Math.cos(p.thetaSmall));
    ctx.strokeStyle = alpha(pal.series[4], 0.5);
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(gx, gy);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = alpha(pal.series[4], 0.22);
    ctx.strokeStyle = alpha(pal.series[4], 0.7);
    ctx.beginPath();
    ctx.arc(gx, gy, bobR, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  const th = p.theta;
  const bx = view.sx(l * Math.sin(th));
  const by = view.sy(-l * Math.cos(th));

  // angle arc
  const arcR = Math.min(60, 0.3 * l * view.scale);
  if (Math.abs(th) > 0.01) {
    ctx.strokeStyle = pal.hl;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    const start = Math.PI / 2;
    ctx.arc(px, py, arcR, start, start - th, th > 0);
    ctx.stroke();
    // label on the opposite side of the vertical line, so it never covers the string
    ctx.fillStyle = pal.hl;
    ctx.font = 'italic 600 13px "Times New Roman", Georgia, serif';
    ctx.textAlign = th > 0 ? 'right' : 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`θ = ${((th * 180) / Math.PI).toFixed(1)}°`, px - Math.sign(th) * 8, py + arcR * 0.8);
  }

  // string
  ctx.strokeStyle = pal.ink;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(px, py);
  ctx.lineTo(bx, by);
  ctx.stroke();

  // pivot / ceiling
  ctx.fillStyle = pal.text3;
  ctx.fillRect(px - 46, py - 6, 92, 4);
  ctx.beginPath();
  ctx.arc(px, py, 4, 0, Math.PI * 2);
  ctx.fillStyle = pal.ink;
  ctx.fill();

  // bob
  const grad = ctx.createRadialGradient(bx - bobR * 0.35, by - bobR * 0.35, bobR * 0.1, bx, by, bobR);
  grad.addColorStop(0, alpha(pal.series[0], 0.75));
  grad.addColorStop(1, pal.series[0]);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(bx, by, bobR, 0, Math.PI * 2);
  ctx.fill();

  // vectors (velocity and acceleration of the bob), not to scale
  if (o.vectors) {
    const v = l * p.omega;
    const tx = Math.cos(th);
    const ty = Math.sin(th); // tangent direction in world (x right, y up) for increasing θ
    const vs = 18; // px per m s⁻¹ (display scale)
    drawArrow(ctx, bx, by, bx + tx * v * vs, by - ty * v * vs, pal.series[1], 'v');
    const at = p.aTangential;
    const ac = p.aCentripetal; // towards pivot
    const ax = at * tx + ac * -Math.sin(th);
    const ay = at * ty + ac * Math.cos(th);
    const as = 6; // px per m s⁻²
    drawArrow(ctx, bx, by, bx + ax * as, by - ay * as, pal.series[2], 'a');
  }

  // energy bars
  drawEnergyBars(ctx, view, p, pal, o.E0);
}

function drawEnergyBars(ctx: CanvasRenderingContext2D, view: View, p: Pendulum, pal: Palette, E0: number) {
  const h = Math.min(150, view.height * 0.3);
  const w = 14;
  const x0 = 22; // bottom-left corner: free on both desktop and mobile layouts
  const y0 = view.height - 96;
  if (y0 - h < 120) return;
  const vals = [
    { v: p.Ek, c: pal.series[1], l: 'Eₖ' },
    { v: p.Ep, c: pal.series[2], l: 'Eₚ' },
    { v: p.E, c: pal.series[3], l: 'E' },
  ];
  const max = Math.max(E0, 1e-12);
  ctx.font = '600 11px Inter Variable, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  vals.forEach((b, i) => {
    const x = x0 + i * 30;
    ctx.fillStyle = pal.grid;
    ctx.fillRect(x, y0 - h, w, h);
    const bh = Math.max(0, Math.min(1, b.v / max)) * h;
    ctx.fillStyle = b.c;
    ctx.fillRect(x, y0 - bh, w, bh);
    ctx.fillStyle = pal.text2;
    ctx.fillText(b.l, x + w / 2, y0 + 5);
  });
}
