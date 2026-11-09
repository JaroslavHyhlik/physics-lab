/**
 * Two carts on a straight, frictionless track colliding through a bumper.
 *
 * Contact model: spring + damper between the bumpers while they overlap,
 *   F = max(0, kδ + cδ̇)   (δ = overlap; the force can only push, never pull)
 * The damping is calibrated so that the relative velocity after the contact is exactly
 * −e times the relative velocity before it (coefficient of restitution e). Because the contact
 * equations are linear, one calibration (in dimensionless form) holds for every mass, speed
 * and stiffness. e = 0 is "perfectly inelastic": the carts lock together at maximum
 * compression.
 *
 * Internal forces are equal and opposite (Newton's third law), so momentum is conserved
 * exactly. Integrator: RK4, fixed step (much smaller than the contact time).
 */
import { RK4, type Derivative } from '../core/integrators';

export interface CollisionParams {
  m1: number;
  m2: number;
  u1: number;
  u2: number;
  e: number; // coefficient of restitution 0..1
  k: number; // bumper stiffness [N m^-1]
  x1: number; // initial centre positions [m]
  x2: number;
  w: number; // cart length [m]
}

/** Damping ratio ζ that gives restitution e for the clipped spring-damper contact. */
export function zetaForRestitution(e: number): number {
  if (e >= 1) return 0;
  const eOf = (z: number) => {
    // dimensionless: k = μ = 1, approach speed 1
    let d = 0;
    let dv = 1;
    const h = 2e-4;
    const acc = (dd: number, vv: number) => -Math.max(0, dd + 2 * z * vv);
    for (let i = 0; i < 200000; i++) {
      // RK4
      const k1x = dv;
      const k1v = acc(d, dv);
      const k2x = dv + 0.5 * h * k1v;
      const k2v = acc(d + 0.5 * h * k1x, dv + 0.5 * h * k1v);
      const k3x = dv + 0.5 * h * k2v;
      const k3v = acc(d + 0.5 * h * k2x, dv + 0.5 * h * k2v);
      const k4x = dv + h * k3v;
      const k4v = acc(d + h * k3x, dv + h * k3v);
      d += (h / 6) * (k1x + 2 * k2x + 2 * k3x + k4x);
      dv += (h / 6) * (k1v + 2 * k2v + 2 * k3v + k4v);
      if (dv < 0 && (d <= 0 || d + 2 * z * dv <= 0)) return -dv;
    }
    return -dv;
  };
  let lo = 0;
  let hi = 8;
  for (let i = 0; i < 50; i++) {
    const mid = 0.5 * (lo + hi);
    if (eOf(mid) > e) lo = mid;
    else hi = mid;
  }
  return 0.5 * (lo + hi);
}

export class Collision1D {
  p: CollisionParams;
  /** [x1, v1, x2, v2, impulse on cart 2] */
  readonly y = new Float64Array(5);
  t = 0;
  stuck = false;
  inContact = false;
  contactStart = NaN;
  contactEnd = NaN;
  private zeta = 0;
  private rk = new RK4(5);
  private startTouch = false;

  constructor(p: CollisionParams) {
    this.p = { ...p };
    this.reset();
  }

  reset(p?: Partial<CollisionParams>): void {
    const eChanged = !p || p.e !== undefined;
    if (p) this.p = { ...this.p, ...p };
    if (eChanged) this.zeta = this.p.e > 0.005 ? zetaForRestitution(this.p.e) : 2;
    this.y[0] = this.p.x1;
    this.y[1] = this.p.u1;
    this.y[2] = this.p.x2;
    this.y[3] = this.p.u2;
    this.y[4] = 0;
    this.t = 0;
    this.stuck = false;
    this.inContact = false;
    this.contactStart = NaN;
    this.contactEnd = NaN;
  }

  get reducedMass(): number {
    return (this.p.m1 * this.p.m2) / (this.p.m1 + this.p.m2);
  }
  private get c(): number {
    return 2 * this.zeta * Math.sqrt(this.p.k * this.reducedMass);
  }
  overlap(y: ArrayLike<number> = this.y): number {
    return y[0] + this.p.w / 2 - (y[2] - this.p.w / 2);
  }
  /** Contact force pushing the carts apart [N] (on cart 2: +F, on cart 1: −F). */
  force(y: ArrayLike<number> = this.y): number {
    if (this.stuck) return 0;
    const d = this.overlap(y);
    // d = 0 counts as contact only in the step that starts exactly at the moment of touching
    if (d <= 0 && !(this.startTouch && d > -1e-9)) return 0;
    return Math.max(0, this.p.k * Math.max(d, 0) + this.c * (y[1] - y[3]));
  }

  private deriv: Derivative = (_t, y, out) => {
    const F = this.force(y);
    out[0] = y[1];
    out[1] = -F / this.p.m1;
    out[2] = y[3];
    out[3] = F / this.p.m2;
    out[4] = F;
  };

  step(dt: number): void {
    if (this.stuck) {
      this.y[0] += this.y[1] * dt;
      this.y[2] += this.y[3] * dt;
      this.t += dt;
      return;
    }
    const before = this.y[1] - this.y[3];
    // The damper makes the force jump at the first touch; split the step exactly there
    // (before the touch both carts move uniformly, so the moment is known analytically).
    let h = dt;
    const d0 = this.overlap();
    if (!this.inContact && d0 <= 0 && d0 + before * dt > 0 && before > 0) {
      const tau = -d0 / before;
      this.y[0] += this.y[1] * tau;
      this.y[2] += this.y[3] * tau;
      h = dt - tau;
      this.startTouch = true;
    }
    if (h > 0) this.rk.step(this.deriv, this.t, this.y, h);
    this.startTouch = false;
    this.t += dt;
    const touching = this.overlap() > 0 && this.force() > 0;
    if (touching && !this.inContact) {
      this.inContact = true;
      if (Number.isNaN(this.contactStart)) this.contactStart = this.t - dt;
    } else if (!touching && this.inContact) {
      this.inContact = false;
      this.contactEnd = this.t;
    }
    // perfectly inelastic: lock at maximum compression (relative velocity crosses zero)
    if (this.p.e <= 0.005 && this.inContact && before > 0 && this.y[1] - this.y[3] <= 0) {
      const v = (this.p.m1 * this.y[1] + this.p.m2 * this.y[3]) / (this.p.m1 + this.p.m2);
      this.y[1] = this.y[3] = v;
      this.stuck = true;
      this.inContact = false;
      this.contactEnd = this.t;
    }
  }

  get momentum(): number {
    return this.p.m1 * this.y[1] + this.p.m2 * this.y[3];
  }
  get kinetic(): number {
    return 0.5 * this.p.m1 * this.y[1] ** 2 + 0.5 * this.p.m2 * this.y[3] ** 2;
  }
  /** Impulse delivered to cart 2 so far, J = ∫F dt [N s] */
  get impulse(): number {
    return this.y[4];
  }
  get vcm(): number {
    return this.momentum / (this.p.m1 + this.p.m2);
  }
  get done(): boolean {
    return !Number.isNaN(this.contactEnd) && !this.inContact;
  }
}

/** Final velocities for a collision with restitution e (analytic). */
export function finalVelocities(m1: number, m2: number, u1: number, u2: number, e: number): [number, number] {
  const M = m1 + m2;
  return [((m1 - e * m2) * u1 + (1 + e) * m2 * u2) / M, ((m2 - e * m1) * u2 + (1 + e) * m1 * u1) / M];
}
