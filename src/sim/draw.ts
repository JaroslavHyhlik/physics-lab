/** Small canvas drawing helpers shared by simulations. */

export function drawArrow(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: string,
  label?: string,
  width = 2.5,
): void {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  if (len < 2) return;
  const ux = dx / len;
  const uy = dy / len;
  const head = Math.min(10, len * 0.45);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2 - ux * head * 0.8, y2 - uy * head * 0.8);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - ux * head - uy * head * 0.5, y2 - uy * head + ux * head * 0.5);
  ctx.lineTo(x2 - ux * head + uy * head * 0.5, y2 - uy * head - ux * head * 0.5);
  ctx.closePath();
  ctx.fill();
  if (label) drawSymbol(ctx, label, x2 + ux * 13, y2 + uy * 13, color);
}

/**
 * Physics symbol in italic serif with an optional subscript after "_" (e.g. "F_N", "v_y"),
 * centred at (x, y).
 */
export function drawSymbol(ctx: CanvasRenderingContext2D, sym: string, x: number, y: number, color: string, size = 14): void {
  const [base, sub] = sym.split('_');
  const fBase = `italic 700 ${size}px "Times New Roman", Georgia, serif`;
  const fSub = `italic 700 ${Math.round(size * 0.72)}px "Times New Roman", Georgia, serif`;
  ctx.font = fBase;
  const wb = ctx.measureText(base).width;
  ctx.font = fSub;
  const ws = sub ? ctx.measureText(sub).width + 1 : 0;
  const x0 = x - (wb + ws) / 2;
  ctx.fillStyle = color;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.font = fBase;
  ctx.fillText(base, x0, y);
  if (sub) {
    ctx.font = fSub;
    ctx.fillText(sub, x0 + wb + 1, y + size * 0.3);
  }
}

/** A "nice" 1-2-5 step so that grid lines are at least minPx apart. */
export function niceStep(pxPerUnit: number, minPx = 60): number {
  const raw = minPx / pxPerUnit;
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
  for (const m of [1, 2, 5, 10]) if (m * p >= raw) return m * p;
  return 10 * p;
}

/** Grid with numbered axes in world units; labels sit along the bottom and left edges. */
export function drawGridAxes(
  ctx: CanvasRenderingContext2D,
  view: { sx(x: number): number; sy(y: number): number; left: number; right: number; top: number; bottom: number; scale: number; width: number; height: number },
  pal: { grid: string; gridStrong: string; text3: string },
  xLabel = 'x / m',
  yLabel = 'y / m',
): void {
  const step = niceStep(view.scale);
  ctx.lineWidth = 1;
  ctx.font = '500 10px Inter Variable, system-ui, sans-serif';
  const fmtTick = (v: number) => String(Math.round(v / step) * step >= 1000 ? +(v.toPrecision(4)) : +v.toFixed(Math.max(0, -Math.floor(Math.log10(step)))));
  for (let x = Math.ceil(view.left / step) * step; x <= view.right; x += step) {
    const px = Math.round(view.sx(x)) + 0.5;
    ctx.strokeStyle = Math.abs(x) < step / 2 ? pal.gridStrong : pal.grid;
    ctx.beginPath();
    ctx.moveTo(px, 0);
    ctx.lineTo(px, view.height);
    ctx.stroke();
    ctx.fillStyle = pal.text3;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(fmtTick(x).replace('-', '−'), px, view.height - 4);
  }
  for (let y = Math.ceil(view.bottom / step) * step; y <= view.top; y += step) {
    const py = Math.round(view.sy(y)) + 0.5;
    ctx.strokeStyle = Math.abs(y) < step / 2 ? pal.gridStrong : pal.grid;
    ctx.beginPath();
    ctx.moveTo(0, py);
    ctx.lineTo(view.width, py);
    ctx.stroke();
    ctx.fillStyle = pal.text3;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    // left margin keeps labels clear of the floating tools toolbar
    if (py > 14 && py < view.height - 18) ctx.fillText(fmtTick(y).replace('-', '−'), 60, py - 7);
  }
  ctx.fillStyle = pal.text3;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'bottom';
  ctx.fillText(xLabel, view.width - 6, view.height - 16);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(yLabel, 60, 6);
}

/** Rounded label box with text, centred at (x, y). */
export function drawTag(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  text: string,
  fg: string,
  bg: string,
  font = '600 12px Inter Variable, system-ui, sans-serif',
): void {
  ctx.font = font;
  const w = ctx.measureText(text).width + 12;
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.roundRect(x - w / 2, y - 10, w, 20, 6);
  ctx.fill();
  ctx.fillStyle = fg;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y + 0.5);
}
