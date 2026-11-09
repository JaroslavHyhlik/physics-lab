import type { Car } from '../../physics/car';
import type { View } from '../../sim/view';
import { alpha, type Palette } from '../../sim/palette';
import { drawArrow, drawTag } from '../../sim/draw';
import { fmt } from '../../core/format';

export interface CarDrawOptions {
  truck: boolean;
  forces: boolean;
  /** Force (N) that maps to the maximum arrow length. */
  forceScale: number;
}

/** Position the camera so that the car is a little left of centre and the road is visible. */
export function followCar(view: View, car: Car, truck: boolean): void {
  const visible = truck ? 38 : 18; // metres across the canvas
  view.scale = Math.max(8, Math.min(60, view.width / visible));
  const len = truck ? 16 : 4.4;
  view.cx = car.x - len / 2 + view.width / view.scale / 2 - view.width / view.scale * 0.36;
  view.cy = (view.height * 0.12) / view.scale + (truck ? 2.2 : 1.2);
}

export function drawCarScene(
  ctx: CanvasRenderingContext2D,
  view: View,
  car: Car,
  pal: Palette,
  o: CarDrawOptions,
): void {
  ctx.fillStyle = pal.bg;
  ctx.fillRect(0, 0, view.width, view.height);
  const groundY = view.sy(0);

  // ground
  ctx.fillStyle = pal.grid;
  ctx.fillRect(0, groundY, view.width, view.height - groundY);
  ctx.strokeStyle = pal.gridStrong;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, groundY);
  ctx.lineTo(view.width, groundY);
  ctx.stroke();

  // distance markers: tick every 5 m, post + label every 50 m
  const x0 = Math.floor(view.left / 5) * 5;
  ctx.font = '600 11px Inter Variable, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  for (let x = x0; x <= view.right + 5; x += 5) {
    const sx = view.sx(x);
    const major = x % 50 === 0;
    const mid = x % 10 === 0;
    ctx.strokeStyle = major ? pal.text3 : pal.gridStrong;
    ctx.lineWidth = major ? 2 : 1;
    ctx.beginPath();
    ctx.moveTo(sx, groundY);
    ctx.lineTo(sx, groundY + (major ? 14 : mid ? 9 : 5));
    ctx.stroke();
    if (mid) {
      ctx.fillStyle = major ? pal.text2 : pal.text3;
      ctx.fillText(`${x} m`, sx, groundY + 17);
    }
    if (major && x >= 0) {
      // marker post
      ctx.strokeStyle = pal.text3;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(sx, groundY);
      ctx.lineTo(sx, view.sy(1.6));
      ctx.stroke();
      ctx.fillStyle = pal.hl;
      ctx.fillRect(sx - 1, view.sy(1.6), 18, 10);
    }
  }
  // quarter mile line
  const q = view.sx(402.336);
  if (q > -10 && q < view.width + 10) {
    ctx.strokeStyle = pal.hl;
    ctx.setLineDash([6, 5]);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(q, groundY);
    ctx.lineTo(q, view.sy(5));
    ctx.stroke();
    ctx.setLineDash([]);
    drawTag(ctx, q, view.sy(5) - 12, '¼ mile (402 m)', pal.hl, alpha(pal.hl.startsWith('#') ? pal.hl : '#f59e0b', 0.15));
  }

  if (o.truck) drawTruck(ctx, view, car, pal);
  else drawCar(ctx, view, car, pal);

  if (car.wheelspin) drawSmoke(ctx, view, car, pal, o.truck);
  if (o.forces) drawForces(ctx, view, car, pal, o);
}

function wheel(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, angle: number, pal: Palette) {
  ctx.fillStyle = pal.dark ? '#05070a' : '#1b2130';
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = pal.dark ? '#5d6678' : '#c9ced8';
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.62, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = pal.dark ? '#2a303c' : '#7d8596';
  ctx.lineWidth = Math.max(1.5, r * 0.12);
  for (let k = 0; k < 5; k++) {
    const a = angle + (k * 2 * Math.PI) / 5;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(a) * r * 0.58, cy + Math.sin(a) * r * 0.58);
    ctx.stroke();
  }
}

function drawCar(ctx: CanvasRenderingContext2D, view: View, car: Car, pal: Palette) {
  const r = car.p.rWheel;
  const L = 4.4;
  const xr = car.x - L; // rear of the car (car.x = front bumper position)
  const s = view.scale;
  const X = (u: number) => view.sx(xr + u);
  const Y = (h: number) => view.sy(h);
  // body silhouette (metres, from the rear bottom)
  ctx.fillStyle = pal.series[0];
  ctx.beginPath();
  ctx.moveTo(X(0.05), Y(0.32));
  ctx.lineTo(X(0.0), Y(0.72));
  ctx.quadraticCurveTo(X(0.05), Y(0.92), X(0.55), Y(0.95));
  ctx.lineTo(X(1.25), Y(1.0));
  ctx.quadraticCurveTo(X(1.7), Y(1.32), X(2.15), Y(1.33));
  ctx.lineTo(X(2.85), Y(1.31));
  ctx.quadraticCurveTo(X(3.15), Y(1.25), X(3.55), Y(0.96));
  ctx.quadraticCurveTo(X(4.3), Y(0.86), X(4.4), Y(0.66));
  ctx.lineTo(X(4.4), Y(0.36));
  ctx.quadraticCurveTo(X(4.38), Y(0.28), X(4.2), Y(0.28));
  ctx.lineTo(X(0.25), Y(0.28));
  ctx.closePath();
  ctx.fill();
  // windows
  ctx.fillStyle = alpha(pal.dark ? '#cfe1ff' : '#e8f0ff', pal.dark ? 0.35 : 0.85);
  ctx.beginPath();
  ctx.moveTo(X(1.42), Y(1.02));
  ctx.quadraticCurveTo(X(1.78), Y(1.27), X(2.15), Y(1.27));
  ctx.lineTo(X(2.8), Y(1.26));
  ctx.quadraticCurveTo(X(3.05), Y(1.2), X(3.35), Y(1.02));
  ctx.closePath();
  ctx.fill();
  // lights
  ctx.fillStyle = '#ffd166';
  ctx.fillRect(X(4.28), Y(0.74), Math.max(2, 0.1 * s), Math.max(2, 0.08 * s));
  ctx.fillStyle = '#ef476f';
  ctx.fillRect(X(0.02), Y(0.8), Math.max(2, 0.08 * s), Math.max(2, 0.1 * s));
  // wheels (rolling without slipping: angle = x / r)
  const ang = car.x / r;
  wheel(ctx, X(0.95), Y(r), r * s, ang, pal);
  wheel(ctx, X(3.55), Y(r), r * s, ang, pal);
}

function drawTruck(ctx: CanvasRenderingContext2D, view: View, car: Car, pal: Palette) {
  const r = car.p.rWheel;
  const L = 16.5;
  const xr = car.x - L;
  const s = view.scale;
  const X = (u: number) => view.sx(xr + u);
  const Y = (h: number) => view.sy(h);
  // trailer
  ctx.fillStyle = pal.dark ? '#3a4152' : '#d5dae3';
  ctx.beginPath();
  ctx.roundRect(X(0), Y(4.0), 13.4 * s, 2.9 * s, 0.15 * s);
  ctx.fill();
  ctx.fillStyle = pal.dark ? '#262b36' : '#aab2c0';
  ctx.fillRect(X(0.3), Y(1.1), 12.8 * s, 0.18 * s);
  // cab
  ctx.fillStyle = pal.series[0];
  ctx.beginPath();
  ctx.moveTo(X(13.7), Y(0.6));
  ctx.lineTo(X(13.7), Y(3.7));
  ctx.lineTo(X(15.6), Y(3.75));
  ctx.quadraticCurveTo(X(16.3), Y(3.6), X(16.4), Y(2.4));
  ctx.lineTo(X(16.5), Y(0.6));
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = alpha('#e8f0ff', pal.dark ? 0.35 : 0.85);
  ctx.fillRect(X(15.3), Y(3.3), 1.0 * s, 1.0 * s);
  const ang = car.x / r;
  for (const u of [1.6, 2.9, 4.2, 14.1, 15.6]) wheel(ctx, X(u), Y(r), r * s, ang, pal);
}

function drawSmoke(ctx: CanvasRenderingContext2D, view: View, car: Car, pal: Palette, truck: boolean) {
  const rear = truck ? car.x - 16.5 + 14.1 : car.x - 4.4 + 0.95;
  const t = car.t;
  for (let k = 0; k < 6; k++) {
    const ph = (t * 3 + k / 6) % 1;
    const x = view.sx(rear - 0.4 - ph * 2.5);
    const y = view.sy(0.25 + ph * 0.9);
    ctx.fillStyle = alpha(pal.dark ? '#c7ccd6' : '#8a94a6', 0.35 * (1 - ph));
    ctx.beginPath();
    ctx.arc(x, y, (6 + 14 * ph) * Math.min(1.5, view.scale / 30), 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawForces(ctx: CanvasRenderingContext2D, view: View, car: Car, pal: Palette, o: CarDrawOptions) {
  const v = car.v;
  const fd = car.driveForce(v);
  const fa = car.dragForce(v);
  const fr = car.rollForce(v, fd);
  const maxLen = Math.min(170, view.width * 0.3);
  const k = maxLen / Math.max(o.forceScale, 1);
  const len = o.truck ? 16.5 : 4.4;
  const yMid = view.sy(o.truck ? 1.9 : 0.62);
  const front = view.sx(car.x);
  const rear = view.sx(car.x - len);
  const ground = view.sy(0) - 4;
  const lab = (f: number) => (f >= 1000 ? `${fmt(f / 1000, 3)} kN` : `${fmt(f, 3)} N`);
  if (fd > 0) {
    const cx = view.sx(car.x - len / 2);
    drawArrow(ctx, cx, ground, cx + fd * k, ground, pal.series[2]);
    drawTag(ctx, cx + (fd * k) / 2, ground + 22, `driving ${lab(fd)}`, pal.series[2], pal.surface);
  }
  if (fa > 0.5) {
    drawArrow(ctx, front + 6, yMid, front + 6 - fa * k, yMid, pal.series[3]);
    drawTag(ctx, front + 6 - (fa * k) / 2, yMid - 18, `air ${lab(fa)}`, pal.series[3], pal.surface);
  }
  if (fr > 0.5) {
    drawArrow(ctx, rear - 4, ground - 10, rear - 4 - fr * k, ground - 10, pal.series[1]);
    drawTag(ctx, rear - 4 - Math.max(40, (fr * k) / 2), ground - 28, `rolling ${lab(fr)}`, pal.series[1], pal.surface);
  }
}
