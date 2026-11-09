import type { Projectile, Body } from '../../physics/projectile';
import type { View } from '../../sim/view';
import { alpha, type Palette } from '../../sim/palette';
import { drawArrow, drawGridAxes, drawTag } from '../../sim/draw';
import { fmt } from '../../core/format';

/** Recorded path of one body: [x, y, x, y, ...] sampled every 1/60 s. */
export class Path {
  data = new Float32Array(8192);
  n = 0;
  push(x: number, y: number) {
    if (2 * this.n + 2 > this.data.length) {
      const d = new Float32Array(this.data.length * 2);
      d.set(this.data);
      this.data = d;
    }
    this.data[2 * this.n] = x;
    this.data[2 * this.n + 1] = y;
    this.n++;
  }
  clear() {
    this.n = 0;
  }
}

export interface ProjectileDrawOptions {
  showVacuum: boolean;
  showAir: boolean;
  components: boolean;
  dots: boolean;
  /** samples between position dots */
  dotEvery: number;
}

export function drawProjectile(
  ctx: CanvasRenderingContext2D,
  view: View,
  pr: Projectile,
  paths: { vac: Path; air: Path },
  pal: Palette,
  o: ProjectileDrawOptions,
): void {
  ctx.fillStyle = pal.bg;
  ctx.fillRect(0, 0, view.width, view.height);
  drawGridAxes(ctx, view, pal);

  // ground
  const gy = view.sy(0);
  ctx.fillStyle = alpha(pal.dark ? '#2a3a2a' : '#9ccf8a', pal.dark ? 0.35 : 0.35);
  ctx.fillRect(0, gy, view.width, view.height - gy);
  ctx.strokeStyle = pal.gridStrong;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, gy);
  ctx.lineTo(view.width, gy);
  ctx.stroke();

  // launch platform (cliff) and launcher
  const h0 = pr.p.h0;
  const lx = view.sx(0);
  const ly = view.sy(h0);
  if (h0 > 0) {
    ctx.fillStyle = alpha(pal.text3.startsWith('#') ? pal.text3 : '#888888', 0.25);
    ctx.fillRect(view.sx(view.left) - 2, ly, lx - view.sx(view.left) + 2, gy - ly);
  }
  const th = pr.p.angle;
  ctx.strokeStyle = pal.ink;
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(lx, ly);
  ctx.lineTo(lx + 28 * Math.cos(th), ly - 28 * Math.sin(th));
  ctx.stroke();
  ctx.lineCap = 'butt';
  if (Math.abs(th) > 0.02) {
    ctx.strokeStyle = pal.hl;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(lx, ly, 44, 0, -th, th > 0);
    ctx.stroke();
    ctx.fillStyle = pal.hl;
    ctx.font = 'italic 600 13px "Times New Roman", Georgia, serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`θ = ${((th * 180) / Math.PI).toFixed(1)}°`, lx + 50, ly - 22 * Math.sign(th));
  }

  const drawBody = (b: Body, path: Path, color: string, dashed: boolean) => {
    // path
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.setLineDash(dashed ? [7, 5] : []);
    ctx.beginPath();
    ctx.moveTo(view.sx(0), view.sy(h0));
    for (let i = 0; i < path.n; i++) ctx.lineTo(view.sx(path.data[2 * i]), view.sy(path.data[2 * i + 1]));
    ctx.lineTo(view.sx(b.s[0]), view.sy(b.s[1]));
    ctx.stroke();
    ctx.setLineDash([]);
    // dots at equal time intervals
    if (o.dots) {
      ctx.fillStyle = color;
      for (let i = 0; i < path.n; i += o.dotEvery) {
        ctx.beginPath();
        ctx.arc(view.sx(path.data[2 * i]), view.sy(path.data[2 * i + 1]), 2.6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // max height marker
    if (Number.isFinite(b.tMax) && b.maxHeight > h0 + 1e-6) {
      // find x at apex from the path (closest sample)
      let best = 0;
      for (let i = 0; i < path.n; i++) if (path.data[2 * i + 1] > path.data[2 * best + 1]) best = i;
      const ax = view.sx(path.data[2 * best]);
      const ay = view.sy(b.maxHeight);
      ctx.strokeStyle = alpha(color.startsWith('#') ? color : '#888888', 0.6);
      ctx.setLineDash([3, 4]);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(ax, gy);
      ctx.stroke();
      ctx.setLineDash([]);
      drawTag(ctx, ax, ay - 16, `H = ${fmt(b.maxHeight, 3)} m`, color, pal.surface);
    }
    if (b.landed) {
      const x = view.sx(b.s[0]);
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, gy - 8);
      ctx.lineTo(x, gy + 8);
      ctx.stroke();
      drawTag(ctx, x, gy + (dashed ? 22 : 44), `R = ${fmt(b.s[0], 3)} m`, color, pal.surface);
    }
    // ball
    const bx = view.sx(b.s[0]);
    const by = view.sy(b.s[1]);
    ctx.fillStyle = dashed ? pal.surface : color;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(bx, by - (b.landed ? 6 : 0), 6.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    if (o.components && !b.landed) {
      const k = 60 / Math.max(pr.p.u, 1);
      drawArrow(ctx, bx, by, bx + b.s[2] * k, by, pal.series[1], 'vₓ', 2);
      drawArrow(ctx, bx, by, bx, by - b.s[3] * k, pal.series[2], 'v_y', 2);
    }
  };

  if (o.showVacuum) drawBody(pr.vacuum, paths.vac, pal.series[4], true);
  if (o.showAir) drawBody(pr.air, paths.air, pal.series[0], false);
}
