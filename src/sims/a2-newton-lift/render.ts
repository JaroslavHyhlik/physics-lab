import type { Lift, Pulley } from '../../physics/newton';
import { alpha, type Palette } from '../../sim/palette';
import { drawArrow, drawTag } from '../../sim/draw';
import { fmt } from '../../core/format';

const lab = (f: number) => `${fmt(Math.abs(f), 3)} N`;

/** Lift in a shaft; the camera follows the lift. Screen coordinates. */
export function drawLift(ctx: CanvasRenderingContext2D, W: number, H: number, lift: Lift, pal: Palette, forces: boolean): void {
  ctx.fillStyle = pal.bg;
  ctx.fillRect(0, 0, W, H);
  const usable = H - 70;
  const scale = Math.min(70, usable / 4.2); // px per metre
  const cx = W * 0.42;
  const cyLift = usable * 0.47; // screen y of the lift floor
  const h = lift.height();
  const sy = (y: number) => cyLift - (y - h) * scale;
  // shaft walls and floors (every 3 m)
  ctx.strokeStyle = pal.gridStrong;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx - 1.3 * scale, 0);
  ctx.lineTo(cx - 1.3 * scale, H);
  ctx.moveTo(cx + 1.3 * scale, 0);
  ctx.lineTo(cx + 1.3 * scale, H);
  ctx.stroke();
  ctx.font = '600 11px Inter Variable, system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  const lo = Math.floor((h - 6) / 3) * 3;
  for (let y = lo; y <= h + 6; y += 3) {
    const py = sy(y);
    ctx.strokeStyle = pal.grid;
    ctx.beginPath();
    ctx.moveTo(cx + 1.3 * scale, py);
    ctx.lineTo(cx + 2.4 * scale, py);
    ctx.stroke();
    ctx.fillStyle = pal.text3;
    ctx.fillText(`floor ${y / 3}`, cx - 1.4 * scale, py);
  }
  // cabin
  const top = sy(2.4);
  const bot = sy(0);
  ctx.fillStyle = alpha(pal.dark ? '#5d6678' : '#c9ced8', 0.35);
  ctx.strokeStyle = pal.text2;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(cx - 1.1 * scale, top, 2.2 * scale, bot - top, 6);
  ctx.fill();
  ctx.stroke();
  // cable (unless it snapped)
  if (!lift.p.freeFall) {
    ctx.strokeStyle = pal.text3;
    ctx.beginPath();
    ctx.moveTo(cx, 0);
    ctx.lineTo(cx, top);
    ctx.stroke();
  }
  // scales + person
  const sx = cx - 0.2 * scale;
  ctx.fillStyle = pal.ink;
  ctx.fillRect(sx - 0.35 * scale, bot - 0.12 * scale, 0.7 * scale, 0.12 * scale);
  const pf = bot - 0.12 * scale;
  ctx.strokeStyle = pal.series[0];
  ctx.lineWidth = Math.max(3, scale * 0.08);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(sx - 0.15 * scale, pf);
  ctx.lineTo(sx, pf - 0.85 * scale);
  ctx.lineTo(sx + 0.15 * scale, pf);
  ctx.moveTo(sx, pf - 0.85 * scale);
  ctx.lineTo(sx, pf - 1.45 * scale);
  ctx.moveTo(sx - 0.3 * scale, pf - 1.15 * scale);
  ctx.lineTo(sx + 0.3 * scale, pf - 1.15 * scale);
  ctx.stroke();
  ctx.lineCap = 'butt';
  ctx.fillStyle = pal.series[0];
  ctx.beginPath();
  ctx.arc(sx, pf - 1.62 * scale, 0.16 * scale, 0, Math.PI * 2);
  ctx.fill();
  // scales display
  const N = lift.normal();
  drawTag(ctx, sx, bot + 18, `scales: ${lab(N)} (“${fmt(N / lift.p.g, 3)} kg”)`, pal.ink, pal.surface);
  if (forces) {
    const k = Math.min(1.2 * scale, 90) / (lift.p.m * lift.p.g);
    const midY = pf - 0.9 * scale;
    drawArrow(ctx, sx + 0.45 * scale, midY, sx + 0.45 * scale, midY + lift.p.m * lift.p.g * k, pal.series[1], 'mg');
    if (N > 1e-9) drawArrow(ctx, sx - 0.45 * scale, pf, sx - 0.45 * scale, pf - N * k, pal.series[2], 'N');
    const a = lift.accel();
    if (Math.abs(a) > 1e-9) {
      const ax = cx + 0.75 * scale;
      drawArrow(ctx, ax, (top + bot) / 2, ax, (top + bot) / 2 - a * 18, pal.hl, 'a');
    }
  }
}

/** Atwood machine or block on a table. Screen coordinates. */
export function drawPulley(ctx: CanvasRenderingContext2D, W: number, H: number, sys: Pulley, pal: Palette, forces: boolean): void {
  ctx.fillStyle = pal.bg;
  ctx.fillRect(0, 0, W, H);
  const usable = H - 70;
  const scale = Math.min(110, usable / 3.4);
  const { m1, m2, g } = sys.p;
  const side = (m: number) => (0.3 + 0.14 * Math.cbrt(m)) * scale;
  const T = sys.tension;
  const k = Math.min(80, usable * 0.2) / (Math.max(m1, m2) * g);
  const R = 0.18 * scale;
  if (sys.p.mode === 'atwood') {
    const px = W * 0.45;
    const py = 40;
    ctx.fillStyle = pal.text3;
    ctx.fillRect(px - 50, py - R - 14, 100, 6);
    ctx.strokeStyle = pal.text2;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(px, py, R, 0, Math.PI * 2);
    ctx.stroke();
    const y1 = py + (1.2 + sys.s) * scale;
    const y2 = py + (1.2 - sys.s) * scale;
    ctx.strokeStyle = pal.ink;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(px - R, py);
    ctx.lineTo(px - R, y1);
    ctx.moveTo(px + R, py);
    ctx.lineTo(px + R, y2);
    ctx.stroke();
    for (const [x, y, m, col, name] of [
      [px - R, y1, m1, pal.series[0], 'm₁'],
      [px + R, y2, m2, pal.series[1], 'm₂'],
    ] as const) {
      const s = side(m);
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.roundRect(x - s / 2, y, s, s, 4);
      ctx.fill();
      ctx.fillStyle = pal.text2;
      ctx.font = '700 11px Inter Variable, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(`${name} = ${fmt(m, 2)} kg`, x, y + s + 6);
      if (forces) {
        const dir = x < px ? -1 : 1;
        const ax = x + dir * (s / 2 + 14);
        drawArrow(ctx, ax, y + s / 2, ax, y + s / 2 - T * k, pal.series[2], 'T');
        drawArrow(ctx, ax, y + s / 2, ax, y + s / 2 + m * g * k, pal.series[3], 'mg');
      }
    }
    drawTag(ctx, px, py + R + 22, `T = ${lab(T)}`, pal.series[2], pal.surface);
    return;
  }
  // table
  const tx = W * 0.62;
  const ty = usable * 0.38;
  ctx.fillStyle = alpha(pal.dark ? '#5d6678' : '#aab2c0', 0.5);
  ctx.fillRect(tx - 3.2 * scale, ty, 3.2 * scale, 12);
  ctx.fillRect(tx - 3.0 * scale, ty + 12, 10, usable - ty);
  ctx.strokeStyle = pal.text2;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(tx + R, ty - R + 2, R, 0, Math.PI * 2);
  ctx.stroke();
  const s1 = side(m1);
  const s2 = side(m2);
  const bx = tx - 2.4 * scale + sys.s * scale; // left edge of block
  const hy = ty + 0.5 * scale + sys.s * scale; // top of hanging mass
  ctx.strokeStyle = pal.ink;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(bx + s1, ty - s1 / 2);
  ctx.lineTo(tx + R, ty - s1 / 2);
  ctx.moveTo(tx + 2 * R, ty - R + 2);
  ctx.lineTo(tx + 2 * R, hy);
  ctx.stroke();
  ctx.fillStyle = pal.series[0];
  ctx.beginPath();
  ctx.roundRect(bx, ty - s1, s1, s1, 4);
  ctx.fill();
  ctx.fillStyle = pal.series[1];
  ctx.beginPath();
  ctx.roundRect(tx + 2 * R - s2 / 2, hy, s2, s2, 4);
  ctx.fill();
  ctx.fillStyle = pal.text2;
  ctx.font = '700 11px Inter Variable, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText(`m₁ = ${fmt(m1, 2)} kg`, bx + s1 / 2 - 34, ty - s1 - 4);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(`m₂ = ${fmt(m2, 2)} kg`, tx + 2 * R + s2 / 2 + 40, hy + s2 / 2);
  if (forces) {
    const cy = ty - s1 / 2;
    drawArrow(ctx, bx + s1 / 2, cy, bx + s1 / 2 + T * k, cy, pal.series[2], 'T');
    const f = sys.friction;
    if (f > 1e-9) drawArrow(ctx, bx + s1 / 2, ty - 4, bx + s1 / 2 - f * k, ty - 4, pal.series[4], 'F_f');
    drawArrow(ctx, bx + s1 / 2, cy, bx + s1 / 2, cy + m1 * g * k, pal.series[3], 'mg');
    drawArrow(ctx, bx + s1 / 2, cy, bx + s1 / 2, cy - m1 * g * k, pal.series[5], 'F_N');
    const hx = tx + 2 * R + s2 / 2 + 14;
    drawArrow(ctx, hx, hy + s2 / 2, hx, hy + s2 / 2 - T * k, pal.series[2], 'T');
    drawArrow(ctx, hx, hy + s2 / 2, hx, hy + s2 / 2 + m2 * g * k, pal.series[3], 'mg');
  }
  drawTag(ctx, tx - 1.6 * scale, ty + 30, `T = ${lab(T)} · friction ${lab(sys.friction)} (${sys.moves ? 'dynamic' : 'static'})`, pal.ink, pal.surface);
}
