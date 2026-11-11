/**
 * Transverse waves on a stretched string (1D wave equation), possibly made of two parts with
 * different linear densities joined at x = L_join:
 *   μ(x) ∂²y/∂t² = T ∂²y/∂x²,   wave speed v = √(T/μ)
 * Method: explicit central differences (leapfrog) with the Courant number C = v_max Δt/Δx ≤ 1
 * enforced by substepping (C = 1 on a uniform string is exact for the 1D wave equation).
 * Left end: driven by the hand (a smooth pulse or a sine), held at y = 0 otherwise.
 * Right end: fixed (y = 0), free (∂y/∂x = 0, a ring on a frictionless rod) or absorbing
 * (first-order Mur condition, as if the string went on for ever).
 */
export type EndKind = 'fixed' | 'free' | 'open';

export interface StringConfig {
  L: number; // total length [m]
  N: number; // number of segments
  T: number; // tension [N]
  mu1: number; // linear density of the left part [kg m⁻¹]
  mu2: number; // right part
  join: number; // position of the join [m] (≥ L for a single string)
  end: EndKind;
}

export class StringFD {
  readonly y: Float64Array;
  private yPrev: Float64Array;
  private yNext: Float64Array;
  readonly c2: Float64Array;
  readonly dx: number;
  readonly vMax: number;
  t = 0;
  /** displacement of the left end as a function of time (set by the screen) */
  drive: (t: number) => number = () => 0;

  constructor(readonly cfg: StringConfig) {
    const n = cfg.N + 1;
    this.y = new Float64Array(n);
    this.yPrev = new Float64Array(n);
    this.yNext = new Float64Array(n);
    this.c2 = new Float64Array(n);
    this.dx = cfg.L / cfg.N;
    let vm = 0;
    for (let i = 0; i < n; i++) {
      const x = i * this.dx;
      const mu = x < cfg.join ? cfg.mu1 : cfg.mu2;
      this.c2[i] = cfg.T / mu;
      vm = Math.max(vm, Math.sqrt(this.c2[i]));
    }
    this.vMax = vm;
  }

  speedAt(x: number): number {
    return Math.sqrt(this.cfg.T / (x < this.cfg.join ? this.cfg.mu1 : this.cfg.mu2));
  }

  /** largest stable time step (Courant number 1 for the fastest part) */
  get maxDt(): number {
    return this.dx / this.vMax;
  }

  step(dt: number): void {
    const n = Math.max(1, Math.ceil(dt / this.maxDt - 1e-9));
    const h = dt / n;
    for (let k = 0; k < n; k++) this.sub(h);
  }

  private sub(h: number): void {
    const { y, yPrev, yNext, c2, dx, cfg } = this;
    const N = cfg.N;
    const r = (h * h) / (dx * dx);
    for (let i = 1; i < N; i++) yNext[i] = 2 * y[i] - yPrev[i] + r * c2[i] * (y[i + 1] - 2 * y[i] + y[i - 1]);
    this.t += h;
    yNext[0] = this.drive(this.t);
    if (cfg.end === 'fixed') yNext[N] = 0;
    else if (cfg.end === 'free') yNext[N] = 2 * y[N] - yPrev[N] + r * c2[N] * 2 * (y[N - 1] - y[N]);
    else {
      const C = (Math.sqrt(c2[N]) * h) / dx;
      yNext[N] = y[N - 1] + ((C - 1) / (C + 1)) * (yNext[N - 1] - y[N]);
    }
    this.yPrev.set(y);
    this.y.set(yNext);
  }
}

/** smooth single pulse (sin² shape) of height A and duration τ, starting at t = 0 */
export const pulse = (A: number, tau: number) => (t: number) => (t > 0 && t < tau ? A * Math.sin((Math.PI * t) / tau) ** 2 : 0);
