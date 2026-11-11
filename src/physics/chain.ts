/**
 * E.4 Chain reaction (illustrative 2D Monte Carlo model).
 *
 * Neutrons move in straight lines inside a lump of uranium (a disc, or a flat plate of the same
 * area). Lengths are measured in units of the mean free path λ: the distance a neutron travels
 * before it is absorbed by a nucleus is random, exponentially distributed with mean 1.
 *   - If it leaves the lump first, it escapes (leakage).
 *   - If it is absorbed by U-235, fission follows with probability σ_f/σ_a = 585/681 (thermal
 *     cross-sections) and releases 2 or 3 neutrons (mean ν = 2.43) and about 200 MeV.
 *   - If absorbed by U-238 (or captured by U-235 without fission), the neutron is lost.
 * The fraction of absorptions in U-235 follows from the enrichment e and the thermal absorption
 * cross-sections (U-235 681 b, U-238 2.7 b), so the infinite-medium multiplication factor is
 *   k∞ = ν · e σ_f5 / (e σ_a5 + (1 − e) σ_a8),
 * and k_eff = k∞ × (probability of not escaping), which falls as the lump gets smaller or flatter.
 * Fuel used up by the fissions is ignored (a few thousand nuclei out of ~10²⁴).
 */
import type { Rng } from '../core/rng';

export const NU = 2.43;
export const SIGMA_F5 = 585; // b, thermal fission U-235
export const SIGMA_A5 = 681; // b, thermal absorption U-235
export const SIGMA_A8 = 2.7; // b, thermal absorption U-238
export const MEV_PER_FISSION = 200;

/** probability that an absorbed neutron causes fission, for enrichment e (fraction U-235) */
export function fissionProbability(e: number): number {
  return (e * SIGMA_F5) / (e * SIGMA_A5 + (1 - e) * SIGMA_A8);
}
export const kInfinity = (e: number) => NU * fissionProbability(e);

export type Shape = 'disc' | 'plate';
/** half-sizes of the lump: disc radius R, or a plate of the same area with sides in ratio 8:1 */
export function plateHalf(R: number): [number, number] {
  const area = Math.PI * R * R;
  const h = Math.sqrt(area / 32); // (2a)(2b) = area, a = 8b
  return [8 * h, h];
}

export class ChainReaction {
  readonly max: number;
  x: Float64Array;
  y: Float64Array;
  ux: Float64Array;
  uy: Float64Array;
  /** path still to travel before absorption */
  s: Float64Array;
  gen: Int32Array;
  alive: Uint8Array;
  /** stack of free slots, so adding a neutron is O(1) */
  private free: Int32Array;
  private nFree: number;
  n = 0; // alive count
  births: number[] = [];
  aliveInGen: number[] = [];
  fissions = 0;
  escaped = 0;
  captured = 0;
  overflow = false;
  /** events in the last step, for drawing flashes: [x, y, type] with 1 = fission, 0 = capture */
  events: number[] = [];
  /** neutrons of later generations are counted in births but not followed (used by tests) */
  followUpToGen = Infinity;

  constructor(
    public rng: Rng,
    public R = 4,
    public shape: Shape = 'disc',
    public enrichment = 0.9,
    max = 4000,
  ) {
    this.max = max;
    this.x = new Float64Array(max);
    this.y = new Float64Array(max);
    this.ux = new Float64Array(max);
    this.uy = new Float64Array(max);
    this.s = new Float64Array(max);
    this.gen = new Int32Array(max);
    this.alive = new Uint8Array(max);
    this.free = new Int32Array(max);
    for (let i = 0; i < max; i++) this.free[i] = max - 1 - i;
    this.nFree = max;
  }

  inside(x: number, y: number): boolean {
    if (this.shape === 'disc') return x * x + y * y < this.R * this.R;
    const [a, b] = plateHalf(this.R);
    return Math.abs(x) < a && Math.abs(y) < b;
  }

  /** a random point inside the lump */
  randomPoint(): [number, number] {
    for (;;) {
      const [a, b] = this.shape === 'disc' ? [this.R, this.R] : plateHalf(this.R);
      const x = this.rng.uniform(-a, a);
      const y = this.rng.uniform(-b, b);
      if (this.inside(x, y)) return [x, y];
    }
  }

  /** add a neutron in generation g at (x, y) moving in a random direction */
  add(x: number, y: number, g: number): boolean {
    if (g > this.followUpToGen) {
      this.births[g] = (this.births[g] ?? 0) + 1;
      return true;
    }
    if (this.nFree > 0) {
      const i = this.free[--this.nFree];
      const th = this.rng.uniform(0, 2 * Math.PI);
      this.x[i] = x;
      this.y[i] = y;
      this.ux[i] = Math.cos(th);
      this.uy[i] = Math.sin(th);
      this.s[i] = -Math.log(1 - this.rng.next());
      this.gen[i] = g;
      this.alive[i] = 1;
      this.n++;
      this.births[g] = (this.births[g] ?? 0) + 1;
      this.aliveInGen[g] = (this.aliveInGen[g] ?? 0) + 1;
      return true;
    }
    this.overflow = true;
    return false;
  }

  /** start n neutrons of generation 0, at the centre or at random points */
  inject(n: number, atCentre = false): void {
    for (let k = 0; k < n; k++) {
      const [x, y] = atCentre ? [0, 0] : this.randomPoint();
      this.add(x, y, 0);
    }
  }

  private kill(i: number) {
    this.alive[i] = 0;
    this.free[this.nFree++] = i;
    this.n--;
    this.aliveInGen[this.gen[i]]--;
  }

  /** move every neutron a path length ds and handle escapes, captures and fissions */
  step(ds: number): void {
    this.events.length = 0;
    const pf = fissionProbability(this.enrichment);
    for (let i = 0; i < this.max; i++) {
      if (!this.alive[i]) continue;
      const d = Math.min(ds, this.s[i]);
      this.x[i] += this.ux[i] * d;
      this.y[i] += this.uy[i] * d;
      this.s[i] -= d;
      if (!this.inside(this.x[i], this.y[i])) {
        this.escaped++;
        this.kill(i);
        continue;
      }
      if (this.s[i] <= 0) {
        const x = this.x[i];
        const y = this.y[i];
        const g = this.gen[i];
        this.kill(i);
        if (this.rng.next() < pf) {
          this.fissions++;
          this.events.push(x, y, 1);
          const nu = this.rng.next() < NU - 2 ? 3 : 2; // P(3) = 0.43 → mean 2.43
          for (let k = 0; k < nu; k++) this.add(x, y, g + 1);
        } else {
          this.captured++;
          this.events.push(x, y, 0);
        }
      }
    }
  }

  /** k measured for each completed generation: births(g + 1)/births(g) */
  measuredK(): number[] {
    const k: number[] = [];
    for (let g = 0; g + 1 < this.births.length; g++) {
      if ((this.aliveInGen[g] ?? 0) > 0) break; // generation g not finished yet
      k.push((this.births[g + 1] ?? 0) / this.births[g]);
    }
    return k;
  }
}
