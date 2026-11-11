/** Small x–y plot on a canvas: grid, axis labels, theory curves, measured points and a fit line. */
import type { Palette } from './palette';
import { niceStep } from './draw';

export interface XYCurve {
  fn: (x: number) => number;
  color: string;
  dash?: number[];
  width?: number;
  /** number of sample points (default 300); raise it for very narrow peaks */
  samples?: number;
}
export interface XYPlotOpts {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  xmin: number;
  xmax: number;
  ymin: number;
  ymax: number;
  xLabel: string;
  yLabel: string;
  curves?: XYCurve[];
  points?: { x: number; y: number }[];
  pointColor?: string;
  current?: { x: number; y: number } | null;
  fit?: { slope: number; intercept: number; color: string } | null;
}

export function drawXYPlot(ctx: CanvasRenderingContext2D, pal: Palette, o: XYPlotOpts): { X: (x: number) => number; Y: (y: number) => number } {
  const X = (x: number) => o.x0 + ((x - o.xmin) / (o.xmax - o.xmin)) * (o.x1 - o.x0);
  const Y = (y: number) => o.y1 - ((y - o.ymin) / (o.ymax - o.ymin)) * (o.y1 - o.y0);
  ctx.lineWidth = 1;
  ctx.font = '500 10px Inter Variable, system-ui, sans-serif';
  const xs = niceStep((o.x1 - o.x0) / (o.xmax - o.xmin), 56);
  for (let x = Math.ceil(o.xmin / xs) * xs; x <= o.xmax + 1e-12; x += xs) {
    ctx.strokeStyle = Math.abs(x) < xs / 2 ? pal.gridStrong : pal.grid;
    ctx.beginPath();
    ctx.moveTo(X(x), o.y0);
    ctx.lineTo(X(x), o.y1);
    ctx.stroke();
    ctx.fillStyle = pal.text3;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(`${+x.toPrecision(6)}`.replace('-', '−'), X(x), o.y1 + 4);
  }
  const ys = niceStep((o.y1 - o.y0) / (o.ymax - o.ymin), 34);
  for (let y = Math.ceil(o.ymin / ys) * ys; y <= o.ymax + 1e-12; y += ys) {
    ctx.strokeStyle = Math.abs(y) < ys / 2 ? pal.gridStrong : pal.grid;
    ctx.beginPath();
    ctx.moveTo(o.x0, Y(y));
    ctx.lineTo(o.x1, Y(y));
    ctx.stroke();
    ctx.fillStyle = pal.text3;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${+y.toPrecision(6)}`.replace('-', '−'), o.x0 - 6, Y(y));
  }
  ctx.textAlign = 'right';
  ctx.textBaseline = 'top';
  ctx.fillText(o.xLabel, o.x1, o.y1 + 18);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  ctx.fillText(o.yLabel, o.x0, o.y0 - 6);
  ctx.save();
  ctx.beginPath();
  ctx.rect(o.x0, o.y0, o.x1 - o.x0, o.y1 - o.y0);
  ctx.clip();
  for (const c of o.curves ?? []) {
    ctx.strokeStyle = c.color;
    ctx.lineWidth = c.width ?? 2;
    ctx.setLineDash(c.dash ?? []);
    ctx.beginPath();
    let started = false;
    const ns = c.samples ?? 300;
    for (let i = 0; i <= ns; i++) {
      const x = o.xmin + ((o.xmax - o.xmin) * i) / ns;
      const y = c.fn(x);
      if (!Number.isFinite(y)) {
        started = false;
        continue;
      }
      if (!started) ctx.moveTo(X(x), Y(y));
      else ctx.lineTo(X(x), Y(y));
      started = true;
    }
    ctx.stroke();
  }
  ctx.setLineDash([]);
  if (o.fit && Number.isFinite(o.fit.slope)) {
    ctx.strokeStyle = o.fit.color;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(X(o.xmin), Y(o.fit.intercept + o.fit.slope * o.xmin));
    ctx.lineTo(X(o.xmax), Y(o.fit.intercept + o.fit.slope * o.xmax));
    ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.fillStyle = o.pointColor ?? pal.series[1];
  for (const p of o.points ?? []) {
    ctx.beginPath();
    ctx.arc(X(p.x), Y(p.y), 4.5, 0, Math.PI * 2);
    ctx.fill();
  }
  if (o.current) {
    ctx.strokeStyle = pal.ink;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(X(o.current.x), Y(o.current.y), 7, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
  ctx.lineWidth = 1;
  return { X, Y };
}
