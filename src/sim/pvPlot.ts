/**
 * p–V diagram helper (canvas). Axes in display units: V in litres (dm³), p in kPa.
 * Optional faint isotherms pV = nRT for a set of temperatures.
 */
import { R } from '../core/constants';
import type { Palette } from './palette';
import { niceStep } from './draw';

export interface PVFrame {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  Vmax: number; // m³
  pmax: number; // Pa
  X: (V: number) => number;
  Y: (p: number) => number;
}

export function pvFrame(x0: number, y0: number, x1: number, y1: number, Vmax: number, pmax: number): PVFrame {
  return {
    x0,
    x1,
    y0,
    y1,
    Vmax,
    pmax,
    X: (V) => x0 + (V / Vmax) * (x1 - x0),
    Y: (p) => y1 - (p / pmax) * (y1 - y0),
  };
}

export function drawPVAxes(ctx: CanvasRenderingContext2D, f: PVFrame, pal: Palette, isotherms: { n: number; T: number[] } | null = null): void {
  ctx.lineWidth = 1;
  ctx.font = '500 10px Inter Variable, system-ui, sans-serif';
  const vL = f.Vmax * 1e3;
  const xs = niceStep((f.x1 - f.x0) / vL, 50);
  for (let v = 0; v <= vL + 1e-9; v += xs) {
    const x = f.X(v / 1e3);
    ctx.strokeStyle = v === 0 ? pal.gridStrong : pal.grid;
    ctx.beginPath();
    ctx.moveTo(x, f.y0);
    ctx.lineTo(x, f.y1);
    ctx.stroke();
    ctx.fillStyle = pal.text3;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(`${+v.toPrecision(6)}`, x, f.y1 + 4);
  }
  const pk = f.pmax / 1e3;
  const ys = niceStep((f.y1 - f.y0) / pk, 36);
  for (let p = 0; p <= pk + 1e-9; p += ys) {
    const y = f.Y(p * 1e3);
    ctx.strokeStyle = p === 0 ? pal.gridStrong : pal.grid;
    ctx.beginPath();
    ctx.moveTo(f.x0, y);
    ctx.lineTo(f.x1, y);
    ctx.stroke();
    ctx.fillStyle = pal.text3;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${+p.toPrecision(6)}`, f.x0 - 6, y);
  }
  ctx.textAlign = 'right';
  ctx.textBaseline = 'top';
  ctx.fillText('V / dm³', f.x1, f.y1 + 18);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  ctx.fillText('p / kPa', f.x0, f.y0 - 6);
  if (isotherms) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(f.x0, f.y0, f.x1 - f.x0, f.y1 - f.y0);
    ctx.clip();
    ctx.strokeStyle = pal.grid;
    ctx.setLineDash([2, 4]);
    for (const T of isotherms.T) {
      ctx.beginPath();
      for (let i = 1; i <= 100; i++) {
        const V = (f.Vmax * i) / 100;
        const p = (isotherms.n * R * T) / V;
        if (i === 1) ctx.moveTo(f.X(V), f.Y(p));
        else ctx.lineTo(f.X(V), f.Y(p));
      }
      ctx.stroke();
      const V = f.Vmax * 0.97;
      ctx.fillStyle = pal.text3;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'bottom';
      ctx.fillText(`${T} K`, f.X(V), f.Y((isotherms.n * R * T) / V) - 2);
    }
    ctx.restore();
  }
}
