import type { Spinner, Discs, MerryGoRound } from '../../physics/angularMomentum';
import { alpha, type Palette } from '../../sim/palette';
import { drawTag } from '../../sim/draw';
import { fmt } from '../../core/format';

function spokes(ctx: CanvasRenderingContext2D, cx: number, cy: number, R: number, ang: number, col: string, n = 6) {
  ctx.strokeStyle = col;
  ctx.lineWidth = 2;
  for (let i = 0; i < n; i++) {
    const a = ang + (i * 2 * Math.PI) / n;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + R * Math.cos(a), cy - R * Math.sin(a));
    ctx.stroke();
  }
}

export function drawSpinner(ctx: CanvasRenderingContext2D, W: number, H: number, s: Spinner, pal: Palette) {
  ctx.fillStyle = pal.bg;
  ctx.fillRect(0, 0, W, H);
  const usable = H - 76;
  const cx = W * 0.42;
  const cy = usable / 2 + 10;
  const k = Math.min(W * 0.32, usable * 0.42); // px per metre (arm radius up to ~1 m)
  ctx.fillStyle = alpha(pal.dark ? '#5d6678' : '#c9ced8', 0.4);
  ctx.beginPath();
  ctx.arc(cx, cy, 0.35 * k, 0, Math.PI * 2);
  ctx.fill();
  spokes(ctx, cx, cy, 0.35 * k, s.angle, pal.text3, 4);
  // arms + dumbbells
  for (const side of [0, Math.PI]) {
    const a = s.angle + side;
    const x = cx + s.r * k * Math.cos(a);
    const y = cy - s.r * k * Math.sin(a);
    ctx.strokeStyle = pal.series[0];
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(x, y);
    ctx.stroke();
    if (s.p.m > 0) {
      ctx.fillStyle = pal.series[1];
      ctx.beginPath();
      ctx.arc(x, y, 6 + 3 * Math.cbrt(s.p.m), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.fillStyle = pal.series[0];
  ctx.beginPath();
  ctx.arc(cx, cy, 0.16 * k, 0, Math.PI * 2);
  ctx.fill();
  drawTag(ctx, cx, cy + 0.5 * k + 16, `ω = ${fmt(s.omega, 3)} rad s⁻¹ · I = ${fmt(s.I, 3)} kg m²`, pal.ink, pal.surface);
}

export function drawDiscs(ctx: CanvasRenderingContext2D, W: number, H: number, d: Discs, pal: Palette) {
  ctx.fillStyle = pal.bg;
  ctx.fillRect(0, 0, W, H);
  const usable = H - 76;
  const cx = W * 0.42;
  const cy = usable / 2 + 10;
  const R1 = Math.min(W * 0.28, usable * 0.4);
  const R2 = R1 * 0.7;
  ctx.fillStyle = alpha(pal.series[0].startsWith('#') ? pal.series[0] : '#4361ee', 0.25);
  ctx.beginPath();
  ctx.arc(cx, cy, R1, 0, Math.PI * 2);
  ctx.fill();
  spokes(ctx, cx, cy, R1, d.a1, pal.series[0]);
  const dropped = d.t >= d.p.tDrop;
  ctx.globalAlpha = dropped ? 1 : 0.5;
  ctx.fillStyle = alpha(pal.series[1].startsWith('#') ? pal.series[1] : '#f2711c', 0.3);
  ctx.beginPath();
  ctx.arc(cx, cy, R2, 0, Math.PI * 2);
  ctx.fill();
  ctx.setLineDash(dropped ? [] : [6, 5]);
  ctx.strokeStyle = pal.series[1];
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, R2, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  spokes(ctx, cx, cy, R2, d.a2, pal.series[1], 3);
  ctx.globalAlpha = 1;
  const msg = !dropped ? `disc 2 is held above (drops at t = ${d.p.tDrop} s)` : d.joined ? 'turning together' : 'slipping: friction torque acts';
  drawTag(ctx, cx, cy + R1 + 18, msg, pal.ink, pal.surface);
}

export function drawMgr(ctx: CanvasRenderingContext2D, W: number, H: number, g: MerryGoRound, pal: Palette) {
  ctx.fillStyle = pal.bg;
  ctx.fillRect(0, 0, W, H);
  const usable = H - 76;
  const cx = W * 0.42;
  const cy = usable / 2 + 10;
  const R = Math.min(W * 0.28, usable * 0.4);
  ctx.fillStyle = alpha(pal.dark ? '#5d6678' : '#c9ced8', 0.4);
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.fill();
  spokes(ctx, cx, cy, R, g.platform, pal.series[0], 8);
  // fixed ground mark
  ctx.fillStyle = pal.hl;
  ctx.fillRect(cx + R + 8, cy - 2, 14, 4);
  const px = cx + R * 0.92 * Math.cos(g.person);
  const py = cy - R * 0.92 * Math.sin(g.person);
  ctx.fillStyle = pal.series[1];
  ctx.beginPath();
  ctx.arc(px, py, 10, 0, Math.PI * 2);
  ctx.fill();
  drawTag(ctx, cx, cy + R + 18, `platform ω = ${fmt(g.omegaP, 3)} rad s⁻¹ · person ω = ${fmt(g.omegaPerson, 3)} rad s⁻¹`, pal.ink, pal.surface);
}
