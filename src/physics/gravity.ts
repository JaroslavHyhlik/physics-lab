/**
 * Motion of a small body around a massive central body (planet around a star, satellite around
 * the Earth). Newton's law of gravitation, a = −GM r/r³. Integrator: Yoshida 4th order
 * (symplectic: energy error stays bounded over many orbits; angular momentum is conserved
 * almost exactly for a central force).
 * Kepler: T² = 4π²a³/(GM); the radius vector sweeps equal areas in equal times (L constant).
 * Vis-viva: v² = GM(2/r − 1/a). Escape speed √(2GM/r), circular orbital speed √(GM/r).
 */
import { G } from '../core/constants';
import { yoshida4 } from '../core/integrators';

/** Sun mass [kg] (IAU nominal); Earth mass and radius (IAU / NASA fact sheet) */
export const M_SUN = 1.989e30;
export const M_EARTH = 5.97e24;
export const R_EARTH = 6.37e6;

export class Orbit {
  readonly x = new Float64Array(2);
  readonly v = new Float64Array(2);
  private a = new Float64Array(2);
  t = 0;
  readonly GM: number;
  private accel = (x: Float64Array, _t: number, out: Float64Array) => {
    const r2 = x[0] * x[0] + x[1] * x[1];
    const k = -this.GM / (r2 * Math.sqrt(r2));
    out[0] = k * x[0];
    out[1] = k * x[1];
  };
  constructor(M: number, x0: number, y0: number, vx0: number, vy0: number) {
    this.GM = G * M;
    this.x[0] = x0;
    this.x[1] = y0;
    this.v[0] = vx0;
    this.v[1] = vy0;
  }
  step(h: number): void {
    yoshida4(this.x, this.v, this.a, h, this.t, this.accel);
    this.t += h;
  }
  get r(): number {
    return Math.hypot(this.x[0], this.x[1]);
  }
  get speed(): number {
    return Math.hypot(this.v[0], this.v[1]);
  }
  /** energy per unit mass of the orbiting body [J kg⁻¹] */
  get energy(): number {
    return 0.5 * (this.v[0] ** 2 + this.v[1] ** 2) - this.GM / this.r;
  }
  /** angular momentum per unit mass (twice the areal velocity) */
  get L(): number {
    return this.x[0] * this.v[1] - this.x[1] * this.v[0];
  }
  /** orbital elements from the current state (bound orbits) */
  elements(): { a: number; e: number; T: number } {
    const eps = this.energy;
    const a = -this.GM / (2 * eps);
    const L = this.L;
    const e = Math.sqrt(Math.max(0, 1 + (2 * eps * L * L) / (this.GM * this.GM)));
    const T = eps < 0 ? 2 * Math.PI * Math.sqrt(a ** 3 / this.GM) : Infinity;
    return { a, e, T };
  }
}

export const escapeSpeed = (GM: number, r: number) => Math.sqrt((2 * GM) / r);
export const orbitalSpeed = (GM: number, r: number) => Math.sqrt(GM / r);
