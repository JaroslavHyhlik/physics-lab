/**
 * Heat-engine cycles built from the processes in thermoProcess.ts (ideal monatomic gas).
 *   Carnot: isothermal expansion at T_h, adiabatic expansion to T_c, isothermal compression at T_c,
 *           adiabatic compression back.            η = 1 − T_c/T_h
 *   Otto:   adiabatic compression (ratio r), isochoric heating to T_max, adiabatic expansion,
 *           isochoric cooling.                     η = 1 − r^{1−γ}
 *   Stirling (no regenerator): isothermal expansion at T_h, isochoric cooling to T_c,
 *           isothermal compression at T_c, isochoric heating.
 * η = W_net / Q_in, where Q_in is the heat taken in on the legs where Q > 0.
 */
import { R } from '../core/constants';
import { GAMMA, energiesAt, stateAt, type GasState, type ProcessKind, type ProcessSpec } from './thermoProcess';

export type CycleKind = 'carnot' | 'otto' | 'stirling';

export interface Leg {
  spec: ProcessSpec;
  label: string;
}

function leg(kind: ProcessKind, n: number, start: GasState, target: { V?: number; T?: number }, label: string): Leg {
  return { spec: { kind, n, start, V2: target.V ?? start.V, T2: target.T ?? start.T }, label };
}
const st = (n: number, V: number, T: number): GasState => ({ V, T, p: (n * R * T) / V });

/** V ratio needed for an adiabatic change of temperature from T1 to T2: V2/V1 = (T1/T2)^{1/(γ−1)} */
const adiabaticRatio = (T1: number, T2: number) => Math.pow(T1 / T2, 1 / (GAMMA - 1));

export interface CycleParams {
  n: number;
  Th: number;
  Tc: number;
  /** smallest volume [m³] */
  V1: number;
  /** expansion ratio of the isothermal legs (Carnot, Stirling) or compression ratio r (Otto) */
  ratio: number;
}

export function buildCycle(kind: CycleKind, c: CycleParams): Leg[] {
  const { n, Th, Tc, V1, ratio } = c;
  const legs: Leg[] = [];
  const add = (l: Leg) => {
    legs.push(l);
    return stateAt(l.spec, 1);
  };
  if (kind === 'carnot') {
    let s = st(n, V1, Th);
    s = add(leg('isothermal', n, s, { V: V1 * ratio }, 'isothermal expansion at T_h'));
    s = add(leg('adiabatic', n, s, { V: V1 * ratio * adiabaticRatio(Th, Tc) }, 'adiabatic expansion'));
    s = add(leg('isothermal', n, s, { V: V1 * adiabaticRatio(Th, Tc) }, 'isothermal compression at T_c'));
    add(leg('adiabatic', n, s, { V: V1 }, 'adiabatic compression'));
  } else if (kind === 'otto') {
    // start at the largest volume r·V1 and the low temperature T_c
    let s = st(n, V1 * ratio, Tc);
    s = add(leg('adiabatic', n, s, { V: V1 }, 'adiabatic compression'));
    s = add(leg('isochoric', n, s, { T: Math.max(Th, s.T * 1.0001) }, 'isochoric heating (ignition)'));
    s = add(leg('adiabatic', n, s, { V: V1 * ratio }, 'adiabatic expansion (power stroke)'));
    add(leg('isochoric', n, s, { T: Tc }, 'isochoric cooling (exhaust)'));
  } else {
    let s = st(n, V1, Th);
    s = add(leg('isothermal', n, s, { V: V1 * ratio }, 'isothermal expansion at T_h'));
    s = add(leg('isochoric', n, s, { T: Tc }, 'isochoric cooling'));
    s = add(leg('isothermal', n, s, { V: V1 }, 'isothermal compression at T_c'));
    add(leg('isochoric', n, s, { T: Th }, 'isochoric heating'));
  }
  return legs;
}

export interface CycleSummary {
  Qin: number;
  Qout: number;
  Wnet: number;
  efficiency: number;
  carnot: number;
  Tmax: number;
  Tmin: number;
}

export function summarize(legs: Leg[]): CycleSummary {
  let Qin = 0;
  let Qout = 0;
  let Wnet = 0;
  let Tmax = -Infinity;
  let Tmin = Infinity;
  for (const l of legs) {
    const e = energiesAt(l.spec, 1);
    if (e.Q > 0) Qin += e.Q;
    else Qout -= e.Q;
    Wnet += e.W;
    for (const s of [0, 0.5, 1]) {
      const T = stateAt(l.spec, s).T;
      Tmax = Math.max(Tmax, T);
      Tmin = Math.min(Tmin, T);
    }
  }
  return { Qin, Qout, Wnet, efficiency: Wnet / Qin, carnot: 1 - Tmin / Tmax, Tmax, Tmin };
}

/** state at cycle progress u ∈ [0, legs.length) */
export function cycleState(legs: Leg[], u: number): GasState {
  const k = Math.min(legs.length - 1, Math.floor(u));
  return stateAt(legs[k].spec, Math.min(1, u - k));
}
