/**
 * Sphere moving vertically through a viscous fluid (measuring-cylinder experiment).
 * Down is positive. Forces: weight mg (down), buoyancy F_b = ρ_f V g (up),
 * Stokes drag F_d = 6πηrv (opposite to v).
 *   m dv/dt = (m − ρ_f V) g − 6πηr v
 * Linear ODE with the exact solution v(t) = v_t + (u − v_t) e^(−t/τ),
 *   τ = m/(6πηr),  v_t = 2r²g(ρ_s − ρ_f)/(9η).
 * Integrator: RK4 (smooth, dissipative); tests compare with the exact solution.
 * Stokes' law holds only for slow, smooth flow (Reynolds number Re = ρ_f v d/η ≲ 1).
 */
import { RK4, type Derivative } from '../core/integrators';

export interface StokesParams {
  r: number; // sphere radius [m]
  rhoS: number; // sphere density [kg m^-3]
  rhoF: number; // fluid density [kg m^-3]
  eta: number; // viscosity [Pa s]
  g: number;
  H: number; // depth of the fluid column [m]
  u: number; // initial velocity (down +) [m s^-1]
}

export class StokesFall {
  p: StokesParams;
  /** [depth below the surface, v] */
  readonly y = new Float64Array(2);
  t = 0;
  stopped = false;
  private rk = new RK4(2);

  constructor(p: StokesParams) {
    this.p = { ...p };
    this.reset();
  }

  reset(p?: Partial<StokesParams>): void {
    if (p) this.p = { ...this.p, ...p };
    // start fully submerged, just below the surface (or at the bottom if it will rise)
    this.y[0] = this.terminalVelocity >= 0 ? this.p.r : this.p.H - this.p.r;
    this.y[1] = this.p.u;
    this.t = 0;
    this.stopped = false;
  }

  get V(): number {
    return (4 / 3) * Math.PI * this.p.r ** 3;
  }
  get m(): number {
    return this.p.rhoS * this.V;
  }
  get weight(): number {
    return this.m * this.p.g;
  }
  get buoyancy(): number {
    return this.p.rhoF * this.V * this.p.g;
  }
  drag(v = this.y[1]): number {
    return 6 * Math.PI * this.p.eta * this.p.r * v;
  }
  get tau(): number {
    return this.m / (6 * Math.PI * this.p.eta * this.p.r);
  }
  get terminalVelocity(): number {
    return (2 * this.p.r ** 2 * this.p.g * (this.p.rhoS - this.p.rhoF)) / (9 * this.p.eta);
  }
  get a(): number {
    return this.stopped ? 0 : (this.weight - this.buoyancy - this.drag()) / this.m;
  }
  /** Reynolds number for the current speed. */
  get reynolds(): number {
    return (this.p.rhoF * Math.abs(this.y[1]) * 2 * this.p.r) / this.p.eta;
  }

  private deriv: Derivative = (_t, y, out) => {
    out[0] = y[1];
    out[1] = (this.weight - this.buoyancy - this.drag(y[1])) / this.m;
  };

  step(dt: number): void {
    if (this.stopped) {
      this.t += dt;
      return;
    }
    // RK4 needs h ≪ τ (τ can be tens of µs for small spheres in honey): substep
    const n = Math.min(400, Math.max(1, Math.ceil(dt / (0.1 * this.tau))));
    const h = dt / n;
    for (let i = 0; i < n; i++) this.rk.step(this.deriv, this.t + i * h, this.y, h);
    this.t += dt;
    if (this.y[0] >= this.p.H - this.p.r) {
      this.y[0] = this.p.H - this.p.r;
      this.y[1] = 0;
      this.stopped = true;
    } else if (this.y[0] <= this.p.r && this.y[1] < 0) {
      this.y[0] = this.p.r;
      this.y[1] = 0;
      this.stopped = true;
    }
  }

  /** Exact velocity at time t (until it hits an end). */
  exactV(t: number): number {
    const vt = this.terminalVelocity;
    return vt + (this.p.u - vt) * Math.exp(-t / this.tau);
  }
}
