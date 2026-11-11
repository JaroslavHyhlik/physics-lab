/**
 * Ripple tank: 2D scalar wave equation  ∂²u/∂t² = c(x, y)² ∇²u
 * Finite differences (5-point Laplacian, leapfrog in time); the Courant number c·Δt/Δx is kept
 * ≤ 0.5 (stability needs ≤ 1/√2). Waves leave the tank through an absorbing sponge layer
 * (damping that grows towards the edges). Walls (barriers with slits) hold u = 0. A shallow
 * region is modelled by a lower wave speed (refraction). Sources drive u = A sin(ωt + φ) at
 * a point or along a line (plane waves). The time-averaged u² shows the interference pattern.
 */
export interface RippleSource {
  kind: 'point' | 'line';
  x: number; // m (line: x position of a vertical line)
  y: number; // m
  phase: number; // rad
}

export class RippleTank {
  readonly nx: number;
  readonly ny: number;
  u: Float32Array;
  private uPrev: Float32Array;
  private uNext: Float32Array;
  readonly c2: Float32Array;
  readonly wall: Uint8Array;
  readonly damp: Float32Array;
  readonly avg: Float32Array;
  t = 0;
  f = 5;
  amp = 1;
  sources: RippleSource[] = [];
  readonly dt: number;

  constructor(
    readonly W: number,
    readonly H: number,
    readonly dx: number,
    readonly c: number,
    sponge = 0.04,
  ) {
    this.nx = Math.round(W / dx);
    this.ny = Math.round(H / dx);
    const n = this.nx * this.ny;
    this.u = new Float32Array(n);
    this.uPrev = new Float32Array(n);
    this.uNext = new Float32Array(n);
    this.c2 = new Float32Array(n).fill(c * c);
    this.wall = new Uint8Array(n);
    this.damp = new Float32Array(n);
    this.avg = new Float32Array(n);
    this.dt = (0.5 * dx) / c;
    // sponge: quadratic damping profile within `sponge` metres of each edge
    const ns = Math.max(1, Math.round(sponge / dx));
    const gmax = (3 * c) / sponge;
    for (let j = 0; j < this.ny; j++)
      for (let i = 0; i < this.nx; i++) {
        const d = Math.min(i, j, this.nx - 1 - i, this.ny - 1 - j);
        if (d < ns) this.damp[j * this.nx + i] = gmax * ((ns - d) / ns) ** 2;
      }
  }

  idx(x: number, y: number): number {
    const i = Math.max(0, Math.min(this.nx - 1, Math.round(x / this.dx)));
    const j = Math.max(0, Math.min(this.ny - 1, Math.round(y / this.dx)));
    return j * this.nx + i;
  }

  /** set the wave speed inside a rectangle (e.g. shallow water) */
  setSpeedRect(x0: number, y0: number, x1: number, y1: number, speed: number): void {
    for (let j = 0; j < this.ny; j++)
      for (let i = 0; i < this.nx; i++) {
        const x = i * this.dx;
        const y = j * this.dx;
        if (x >= x0 && x <= x1 && y >= y0 && y <= y1) this.c2[j * this.nx + i] = speed * speed;
      }
  }

  /** set the wave speed wherever pred(x, y) is true */
  setSpeedWhere(pred: (x: number, y: number) => boolean, speed: number): void {
    for (let j = 0; j < this.ny; j++)
      for (let i = 0; i < this.nx; i++) if (pred(i * this.dx, j * this.dx)) this.c2[j * this.nx + i] = speed * speed;
  }

  /** vertical barrier at x with gaps given as [yCentre, width] pairs */
  setBarrier(x: number, gaps: [number, number][], thickness = 0.006): void {
    for (let j = 0; j < this.ny; j++) {
      const y = j * this.dx;
      const open = gaps.some(([yc, w]) => Math.abs(y - yc) <= w / 2);
      if (open) continue;
      for (let i = 0; i < this.nx; i++) if (Math.abs(i * this.dx - x) <= thickness / 2) this.wall[j * this.nx + i] = 1;
    }
  }

  step(): void {
    const { nx, ny, u, uPrev, uNext, c2, wall, damp, dt, dx } = this;
    const r = (dt * dt) / (dx * dx);
    for (let j = 1; j < ny - 1; j++) {
      const row = j * nx;
      for (let i = 1; i < nx - 1; i++) {
        const k = row + i;
        if (wall[k]) {
          uNext[k] = 0;
          continue;
        }
        const lap = u[k - 1] + u[k + 1] + u[k - nx] + u[k + nx] - 4 * u[k];
        const g = damp[k] * dt * 0.5;
        uNext[k] = (2 * u[k] - (1 - g) * uPrev[k] + r * c2[k] * lap) / (1 + g);
      }
    }
    this.t += dt;
    for (const src of this.sources) {
      const v = this.amp * Math.sin(2 * Math.PI * this.f * this.t + src.phase);
      if (src.kind === 'point') uNext[this.idx(src.x, src.y)] = v;
      else {
        const i = Math.round(src.x / dx);
        for (let j = 1; j < ny - 1; j++) if (!wall[j * nx + i]) uNext[j * nx + i] = v;
      }
    }
    // rotate buffers
    this.uPrev = u;
    this.u = uNext;
    this.uNext = uPrev;
    // running average of u² (time constant ~ 2 periods)
    const a = Math.min(1, dt * this.f * 0.5);
    const avg = this.avg;
    const cur = this.u;
    for (let k = 0; k < avg.length; k++) avg[k] += a * (cur[k] * cur[k] - avg[k]);
  }

  reset(): void {
    this.u.fill(0);
    this.uPrev.fill(0);
    this.uNext.fill(0);
    this.avg.fill(0);
    this.t = 0;
  }
}
