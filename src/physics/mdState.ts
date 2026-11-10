/** Messages between the particle-model screen and its worker (or the main-thread fallback). */
import type { MDConfig, MDSystem } from './lennardJones';

export interface MDRequest {
  id: number;
  reset?: MDConfig;
  steps: number;
  mode: string;
  Ttarget: number;
  power: number;
  /** buffer returned for reuse (x, y, speed for each particle) */
  buf?: Float32Array;
}

export interface MDState {
  id: number;
  buf: Float32Array;
  N: number;
  L: number;
  t: number;
  KE: number;
  PE: number;
  T: number;
  heatIn: number;
  neighbours: number;
}

export function packState(s: MDSystem, id: number, buf?: Float32Array): MDState {
  const b = buf && buf.length === 3 * s.N ? buf : new Float32Array(3 * s.N);
  for (let i = 0; i < s.N; i++) {
    b[3 * i] = s.x[i];
    b[3 * i + 1] = s.y[i];
    b[3 * i + 2] = Math.hypot(s.vx[i], s.vy[i]);
  }
  return { id, buf: b, N: s.N, L: s.L, t: s.t, KE: s.KE, PE: s.PE, T: s.T, heatIn: s.heatIn, neighbours: s.neighbours() };
}
