/**
 * Sankey diagram: one input band splitting into outputs. Band thickness ∝ value.
 * Drawn in screen coordinates inside the box (x, y, w, h).
 */
import { alpha } from './palette';

export interface SankeyFlow {
  label: string;
  value: number;
  color: string;
}

export function drawSankey(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  input: { label: string; value: number; color: string },
  outputs: SankeyFlow[],
  unit: string,
  fmt: (v: number) => string,
  textColor: string,
): void {
  const total = Math.max(input.value, 1e-12);
  const flows = outputs.filter((f) => f.value > total * 5e-3); // hide flows under 0.5 %
  const gap = 10;
  const inH = h * 0.62;
  const scale = inH / total;
  const inY = y + (h - inH) / 2;
  const x0 = x + 70;
  const x1 = x + w - 120;
  // input band
  ctx.fillStyle = alpha(input.color, 0.85);
  ctx.fillRect(x, inY, x0 - x, inH);
  ctx.font = '600 11px Inter Variable, system-ui, sans-serif';
  ctx.fillStyle = textColor;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  ctx.fillText(`${input.label} ${fmt(input.value)} ${unit}`, x, inY - 4);
  // outputs, stacked on the right with gaps
  const usedOut = flows.reduce((s, f) => s + f.value * scale, 0) + gap * (flows.length - 1);
  let yl = inY;
  let yr = y + (h - usedOut) / 2;
  for (const f of flows) {
    const t = f.value * scale;
    ctx.fillStyle = alpha(f.color, 0.75);
    ctx.beginPath();
    const mx = (x0 + x1) / 2;
    ctx.moveTo(x0, yl);
    ctx.bezierCurveTo(mx, yl, mx, yr, x1, yr);
    ctx.lineTo(x1 + 18, yr);
    ctx.lineTo(x1 + 18, yr + t);
    ctx.lineTo(x1, yr + t);
    ctx.bezierCurveTo(mx, yr + t, mx, yl + t, x0, yl + t);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = textColor;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillText(`${f.label}`, x1 + 24, yr + t / 2 - 7);
    ctx.fillText(`${fmt(f.value)} ${unit} (${((100 * f.value) / total).toFixed(0)} %)`, x1 + 24, yr + t / 2 + 7);
    yl += t;
    yr += t + gap;
  }
}
