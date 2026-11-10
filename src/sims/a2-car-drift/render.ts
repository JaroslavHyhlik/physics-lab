import type { DriftCar, AxleState } from '../../physics/drift';
import type { View } from '../../sim/view';
import { alpha, type Palette } from '../../sim/palette';
import { drawArrow } from '../../sim/draw';

/** Skid marks: segments (x1, y1, x2, y2) in world coordinates, ring buffer. */
export class Skids {
  data = new Float32Array(4 * 6000);
  n = 0;
  head = 0;
  last: (number[] | null)[] = [null, null, null, null];
  add(i: number, x: number, y: number, on: boolean) {
    const prev = this.last[i];
    if (on && prev) {
      const k = this.head;
      this.data.set([prev[0], prev[1], x, y], 4 * k);
      this.head = (this.head + 1) % 6000;
      this.n = Math.min(this.n + 1, 6000);
    }
    this.last[i] = on ? [x, y] : null;
  }
  clear() {
    this.n = 0;
    this.head = 0;
    this.last = [null, null, null, null];
  }
}

/** world positions of the four wheels: FL, FR, RL, RR */
export function wheelPositions(c: DriftCar): number[][] {
  const [X, Y, psi] = [c.y[0], c.y[1], c.y[2]];
  const cs = Math.cos(psi);
  const sn = Math.sin(psi);
  const tw = 0.8;
  return [
    [c.p.a, tw],
    [c.p.a, -tw],
    [-c.p.b, tw],
    [-c.p.b, -tw],
  ].map(([u, w]) => [X + u * cs - w * sn, Y + u * sn + w * cs]);
}

export function drawDrift(ctx: CanvasRenderingContext2D, view: View, c: DriftCar, skids: Skids, pal: Palette, forces: boolean, circles: boolean): void {
  ctx.fillStyle = pal.bg;
  ctx.fillRect(0, 0, view.width, view.height);
  // ground grid every 5 m (moves under the car)
  ctx.strokeStyle = pal.grid;
  ctx.lineWidth = 1;
  for (let x = Math.floor(view.left / 5) * 5; x <= view.right; x += 5) {
    ctx.beginPath();
    ctx.moveTo(view.sx(x), 0);
    ctx.lineTo(view.sx(x), view.height);
    ctx.stroke();
  }
  for (let y = Math.floor(view.bottom / 5) * 5; y <= view.top; y += 5) {
    ctx.beginPath();
    ctx.moveTo(0, view.sy(y));
    ctx.lineTo(view.width, view.sy(y));
    ctx.stroke();
  }
  // skidpad circle (radius 15 m) as a practice line
  ctx.strokeStyle = alpha(pal.hl.startsWith('#') ? pal.hl : '#f59e0b', 0.5);
  ctx.setLineDash([10, 8]);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(view.sx(0), view.sy(15), 15 * view.scale, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  // skid marks
  ctx.strokeStyle = pal.dark ? 'rgba(0,0,0,0.55)' : 'rgba(20,24,32,0.35)';
  ctx.lineWidth = Math.max(1.5, 0.22 * view.scale);
  ctx.beginPath();
  for (let k = 0; k < skids.n; k++) {
    const i = 4 * k;
    ctx.moveTo(view.sx(skids.data[i]), view.sy(skids.data[i + 1]));
    ctx.lineTo(view.sx(skids.data[i + 2]), view.sy(skids.data[i + 3]));
  }
  ctx.stroke();

  // car body
  const [X, Y, psi] = [c.y[0], c.y[1], c.y[2]];
  ctx.save();
  ctx.translate(view.sx(X), view.sy(Y));
  ctx.rotate(-psi);
  const s = view.scale;
  const front = c.p.a + 0.9;
  const rear = c.p.b + 0.9;
  ctx.fillStyle = pal.series[0];
  ctx.beginPath();
  ctx.roundRect(-rear * s, -0.9 * s, (front + rear) * s, 1.8 * s, 0.35 * s);
  ctx.fill();
  ctx.fillStyle = alpha('#e8f0ff', pal.dark ? 0.4 : 0.8);
  ctx.fillRect(0.2 * s, -0.75 * s, 0.9 * s, 1.5 * s);
  const wheel = (u: number, w: number, ang: number, sliding: boolean) => {
    ctx.save();
    ctx.translate(u * s, -w * s);
    ctx.rotate(-ang);
    ctx.fillStyle = sliding ? pal.positive : pal.ink;
    ctx.fillRect(-0.35 * s, -0.13 * s, 0.7 * s, 0.26 * s);
    ctx.restore();
  };
  wheel(c.p.a, 0.8, c.ctl.steer, c.front.sliding);
  wheel(c.p.a, -0.8, c.ctl.steer, c.front.sliding);
  wheel(-c.p.b, 0.8, 0, c.rear.sliding);
  wheel(-c.p.b, -0.8, 0, c.rear.sliding);
  ctx.restore();

  const toScreen = (u: number, w: number) => {
    const cs = Math.cos(psi);
    const sn = Math.sin(psi);
    return [view.sx(X + u * cs - w * sn), view.sy(Y + u * sn + w * cs)];
  };
  if (forces) {
    const k = 55 / (c.p.muS * Math.max(c.front.Fz, c.rear.Fz));
    for (const [ax, u] of [
      [c.front, c.p.a],
      [c.rear, -c.p.b],
    ] as [AxleState, number][]) {
      const [px, py] = toScreen(u, 0);
      const cs = Math.cos(psi);
      const sn = Math.sin(psi);
      const wx = ax.fx * cs - ax.fy * sn;
      const wy = ax.fx * sn + ax.fy * cs;
      drawArrow(ctx, px, py, px + wx * k, py - wy * k, ax.sliding ? pal.positive : pal.series[2], undefined, 2.5);
    }
    // velocity of the centre of mass
    const cs = Math.cos(psi);
    const sn = Math.sin(psi);
    const vx = c.y[3] * cs - c.y[4] * sn;
    const vy = c.y[3] * sn + c.y[4] * cs;
    if (c.speed > 0.3) drawArrow(ctx, view.sx(X), view.sy(Y), view.sx(X) + vx * 3, view.sy(Y) - vy * 3, pal.series[1], 'v', 2);
  }
  if (circles) {
    frictionCircle(ctx, 16, 16, c.front, c, pal, 'front');
    frictionCircle(ctx, 16, 86, c.rear, c, pal, 'rear');
  }
}

/** Friction circle inset: outer = μ_s F_N, dashed = μ_d F_N; arrow = tyre force (car frame). */
function frictionCircle(ctx: CanvasRenderingContext2D, x: number, y: number, ax: AxleState, c: DriftCar, pal: Palette, label: string) {
  const R = 28;
  const cx = x + R;
  const cy = y + R;
  ctx.fillStyle = alpha(pal.surface.startsWith('#') ? pal.surface : '#ffffff', 0.85);
  ctx.beginPath();
  ctx.arc(cx, cy, R + 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = pal.text3;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.arc(cx, cy, (R * c.p.muD) / c.p.muS, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  const k = R / (c.p.muS * ax.Fz);
  // car frame: forward = up on the inset, left = left
  drawArrow(ctx, cx, cy, cx - ax.fy * k, cy - ax.fx * k, ax.sliding ? pal.positive : pal.series[2], undefined, 2);
  ctx.fillStyle = pal.text2;
  ctx.font = '600 10px Inter Variable, system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(`${label}: ${ax.sliding ? 'SLIDING' : 'grip'}`, cx + R + 10, cy);
}
