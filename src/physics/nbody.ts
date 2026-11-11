/**
 * N bodies attracting each other by Newton's law of gravitation (SI units).
 * Integrator: Yoshida 4th order (symplectic). The time step is shortened during close
 * encounters (a fraction of the shortest pair "orbital time" √(r³/G(m₁+m₂))).
 * Bodies that touch merge in a perfectly inelastic collision (mass and momentum conserved).
 */
import { G } from '../core/constants';
import { yoshida4 } from '../core/integrators';

export interface Body {
  x: number;
  y: number;
  vx: number;
  vy: number;
  m: number;
  r: number; // radius [m] (for collisions)
}

export class NBody {
  bodies: Body[] = [];
  t = 0;
  private pos = new Float64Array(0);
  private vel = new Float64Array(0);
  private acc = new Float64Array(0);
  merges = 0;
  private accel = (x: Float64Array, _t: number, out: Float64Array) => {
    const n = this.bodies.length;
    out.fill(0);
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const dx = x[2 * j] - x[2 * i];
        const dy = x[2 * j + 1] - x[2 * i + 1];
        const r2 = dx * dx + dy * dy;
        const inv = 1 / (r2 * Math.sqrt(r2));
        const mi = this.bodies[i].m;
        const mj = this.bodies[j].m;
        out[2 * i] += G * mj * dx * inv;
        out[2 * i + 1] += G * mj * dy * inv;
        out[2 * j] -= G * mi * dx * inv;
        out[2 * j + 1] -= G * mi * dy * inv;
      }
    }
  };

  add(b: Body): void {
    this.bodies.push(b);
  }

  private pack(): void {
    const n = this.bodies.length;
    if (this.pos.length !== 2 * n) {
      this.pos = new Float64Array(2 * n);
      this.vel = new Float64Array(2 * n);
      this.acc = new Float64Array(2 * n);
    }
    this.bodies.forEach((b, i) => {
      this.pos[2 * i] = b.x;
      this.pos[2 * i + 1] = b.y;
      this.vel[2 * i] = b.vx;
      this.vel[2 * i + 1] = b.vy;
    });
  }
  private unpack(): void {
    this.bodies.forEach((b, i) => {
      b.x = this.pos[2 * i];
      b.y = this.pos[2 * i + 1];
      b.vx = this.vel[2 * i];
      b.vy = this.vel[2 * i + 1];
    });
  }

  /** shortest pair dynamical time (sets a safe step) */
  minTime(): number {
    let tmin = Infinity;
    const bs = this.bodies;
    for (let i = 0; i < bs.length; i++)
      for (let j = i + 1; j < bs.length; j++) {
        const r = Math.hypot(bs[j].x - bs[i].x, bs[j].y - bs[i].y);
        tmin = Math.min(tmin, Math.sqrt((r * r * r) / (G * (bs[i].m + bs[j].m))));
      }
    return tmin;
  }

  /** advance by H, splitting into steps of at most `frac` × the shortest dynamical time */
  advance(H: number, frac = 0.005, merge = true): void {
    let left = H;
    while (left > 0) {
      const h = Math.min(left, frac * this.minTime());
      this.pack();
      yoshida4(this.pos, this.vel, this.acc, h, this.t, this.accel);
      this.unpack();
      this.t += h;
      left -= h;
      if (merge) this.collide();
    }
  }

  private collide(): void {
    const bs = this.bodies;
    for (let i = 0; i < bs.length; i++)
      for (let j = i + 1; j < bs.length; j++) {
        const a = bs[i];
        const b = bs[j];
        if (Math.hypot(b.x - a.x, b.y - a.y) > a.r + b.r) continue;
        const m = a.m + b.m;
        const merged: Body = {
          x: (a.m * a.x + b.m * b.x) / m,
          y: (a.m * a.y + b.m * b.y) / m,
          vx: (a.m * a.vx + b.m * b.vx) / m,
          vy: (a.m * a.vy + b.m * b.vy) / m,
          m,
          r: Math.cbrt(a.r ** 3 + b.r ** 3),
        };
        bs.splice(j, 1);
        bs[i] = merged;
        this.merges++;
        j = i;
      }
  }

  get momentum(): [number, number] {
    let px = 0;
    let py = 0;
    for (const b of this.bodies) {
      px += b.m * b.vx;
      py += b.m * b.vy;
    }
    return [px, py];
  }
  get energy(): number {
    let e = 0;
    const bs = this.bodies;
    for (let i = 0; i < bs.length; i++) {
      e += 0.5 * bs[i].m * (bs[i].vx ** 2 + bs[i].vy ** 2);
      for (let j = i + 1; j < bs.length; j++) e -= (G * bs[i].m * bs[j].m) / Math.hypot(bs[j].x - bs[i].x, bs[j].y - bs[i].y);
    }
    return e;
  }
}

/**
 * Figure-eight three-body orbit (Chenciner & Montgomery 2000; initial conditions of
 * C. Moore 1993) in units G = M = L = 1, scaled to SI with length L [m] and mass M [kg].
 * Period 6.32591398 time units.
 */
export function figureEight(L: number, M: number): { bodies: Body[]; period: number } {
  const V = Math.sqrt((G * M) / L);
  const T = Math.sqrt((L * L * L) / (G * M));
  const p1 = [-0.97000436, 0.24308753];
  const v3 = [-0.93240737, -0.86473146];
  const mk = (x: number, y: number, vx: number, vy: number): Body => ({ x: x * L, y: y * L, vx: vx * V, vy: vy * V, m: M, r: 0.01 * L });
  return {
    bodies: [mk(p1[0], p1[1], -v3[0] / 2, -v3[1] / 2), mk(-p1[0], -p1[1], -v3[0] / 2, -v3[1] / 2), mk(0, 0, v3[0], v3[1])],
    period: 6.32591398 * T,
  };
}
