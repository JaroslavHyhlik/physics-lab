/**
 * Thermodynamic processes of an ideal monatomic gas (n moles), exact formulas.
 * IB sign convention: Q = ΔU + W, where W is the work done BY the gas.
 *   ΔU = (3/2)nRΔT;  γ = 5/3
 *   isobaric:   W = pΔV,              Q = (5/2)nRΔT
 *   isochoric:  W = 0,                Q = ΔU
 *   isothermal: W = nRT ln(V₂/V₁),    ΔU = 0, Q = W
 *   adiabatic:  pV^γ = constant,      Q = 0,  W = (p₁V₁ − p₂V₂)/(γ − 1)
 */
import { R } from '../core/constants';

export type ProcessKind = 'isobaric' | 'isochoric' | 'isothermal' | 'adiabatic';
export const GAMMA = 5 / 3;

export interface GasState {
  p: number;
  V: number;
  T: number;
}

export interface ProcessSpec {
  kind: ProcessKind;
  n: number;
  start: GasState;
  /** final volume (isobaric, isothermal, adiabatic) [m³] */
  V2: number;
  /** final temperature (isochoric) [K] */
  T2: number;
}

export function startState(n: number, p: number, V: number): GasState {
  return { p, V, T: (p * V) / (n * R) };
}

/** state after a fraction s ∈ [0, 1] of the process */
export function stateAt(spec: ProcessSpec, s: number): GasState {
  const { n, start } = spec;
  if (spec.kind === 'isochoric') {
    const T = start.T + (spec.T2 - start.T) * s;
    return { V: start.V, T, p: (n * R * T) / start.V };
  }
  const V = start.V + (spec.V2 - start.V) * s;
  if (spec.kind === 'isobaric') return { p: start.p, V, T: (start.p * V) / (n * R) };
  if (spec.kind === 'isothermal') return { T: start.T, V, p: (n * R * start.T) / V };
  const p = start.p * Math.pow(start.V / V, GAMMA);
  return { p, V, T: (p * V) / (n * R) };
}

export interface Energies {
  W: number; // work done by the gas
  dU: number;
  Q: number; // heat supplied to the gas
}

export function energiesAt(spec: ProcessSpec, s: number): Energies {
  const { n, start } = spec;
  const st = stateAt(spec, s);
  const dU = 1.5 * n * R * (st.T - start.T);
  let W: number;
  switch (spec.kind) {
    case 'isobaric':
      W = start.p * (st.V - start.V);
      break;
    case 'isochoric':
      W = 0;
      break;
    case 'isothermal':
      W = n * R * start.T * Math.log(st.V / start.V);
      break;
    default:
      W = (start.p * start.V - st.p * st.V) / (GAMMA - 1);
  }
  return { W, dU, Q: dU + W };
}
