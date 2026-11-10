/**
 * Vertical rocket flight with decreasing mass.
 *   dm/dt = −ṁ (while fuel remains)
 *   m dv/dt = v_e ṁ − m g(h) − ½ρ(h) C_d A v|v|
 *   thrust F = v_e ṁ  (= Δp/Δt of the exhaust)
 *   g(h) = g₀ R²/(R + h)²  (inverse-square law, g₀ = 9.8 m s⁻² at the surface)
 *   ρ(h) = ρ₀ e^(−h/H)     (isothermal atmosphere, H = 8.5 km)
 * Integrator: RK4 on [h, v, m]; burnout is resolved exactly by splitting the step.
 */
import { RK4, type Derivative } from '../core/integrators';

export const R_EARTH = 6.37e6; // [m]
export const SCALE_HEIGHT = 8500; // [m]

export interface RocketParams {
  dry: number; // mass without fuel [kg]
  fuel: number; // fuel mass [kg]
  mdot: number; // burn rate [kg s^-1]
  ve: number; // exhaust speed relative to the rocket [m s^-1]
  Cd: number;
  d: number; // diameter [m]
  rho0: number; // sea-level air density [kg m^-3]
  g0: number;
  drag: boolean;
  gravity: boolean;
  variableG: boolean;
}

export class Rocket {
  p: RocketParams;
  /** [h, v, m] */
  readonly y = new Float64Array(3);
  t = 0;
  maxH = 0;
  tBurnout = NaN;
  landed = false;
  private rk = new RK4(3);

  constructor(p: RocketParams) {
    this.p = { ...p };
    this.reset();
  }

  reset(p?: Partial<RocketParams>): void {
    if (p) this.p = { ...this.p, ...p };
    this.y[0] = 0;
    this.y[1] = 0;
    this.y[2] = this.p.dry + this.p.fuel;
    this.t = 0;
    this.maxH = 0;
    this.tBurnout = this.p.fuel > 0 ? NaN : 0;
    this.landed = false;
  }

  get burnTime(): number {
    return this.p.fuel / this.p.mdot;
  }
  get burning(): boolean {
    return this.y[2] > this.p.dry + 1e-12;
  }
  gAt(h: number): number {
    if (!this.p.gravity) return 0;
    if (!this.p.variableG) return this.p.g0;
    const r = R_EARTH / (R_EARTH + Math.max(h, 0));
    return this.p.g0 * r * r;
  }
  rhoAt(h: number): number {
    return this.p.rho0 * Math.exp(-Math.max(h, 0) / SCALE_HEIGHT);
  }
  thrust(burning = this.burning): number {
    return burning ? this.p.ve * this.p.mdot : 0;
  }
  dragForce(h = this.y[0], v = this.y[1]): number {
    if (!this.p.drag) return 0;
    const A = (Math.PI * this.p.d * this.p.d) / 4;
    return 0.5 * this.rhoAt(h) * this.p.Cd * A * v * Math.abs(v);
  }
  /** resultant acceleration (up +) */
  get a(): number {
    const [h, v, m] = this.y;
    if (this.landed) return 0;
    return (this.thrust() - this.dragForce(h, v)) / m - this.gAt(h);
  }

  private burnOn = true;
  private deriv: Derivative = (_t, y, out) => {
    const F = this.burnOn ? this.p.ve * this.p.mdot : 0;
    out[0] = y[1];
    out[1] = (F - this.dragForce(y[0], y[1])) / y[2] - this.gAt(y[0]);
    out[2] = this.burnOn ? -this.p.mdot : 0;
  };

  step(dt: number): void {
    if (this.landed) {
      this.t += dt;
      return;
    }
    let left = dt;
    if (this.burning) {
      const tb = (this.y[2] - this.p.dry) / this.p.mdot; // time left until burnout
      this.burnOn = true;
      if (tb <= left) {
        this.rk.step(this.deriv, this.t, this.y, tb);
        this.y[2] = this.p.dry;
        this.tBurnout = this.t + tb;
        left -= tb;
      } else {
        this.rk.step(this.deriv, this.t, this.y, left);
        left = 0;
      }
    }
    if (left > 0) {
      this.burnOn = false;
      this.rk.step(this.deriv, this.t + dt - left, this.y, left);
    }
    this.t += dt;
    this.maxH = Math.max(this.maxH, this.y[0]);
    if (this.y[0] < 0) {
      this.y[0] = 0;
      this.y[1] = 0;
      // fell back after a flight → landed; otherwise it is still standing on the pad
      // (thrust smaller than weight), and the pad's normal force holds it
      if (this.maxH > 0.01) this.landed = true;
    }
  }
}

/** Tsiolkovsky rocket equation: Δv = v_e ln(m₀/m_f). */
export function tsiolkovsky(ve: number, m0: number, mf: number): number {
  return ve * Math.log(m0 / mf);
}
