/**
 * I–V behaviour of circuit components (steady state).
 *  - Resistor: I = V/R (ohmic).
 *  - Filament lamp (12 V, 24 W, tungsten): R(T) = R_cold (T/T₀)^1.2 (tungsten resistivity rises
 *    roughly as T^1.2); the filament temperature settles where electrical power equals the power
 *    radiated, V²/R(T) = K(T⁴ − T₀⁴). K is fixed by the rating: 24 W at 2700 K. Solved by bisection.
 *  - Silicon diode (Shockley): I = I_s (e^{V/(nV_T)} − 1), I_s = 1 nA, n = 1.5, V_T = k_BT/e at 300 K.
 *    Reverse breakdown is not modelled.
 */
import { k_B, e } from '../core/constants';

export const LAMP = { Vrated: 12, Prated: 24, Thot: 2700, T0: 293, exponent: 1.2 };
const Rhot = (LAMP.Vrated * LAMP.Vrated) / LAMP.Prated;
export const LAMP_RCOLD = Rhot / Math.pow(LAMP.Thot / LAMP.T0, LAMP.exponent);
const K = LAMP.Prated / (LAMP.Thot ** 4 - LAMP.T0 ** 4);

export const lampR = (T: number) => LAMP_RCOLD * Math.pow(T / LAMP.T0, LAMP.exponent);

/** steady filament temperature for a p.d. V across the lamp */
export function lampT(V: number): number {
  const v2 = V * V;
  if (v2 === 0) return LAMP.T0;
  let lo = LAMP.T0;
  let hi = 6000;
  for (let i = 0; i < 100; i++) {
    const T = 0.5 * (lo + hi);
    if (v2 / lampR(T) - K * (T ** 4 - LAMP.T0 ** 4) > 0) lo = T;
    else hi = T;
  }
  return 0.5 * (lo + hi);
}
export const lampI = (V: number) => V / lampR(lampT(V));

export const DIODE = { Is: 1e-9, n: 1.5, VT: (k_B * 300) / e };
export const diodeI = (V: number) => DIODE.Is * Math.expm1(V / (DIODE.n * DIODE.VT));
