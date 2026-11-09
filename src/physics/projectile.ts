/**
 * Projectile launched from height h0 with speed u at angle θ, in a uniform field g.
 * Two copies fly at once: one in a vacuum and one with quadratic air resistance
 *   F_drag = ½ρC_dA v²  (opposite to the velocity), A = πd²/4 (sphere).
 *
 * Integrator: RK4 on [x, y, vx, vy] with a fixed step. The landing point (y = 0) is found
 * inside the final step by solving y(τ) = y + v_y τ + ½ a_y τ² — exact in a vacuum, O(dt³)
 * with drag.
 */
import { RK4, type Derivative } from '../core/integrators';

export interface ProjectileParams {
  u: number; // launch speed [m s^-1]
  angle: number; // launch angle [rad]
  h0: number; // launch height [m]
  m: number; // mass [kg]
  d: number; // diameter [m]
  Cd: number; // drag coefficient
  rho: number; // air density [kg m^-3]
  g: number; // [m s^-2]
}

export class Body {
  /** [x, y, vx, vy] */
  readonly s = new Float64Array(4);
  landed = false;
  tLand = NaN;
  maxHeight = 0;
  tMax = NaN;
  private rk = new RK4(4);
  constructor(private k: () => number) {}

  reset(p: ProjectileParams): void {
    this.s[0] = 0;
    this.s[1] = p.h0;
    this.s[2] = p.u * Math.cos(p.angle);
    this.s[3] = p.u * Math.sin(p.angle);
    this.landed = false;
    this.tLand = NaN;
    this.maxHeight = p.h0;
    this.tMax = this.s[3] > 0 ? NaN : 0;
  }

  /** Acceleration [ax, ay] for state s. */
  accel(s: ArrayLike<number>, g: number, out: number[]): void {
    const k = this.k();
    const v = Math.hypot(s[2], s[3]);
    out[0] = -k * v * s[2];
    out[1] = -g - k * v * s[3];
  }

  private a = [0, 0];
  private prev = new Float64Array(4);

  step(t: number, dt: number, g: number, deriv: Derivative): void {
    if (this.landed) return;
    const y0 = this.s[1];
    const vy0 = this.s[3];
    const a = this.a;
    this.accel(this.s, g, a);
    const prev = this.prev;
    prev.set(this.s);
    this.rk.step(deriv, t, this.s, dt);
    // apex (vy changes sign): quadratic estimate within the step
    if (vy0 > 0 && this.s[3] <= 0) {
      const tau = -vy0 / a[1];
      this.maxHeight = Math.max(this.maxHeight, y0 + vy0 * tau + 0.5 * a[1] * tau * tau);
      this.tMax = t + tau;
    }
    if (this.s[1] <= 0 && t + dt > 0) {
      // solve y0 + vy0 τ + ½ a τ² = 0 for the smallest τ in (0, dt]
      const A = 0.5 * a[1];
      const B = vy0;
      const C = y0;
      let tau: number;
      if (Math.abs(A) < 1e-15) tau = -C / B;
      else {
        const disc = Math.max(0, B * B - 4 * A * C);
        const r1 = (-B - Math.sqrt(disc)) / (2 * A);
        const r2 = (-B + Math.sqrt(disc)) / (2 * A);
        tau = [r1, r2].filter((r) => r >= -1e-12 && r <= dt + 1e-9).sort((p, q) => p - q)[0] ?? dt;
      }
      this.s[0] = prev[0] + prev[2] * tau + 0.5 * a[0] * tau * tau;
      this.s[1] = 0;
      this.s[2] = prev[2] + a[0] * tau;
      this.s[3] = prev[3] + a[1] * tau;
      this.landed = true;
      this.tLand = t + tau;
    }
  }

  get speed(): number {
    return Math.hypot(this.s[2], this.s[3]);
  }
}

export class Projectile {
  p: ProjectileParams;
  t = 0;
  readonly vacuum: Body;
  readonly air: Body;
  private dVac: Derivative;
  private dAir: Derivative;

  constructor(p: ProjectileParams) {
    this.p = { ...p };
    this.vacuum = new Body(() => 0);
    this.air = new Body(() => this.dragK);
    const make = (body: Body): Derivative => {
      const a = [0, 0];
      return (_t, s, out) => {
        body.accel(s, this.p.g, a);
        out[0] = s[2];
        out[1] = s[3];
        out[2] = a[0];
        out[3] = a[1];
      };
    };
    this.dVac = make(this.vacuum);
    this.dAir = make(this.air);
    this.reset();
  }

  /** Drag constant k such that a_drag = −k·v·v⃗ :  k = ρC_dA/(2m) [m^-1]. */
  get dragK(): number {
    const A = (Math.PI * this.p.d * this.p.d) / 4;
    return (this.p.rho * this.p.Cd * A) / (2 * this.p.m);
  }

  /** Terminal speed v_t = √(2mg/(ρC_dA)) [m s^-1]. */
  get terminalSpeed(): number {
    return Math.sqrt(this.p.g / this.dragK);
  }

  reset(p?: Partial<ProjectileParams>): void {
    if (p) this.p = { ...this.p, ...p };
    this.t = 0;
    this.vacuum.reset(this.p);
    this.air.reset(this.p);
  }

  step(dt: number): void {
    this.vacuum.step(this.t, dt, this.p.g, this.dVac);
    this.air.step(this.t, dt, this.p.g, this.dAir);
    this.t += dt;
  }

  get done(): boolean {
    return this.vacuum.landed && this.air.landed;
  }
}

/** Analytic vacuum results for launch from height h0. */
export function vacuumResults(u: number, angle: number, h0: number, g: number) {
  const ux = u * Math.cos(angle);
  const uy = u * Math.sin(angle);
  const T = (uy + Math.sqrt(uy * uy + 2 * g * h0)) / g;
  return { T, range: ux * T, maxHeight: h0 + (uy > 0 ? (uy * uy) / (2 * g) : 0) };
}

/** Range with drag for a given angle (simulated). */
export function rangeWithDrag(p: ProjectileParams, dt = 1e-3): number {
  const pr = new Projectile(p);
  for (let i = 0; i < 2e6 && !pr.air.landed; i++) pr.step(dt);
  return pr.air.s[0];
}

/** Launch angle giving the maximum range with drag (golden-section search). */
export function optimumAngle(p: ProjectileParams): number {
  const phi = (Math.sqrt(5) - 1) / 2;
  let a = 0;
  let b = Math.PI / 2;
  let c = b - phi * (b - a);
  let d = a + phi * (b - a);
  let fc = rangeWithDrag({ ...p, angle: c }, 2e-3);
  let fd = rangeWithDrag({ ...p, angle: d }, 2e-3);
  for (let i = 0; i < 28; i++) {
    if (fc > fd) {
      b = d;
      d = c;
      fd = fc;
      c = b - phi * (b - a);
      fc = rangeWithDrag({ ...p, angle: c }, 2e-3);
    } else {
      a = c;
      c = d;
      fc = fd;
      d = a + phi * (b - a);
      fd = rangeWithDrag({ ...p, angle: d }, 2e-3);
    }
  }
  return (a + b) / 2;
}
