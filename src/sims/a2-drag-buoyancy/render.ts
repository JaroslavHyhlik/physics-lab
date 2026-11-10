import type { StokesFall } from '../../physics/stokes';
import type { View } from '../../sim/view';
import { alpha, type Palette } from '../../sim/palette';
import { drawArrow, drawTag } from '../../sim/draw';
import { fmt } from '../../core/format';

/** World coordinates: x across the cylinder, y = height above the bottom (m). */
export function drawStokes(ctx: CanvasRenderingContext2D, view: View, b: StokesFall, pal: Palette, forces: boolean): void {
  ctx.fillStyle = pal.bg;
  ctx.fillRect(0, 0, view.width, view.height);
  const H = b.p.H;
  const half = Math.max(0.04, H * 0.09);
  // fluid
  const x0 = view.sx(-half);
  const x1 = view.sx(half);
  const yTop = view.sy(H);
  const yBot = view.sy(0);
  const air = b.p.rhoF < 50;
  ctx.fillStyle = alpha(pal.dark ? '#d9b44a' : '#e8c766', air ? 0.06 : Math.min(0.55, 0.15 + 0.05 * Math.log10(1 + b.p.eta * 100)));
  ctx.fillRect(x0, yTop, x1 - x0, yBot - yTop);
  // glass walls
  ctx.strokeStyle = pal.text3;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x0, view.sy(H * 1.06));
  ctx.lineTo(x0, yBot);
  ctx.lineTo(x1, yBot);
  ctx.lineTo(x1, view.sy(H * 1.06));
  ctx.stroke();
  // scale marks every 1 cm (labels every 5 cm), depth measured from the surface
  ctx.font = '500 10px Inter Variable, system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  const step = H > 1 ? 0.05 : 0.01;
  for (let d = 0; d <= H + 1e-9; d += step) {
    const y = view.sy(H - d);
    const major = Math.round(d / step) % 5 === 0;
    ctx.strokeStyle = pal.text3;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x0, y);
    ctx.lineTo(x0 + (major ? 12 : 6), y);
    ctx.stroke();
    if (major) {
      ctx.fillStyle = pal.text2;
      ctx.fillText(`${Math.round(d * 100)} cm`, x0 - 6, y);
    }
  }
  // sphere (at least 5 px so it stays visible)
  const cy = H - b.y[0];
  const rPx = Math.max(5, b.p.r * view.scale);
  const px = view.sx(0);
  const py = view.sy(cy);
  ctx.fillStyle = pal.series[0];
  ctx.beginPath();
  ctx.arc(px, py, rPx, 0, Math.PI * 2);
  ctx.fill();
  if (rPx > b.p.r * view.scale + 0.5) {
    ctx.fillStyle = pal.text3;
    ctx.textAlign = 'left';
    ctx.fillText('sphere enlarged', x1 + 8, view.sy(H) - 14);
  }
  if (forces) {
    const W = b.weight;
    const k = Math.min(90, view.height * 0.18) / W;
    const lab = (f: number) => `${fmt(Math.abs(f), 3)} N`;
    drawArrow(ctx, px, py + rPx, px, py + rPx + W * k, pal.series[1], 'mg');
    drawArrow(ctx, px - 4, py - rPx, px - 4, py - rPx - b.buoyancy * k, pal.series[2], 'F_b');
    const d = b.drag();
    if (Math.abs(d) * k > 2) drawArrow(ctx, px + 4, py - Math.sign(d) * rPx, px + 4, py - Math.sign(d) * (rPx + Math.abs(d) * k), pal.series[3], 'F_d');
    ctx.textAlign = 'left';
    drawTag(ctx, x1 + 70, py - 18, `F_b ${lab(b.buoyancy)}`, pal.series[2], pal.surface);
    drawTag(ctx, x1 + 70, py + 2, `F_d ${lab(d)}`, pal.series[3], pal.surface);
    drawTag(ctx, x1 + 70, py + 22, `mg ${lab(W)}`, pal.series[1], pal.surface);
  }
}
