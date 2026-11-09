import type { View } from '../sim/view';
import type { Interaction } from '../sim/interaction';
import type { Palette } from '../sim/palette';
import { alpha } from '../sim/palette';
import { fmt } from '../core/format';

/**
 * Measuring tape in world units (m). Drag either end to measure; drag the middle to move it.
 */
export class Ruler {
  enabled = false;
  ax: number;
  ay: number;
  bx: number;
  by: number;

  constructor(ax: number, ay: number, bx: number, by: number) {
    this.ax = ax;
    this.ay = ay;
    this.bx = bx;
    this.by = by;
  }

  get length(): number {
    return Math.hypot(this.bx - this.ax, this.by - this.ay);
  }

  /** Register drag handles; returns an unregister function. */
  attach(view: View, inter: Interaction): () => void {
    const offs: (() => void)[] = [];
    const end = (which: 'a' | 'b') => ({
      priority: 100,
      cursor: 'crosshair',
      hit: (px: number, py: number) => {
        if (!this.enabled) return Infinity;
        const x = which === 'a' ? this.ax : this.bx;
        const y = which === 'a' ? this.ay : this.by;
        return Math.hypot(view.sx(x) - px, view.sy(y) - py);
      },
      move: (px: number, py: number) => {
        if (which === 'a') {
          this.ax = view.wx(px);
          this.ay = view.wy(py);
        } else {
          this.bx = view.wx(px);
          this.by = view.wy(py);
        }
      },
    });
    offs.push(inter.add(end('a')), inter.add(end('b')));
    let grabX = 0;
    let grabY = 0;
    offs.push(
      inter.add({
        priority: 99,
        cursor: 'move',
        hit: (px, py) => {
          if (!this.enabled) return Infinity;
          return segDist(px, py, view.sx(this.ax), view.sy(this.ay), view.sx(this.bx), view.sy(this.by));
        },
        start: (px, py) => {
          grabX = view.wx(px);
          grabY = view.wy(py);
        },
        move: (px, py) => {
          const x = view.wx(px);
          const y = view.wy(py);
          const dx = x - grabX;
          const dy = y - grabY;
          this.ax += dx;
          this.bx += dx;
          this.ay += dy;
          this.by += dy;
          grabX = x;
          grabY = y;
        },
      }),
    );
    return () => offs.forEach((f) => f());
  }

  draw(ctx: CanvasRenderingContext2D, view: View, pal: Palette): void {
    if (!this.enabled) return;
    const x1 = view.sx(this.ax);
    const y1 = view.sy(this.ay);
    const x2 = view.sx(this.bx);
    const y2 = view.sy(this.by);
    const lenPx = Math.hypot(x2 - x1, y2 - y1);
    const ang = Math.atan2(y2 - y1, x2 - x1);
    const L = this.length;
    ctx.save();
    ctx.translate(x1, y1);
    ctx.rotate(ang);
    // tape body
    const w = 22;
    ctx.fillStyle = alpha(pal.hl.startsWith('#') ? pal.hl : '#f59e0b', pal.dark ? 0.22 : 0.18);
    ctx.strokeStyle = pal.hl;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(0, -w / 2, lenPx, w, 4);
    ctx.fill();
    ctx.stroke();
    // ticks: choose a 1-2-5 spacing at least 7 px apart
    if (L > 0) {
      const pxPerM = lenPx / L;
      let step = Math.pow(10, Math.floor(Math.log10(7 / pxPerM)));
      while (step * pxPerM < 7) step *= step.toString().includes('2') ? 2.5 : 2;
      ctx.strokeStyle = pal.ink;
      ctx.globalAlpha = 0.7;
      const n = Math.floor(L / step + 1e-9);
      ctx.beginPath();
      for (let i = 0; i <= n; i++) {
        const x = i * step * pxPerM;
        const major = i % 10 === 0;
        const mid = i % 5 === 0;
        const h = major ? 9 : mid ? 6 : 3.5;
        ctx.moveTo(x, -w / 2);
        ctx.lineTo(x, -w / 2 + h);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    ctx.restore();
    // label
    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2;
    const label = `${fmt(L, 3)} m`;
    ctx.font = '600 12px Inter Variable, system-ui, sans-serif';
    const tw = ctx.measureText(label).width;
    ctx.fillStyle = pal.surface;
    ctx.strokeStyle = pal.hl;
    ctx.beginPath();
    ctx.roundRect(mx - tw / 2 - 7, my + 14, tw + 14, 20, 10);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = pal.ink;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, mx, my + 24);
    // handles
    for (const [x, y] of [
      [x1, y1],
      [x2, y2],
    ]) {
      ctx.beginPath();
      ctx.arc(x, y, 7, 0, Math.PI * 2);
      ctx.fillStyle = pal.surface;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = pal.hl;
      ctx.stroke();
    }
  }
}

function segDist(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const l2 = dx * dx + dy * dy;
  const t = l2 ? Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / l2)) : 0;
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}
