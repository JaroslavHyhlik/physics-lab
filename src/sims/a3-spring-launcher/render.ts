import type { SpringLauncher } from '../../physics/springLauncher';
import type { View } from '../../sim/view';
import { alpha, type Palette } from '../../sim/palette';
import { drawGridAxes, drawTag } from '../../sim/draw';
import { fmt } from '../../core/format';

export function drawLauncher(ctx: CanvasRenderingContext2D, view: View, s: SpringLauncher, pal: Palette, bars: boolean): void {
  ctx.fillStyle = pal.bg;
  ctx.fillRect(0, 0, view.width, view.height);
  drawGridAxes(ctx, view, pal, '', 'height / m', false);
  const L0 = Math.max(0.15, s.p.dx * 2); // natural length of the spring (drawn)
  const baseY = -L0; // spring base
  const top = Math.min(s.y, 0); // spring top follows the ball while compressed
  const x = 0;
  // tube / base
  ctx.fillStyle = alpha(pal.dark ? '#5d6678' : '#aab2c0', 0.5);
  ctx.fillRect(view.sx(-0.06), view.sy(baseY), view.sx(0.06) - view.sx(-0.06), 8);
  // spring zigzag from base to top
  const n = 12;
  const y0 = view.sy(baseY);
  const y1 = view.sy(top);
  const wPx = Math.max(10, 0.035 * view.scale);
  ctx.strokeStyle = pal.text2;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(view.sx(x), y0);
  for (let i = 1; i < n; i++) ctx.lineTo(view.sx(x) + (i % 2 ? -wPx : wPx), y0 + ((y1 - y0) * i) / n);
  ctx.lineTo(view.sx(x), y1);
  ctx.stroke();
  ctx.fillStyle = pal.text2;
  ctx.fillRect(view.sx(x) - wPx - 4, y1 - 3, 2 * wPx + 8, 4);
  // ball (bottom at y)
  const r = 9;
  ctx.fillStyle = pal.series[0];
  ctx.beginPath();
  ctx.arc(view.sx(x), view.sy(s.y) - r, r, 0, Math.PI * 2);
  ctx.fill();
  // predicted top (dashed)
  const H = s.predictedRise - s.p.dx;
  if (s.launches) {
    ctx.strokeStyle = pal.hl;
    ctx.setLineDash([6, 5]);
    ctx.beginPath();
    ctx.moveTo(view.sx(-0.25 * (view.right - view.left) * 0.4), view.sy(H));
    ctx.lineTo(view.sx(0.3), view.sy(H));
    ctx.stroke();
    ctx.setLineDash([]);
    drawTag(ctx, view.sx(0) + 90, view.sy(H) - 14, `½kΔx² = mgH → top at ${fmt(H, 3)} m`, pal.hl, pal.surface);
  }
  if (bars) drawBars(ctx, view, s, pal);
}

function drawBars(ctx: CanvasRenderingContext2D, view: View, s: SpringLauncher, pal: Palette) {
  const E0 = 0.5 * s.p.k * s.p.dx ** 2;
  const items = [
    { v: s.EH, c: pal.series[4], l: 'E_H' },
    { v: s.Ek, c: pal.series[1], l: 'Eₖ' },
    { v: s.Ep, c: pal.series[2], l: 'Eₚ' },
    { v: s.EH + s.Ek + s.Ep, c: pal.series[3], l: 'total' },
  ];
  const h = Math.min(160, view.height * 0.4);
  const x0 = view.width - 210;
  const y0 = view.height - 92;
  if (x0 < view.width * 0.5) return;
  ctx.font = '600 11px Inter Variable, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  items.forEach((b, i) => {
    const x = x0 + i * 46;
    ctx.fillStyle = pal.grid;
    ctx.fillRect(x, y0 - h, 22, h);
    const bh = Math.max(0, Math.min(1, b.v / E0)) * h;
    ctx.fillStyle = b.c;
    ctx.fillRect(x, y0 - bh, 22, bh);
    ctx.fillStyle = pal.text2;
    ctx.fillText(b.l, x + 11, y0 + 5);
  });
  ctx.fillStyle = pal.text3;
  ctx.textAlign = 'left';
  ctx.fillText(`energy (total ${fmt(E0, 3)} J)`, x0, y0 - h - 16);
}
