/**
 * 2D molecular dynamics of argon-like atoms (Lennard-Jones potential) in a box.
 *
 *   U(r) = 4ε[(σ/r)¹² − (σ/r)⁶], cut off at r_c = 2.5σ and shifted so U(r_c) = 0
 *   walls: purely repulsive (WCA) wall potential, so energy is conserved smoothly
 *
 * Integrator: velocity Verlet (symplectic, conservative system; energy error stays bounded).
 * Neighbour search: cell list (cells ≥ r_c), O(N).
 * Heating/cooling (optional, applied after each step):
 *   - thermostat: Berendsen velocity rescaling towards a target temperature
 *   - power: a constant rate of energy input per particle (velocities scaled up/down)
 * SI units throughout. In 2D each particle has 2 degrees of freedom, so the mean kinetic
 * energy per particle is k_B T (equipartition) and T = E_k,total/(N k_B).
 */
import { k_B } from '../core/constants';
import { Rng } from '../core/rng';

/** argon (typical literature values) */
export const ARGON = { sigma: 3.4e-10, epsilon: 1.65e-21, mass: 6.63e-26 };
/** natural time unit τ = σ√(m/ε) ≈ 2.2 ps */
export const TAU = ARGON.sigma * Math.sqrt(ARGON.mass / ARGON.epsilon);

export type HeatMode = 'off' | 'thermostat' | 'power';

export interface MDConfig {
  N: number;
  /** box side in units of σ */
  boxSigma: number;
  seed: number;
  /** starting temperature [K] */
  T0: number;
  /** 'solid': a crystal block in the middle; 'gas': spread over the box */
  start: 'solid' | 'gas';
}

const RC = 2.5;
const RW = Math.pow(2, 1 / 6);

export class MDSystem {
  readonly N: number;
  readonly L: number;
  readonly x: Float64Array;
  readonly y: Float64Array;
  readonly vx: Float64Array;
  readonly vy: Float64Array;
  readonly ax: Float64Array;
  readonly ay: Float64Array;
  /** time step [s] (0.004 τ ≈ 9 fs) */
  dt = 0.004 * TAU;
  t = 0;
  PE = 0;
  mode: HeatMode = 'off';
  Ttarget = 100;
  /** thermostat coupling time [s] */
  tauT = 100 * 0.004 * TAU;
  /** energy input per particle per second [W] (negative = cooling) */
  power = 0;
  /** total energy put in by heating/cooling so far [J] */
  heatIn = 0;

  private readonly sig: number;
  private readonly eps: number;
  private readonly m: number;
  private readonly rc2: number;
  private readonly uShift: number;
  private readonly nc: number;
  private readonly cellSize: number;
  private readonly head: Int32Array;
  private readonly nextIdx: Int32Array;

  constructor(cfg: MDConfig, readonly atom = ARGON) {
    this.N = cfg.N;
    this.sig = atom.sigma;
    this.eps = atom.epsilon;
    this.m = atom.mass;
    this.L = cfg.boxSigma * this.sig;
    const n = cfg.N;
    this.x = new Float64Array(n);
    this.y = new Float64Array(n);
    this.vx = new Float64Array(n);
    this.vy = new Float64Array(n);
    this.ax = new Float64Array(n);
    this.ay = new Float64Array(n);
    this.rc2 = RC * RC * this.sig * this.sig;
    const s6 = Math.pow(1 / RC, 6);
    this.uShift = 4 * this.eps * (s6 * s6 - s6);
    this.nc = Math.max(1, Math.floor(this.L / (RC * this.sig)));
    this.cellSize = this.L / this.nc;
    this.head = new Int32Array(this.nc * this.nc);
    this.nextIdx = new Int32Array(n);
    this.init(cfg);
  }

  private init(cfg: MDConfig): void {
    const rng = new Rng(cfg.seed);
    const n = this.N;
    if (cfg.start === 'solid') {
      // triangular lattice at the LJ minimum spacing 2^{1/6}σ, centred
      const a = RW * this.sig;
      const cols = Math.ceil(Math.sqrt(n * 1.15));
      const rows = Math.ceil(n / cols);
      const w = (cols - 1) * a + a / 2;
      const hgt = (rows - 1) * a * (Math.sqrt(3) / 2);
      for (let i = 0; i < n; i++) {
        const r = Math.floor(i / cols);
        const c = i % cols;
        this.x[i] = this.L / 2 - w / 2 + c * a + (r % 2) * (a / 2);
        this.y[i] = this.L / 2 - hgt / 2 + r * a * (Math.sqrt(3) / 2);
      }
    } else {
      // jittered grid over the box, away from the walls
      const k = Math.ceil(Math.sqrt(n));
      const sp = (this.L - 2 * this.sig) / k;
      for (let i = 0; i < n; i++) {
        this.x[i] = this.sig + (i % k + 0.5) * sp + rng.uniform(-0.15, 0.15) * sp;
        this.y[i] = this.sig + (Math.floor(i / k) + 0.5) * sp + rng.uniform(-0.15, 0.15) * sp;
      }
    }
    // Maxwell–Boltzmann velocities at T0, zero total momentum, exact starting temperature
    const sd = Math.sqrt((k_B * Math.max(cfg.T0, 0.01)) / this.m);
    let px = 0;
    let py = 0;
    for (let i = 0; i < n; i++) {
      this.vx[i] = sd * rng.gaussian();
      this.vy[i] = sd * rng.gaussian();
      px += this.vx[i];
      py += this.vy[i];
    }
    for (let i = 0; i < n; i++) {
      this.vx[i] -= px / n;
      this.vy[i] -= py / n;
    }
    const s = Math.sqrt((n * k_B * Math.max(cfg.T0, 0.01)) / this.KE);
    for (let i = 0; i < n; i++) {
      this.vx[i] *= s;
      this.vy[i] *= s;
    }
    this.forces();
  }

  /** computes accelerations and the potential energy */
  forces(): void {
    const { N, x, y, ax, ay, head, nextIdx, nc, cellSize, sig, eps, rc2, uShift, m, L } = this;
    ax.fill(0);
    ay.fill(0);
    head.fill(-1);
    for (let i = 0; i < N; i++) {
      let cx = Math.floor(x[i] / cellSize);
      let cy = Math.floor(y[i] / cellSize);
      cx = cx < 0 ? 0 : cx >= nc ? nc - 1 : cx;
      cy = cy < 0 ? 0 : cy >= nc ? nc - 1 : cy;
      const c = cy * nc + cx;
      nextIdx[i] = head[c];
      head[c] = i;
    }
    const s2 = sig * sig;
    let pe = 0;
    for (let cy = 0; cy < nc; cy++) {
      for (let cx = 0; cx < nc; cx++) {
        for (let i = head[cy * nc + cx]; i !== -1; i = nextIdx[i]) {
          // half of the neighbouring cells (and own cell with j after i) → each pair once
          for (let k = 0; k < 5; k++) {
            const nx = cx + (k === 1 ? 1 : k === 2 ? 1 : k === 3 ? 0 : k === 4 ? -1 : 0);
            const ny = cy + (k === 2 || k === 3 || k === 4 ? 1 : 0);
            if (nx < 0 || nx >= nc || ny >= nc) continue;
            let j = k === 0 ? nextIdx[i] : head[ny * nc + nx];
            for (; j !== -1; j = nextIdx[j]) {
              const dx = x[i] - x[j];
              const dy = y[i] - y[j];
              const r2 = dx * dx + dy * dy;
              if (r2 >= rc2) continue;
              const ir2 = s2 / r2;
              const ir6 = ir2 * ir2 * ir2;
              pe += 4 * eps * (ir6 * ir6 - ir6) - uShift;
              const f = (24 * eps * (2 * ir6 * ir6 - ir6)) / r2 / m; // (F/r)/m
              ax[i] += f * dx;
              ay[i] += f * dy;
              ax[j] -= f * dx;
              ay[j] -= f * dy;
            }
          }
        }
      }
    }
    // walls
    const rw = RW * sig;
    for (let i = 0; i < N; i++) {
      for (let w = 0; w < 4; w++) {
        const d = w === 0 ? x[i] : w === 1 ? L - x[i] : w === 2 ? y[i] : L - y[i];
        if (d >= rw) continue;
        const dd = Math.max(d, 0.3 * sig);
        const ir2 = s2 / (dd * dd);
        const ir6 = ir2 * ir2 * ir2;
        pe += 4 * eps * (ir6 * ir6 - ir6) + eps;
        const f = (24 * eps * (2 * ir6 * ir6 - ir6)) / dd / m; // pushes away from the wall
        if (w === 0) ax[i] += f;
        else if (w === 1) ax[i] -= f;
        else if (w === 2) ay[i] += f;
        else ay[i] -= f;
      }
    }
    this.PE = pe;
  }

  step(): void {
    const { N, x, y, vx, vy, ax, ay, dt } = this;
    const h = 0.5 * dt;
    for (let i = 0; i < N; i++) {
      vx[i] += h * ax[i];
      vy[i] += h * ay[i];
      x[i] += dt * vx[i];
      y[i] += dt * vy[i];
    }
    this.forces();
    for (let i = 0; i < N; i++) {
      vx[i] += h * ax[i];
      vy[i] += h * ay[i];
    }
    this.t += dt;
    if (this.mode !== 'off') this.heat();
  }

  private heat(): void {
    const ke = this.KE;
    if (ke <= 0) return;
    let target: number;
    if (this.mode === 'thermostat') {
      const T = ke / (this.N * k_B);
      const lam2 = 1 + (this.dt / this.tauT) * (this.Ttarget / Math.max(T, 1e-9) - 1);
      target = ke * Math.max(lam2, 0);
    } else {
      target = Math.max(ke + this.power * this.N * this.dt, 0.01 * ke);
    }
    const s = Math.sqrt(target / ke);
    for (let i = 0; i < this.N; i++) {
      this.vx[i] *= s;
      this.vy[i] *= s;
    }
    this.heatIn += target - ke;
  }

  get KE(): number {
    let s = 0;
    for (let i = 0; i < this.N; i++) s += this.vx[i] * this.vx[i] + this.vy[i] * this.vy[i];
    return 0.5 * this.m * s;
  }

  /** temperature from equipartition in 2D: E_k = N k_B T */
  get T(): number {
    return this.KE / (this.N * k_B);
  }

  /** mean number of neighbours closer than 1.5σ (≈ 6 in a 2D crystal, ≈ 0 in a dilute gas) */
  neighbours(): number {
    const { N, x, y, head, nextIdx, nc, sig } = this;
    const r2 = (1.5 * sig) ** 2;
    let count = 0;
    // head/nextIdx still hold the cell list from the last force evaluation
    for (let cy = 0; cy < nc; cy++) {
      for (let cx = 0; cx < nc; cx++) {
        for (let i = head[cy * nc + cx]; i !== -1; i = nextIdx[i]) {
          for (let oy = -1; oy <= 1; oy++) {
            for (let ox = -1; ox <= 1; ox++) {
              const nx = cx + ox;
              const ny = cy + oy;
              if (nx < 0 || ny < 0 || nx >= nc || ny >= nc) continue;
              for (let j = head[ny * nc + nx]; j !== -1; j = nextIdx[j]) {
                if (j === i) continue;
                const dx = x[i] - x[j];
                const dy = y[i] - y[j];
                if (dx * dx + dy * dy < r2) count++;
              }
            }
          }
        }
      }
    }
    return count / N;
  }

  get mass(): number {
    return this.m;
  }
}

/** 2D Maxwell–Boltzmann speed distribution f(v) = (m v / kT) e^{−mv²/2kT} */
export function mb2d(v: number, T: number, m = ARGON.mass): number {
  const a = m / (k_B * T);
  return a * v * Math.exp(-0.5 * a * v * v);
}
