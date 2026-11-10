/**
 * 1D heat conduction through a slab (or an insulated rod) between two heat baths.
 *   ∂T/∂t = α ∂²T/∂x²,  α = k/(ρc),  T(0) = T_H, T(L) = T_C
 * Method: explicit finite differences (FTCS) with the stability (CFL) limit enforced:
 * r = αΔt/Δx² ≤ 0.4, so a large requested step is split into substeps.
 * Heat flow at each face: P = −kA ∂T/∂x (second-order one-sided differences).
 * Steady state: a straight-line temperature profile and P = kAΔT/Δx everywhere.
 */
export interface ConductMaterial {
  name: string;
  k: number; // thermal conductivity, W m⁻¹ K⁻¹
  rho: number; // density, kg m⁻³
  c: number; // specific heat capacity, J kg⁻¹ K⁻¹
}

/** Typical room-temperature values (CRC Handbook / engineering tables), rounded. */
export const CONDUCT_MATERIALS: Record<string, ConductMaterial> = {
  copper: { name: 'Copper', k: 400, rho: 8960, c: 385 },
  aluminium: { name: 'Aluminium', k: 237, rho: 2700, c: 900 },
  steel: { name: 'Steel', k: 50, rho: 7850, c: 450 },
  glass: { name: 'Glass', k: 0.8, rho: 2500, c: 840 },
  brick: { name: 'Brick', k: 0.7, rho: 1900, c: 840 },
  wood: { name: 'Wood (pine)', k: 0.12, rho: 500, c: 1700 },
  foam: { name: 'Polystyrene foam', k: 0.033, rho: 30, c: 1300 },
};

export class Slab {
  readonly T: Float64Array;
  private next: Float64Array;
  t = 0;
  readonly alpha: number;
  readonly dx: number;

  constructor(
    readonly mat: ConductMaterial,
    readonly L: number,
    readonly A: number,
    readonly TH: number,
    readonly TC: number,
    readonly N = 41,
  ) {
    this.T = new Float64Array(N);
    this.next = new Float64Array(N);
    this.alpha = mat.k / (mat.rho * mat.c);
    this.dx = L / (N - 1);
    this.reset();
  }

  /** starts at the cold temperature everywhere; the hot face is at T_H */
  reset(): void {
    this.T.fill(this.TC);
    this.T[0] = this.TH;
    this.t = 0;
  }

  /** largest stable step */
  get maxDt(): number {
    return (0.4 * this.dx * this.dx) / this.alpha;
  }

  step(dt: number): void {
    const n = Math.max(1, Math.ceil(dt / this.maxDt));
    const h = dt / n;
    const r = (this.alpha * h) / (this.dx * this.dx);
    const { T, N } = this;
    let a = T;
    let b = this.next;
    for (let s = 0; s < n; s++) {
      b[0] = this.TH;
      b[N - 1] = this.TC;
      for (let i = 1; i < N - 1; i++) b[i] = a[i] + r * (a[i + 1] - 2 * a[i] + a[i - 1]);
      const tmp = a;
      a = b;
      b = tmp;
    }
    if (a !== T) T.set(a);
    this.t += dt;
  }

  /** heat flow into the slab at the hot face [W] */
  get Pin(): number {
    const { T, dx } = this;
    return -this.mat.k * this.A * ((-3 * T[0] + 4 * T[1] - T[2]) / (2 * dx));
  }
  /** heat flow out of the slab at the cold face [W] */
  get Pout(): number {
    const { T, dx, N } = this;
    return -this.mat.k * this.A * ((3 * T[N - 1] - 4 * T[N - 2] + T[N - 3]) / (2 * dx));
  }
  /** steady-state heat flow kAΔT/Δx [W] */
  get Psteady(): number {
    return (this.mat.k * this.A * (this.TH - this.TC)) / this.L;
  }
  /** time constant of the slowest mode, L²/(π²α) [s] */
  get tau(): number {
    return (this.L * this.L) / (Math.PI * Math.PI * this.alpha);
  }

  /** exact solution (Fourier series) for the same start: T = T_C inside, T_H at x = 0 */
  exact(x: number, t: number, terms = 200): number {
    const d = this.TH - this.TC;
    let s = this.TC + d * (1 - x / this.L);
    for (let n = 1; n <= terms; n++) {
      const kn = (n * Math.PI) / this.L;
      s -= ((2 * d) / (n * Math.PI)) * Math.sin(kn * x) * Math.exp(-kn * kn * this.alpha * t);
    }
    return s;
  }

  /** thermal energy stored relative to T_C [J] (trapezoidal rule) */
  get stored(): number {
    const { T, N, dx } = this;
    let s = 0;
    for (let i = 0; i < N; i++) s += (i === 0 || i === N - 1 ? 0.5 : 1) * (T[i] - this.TC);
    return s * dx * this.A * this.mat.rho * this.mat.c;
  }
}
