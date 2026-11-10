import type { Collision2D } from '../../physics/collision2d';
import type { View } from '../../sim/view';
import { alpha, type Palette } from '../../sim/palette';
import { drawArrow, drawSymbol } from '../../sim/draw';

export interface C2DOptions {
  trails: boolean;
  arrows: boolean;
  pdiagram: boolean;
  cmframe: boolean;
  /** initial total momentum magnitude (diagram scale) */
  pScale: number;
}

const tmp = new Float64Array(4);

export function drawCollision2D(ctx: CanvasRenderingContext2D, view: View, c: Collision2D, pal: Palette, o: C2DOptions): void {
  ctx.fillStyle = pal.bg;
  ctx.fillRect(0, 0, view.width, view.height);
  // table with a 10 cm grid
  ctx.lineWidth = 1;
  for (let x = Math.ceil(view.left * 10) / 10; x <= view.right; x += 0.1) {
    ctx.strokeStyle = Math.abs(Math.round(x * 10) % 5) === 0 ? pal.gridStrong : pal.grid;
    ctx.beginPath();
    ctx.moveTo(Math.round(view.sx(x)) + 0.5, 0);
    ctx.lineTo(Math.round(view.sx(x)) + 0.5, view.height);
    ctx.stroke();
  }
  for (let y = Math.ceil(view.bottom * 10) / 10; y <= view.top; y += 0.1) {
    ctx.strokeStyle = Math.abs(Math.round(y * 10) % 5) === 0 ? pal.gridStrong : pal.grid;
    ctx.beginPath();
    ctx.moveTo(0, Math.round(view.sy(y)) + 0.5);
    ctx.lineTo(view.width, Math.round(view.sy(y)) + 0.5);
    ctx.stroke();
  }
  ctx.fillStyle = pal.text3;
  ctx.font = '500 10px Inter Variable, system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'bottom';
  ctx.fillText('grid: 10 cm' + (o.cmframe ? ' · centre-of-mass frame' : ''), view.width - 8, view.height - 6);

  const vcmx = c.px / c.M;
  const vcmy = c.py / c.M;
  // frame shift: in the CM frame subtract the motion of the centre of mass
  const q = c.p;
  const xcm0 = (q.m1 * q.x1 + q.m2 * q.x2) / c.M;
  const ycm0 = (q.m1 * q.y1 + q.m2 * q.y2) / c.M;
  const shiftX = (t: number) => (o.cmframe ? xcm0 + vcmx * t : 0);
  const shiftY = (t: number) => (o.cmframe ? ycm0 + vcmy * t : 0);
  const X = (x: number, t: number) => view.sx(x - shiftX(t));
  const Y = (y: number, t: number) => view.sy(y - shiftY(t));

  // trails: straight lines start → contact → now
  if (o.trails) {
    const pts: number[] = [0];
    if (c.collided) pts.push(c.tc);
    pts.push(c.t);
    for (const [k, col] of [
      [0, pal.series[0]],
      [1, pal.series[1]],
    ] as const) {
      ctx.strokeStyle = alpha(col.startsWith('#') ? col : '#888888', 0.55);
      ctx.lineWidth = 2;
      ctx.setLineDash([2, 5]);
      ctx.beginPath();
      pts.forEach((t, i) => {
        c.positionAt(t, tmp);
        const x = X(tmp[2 * k], t);
        const y = Y(tmp[2 * k + 1], t);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
      ctx.setLineDash([]);
    }
    // contact snapshot and line of centres
    if (c.collided) {
      const k = c.contact;
      const t = c.tc;
      ctx.strokeStyle = pal.hl;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.moveTo(X(k[0], t), Y(k[1], t));
      ctx.lineTo(X(k[2], t), Y(k[3], t));
      ctx.stroke();
      ctx.setLineDash([]);
      for (const [x, y, r] of [
        [k[0], k[1], q.r1],
        [k[2], k[3], q.r2],
      ]) {
        ctx.strokeStyle = alpha(pal.text3.startsWith('#') ? pal.text3 : '#888888', 0.6);
        ctx.beginPath();
        ctx.arc(X(x, t), Y(y, t), r * view.scale, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }

  // pucks
  const s = c.s;
  const pucks = [
    [s[0], s[1], s[2], s[3], q.r1, q.m1, pal.series[0], 'v_1'],
    [s[4], s[5], s[6], s[7], q.r2, q.m2, pal.series[1], 'v_2'],
  ] as const;
  for (const [x, y, vx, vy, r, m, col, name] of pucks) {
    const px = X(x, c.t);
    const py = Y(y, c.t);
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(px, py, r * view.scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 11px Inter Variable, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${m.toFixed(1)} kg`, px, py);
    if (o.arrows) {
      const k = 70; // px per m s⁻¹
      const ux = vx - (o.cmframe ? vcmx : 0);
      const uy = vy - (o.cmframe ? vcmy : 0);
      if (Math.hypot(ux, uy) * k > 4) {
        drawArrow(ctx, px, py, px + ux * k, py - uy * k, col);
        drawSymbol(ctx, name, px + ux * k + 14 * Math.sign(ux || 1), py - uy * k - 12, col, 13);
      }
    }
  }
  // centre of mass marker
  const cx = X(c.xcm, c.t);
  const cy = Y(c.ycm, c.t);
  ctx.strokeStyle = pal.series[4];
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx - 6, cy - 6);
  ctx.lineTo(cx + 6, cy + 6);
  ctx.moveTo(cx - 6, cy + 6);
  ctx.lineTo(cx + 6, cy - 6);
  ctx.stroke();

  if (o.pdiagram) drawMomentumDiagram(ctx, view, c, pal, o.pScale);
}

/** Tip-to-tail vector diagram: p₁ + p₂ = p, before (faint) and now. */
function drawMomentumDiagram(ctx: CanvasRenderingContext2D, view: View, c: Collision2D, pal: Palette, pScale: number) {
  const w = Math.min(190, view.width * 0.32);
  const h = 120;
  const x0 = 14;
  const y0 = view.height - h - 76;
  if (y0 < 60) return;
  ctx.fillStyle = alpha(pal.surface.startsWith('#') ? pal.surface : '#ffffff', 0.85);
  ctx.strokeStyle = pal.gridStrong;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(x0, y0, w, h, 10);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = pal.text3;
  ctx.font = '600 10px Inter Variable, system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('momentum: p₁ + p₂ = p', x0 + 8, y0 + 6);
  const k = (w - 30) / Math.max(pScale, 1e-9);
  const ox = x0 + 14;
  const oy = y0 + h / 2 + 8;
  const q = c.p;
  const draw = (p1x: number, p1y: number, p2x: number, p2y: number, a: number) => {
    ctx.globalAlpha = a;
    drawArrow(ctx, ox, oy, ox + p1x * k, oy - p1y * k, pal.series[0], undefined, 2);
    drawArrow(ctx, ox + p1x * k, oy - p1y * k, ox + (p1x + p2x) * k, oy - (p1y + p2y) * k, pal.series[1], undefined, 2);
    drawArrow(ctx, ox, oy, ox + (p1x + p2x) * k, oy - (p1y + p2y) * k, pal.series[4], undefined, 1.5);
    ctx.globalAlpha = 1;
  };
  draw(q.m1 * q.u1x, q.m1 * q.u1y, q.m2 * q.u2x, q.m2 * q.u2y, 0.3);
  const s = c.s;
  draw(q.m1 * s[2], q.m1 * s[3], q.m2 * s[6], q.m2 * s[7], 1);
}
