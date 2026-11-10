/**
 * Gas laws for a fixed amount of gas (n moles), SI units.
 * Ideal gas: pV = nRT. Real gas (beyond syllabus): van der Waals (p + an²/V²)(V − nb) = nRT,
 * solved for V by Newton's method starting from the ideal-gas volume.
 * van der Waals constants: CRC Handbook of Chemistry and Physics (converted to SI).
 */
import { R } from '../core/constants';

export interface VdwGas {
  name: string;
  a: number; // Pa m⁶ mol⁻²
  b: number; // m³ mol⁻¹
}

export const VDW: Record<string, VdwGas> = {
  He: { name: 'Helium', a: 0.00346, b: 2.38e-5 },
  N2: { name: 'Nitrogen', a: 0.137, b: 3.87e-5 },
  CO2: { name: 'Carbon dioxide', a: 0.364, b: 4.267e-5 },
};

export const idealP = (n: number, V: number, T: number) => (n * R * T) / V;
export const idealV = (n: number, p: number, T: number) => (n * R * T) / p;
export const idealT = (n: number, p: number, V: number) => (p * V) / (n * R);

export function vdwP(n: number, V: number, T: number, g: VdwGas): number {
  return (n * R * T) / (V - n * g.b) - (g.a * n * n) / (V * V);
}

/** volume at pressure p and temperature T; for T below the critical temperature the gas branch is chosen */
export function vdwV(n: number, p: number, T: number, g: VdwGas): number {
  let V = Math.max(idealV(n, p, T), 1.5 * n * g.b);
  for (let i = 0; i < 100; i++) {
    const f = vdwP(n, V, T, g) - p;
    const df = (-n * R * T) / (V - n * g.b) ** 2 + (2 * g.a * n * n) / V ** 3;
    let Vn = V - f / df;
    if (!(Vn > n * g.b)) Vn = 0.5 * (V + n * g.b);
    if (Math.abs(Vn - V) < 1e-14 * V) return Vn;
    V = Vn;
  }
  return V;
}

/** critical temperature of a van der Waals gas, T_c = 8a/(27Rb) */
export const criticalT = (g: VdwGas) => (8 * g.a) / (27 * R * g.b);
