/**
 * Entropy.
 * 1) Microstates: N labelled particles, each in the left or right half of a box. A macrostate
 *    "n in the left half" has Ω = C(N, n) microstates; S = k_B ln Ω. ln C is computed exactly
 *    from sums of logarithms (no Stirling approximation). The particles move ballistically in a
 *    2D box with reflecting walls; a partition can keep them in the left half (free expansion).
 * 2) Heat exchange between two bodies (heat capacities C₁, C₂) through a conductance K:
 *    exact exponential approach to T_f = (C₁T₁ + C₂T₂)/(C₁ + C₂);
 *    ΔS = C₁ ln(T₁/T₁₀) + C₂ ln(T₂/T₂₀) ≥ 0, and dS = dQ/T₂ − dQ/T₁.
 */
import { k_B } from '../core/constants';
import { Rng } from '../core/rng';

const lnFactCache: number[] = [0];
export function lnFactorial(n: number): number {
  for (let k = lnFactCache.length; k <= n; k++) lnFactCache[k] = lnFactCache[k - 1] + Math.log(k);
  return lnFactCache[n];
}
export function lnChoose(N: number, k: number): number {
  if (k < 0 || k > N) return -Infinity;
  return lnFactorial(N) - lnFactorial(k) - lnFactorial(N - k);
}
/** S = k_B ln Ω for the macrostate n-left out of N */
export const entropyHalves = (N: number, n: number) => k_B * lnChoose(N, n);

export class Expansion {
  readonly x: Float64Array;
  readonly y: Float64Array;
  readonly vx: Float64Array;
  readonly vy: Float64Array;
  partition = true;
  t = 0;
  constructor(
    readonly N: number,
    seed = 1,
  ) {
    const rng = new Rng(seed);
    this.x = new Float64Array(N);
    this.y = new Float64Array(N);
    this.vx = new Float64Array(N);
    this.vy = new Float64Array(N);
    for (let i = 0; i < N; i++) {
      this.x[i] = rng.uniform(0.01, 0.49); // box: x ∈ [0, 1], y ∈ [0, 0.5], partition at x = 0.5
      this.y[i] = rng.uniform(0.01, 0.49);
      const a = 2 * Math.PI * rng.next();
      const v = 0.15 * (0.5 + rng.next());
      this.vx[i] = v * Math.cos(a);
      this.vy[i] = v * Math.sin(a);
    }
  }
  step(dt: number): void {
    for (let i = 0; i < this.N; i++) {
      let x = this.x[i] + this.vx[i] * dt;
      let y = this.y[i] + this.vy[i] * dt;
      const right = this.partition ? 0.5 : 1;
      if (x < 0) {
        x = -x;
        this.vx[i] = -this.vx[i];
      }
      if (x > right) {
        x = 2 * right - x;
        this.vx[i] = -this.vx[i];
      }
      if (y < 0) {
        y = -y;
        this.vy[i] = -this.vy[i];
      }
      if (y > 0.5) {
        y = 1 - y;
        this.vy[i] = -this.vy[i];
      }
      this.x[i] = x;
      this.y[i] = y;
    }
    this.t += dt;
  }
  get nLeft(): number {
    let n = 0;
    for (let i = 0; i < this.N; i++) if (this.x[i] < 0.5) n++;
    return n;
  }
}

export interface ExchangeState {
  T1: number;
  T2: number;
  Q: number; // heat that has flowed from body 1 to body 2 [J]
  dS: number; // total entropy change [J K⁻¹]
}
export function heatExchange(C1: number, C2: number, T10: number, T20: number, K: number, t: number): ExchangeState {
  const Tf = (C1 * T10 + C2 * T20) / (C1 + C2);
  const d = (T10 - T20) * Math.exp(-K * (1 / C1 + 1 / C2) * t);
  const T1 = Tf + (C2 / (C1 + C2)) * d;
  const T2 = Tf - (C1 / (C1 + C2)) * d;
  return { T1, T2, Q: C1 * (T10 - T1), dS: C1 * Math.log(T1 / T10) + C2 * Math.log(T2 / T20) };
}
