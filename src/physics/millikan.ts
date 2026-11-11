/**
 * Millikan's oil-drop experiment between parallel plates (uniform field E = V/d, pointing down,
 * so a negatively charged drop is pushed up with force |q|E).
 * Forces on a drop of radius r: weight mg, buoyancy of air, electric force, Stokes drag 6πηrv.
 * The motion relaxes to the terminal velocity in τ = m/(6πηr) (microseconds), exactly:
 *   v(t) = v_t + (v₀ − v_t) e^{−t/τ},   v_t = (m_eff g − |q|E)/(6πηr)   (positive = down)
 * Hovering (v_t = 0): |q| = m_eff g d / V  →  V_hover = m_eff g d / |q|.
 */
import { e as eCharge, g } from '../core/constants';

export const OIL_DENSITY = 875; // kg m⁻³ (typical light oil)
export const AIR_DENSITY = 1.2; // kg m⁻³
export const AIR_VISCOSITY = 1.81e-5; // Pa s (20 °C)

export interface Drop {
  r: number; // m
  n: number; // number of extra electrons (charge −ne)
  y: number; // height above the bottom plate [m]
  v: number; // downward velocity [m s⁻¹]
}

export const dropMassEff = (r: number) => (4 / 3) * Math.PI * r ** 3 * (OIL_DENSITY - AIR_DENSITY);
export const dropMass = (r: number) => (4 / 3) * Math.PI * r ** 3 * OIL_DENSITY;

export function terminalVelocity(r: number, q: number, E: number): number {
  return (dropMassEff(r) * g - Math.abs(q) * E) / (6 * Math.PI * AIR_VISCOSITY * r);
}

export const hoverVoltage = (r: number, q: number, d: number) => (dropMassEff(r) * g * d) / Math.abs(q);

/** advance a drop exactly by dt in field E (downward velocity positive) */
export function stepDrop(drop: Drop, E: number, dt: number): void {
  const vt = terminalVelocity(drop.r, drop.n * eCharge, E);
  const tau = dropMass(drop.r) / (6 * Math.PI * AIR_VISCOSITY * drop.r);
  const k = Math.exp(-dt / tau);
  const dy = vt * dt + (drop.v - vt) * tau * (1 - k);
  drop.v = vt + (drop.v - vt) * k;
  drop.y -= dy;
}
