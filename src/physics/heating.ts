/**
 * Heating curve of water: ice → water → steam at constant heater power P.
 * Exact piecewise solution (no integrator needed): the energy supplied is Q = Pt and
 *   one phase:   Q = mcΔT  → temperature rises with slope P/(mc)
 *   phase change: Q = mL  → temperature stays constant for a time mL/P
 * Assumes all heater energy goes into the water (no losses, container ignored), uniform
 * temperature, and normal atmospheric pressure (melting 0 °C, boiling 100 °C).
 */
export interface Substance {
  name: string;
  cSolid: number; // J kg⁻¹ K⁻¹
  cLiquid: number;
  cGas: number;
  Lf: number; // specific latent heat of fusion, J kg⁻¹
  Lv: number; // specific latent heat of vaporization, J kg⁻¹
  Tm: number; // melting point, °C
  Tb: number; // boiling point, °C
}

/** Typical textbook values (CRC Handbook of Chemistry and Physics), rounded. */
export const WATER: Substance = {
  name: 'water',
  cSolid: 2100,
  cLiquid: 4180,
  cGas: 2000,
  Lf: 3.34e5,
  Lv: 2.26e6,
  Tm: 0,
  Tb: 100,
};

export type Stage = 'solid' | 'melting' | 'liquid' | 'boiling' | 'gas';

export interface HeatingState {
  T: number; // °C
  solid: number; // kg
  liquid: number;
  gas: number;
  stage: Stage;
}

/** Energies [J] at which each stage ends, starting from solid at T0 (< Tm). */
export function stageEnergies(m: number, T0: number, s: Substance = WATER): [number, number, number, number] {
  const q1 = m * s.cSolid * (s.Tm - T0);
  const q2 = q1 + m * s.Lf;
  const q3 = q2 + m * s.cLiquid * (s.Tb - s.Tm);
  const q4 = q3 + m * s.Lv;
  return [q1, q2, q3, q4];
}

/** State after energy Q [J] has been supplied to mass m [kg] starting as solid at T0 [°C]. */
export function heatingState(Q: number, m: number, T0: number, s: Substance = WATER, out?: HeatingState): HeatingState {
  const r = out ?? { T: T0, solid: m, liquid: 0, gas: 0, stage: 'solid' as Stage };
  const [q1, q2, q3, q4] = stageEnergies(m, T0, s);
  if (Q <= q1) {
    r.T = T0 + Q / (m * s.cSolid);
    r.solid = m;
    r.liquid = 0;
    r.gas = 0;
    r.stage = 'solid';
  } else if (Q <= q2) {
    const melted = (Q - q1) / s.Lf;
    r.T = s.Tm;
    r.solid = m - melted;
    r.liquid = melted;
    r.gas = 0;
    r.stage = 'melting';
  } else if (Q <= q3) {
    r.T = s.Tm + (Q - q2) / (m * s.cLiquid);
    r.solid = 0;
    r.liquid = m;
    r.gas = 0;
    r.stage = 'liquid';
  } else if (Q <= q4) {
    const boiled = (Q - q3) / s.Lv;
    r.T = s.Tb;
    r.solid = 0;
    r.liquid = m - boiled;
    r.gas = boiled;
    r.stage = 'boiling';
  } else {
    r.T = s.Tb + (Q - q4) / (m * s.cGas);
    r.solid = 0;
    r.liquid = 0;
    r.gas = m;
    r.stage = 'gas';
  }
  return r;
}

/** Energy needed to reach temperature T (> T0) as gas after boiling, or any T in a single-phase stage. */
export function energyToReach(T: number, m: number, T0: number, s: Substance = WATER): number {
  const [, q2, , q4] = stageEnergies(m, T0, s);
  if (T <= s.Tm) return m * s.cSolid * (T - T0);
  if (T <= s.Tb) return q2 + m * s.cLiquid * (T - s.Tm);
  return q4 + m * s.cGas * (T - s.Tb);
}
