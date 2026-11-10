/** Messages for the gas worker: settings, state and the handler shared by worker and fallback. */
import { Gas3D, type GasConfig } from './gas';
import type { StepRequest } from '../workers/stepClient';

export interface GasSettings {
  LxTarget: number;
  pistonSpeed: number;
  bath: boolean;
  Tbath: number;
}

export interface GasState {
  buf: Float32Array; // per atom: x, y, z, speed, species
  N: number;
  L: number;
  Lx: number;
  dt: number;
  t: number;
  T: number;
  V: number;
  pMeasured: number;
  pIdeal: number;
  Q: number;
  W: number;
  KE: number;
  collisions: number;
  wallHits: number;
  pistonV: number;
  masses: number[];
}

export const GAS_STRIDE = 5;

export function createGasHandler() {
  let g: Gas3D | null = null;
  return (req: StepRequest<GasConfig, GasSettings>): GasState => {
    if (req.reset) g = new Gas3D(req.reset);
    const gas = g!;
    gas.LxTarget = req.set.LxTarget;
    gas.pistonSpeedMax = req.set.pistonSpeed;
    gas.bath = req.set.bath;
    gas.Tbath = req.set.Tbath;
    for (let i = 0; i < req.steps; i++) gas.step();
    const n = gas.N * GAS_STRIDE;
    const b = req.buf && req.buf.length === n ? req.buf : new Float32Array(n);
    for (let i = 0; i < gas.N; i++) {
      const o = i * GAS_STRIDE;
      b[o] = gas.x[i];
      b[o + 1] = gas.y[i];
      b[o + 2] = gas.z[i];
      b[o + 3] = Math.hypot(gas.vx[i], gas.vy[i], gas.vz[i]);
      b[o + 4] = gas.species[i];
    }
    return {
      buf: b,
      N: gas.N,
      L: gas.L,
      Lx: gas.Lx,
      dt: gas.dt,
      t: gas.t,
      T: gas.T,
      V: gas.V,
      pMeasured: gas.pMeasured,
      pIdeal: gas.pIdeal,
      Q: gas.Q,
      W: gas.W,
      KE: gas.KE,
      collisions: gas.collisions,
      wallHits: gas.wallHits,
      pistonV: gas.pistonV,
      masses: gas.speciesList.map((s) => s.mass),
    };
  };
}
