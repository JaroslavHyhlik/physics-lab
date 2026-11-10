/**
 * Roller-coaster car on a track (a smooth curve in the vertical plane, possibly with loops).
 * The car is held on the track (it has safety wheels), so it moves along the arc length s.
 *
 * With unit tangent T, unit normal n (T rotated +90°) and signed curvature κ:
 *   acceleration = s̈ T + v²κ n
 *   normal force (along n):     N = m(v²κ + g n_y)
 *   along the track:           m s̈ = −m g T_y − sign(v) μ|N|
 * Energy: ½mv² + mgy + (work done against friction) = constant.
 * Track: natural cubic spline through control points (continuous curvature, so the normal
 * force is smooth), re-parametrised by arc length with a
 * fine lookup table; the slope used in the equation of motion is dy/ds of that same mapping.
 * Integrator: RK4 on [s, v, heat].
 */
import { RK4, type Derivative } from '../core/integrators';

export class Track {
  readonly pts: [number, number][];
  private N = 6000;
  private sTab: Float64Array; // arc length at u_i
  readonly length: number;

  constructor(points: [number, number][]) {
    this.pts = points;
    const segs = points.length - 1;
    this.sTab = new Float64Array(this.N + 1);
    let prev = this.rawPos(0);
    for (let i = 1; i <= this.N; i++) {
      const p = this.rawPos((i / this.N) * segs);
      this.sTab[i] = this.sTab[i - 1] + Math.hypot(p[0] - prev[0], p[1] - prev[1]);
      prev = p;
    }
    this.length = this.sTab[this.N];
  }

  /** second derivatives of the natural cubic spline (x and y separately, parameter u = index) */
  private mx!: Float64Array;
  private my!: Float64Array;

  private static secondDerivs(v: number[]): Float64Array {
    const n = v.length;
    const M = new Float64Array(n);
    if (n < 3) return M;
    // tridiagonal system M[i-1] + 4M[i] + M[i+1] = 6(v[i+1] − 2v[i] + v[i−1]), M0 = M(n−1) = 0
    const c = new Float64Array(n);
    const d = new Float64Array(n);
    for (let i = 1; i < n - 1; i++) {
      const rhs = 6 * (v[i + 1] - 2 * v[i] + v[i - 1]);
      const m = 4 - (i > 1 ? c[i - 1] : 0);
      c[i] = 1 / m;
      d[i] = (rhs - (i > 1 ? d[i - 1] : 0)) / m;
    }
    for (let i = n - 2; i >= 1; i--) M[i] = d[i] - c[i] * M[i + 1];
    return M;
  }

  /** natural cubic spline (C²: continuous curvature) at parameter u ∈ [0, segs] */
  private eval(u: number): { x: number; y: number; dx: number; dy: number; ddx: number; ddy: number } {
    if (!this.mx) {
      this.mx = Track.secondDerivs(this.pts.map((p) => p[0]));
      this.my = Track.secondDerivs(this.pts.map((p) => p[1]));
    }
    const segs = this.pts.length - 1;
    const i = Math.min(segs - 1, Math.max(0, Math.floor(u)));
    const t = u - i;
    const s1 = 1 - t;
    const f = (p0: number, p1: number, m0: number, m1: number) => [
      s1 * p0 + t * p1 + ((s1 * s1 * s1 - s1) * m0 + (t * t * t - t) * m1) / 6,
      p1 - p0 + ((-3 * s1 * s1 + 1) * m0 + (3 * t * t - 1) * m1) / 6,
      s1 * m0 + t * m1,
    ];
    const X = f(this.pts[i][0], this.pts[i + 1][0], this.mx[i], this.mx[i + 1]);
    const Y = f(this.pts[i][1], this.pts[i + 1][1], this.my[i], this.my[i + 1]);
    return { x: X[0], y: Y[0], dx: X[1], dy: Y[1], ddx: X[2], ddy: Y[2] };
  }

  private rawPos(u: number): [number, number] {
    const e = this.eval(u);
    return [e.x, e.y];
  }

  /** spline parameter u and du/ds for arc length s (binary search + linear interpolation) */
  private uOf(s: number): [number, number] {
    const segs = this.pts.length - 1;
    const S = Math.min(Math.max(s, 0), this.length);
    let lo = 0;
    let hi = this.N;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (this.sTab[mid] <= S) lo = mid;
      else hi = mid;
    }
    const ds = Math.max(this.sTab[hi] - this.sTab[lo], 1e-15);
    const f = (S - this.sTab[lo]) / ds;
    return [((lo + f) / this.N) * segs, segs / this.N / ds];
  }

  /**
   * Position, unit tangent, signed curvature and dy/ds at arc length s. dyds is the exact
   * derivative of the height y(s) used for the potential energy, so the equation of motion
   * conserves energy consistently.
   */
  at(s: number): { x: number; y: number; tx: number; ty: number; k: number; dyds: number } {
    const [u, duds] = this.uOf(s);
    const e = this.eval(u);
    const sp = Math.hypot(e.dx, e.dy) || 1e-12;
    return {
      x: e.x,
      y: e.y,
      tx: e.dx / sp,
      ty: e.dy / sp,
      k: (e.dx * e.ddy - e.dy * e.ddx) / (sp * sp * sp),
      dyds: e.dy * duds,
    };
  }
}

export interface CoasterParams {
  m: number;
  mu: number;
  g: number;
  s0: number; // start position along the track [m]
  u: number; // initial speed along the track [m s^-1]
}

export class Coaster {
  p: CoasterParams;
  track: Track;
  readonly y = new Float64Array(3); // s, v, heat
  t = 0;
  stopped = false;
  private rk = new RK4(3);

  constructor(track: Track, p: CoasterParams) {
    this.track = track;
    this.p = { ...p };
    this.reset();
  }

  reset(p?: Partial<CoasterParams>, track?: Track): void {
    if (p) this.p = { ...this.p, ...p };
    if (track) this.track = track;
    this.y[0] = Math.min(Math.max(this.p.s0, 0), this.track.length);
    this.y[1] = this.p.u;
    this.y[2] = 0;
    this.t = 0;
    this.stopped = false;
  }

  normalAt(s: number, v: number): number {
    const a = this.track.at(s);
    // n = T rotated +90° = (−ty, tx)
    return this.p.m * (v * v * a.k + this.p.g * a.tx);
  }

  private deriv: Derivative = (_t, y, out) => {
    const a = this.track.at(y[0]);
    const v = y[1];
    const N = this.p.m * (v * v * a.k + this.p.g * a.tx);
    const fr = this.p.mu * Math.abs(N);
    out[0] = v;
    out[1] = -this.p.g * a.dyds - (v > 0 ? 1 : v < 0 ? -1 : 0) * (fr / this.p.m);
    out[2] = fr * Math.abs(v);
  };

  step(dt: number): void {
    this.t += dt;
    if (this.stopped) return;
    const v0 = this.y[1];
    this.rk.step(this.deriv, this.t - dt, this.y, dt);
    // with friction the car can come to rest: stop it if v changed sign and friction can hold it
    if (this.p.mu > 0 && v0 !== 0 && Math.sign(this.y[1]) !== Math.sign(v0)) {
      const a = this.track.at(this.y[0]);
      const N = Math.abs(this.normalAt(this.y[0], 0));
      if (Math.abs(this.p.m * this.p.g * a.dyds) <= this.p.mu * N) {
        this.y[1] = 0;
        this.stopped = true;
      }
    }
    if (this.y[0] <= 0 || this.y[0] >= this.track.length) {
      this.y[0] = Math.min(Math.max(this.y[0], 0), this.track.length);
      this.y[1] = 0;
      this.stopped = true;
    }
  }

  get pos() {
    return this.track.at(this.y[0]);
  }
  get v(): number {
    return this.y[1];
  }
  get N(): number {
    return this.normalAt(this.y[0], this.y[1]);
  }
  get Ek(): number {
    return 0.5 * this.p.m * this.y[1] ** 2;
  }
  get Ep(): number {
    return this.p.m * this.p.g * this.pos.y;
  }
  get heat(): number {
    return this.y[2];
  }
}

/** Smooth drop from height h0 to h1 over the horizontal distance L (cosine profile). */
const drop = (x: number, L: number, h0: number, h1: number) =>
  x >= L ? h1 : h1 + (h0 - h1) * (0.5 + 0.5 * Math.cos((Math.PI * x) / L));
const bump = (x: number, c: number, w: number) => Math.exp(-(((x - c) / w) ** 2));
const sample = (x0: number, x1: number, dx: number, f: (x: number) => number): [number, number][] => {
  const out: [number, number][] = [];
  for (let x = x0; x <= x1 + 1e-9; x += dx) out.push([x, f(x)]);
  return out;
};

function loopTrack(): [number, number][] {
  const R = 10;
  const cx = 62;
  const pts = sample(0, cx, 2, (x) => drop(x, 50, 32, 1));
  // the loop: a circle traversed anticlockwise from the bottom, drifting 3 m sideways so the
  // exit does not run into the entry (like a real loop)
  for (let a = 15; a < 360; a += 15) {
    const th = (a * Math.PI) / 180 - Math.PI / 2;
    pts.push([cx + R * Math.cos(th) + (3 * a) / 360, 1 + R + R * Math.sin(th)]);
  }
  for (let x = cx + 3; x <= cx + 25; x += 2) pts.push([x, 1]);
  return pts;
}

/** Preset tracks (metres). */
export const tracks: Record<string, { label: string; points: [number, number][]; s0: number }> = {
  hills: {
    label: 'Drop and hills',
    points: sample(0, 120, 2, (x) => drop(x, 40, 30, 2) + 16 * bump(x, 62, 9) + 7 * bump(x, 94, 7)),
    s0: 1,
  },
  loop: { label: 'Drop into a vertical loop', points: loopTrack(), s0: 1 },
  valley: {
    label: 'Valley (oscillation)',
    points: sample(0, 40, 1, (x) => 12 * ((x - 20) / 20) ** 2),
    s0: 1,
  },
  camel: {
    label: 'Camel back (airtime)',
    points: sample(0, 100, 2, (x) => drop(x, 44, 40, 3) + 22 * bump(x, 64, 7)),
    s0: 1,
  },
};
