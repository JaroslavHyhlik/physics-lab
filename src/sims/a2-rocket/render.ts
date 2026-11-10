import type { Rocket } from '../../physics/rocket';
import { alpha, type Palette } from '../../sim/palette';
import { drawArrow, niceStep } from '../../sim/draw';
import { fmt } from '../../core/format';

const alt = (h: number) => (h >= 10000 ? `${fmt(h / 1000, 3)} km` : `${fmt(h, 3)} m`);

/** The view zooms out so that the ground stays at the bottom; the rocket keeps a fixed size. */
export function drawRocket(ctx: CanvasRenderingContext2D, W: number, H: number, r: Rocket, pal: Palette, forces: boolean, span: number): void {
  const bottom = H - 80;
  const topY = 30;
  const h = r.y[0];
  const Y = (alt: number) => bottom - (alt / span) * (bottom - topY);
  ctx.fillStyle = pal.bg;
  ctx.fillRect(0, 0, W, H);
  // sky: thicker colour where the air is dense (smooth gradient)
  const sky = ctx.createLinearGradient(0, Y(0), 0, Y(span));
  for (let i = 0; i <= 10; i++) {
    const rho = Math.exp(-(span * i) / 10 / 8500);
    sky.addColorStop(i / 10, alpha('#5aa0e6', (pal.dark ? 0.18 : 0.28) * rho));
  }
  ctx.fillStyle = sky;
  ctx.fillRect(0, Y(span), W, Y(0) - Y(span));
  // ground
  ctx.fillStyle = alpha(pal.dark ? '#2a3a2a' : '#9ccf8a', 0.5);
  ctx.fillRect(0, bottom, W, H - bottom);
  // altitude scale
  const step = niceStep((bottom - topY) / span, 50);
  ctx.font = '500 10px Inter Variable, system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  for (let a = 0; a <= span; a += step) {
    const y = Y(a);
    ctx.strokeStyle = pal.grid;
    ctx.beginPath();
    ctx.moveTo(60, y);
    ctx.lineTo(W, y);
    ctx.stroke();
    ctx.fillStyle = pal.text3;
    ctx.fillText(alt(a), 62, y - 7);
  }
  // maximum altitude so far
  if (r.maxH > 0) {
    const y = Y(r.maxH);
    ctx.strokeStyle = pal.hl;
    ctx.setLineDash([6, 5]);
    ctx.beginPath();
    ctx.moveTo(W * 0.3, y);
    ctx.lineTo(W * 0.75, y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = pal.hl;
    ctx.textAlign = 'right';
    ctx.fillText(`max ${alt(r.maxH)}`, W * 0.75, y - 8);
  }
  // rocket (fixed size)
  const cx = W * 0.45;
  const base = Y(h);
  const L = 64;
  const w = 16;
  if (r.burning && r.t > 0) {
    const fl = 26 + 10 * Math.sin(r.t * 40);
    const g = ctx.createLinearGradient(cx, base, cx, base + fl);
    g.addColorStop(0, '#ffd166');
    g.addColorStop(1, 'rgba(255,90,40,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(cx - w / 2 + 2, base);
    ctx.lineTo(cx, base + fl);
    ctx.lineTo(cx + w / 2 - 2, base);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillStyle = pal.series[0];
  ctx.beginPath();
  ctx.moveTo(cx - w / 2, base);
  ctx.lineTo(cx - w / 2, base - L + 14);
  ctx.quadraticCurveTo(cx, base - L - 10, cx + w / 2, base - L + 14);
  ctx.lineTo(cx + w / 2, base);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = pal.series[3];
  ctx.beginPath();
  ctx.moveTo(cx - w / 2, base);
  ctx.lineTo(cx - w / 2 - 8, base + 4);
  ctx.lineTo(cx - w / 2, base - 16);
  ctx.moveTo(cx + w / 2, base);
  ctx.lineTo(cx + w / 2 + 8, base + 4);
  ctx.lineTo(cx + w / 2, base - 16);
  ctx.fill();
  // fuel gauge
  const frac = r.p.fuel > 0 ? Math.max(0, (r.y[2] - r.p.dry) / r.p.fuel) : 0;
  ctx.fillStyle = pal.surface;
  ctx.fillRect(cx - 3, base - L + 16, 6, L - 24);
  ctx.fillStyle = pal.hl;
  ctx.fillRect(cx - 3, base - 8 - (L - 24) * frac, 6, (L - 24) * frac);

  if (forces) {
    const m = r.y[2];
    const Wt = m * r.gAt(h);
    const F = r.thrust();
    const D = r.dragForce();
    const k = 90 / Math.max(F, Wt, Math.abs(D), 1e-9);
    const mid = base - L / 2;
    if (F > 0) drawArrow(ctx, cx + 22, mid, cx + 22, mid - F * k, pal.series[2], 'F');
    if (Wt > 0) drawArrow(ctx, cx - 22, mid, cx - 22, mid + Wt * k, pal.series[1], 'mg');
    if (Math.abs(D) * k > 3) drawArrow(ctx, cx + 40, mid, cx + 40, mid + D * k, pal.series[3], 'F_d');
  }
}
