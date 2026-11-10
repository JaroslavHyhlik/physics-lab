import type { Beam, LadderParams } from '../../physics/torque';
import { ladderForces, pivotReaction } from '../../physics/torque';
import type { View } from '../../sim/view';
import { alpha, type Palette } from '../../sim/palette';
import { drawArrow, drawTag } from '../../sim/draw';
import { fmt } from '../../core/format';

export const PIVOT_Y = 0.6;
const lab = (f: number) => `${fmt(Math.abs(f), 3)} N`;

/** world position of a point x along the (tilted) beam */
export function beamPoint(b: Beam, x: number, up = 0): [number, number] {
  const th = b.theta;
  const dx = x - b.p.xp;
  return [b.p.xp + dx * Math.cos(th) - up * Math.sin(th), PIVOT_Y + dx * Math.sin(th) + up * Math.cos(th)];
}

export function blockSize(m: number): number {
  return 0.18 + 0.08 * Math.cbrt(m);
}

export function drawBeam(ctx: CanvasRenderingContext2D, view: View, b: Beam, pal: Palette): void {
  ctx.fillStyle = pal.bg;
  ctx.fillRect(0, 0, view.width, view.height);
  // ground
  ctx.fillStyle = pal.grid;
  ctx.fillRect(0, view.sy(0), view.width, view.height - view.sy(0));
  ctx.strokeStyle = pal.gridStrong;
  ctx.beginPath();
  ctx.moveTo(0, view.sy(0));
  ctx.lineTo(view.width, view.sy(0));
  ctx.stroke();
  // pivot
  const px = view.sx(b.p.xp);
  ctx.fillStyle = pal.text2;
  ctx.beginPath();
  ctx.moveTo(px, view.sy(PIVOT_Y));
  ctx.lineTo(px - 0.25 * view.scale, view.sy(0));
  ctx.lineTo(px + 0.25 * view.scale, view.sy(0));
  ctx.closePath();
  ctx.fill();
  // beam
  const L = b.p.L;
  const [ax, ay] = beamPoint(b, -L / 2);
  const [bx, by] = beamPoint(b, L / 2);
  ctx.strokeStyle = b.p.mb > 0 ? pal.series[5] : pal.text3;
  ctx.lineWidth = Math.max(5, 0.08 * view.scale);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(view.sx(ax), view.sy(ay));
  ctx.lineTo(view.sx(bx), view.sy(by));
  ctx.stroke();
  ctx.lineCap = 'butt';
  // distance scale marks every 0.5 m from the pivot
  ctx.fillStyle = pal.text3;
  ctx.font = '500 10px Inter Variable, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  for (let d = -4; d <= 4; d += 0.5) {
    const x = b.p.xp + d;
    if (x < -L / 2 - 1e-9 || x > L / 2 + 1e-9) continue;
    const [mx, my] = beamPoint(b, x, -0.06);
    ctx.fillText(`${Math.abs(d)}`, view.sx(mx), view.sy(my) + 4);
  }
  // weights
  const k = Math.min(70, view.height * 0.18) / Math.max(pivotReaction(b.p), 1e-9) * 2;
  const masses = b.p.masses;
  masses.forEach((q, i) => {
    if (q.m <= 0) return;
    const s = blockSize(q.m);
    const [cx, cy] = beamPoint(b, q.x, s / 2 + 0.04);
    ctx.save();
    ctx.translate(view.sx(cx), view.sy(cy));
    ctx.rotate(-b.theta);
    ctx.fillStyle = pal.series[i];
    ctx.beginPath();
    ctx.roundRect((-s / 2) * view.scale, (-s / 2) * view.scale, s * view.scale, s * view.scale, 4);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 11px Inter Variable, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${fmt(q.m, 2)} kg`, 0, 0);
    ctx.restore();
    const W = q.m * b.p.g;
    drawArrow(ctx, view.sx(cx), view.sy(cy), view.sx(cx), view.sy(cy) + W * k, pal.series[i], undefined, 2);
    drawTag(ctx, view.sx(cx), view.sy(cy) + W * k + 14, `${lab(W)} · d = ${fmt(Math.abs(q.x - b.p.xp), 3)} m`, pal.series[i], pal.surface);
  });
  if (b.p.mb > 0) {
    const [cx, cy] = beamPoint(b, 0);
    const W = b.p.mb * b.p.g;
    drawArrow(ctx, view.sx(cx), view.sy(cy), view.sx(cx), view.sy(cy) + W * k, pal.series[5], undefined, 2);
  }
  // pivot reaction (only when held still)
  if (Math.abs(b.theta) < 1e-9 || b.resting) {
    const R = pivotReaction(b.p);
    drawArrow(ctx, px - 14, view.sy(PIVOT_Y) + 4, px - 14, view.sy(PIVOT_Y) + 4 - R * k * 0.5, pal.series[2], undefined, 2);
    drawTag(ctx, px - 14, view.sy(PIVOT_Y) - R * k * 0.5 - 12, `pivot ${lab(R)}${b.resting ? ' + ground' : ''}`, pal.series[2], pal.surface);
  }
}

export function drawLadder(ctx: CanvasRenderingContext2D, view: View, p: LadderParams, pal: Palette): void {
  ctx.fillStyle = pal.bg;
  ctx.fillRect(0, 0, view.width, view.height);
  const F = ladderForces(p);
  const { L, theta } = p;
  // floor and wall (wall at x = 0)
  ctx.fillStyle = pal.grid;
  ctx.fillRect(0, view.sy(0), view.width, view.height);
  ctx.fillRect(view.sx(0), 0, view.width, view.sy(0));
  ctx.strokeStyle = pal.gridStrong;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, view.sy(0));
  ctx.lineTo(view.sx(0), view.sy(0));
  ctx.lineTo(view.sx(0), 0);
  ctx.stroke();
  const foot: [number, number] = [-L * Math.cos(theta), 0];
  const top: [number, number] = [0, L * Math.sin(theta)];
  const along = (d: number): [number, number] => [foot[0] + d * Math.cos(theta), d * Math.sin(theta)];
  ctx.strokeStyle = F.slips ? pal.positive : pal.series[5];
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(view.sx(foot[0]), view.sy(foot[1]));
  ctx.lineTo(view.sx(top[0]), view.sy(top[1]));
  ctx.stroke();
  // person
  const [hx, hy] = along(Math.min(p.d, L));
  if (p.M > 0) {
    ctx.fillStyle = pal.series[0];
    ctx.beginPath();
    ctx.arc(view.sx(hx) - 10, view.sy(hy) - 18, 10, 0, Math.PI * 2);
    ctx.fill();
  }
  const k = Math.min(90, view.height * 0.22) / ((p.m + p.M) * p.g);
  const [mx, my] = along(L / 2);
  drawArrow(ctx, view.sx(mx), view.sy(my), view.sx(mx), view.sy(my) + p.m * p.g * k, pal.series[5], 'mg', 2);
  if (p.M > 0) drawArrow(ctx, view.sx(hx) - 10, view.sy(hy) - 18, view.sx(hx) - 10, view.sy(hy) - 18 + p.M * p.g * k, pal.series[0], 'Mg', 2);
  drawArrow(ctx, view.sx(0), view.sy(top[1]), view.sx(0) - F.Nw * k, view.sy(top[1]), pal.series[2], 'N_w', 2.5);
  drawArrow(ctx, view.sx(foot[0]), view.sy(0), view.sx(foot[0]), view.sy(0) - F.Nf * k, pal.series[2], 'N_f', 2.5);
  const fShown = Math.min(F.f, F.fmax);
  drawArrow(ctx, view.sx(foot[0]), view.sy(0) + 6, view.sx(foot[0]) + fShown * k, view.sy(0) + 6, pal.series[3], 'F_f', 2.5);
  // safe climbing limit
  if (F.dmax < L) {
    const [sx, sy] = along(F.dmax);
    ctx.fillStyle = pal.hl;
    ctx.beginPath();
    ctx.arc(view.sx(sx), view.sy(sy), 5, 0, Math.PI * 2);
    ctx.fill();
    drawTag(ctx, view.sx(sx) - 70, view.sy(sy), `slips beyond d = ${fmt(F.dmax, 3)} m`, pal.hl, pal.surface);
  }
  if (F.slips) drawTag(ctx, view.sx(foot[0]) + 60, view.sy(0) + 30, 'friction needed > μ_s F_N: the ladder slips!', pal.positive, alpha(pal.surface.startsWith('#') ? pal.surface : '#ffffff', 0.95));
}
