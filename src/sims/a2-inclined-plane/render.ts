import type { Incline } from '../../physics/incline';
import type { View } from '../../sim/view';
import { alpha, type Palette } from '../../sim/palette';
import { drawArrow } from '../../sim/draw';
import { fmt } from '../../core/format';

export interface InclineDrawOptions {
  fbd: boolean;
  components: boolean;
}


export function drawIncline(ctx: CanvasRenderingContext2D, view: View, b: Incline, pal: Palette, o: InclineDrawOptions): void {
  ctx.fillStyle = pal.bg;
  ctx.fillRect(0, 0, view.width, view.height);
  const th = b.p.theta;
  const L = b.p.L;
  const c = Math.cos(th);
  const s = Math.sin(th);

  // ground and ramp
  const gy = view.sy(0);
  ctx.strokeStyle = pal.gridStrong;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, gy);
  ctx.lineTo(view.width, gy);
  ctx.stroke();
  ctx.fillStyle = alpha(pal.dark ? '#5d6678' : '#aab2c0', pal.dark ? 0.35 : 0.45);
  ctx.strokeStyle = pal.text3;
  ctx.beginPath();
  ctx.moveTo(view.sx(0), view.sy(0));
  ctx.lineTo(view.sx(L * c), view.sy(L * s));
  ctx.lineTo(view.sx(L * c), view.sy(0));
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // angle mark
  if (th > 0.01) {
    ctx.strokeStyle = pal.hl;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(view.sx(0), view.sy(0), 46, 0, -th, true);
    ctx.stroke();
    ctx.fillStyle = pal.hl;
    ctx.font = 'italic 600 13px "Times New Roman", Georgia, serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`θ = ${((th * 180) / Math.PI).toFixed(1)}°`, view.sx(0) + 52, view.sy(0) - 12);
  }

  // block (square resting on the slope); its centre is BLOCK/2 above the surface
  const half = 0.07 * L; // drawn block size (not physical)
  const cx = b.s * c - half * s;
  const cy = b.s * s + half * c;
  const pcx = view.sx(cx);
  const pcy = view.sy(cy);
  ctx.save();
  ctx.translate(pcx, pcy);
  ctx.rotate(-th);
  const hp = half * view.scale;
  ctx.fillStyle = pal.series[0];
  ctx.beginPath();
  ctx.roundRect(-hp, -hp, 2 * hp, 2 * hp, 4);
  ctx.fill();
  ctx.restore();

  if (!o.fbd) return;
  // free-body diagram: arrows from the block centre, scale so that mg ≈ 95 px
  const W = b.p.m * b.p.g;
  const k = Math.min(110, view.height * 0.28) / Math.max(W, 1e-9);
  const lab = (f: number) => `${fmt(Math.abs(f), 3)} N`;
  // unit vectors in screen space: up the slope (ux, uy), out of the slope (nx, ny)
  const ux = c;
  const uy = -s;
  const nx = -s;
  const ny = -c;
  drawArrow(ctx, pcx, pcy, pcx, pcy + W * k, pal.series[1], 'mg');
  label(ctx, pcx + 8, pcy + W * k + 4, lab(W), pal.series[1], 'left');
  const N = b.normal;
  drawArrow(ctx, pcx, pcy, pcx + nx * N * k, pcy + ny * N * k, pal.series[2], 'F_N');
  label(ctx, pcx + nx * N * k - 6, pcy + ny * N * k - 16, lab(N), pal.series[2], 'right');
  const f = b.friction;
  if (Math.abs(f) > 1e-9) {
    const ex = pcx - ux * hp * 0.0;
    drawArrow(ctx, ex, pcy, ex + ux * f * k, pcy + uy * f * k, pal.series[3], 'F_f');
    label(ctx, ex + ux * f * k, pcy + uy * f * k + 18, `${lab(f)} ${b.isStatic ? '(static)' : '(dynamic)'}`, pal.series[3], 'center');
  }
  if (Math.abs(b.p.F) > 1e-9) {
    drawArrow(ctx, pcx, pcy, pcx + ux * b.p.F * k, pcy + uy * b.p.F * k, pal.series[4], 'F');
  }
  if (o.components) {
    ctx.setLineDash([5, 4]);
    const Wp = W * s;
    const Wn = W * c;
    ctx.globalAlpha = 0.7;
    drawArrow(ctx, pcx, pcy, pcx - ux * Wp * k, pcy - uy * Wp * k, pal.series[1], undefined, 1.8);
    drawArrow(ctx, pcx, pcy, pcx - nx * Wn * k, pcy - ny * Wn * k, pal.series[1], undefined, 1.8);
    ctx.globalAlpha = 1;
    ctx.setLineDash([]);
    label(ctx, pcx - ux * Wp * k - 6, pcy - uy * Wp * k + 4, `mg sinθ = ${lab(Wp)}`, pal.series[1], 'right');
    label(ctx, pcx - nx * Wn * k + 8, pcy - ny * Wn * k + 8, `mg cosθ`, pal.series[1], 'left');
  }
}

function label(ctx: CanvasRenderingContext2D, x: number, y: number, t: string, color: string, align: CanvasTextAlign) {
  ctx.font = '600 11px Inter Variable, system-ui, sans-serif';
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.fillText(t, x, y);
}
