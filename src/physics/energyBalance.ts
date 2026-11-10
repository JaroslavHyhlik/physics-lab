/**
 * Zero-dimensional planetary energy balance (whole planet, one temperature).
 *   absorbed per m² of surface: (1 − α)S/4   (S/4: sunlight falls on a disc πR², the surface is 4πR²)
 *   emitted per m²:             εσT⁴
 *   C dT/dt = (1 − α)S/4 − εσT⁴,   C = heat capacity per m² (mostly the ocean's mixed layer)
 * Equilibrium: T = [(1 − α)S/(4εσ)]^{1/4}. Integrator: RK4 (smooth ODE).
 * Here ε is the effective emissivity of surface + atmosphere seen from space; a value below 1
 * stands for the greenhouse effect (as in the IB treatment).
 */
import { sigma } from '../core/constants';

export const YEAR = 3.156e7; // s

export function equilibriumT(S: number, albedo: number, emissivity: number): number {
  return Math.pow(((1 - albedo) * S) / (4 * emissivity * sigma), 0.25);
}

export class EnergyBalance {
  T: number;
  t = 0;
  /** total energy absorbed and emitted per m² since the start [J m⁻²] */
  Ein = 0;
  Eout = 0;
  constructor(
    public S: number,
    public albedo: number,
    public emissivity: number,
    public C: number,
    public T0: number,
  ) {
    this.T = T0;
  }

  get absorbed(): number {
    return ((1 - this.albedo) * this.S) / 4;
  }
  emitted(T = this.T): number {
    return this.emissivity * sigma * T ** 4;
  }

  step(dt: number): void {
    const f = (T: number) => (this.absorbed - this.emitted(T)) / this.C;
    const T = this.T;
    const k1 = f(T);
    const k2 = f(T + 0.5 * dt * k1);
    const k3 = f(T + 0.5 * dt * k2);
    const k4 = f(T + dt * k3);
    // energy bookkeeping with the same RK4 weights
    const e = (x: number) => this.emitted(x);
    this.Eout += (dt / 6) * (e(T) + 2 * e(T + 0.5 * dt * k1) + 2 * e(T + 0.5 * dt * k2) + e(T + dt * k3));
    this.Ein += this.absorbed * dt;
    this.T = T + (dt / 6) * (k1 + 2 * k2 + 2 * k3 + k4);
    this.t += dt;
  }

  /** relaxation time near equilibrium, C/(4εσT³) [s] */
  get tau(): number {
    const Te = equilibriumT(this.S, this.albedo, this.emissivity);
    return this.C / (4 * this.emissivity * sigma * Te ** 3);
  }
}
