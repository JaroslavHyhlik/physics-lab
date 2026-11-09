/**
 * Simple pendulum (point mass on a massless, inextensible string), exact nonlinear model:
 *   θ'' = −(g/l)·sin θ − (b/m)·θ'
 * plus a "ghost" using the small-angle approximation θ'' = −(g/l)·θ − (b/m)·θ'.
 *
 * Integrator: without damping the system is conservative → Yoshida 4th-order (symplectic),
 * so energy does not drift over thousands of swings. With damping → classic RK4.
 * The linear damping force F = −b·v acts on the bob.
 */
import { RK4, yoshida4, type Derivative } from '../core/integrators';

export interface PendulumParams {
  /** string length [m] */
  l: number;
  /** bob mass [kg] */
  m: number;
  /** gravitational field strength [m s^-2] */
  g: number;
  /** linear damping coefficient [kg s^-1] */
  b: number;
  /** release angle [rad] (released from rest) */
  theta0: number;
}

export class Pendulum {
  p: PendulumParams;
  t = 0;
  /** [θ, θ_ghost] */
  readonly x = new Float64Array(2);
  /** [ω, ω_ghost] */
  readonly v = new Float64Array(2);
  private a = new Float64Array(2);
  private y = new Float64Array(4);
  private rk = new RK4(4);
  /** times of upward zero crossings of θ (for period measurement) */
  private crossings: number[] = [];

  constructor(p: PendulumParams) {
    this.p = { ...p };
    this.reset();
  }

  reset(p?: Partial<PendulumParams>): void {
    if (p) this.p = { ...this.p, ...p };
    this.t = 0;
    this.x[0] = this.x[1] = this.p.theta0;
    this.v[0] = this.v[1] = 0;
    this.crossings = [];
  }

  get theta(): number {
    return this.x[0];
  }
  get omega(): number {
    return this.v[0];
  }
  get thetaSmall(): number {
    return this.x[1];
  }

  private accel = (x: Float64Array, _t: number, out: Float64Array) => {
    const k = this.p.g / this.p.l;
    out[0] = -k * Math.sin(x[0]);
    out[1] = -k * x[1];
  };

  private deriv: Derivative = (_t, y, out) => {
    const k = this.p.g / this.p.l;
    const gamma = this.p.b / this.p.m;
    out[0] = y[1];
    out[1] = -k * Math.sin(y[0]) - gamma * y[1];
    out[2] = y[3];
    out[3] = -k * y[2] - gamma * y[3];
  };

  step(dt: number): void {
    const prevTheta = this.x[0];
    if (this.p.b === 0) {
      yoshida4(this.x, this.v, this.a, dt, this.t, this.accel);
    } else {
      const y = this.y;
      y[0] = this.x[0];
      y[1] = this.v[0];
      y[2] = this.x[1];
      y[3] = this.v[1];
      this.rk.step(this.deriv, this.t, y, dt);
      this.x[0] = y[0];
      this.v[0] = y[1];
      this.x[1] = y[2];
      this.v[1] = y[3];
    }
    // Upward zero crossing: θ'' = 0 there, so linear interpolation is accurate to O(dt³).
    if (prevTheta < 0 && this.x[0] >= 0) {
      const frac = -prevTheta / (this.x[0] - prevTheta);
      this.crossings.push(this.t + frac * dt);
      if (this.crossings.length > 8) this.crossings.shift();
    }
    this.t += dt;
  }

  /** Period measured from the last two upward zero crossings [s], or NaN. */
  get measuredPeriod(): number {
    const c = this.crossings;
    return c.length >= 2 ? c[c.length - 1] - c[c.length - 2] : NaN;
  }

  /** Kinetic energy E_k = ½ m (lω)² [J] */
  get Ek(): number {
    const v = this.p.l * this.v[0];
    return 0.5 * this.p.m * v * v;
  }

  /** Gravitational potential energy relative to the lowest point, m g l (1 − cos θ) [J] */
  get Ep(): number {
    return this.p.m * this.p.g * this.p.l * (1 - Math.cos(this.x[0]));
  }

  get E(): number {
    return this.Ek + this.Ep;
  }

  /** Tangential acceleration of the bob [m s^-2] */
  get aTangential(): number {
    return -this.p.g * Math.sin(this.x[0]) - (this.p.b / this.p.m) * this.p.l * this.v[0];
  }

  /** Centripetal acceleration lω² [m s^-2] */
  get aCentripetal(): number {
    return this.p.l * this.v[0] * this.v[0];
  }

  /** String tension T = m(g cos θ + lω²) [N] */
  get tension(): number {
    return this.p.m * (this.p.g * Math.cos(this.x[0]) + this.p.l * this.v[0] * this.v[0]);
  }
}
