/**
 * E.5 Stellar equilibrium: a one-zone toy model (labelled as simplified in the sim).
 *
 * The star is described by its radius R alone. Gravity pulls the outer layers in with a force per
 * unit mass ∝ GM/R²; the gas pressure pushes out, and when the star is squeezed adiabatically the
 * pressure rises as P ∝ R^(−3γ), so the outward push per unit mass ∝ R²P ∝ R^(2−3γ).
 * With x = R/R₀ (R₀ = equilibrium radius) and A = GM/R₀³:
 *   ẍ = A (x^(2−3γ) − x^(−2)).
 * x = 1 is the equilibrium (hydrostatic equilibrium: pressure balances gravity). Small disturbances
 * oscillate with ω² = A(3γ − 4) if γ > 4/3 (stable), and grow if γ < 4/3 (unstable). Radiation
 * pressure brings γ towards 4/3, which is why very massive stars are less stable.
 *
 * Conservative system → velocity Verlet (symplectic); energy E = ½ẋ² + V(x) with
 *   V(x) = −A (x^(3−3γ)/(3 − 3γ) + 1/x).
 */
import { G } from '../core/constants';

export const M_SUN = 1.99e30;
export const R_SUN = 6.96e8;
export const A_SUN = (G * M_SUN) / R_SUN ** 3; // s⁻²

export const accel = (x: number, gamma: number, A: number) => A * (x ** (2 - 3 * gamma) - x ** -2);
export const potential = (x: number, gamma: number, A: number) => -A * (x ** (3 - 3 * gamma) / (3 - 3 * gamma) + 1 / x);
export const smallOscillationOmega2 = (gamma: number, A: number) => A * (3 * gamma - 4);

export class OneZoneStar {
  x: number;
  v = 0;
  t = 0;
  private a: number;
  constructor(
    x0: number,
    public gamma = 5 / 3,
    public A = A_SUN,
  ) {
    this.x = x0;
    this.a = accel(x0, gamma, A);
  }
  step(dt: number): void {
    this.x += this.v * dt + 0.5 * this.a * dt * dt;
    const a2 = accel(this.x, this.gamma, this.A);
    this.v += 0.5 * (this.a + a2) * dt;
    this.a = a2;
    this.t += dt;
  }
  energy(): number {
    return 0.5 * this.v * this.v + potential(this.x, this.gamma, this.A);
  }
  /** outward (pressure) and inward (gravity) accelerations, in units of A */
  forces(): { out: number; in: number } {
    return { out: this.x ** (2 - 3 * this.gamma), in: this.x ** -2 };
  }
}
