/**
 * Monatomic gas in a 3D box with a movable piston (kinetic model, SI units).
 *
 * - Atoms are hard spheres with their kinetic diameters; atom–atom collisions are elastic
 *   (found with sweep-and-prune along x each step; velocities exchanged along the line of centres).
 * - The box is so small (tens of nm) that atoms hit the walls far more often than each other.
 *   Real walls are rough, so the fixed walls scatter each atom in a random direction (cosine law)
 *   without changing its speed. This conserves energy and keeps the gas isotropic.
 * - The piston (right wall, x = L_x) is smooth and may move with velocity u: v_x' = 2u − v_x.
 *   The kinetic-energy change is the work done on the gas.
 * - Optionally the left wall is a heat bath at T_bath: atoms leave it with speeds drawn from the
 *   wall's thermal (flux-weighted Maxwell–Boltzmann) distribution. The energy change is heat Q.
 * - Pressure is measured from the momentum given to all six walls per unit area per unit time,
 *   averaged over a sliding window of steps.
 * Integration: straight-line motion with collisions handled at the end of each step (dt chosen
 * so an atom moves much less than its diameter per step).
 */
import { k_B, u as amu } from '../core/constants';
import { Rng } from '../core/rng';

export interface GasSpecies {
  name: string;
  symbol: string;
  mass: number; // kg
  diameter: number; // m (kinetic diameter)
}

/** Kinetic diameters: D. W. Breck, Zeolite Molecular Sieves (1974); masses in u (IUPAC). */
export const GASES: Record<string, GasSpecies> = {
  He: { name: 'Helium', symbol: 'He', mass: 4.003 * amu, diameter: 0.26e-9 },
  Ne: { name: 'Neon', symbol: 'Ne', mass: 20.18 * amu, diameter: 0.275e-9 },
  Ar: { name: 'Argon', symbol: 'Ar', mass: 39.95 * amu, diameter: 0.34e-9 },
  Xe: { name: 'Xenon', symbol: 'Xe', mass: 131.29 * amu, diameter: 0.396e-9 },
};

export interface GasConfig {
  /** number of atoms of each species, e.g. { He: 200, Ar: 50 } */
  counts: Record<string, number>;
  /** box height and depth [m] */
  L: number;
  /** starting piston position (box length along x) [m] */
  Lx: number;
  T0: number;
  seed: number;
}

/** time step for a mixture: the fastest likely atom (≈ 4 × rms of the lightest at ≥ 1000 K) moves 0.2 diameters */
export function gasTimeStep(counts: Record<string, number>): number {
  const sp = Object.keys(counts)
    .filter((k) => counts[k] > 0)
    .map((k) => GASES[k]);
  const mMin = Math.min(...sp.map((s) => s.mass));
  const vFast = 4 * Math.sqrt((3 * k_B * 1000) / mMin);
  return (0.2 * Math.min(...sp.map((s) => s.diameter))) / vFast;
}

export class Gas3D {
  readonly N: number;
  readonly L: number;
  Lx: number;
  readonly x: Float64Array;
  readonly y: Float64Array;
  readonly z: Float64Array;
  readonly vx: Float64Array;
  readonly vy: Float64Array;
  readonly vz: Float64Array;
  readonly m: Float64Array;
  readonly r: Float64Array;
  readonly species: Uint8Array;
  readonly speciesList: GasSpecies[];
  private order: Int32Array;
  private dmax = 0;
  t = 0;
  dt: number;
  /** piston */
  LxTarget: number;
  pistonSpeedMax = 50; // m s⁻¹
  pistonV = 0;
  /** heat bath on the left wall */
  bath = false;
  Tbath = 300;
  /** energy bookkeeping [J] */
  Q = 0;
  W = 0;
  /** pressure measurement window */
  private ring: Float64Array;
  private ringArea: Float64Array;
  private ringPos = 0;
  private ringFill = 0;
  collisions = 0;
  wallHits = 0;
  /** running totals for a long-time pressure average: Σ impulse and Σ area·dt */
  impulseTotal = 0;
  areaTime = 0;
  private rng: Rng;

  /** windowTime: averaging time for the pressure gauge [s] */
  constructor(cfg: GasConfig, windowTime = 1e-11) {
    this.rng = new Rng(cfg.seed);
    this.speciesList = Object.keys(cfg.counts)
      .filter((k) => cfg.counts[k] > 0)
      .map((k) => GASES[k]);
    const N = Object.values(cfg.counts).reduce((a, b) => a + b, 0);
    this.N = N;
    this.L = cfg.L;
    this.Lx = cfg.Lx;
    this.LxTarget = cfg.Lx;
    this.x = new Float64Array(N);
    this.y = new Float64Array(N);
    this.z = new Float64Array(N);
    this.vx = new Float64Array(N);
    this.vy = new Float64Array(N);
    this.vz = new Float64Array(N);
    this.m = new Float64Array(N);
    this.r = new Float64Array(N);
    this.species = new Uint8Array(N);
    this.order = new Int32Array(N);
    this.dt = gasTimeStep(cfg.counts);
    const window = Math.max(10, Math.round(windowTime / this.dt));
    this.ring = new Float64Array(window);
    this.ringArea = new Float64Array(window);
    let i = 0;
    this.speciesList.forEach((sp, s) => {
      const n = cfg.counts[sp.symbol];
      for (let k = 0; k < n; k++, i++) {
        this.m[i] = sp.mass;
        this.r[i] = sp.diameter / 2;
        this.species[i] = s;
      }
      this.dmax = Math.max(this.dmax, sp.diameter);
    });
    this.place();
    this.thermalize(cfg.T0);
  }

  private place(): void {
    const { rng, N } = this;
    for (let i = 0; i < N; i++) {
      for (let tries = 0; tries < 1000; tries++) {
        const ri = this.r[i];
        this.x[i] = rng.uniform(ri, this.Lx - ri);
        this.y[i] = rng.uniform(ri, this.L - ri);
        this.z[i] = rng.uniform(ri, this.L - ri);
        let ok = true;
        for (let j = 0; j < i && ok; j++) {
          const d = ri + this.r[j];
          if ((this.x[i] - this.x[j]) ** 2 + (this.y[i] - this.y[j]) ** 2 + (this.z[i] - this.z[j]) ** 2 < d * d) ok = false;
        }
        if (ok) break;
      }
      this.order[i] = i;
    }
  }

  /** Maxwell–Boltzmann velocities at temperature T */
  thermalize(T: number): void {
    for (let i = 0; i < this.N; i++) {
      const s = Math.sqrt((k_B * T) / this.m[i]);
      this.vx[i] = s * this.rng.gaussian();
      this.vy[i] = s * this.rng.gaussian();
      this.vz[i] = s * this.rng.gaussian();
    }
  }

  get V(): number {
    return this.Lx * this.L * this.L;
  }
  get area(): number {
    return 2 * this.L * this.L + 4 * this.L * this.Lx;
  }
  get KE(): number {
    let s = 0;
    for (let i = 0; i < this.N; i++) s += this.m[i] * (this.vx[i] ** 2 + this.vy[i] ** 2 + this.vz[i] ** 2);
    return 0.5 * s;
  }
  /** temperature from ⟨½mv²⟩ = (3/2)k_BT */
  get T(): number {
    return (2 * this.KE) / (3 * this.N * k_B);
  }
  /** ideal-gas pressure NkT/V */
  get pIdeal(): number {
    return (this.N * k_B * this.T) / this.V;
  }
  /** measured pressure: momentum given to the walls per unit area per unit time (sliding window) */
  get pMeasured(): number {
    if (this.ringFill === 0) return NaN;
    let s = 0;
    let a = 0;
    for (let k = 0; k < this.ringFill; k++) {
      s += this.ring[k];
      a += this.ringArea[k];
    }
    return s / ((a / this.ringFill) * this.ringFill * this.dt);
  }

  /** scatter an atom off a rough wall: random direction (cosine law about the inward normal), same speed */
  private diffuse(i: number, axis: 0 | 1 | 2, sign: 1 | -1, thermalT: number): number {
    const rng = this.rng;
    const mi = this.m[i];
    const vin = axis === 0 ? this.vx[i] : axis === 1 ? this.vy[i] : this.vz[i];
    const e0 = this.vx[i] ** 2 + this.vy[i] ** 2 + this.vz[i] ** 2;
    let vn: number;
    let t1: number;
    let t2: number;
    if (thermalT > 0) {
      const s = Math.sqrt((k_B * thermalT) / mi);
      vn = s * Math.sqrt(-2 * Math.log(1 - rng.next()));
      t1 = s * rng.gaussian();
      t2 = s * rng.gaussian();
    } else {
      const sp = Math.sqrt(e0);
      const c = Math.sqrt(rng.next());
      const sn = Math.sqrt(1 - c * c);
      const ph = 2 * Math.PI * rng.next();
      vn = sp * c;
      t1 = sp * sn * Math.cos(ph);
      t2 = sp * sn * Math.sin(ph);
    }
    vn *= sign;
    if (axis === 0) {
      this.vx[i] = vn;
      this.vy[i] = t1;
      this.vz[i] = t2;
    } else if (axis === 1) {
      this.vy[i] = vn;
      this.vx[i] = t1;
      this.vz[i] = t2;
    } else {
      this.vz[i] = vn;
      this.vx[i] = t1;
      this.vy[i] = t2;
    }
    if (thermalT > 0) this.Q += 0.5 * mi * (this.vx[i] ** 2 + this.vy[i] ** 2 + this.vz[i] ** 2 - e0);
    // momentum given to the wall: normal component in plus normal component out
    return mi * (Math.abs(vin) + Math.abs(vn));
  }

  step(): void {
    const { N, x, y, z, vx, vy, vz, r, dt, L } = this;
    // piston moves towards its target, never faster than pistonSpeedMax
    const gap = this.LxTarget - this.Lx;
    const vmax = this.pistonSpeedMax;
    this.pistonV = Math.abs(gap) < vmax * dt ? gap / dt : Math.sign(gap) * vmax;
    this.Lx += this.pistonV * dt;
    const Lx = this.Lx;
    const u = this.pistonV;
    let impulse = 0;
    for (let i = 0; i < N; i++) {
      x[i] += vx[i] * dt;
      y[i] += vy[i] * dt;
      z[i] += vz[i] * dt;
      const ri = r[i];
      if (x[i] < ri && vx[i] < 0) {
        x[i] = 2 * ri - x[i];
        impulse += this.diffuse(i, 0, 1, this.bath ? this.Tbath : 0);
        this.wallHits++;
      }
      if (x[i] > Lx - ri && vx[i] > u) {
        // smooth moving piston
        const v0 = vx[i];
        const v1 = 2 * u - v0;
        vx[i] = v1;
        x[i] = Math.min(2 * (Lx - ri) - x[i], Lx - ri);
        this.W += 0.5 * this.m[i] * (v1 * v1 - v0 * v0);
        impulse += this.m[i] * (v0 - v1);
        this.wallHits++;
      } else if (x[i] > Lx - ri) x[i] = Lx - ri;
      if (y[i] < ri && vy[i] < 0) {
        y[i] = 2 * ri - y[i];
        impulse += this.diffuse(i, 1, 1, 0);
        this.wallHits++;
      } else if (y[i] > L - ri && vy[i] > 0) {
        y[i] = 2 * (L - ri) - y[i];
        impulse += this.diffuse(i, 1, -1, 0);
        this.wallHits++;
      }
      if (z[i] < ri && vz[i] < 0) {
        z[i] = 2 * ri - z[i];
        impulse += this.diffuse(i, 2, 1, 0);
        this.wallHits++;
      } else if (z[i] > L - ri && vz[i] > 0) {
        z[i] = 2 * (L - ri) - z[i];
        impulse += this.diffuse(i, 2, -1, 0);
        this.wallHits++;
      }
    }
    this.collide();
    this.impulseTotal += impulse;
    this.areaTime += this.area * dt;
    this.ring[this.ringPos] = impulse;
    this.ringArea[this.ringPos] = this.area;
    this.ringPos = (this.ringPos + 1) % this.ring.length;
    this.ringFill = Math.min(this.ringFill + 1, this.ring.length);
    this.t += dt;
  }

  /** sweep and prune along x; elastic hard-sphere collisions */
  private collide(): void {
    const { N, x, y, z, vx, vy, vz, m, r, order } = this;
    // insertion sort (the order barely changes between steps)
    for (let a = 1; a < N; a++) {
      const k = order[a];
      const xk = x[k];
      let b = a - 1;
      while (b >= 0 && x[order[b]] > xk) {
        order[b + 1] = order[b];
        b--;
      }
      order[b + 1] = k;
    }
    const dmax = this.dmax;
    for (let a = 0; a < N; a++) {
      const i = order[a];
      for (let b = a + 1; b < N; b++) {
        const j = order[b];
        const dx = x[j] - x[i];
        if (dx > dmax) break;
        const dy = y[j] - y[i];
        const dz = z[j] - z[i];
        const d = r[i] + r[j];
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 >= d * d) continue;
        const dvx = vx[j] - vx[i];
        const dvy = vy[j] - vy[i];
        const dvz = vz[j] - vz[i];
        const bdot = dx * dvx + dy * dvy + dz * dvz;
        if (bdot >= 0) continue; // already separating
        const J = (2 * m[i] * m[j] * bdot) / ((m[i] + m[j]) * d2);
        vx[i] += (J * dx) / m[i];
        vy[i] += (J * dy) / m[i];
        vz[i] += (J * dz) / m[i];
        vx[j] -= (J * dx) / m[j];
        vy[j] -= (J * dy) / m[j];
        vz[j] -= (J * dz) / m[j];
        this.collisions++;
      }
    }
  }
}
