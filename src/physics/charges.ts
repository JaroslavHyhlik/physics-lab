/**
 * Electrostatics in the plane z = 0.
 *
 * Sources:
 *  - point charges (true 3D point charges lying in the plane): E = kq r̂/r², V = kq/r
 *  - charged plates: uniform strips of surface charge density σ, finite width w in the plane
 *    and infinitely long perpendicular to the screen (the cross-section of a parallel-plate
 *    capacitor). Closed-form field and potential, derived by integrating line charges.
 * Superposition of both is exact. Potential is zero at infinity (plates come in ± pairs).
 *
 * Field lines: adaptive Dormand–Prince RK45 along the unit field direction (arc length).
 * Equipotentials: marching squares on a potential grid.
 */
import { k_e, epsilon_0 } from '../core/constants';
import { DormandPrince45, type Derivative } from '../core/integrators';

export interface PointCharge {
  x: number; // [m]
  y: number; // [m]
  q: number; // [C]
}

export interface Plate {
  cx: number; // centre [m]
  cy: number;
  w: number; // width in the plane [m]
  vertical: boolean;
  sigma: number; // surface charge density [C m^-2]
}

export interface Sources {
  charges: PointCharge[];
  plates: Plate[];
}

const TWO_PI_EPS0 = 2 * Math.PI * epsilon_0;

/** Field of one strip in its local frame (X along the strip, Y normal). */
function stripField(X: number, Y: number, w: number, sigma: number, out: number[]): void {
  const a = w / 2;
  const r1 = (X + a) * (X + a) + Y * Y;
  const r2 = (X - a) * (X - a) + Y * Y;
  out[0] = (sigma / (2 * TWO_PI_EPS0)) * Math.log(r1 / r2);
  out[1] = Y === 0 ? 0 : (sigma / TWO_PI_EPS0) * (Math.atan((a - X) / Y) + Math.atan((a + X) / Y));
}

/** ∫ ln(u² + Y²) du antiderivative. */
function lnInt(u: number, Y: number): number {
  const r2 = u * u + Y * Y;
  const t = r2 > 0 ? u * Math.log(r2) : 0;
  return t - 2 * u + (Y === 0 ? 0 : 2 * Y * Math.atan(u / Y));
}

function stripPotential(X: number, Y: number, w: number, sigma: number): number {
  const a = w / 2;
  return -(sigma / (2 * TWO_PI_EPS0)) * (lnInt(a - X, Y) - lnInt(-a - X, Y));
}

const tmp = [0, 0];

/** Electric field at (x, y) [N C^-1]; writes [Ex, Ey] into out. */
export function fieldAt(src: Sources, x: number, y: number, out: number[] | Float64Array): void {
  let ex = 0;
  let ey = 0;
  for (const c of src.charges) {
    const dx = x - c.x;
    const dy = y - c.y;
    const r2 = dx * dx + dy * dy;
    if (r2 < 1e-24) continue;
    const f = (k_e * c.q) / (r2 * Math.sqrt(r2));
    ex += f * dx;
    ey += f * dy;
  }
  for (const p of src.plates) {
    if (p.vertical) {
      // local X along the plate (world y), local Y normal (world x)
      stripField(y - p.cy, x - p.cx, p.w, p.sigma, tmp);
      ex += tmp[1];
      ey += tmp[0];
    } else {
      stripField(x - p.cx, y - p.cy, p.w, p.sigma, tmp);
      ex += tmp[0];
      ey += tmp[1];
    }
  }
  out[0] = ex;
  out[1] = ey;
}

/** Electric potential at (x, y) [V], zero at infinity. */
export function potentialAt(src: Sources, x: number, y: number): number {
  let v = 0;
  for (const c of src.charges) {
    const r = Math.hypot(x - c.x, y - c.y);
    if (r > 1e-12) v += (k_e * c.q) / r;
  }
  for (const p of src.plates) {
    v += p.vertical
      ? stripPotential(y - p.cy, x - p.cx, p.w, p.sigma)
      : stripPotential(x - p.cx, y - p.cy, p.w, p.sigma);
  }
  return v;
}

export interface Bounds {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

export interface LineOptions {
  bounds: Bounds;
  /** stop this close to a point charge [m] */
  stopRadius: number;
  /** maximum length of one line [m] */
  maxLength: number;
  /** largest allowed step [m] (keeps the polyline smooth) */
  maxStep: number;
  tol: number;
}

const dp = new DormandPrince45(2);

/**
 * Trace one field line from (x0, y0). dir = +1 follows E, −1 goes against E.
 * Returns the polyline as [x0, y0, x1, y1, ...] and where it ended.
 */
export function traceFieldLine(
  src: Sources,
  x0: number,
  y0: number,
  dir: 1 | -1,
  o: LineOptions,
): { points: number[]; end: 'charge' | 'plate' | 'out' | 'length' | 'null'; endSign: number } {
  const E = [0, 0];
  const f: Derivative = (_t, y, out) => {
    fieldAt(src, y[0], y[1], E);
    const m = Math.hypot(E[0], E[1]) || 1e-300;
    out[0] = (dir * E[0]) / m;
    out[1] = (dir * E[1]) / m;
  };
  const y = new Float64Array([x0, y0]);
  const pts = [x0, y0];
  let s = 0;
  let h = o.maxStep * 0.25;
  const b = o.bounds;
  for (let iter = 0; iter < 4000; iter++) {
    const px = y[0];
    const py = y[1];
    const r = dp.tryStep(f, s, y, h, o.tol, 0);
    if (!r.accepted) {
      h = Math.max(r.hNext, 1e-7);
      continue;
    }
    s += h;
    h = Math.min(r.hNext, o.maxStep);
    pts.push(y[0], y[1]);
    // ended on a point charge?
    for (const c of src.charges) {
      if (Math.hypot(y[0] - c.x, y[1] - c.y) < o.stopRadius) {
        pts.push(c.x, c.y);
        return { points: pts, end: 'charge', endSign: Math.sign(c.q) };
      }
    }
    // crossed a plate?
    for (const p of src.plates) {
      const hit = p.vertical
        ? (px - p.cx) * (y[0] - p.cx) <= 0 && Math.abs((py + y[1]) / 2 - p.cy) <= p.w / 2 && s > o.maxStep
        : (py - p.cy) * (y[1] - p.cy) <= 0 && Math.abs((px + y[0]) / 2 - p.cx) <= p.w / 2 && s > o.maxStep;
      if (hit) return { points: pts, end: 'plate', endSign: Math.sign(p.sigma) };
    }
    if (y[0] < b.x0 || y[0] > b.x1 || y[1] < b.y0 || y[1] > b.y1) return { points: pts, end: 'out', endSign: 0 };
    if (s > o.maxLength) return { points: pts, end: 'length', endSign: 0 };
    fieldAt(src, y[0], y[1], E);
    if (Math.hypot(E[0], E[1]) < 1e-9) return { points: pts, end: 'null', endSign: 0 };
  }
  return { points: pts, end: 'length', endSign: 0 };
}

/** Seed and trace all field lines. linesPerNC sets the density (lines per nC of charge). */
export function traceAllLines(src: Sources, o: LineOptions, linesPerNC = 8): number[][] {
  const lines: number[][] = [];
  const seedR = o.stopRadius * 1.2;
  for (const sign of [1, -1] as const) {
    for (const c of src.charges) {
      if (Math.sign(c.q) !== sign) continue;
      const n = Math.max(4, Math.min(32, Math.round(Math.abs(c.q) * 1e9 * linesPerNC)));
      for (let i = 0; i < n; i++) {
        const a = ((i + 0.5) * 2 * Math.PI) / n;
        const res = traceFieldLine(src, c.x + seedR * Math.cos(a), c.y + seedR * Math.sin(a), sign, o);
        // lines from negative charges are only kept if they do not end on a positive source
        if (sign === -1 && res.endSign > 0) continue;
        if (sign === -1) res.points.unshift(c.x, c.y);
        else res.points.unshift(c.x, c.y);
        lines.push(sign === 1 ? res.points : reversePairs(res.points));
      }
    }
    for (const p of src.plates) {
      if (Math.sign(p.sigma) !== sign) continue;
      // density: lines per metre ∝ σ (σ in nC m^-2)
      const n = Math.max(2, Math.min(16, Math.round(Math.abs(p.sigma) * 1e9 * linesPerNC * p.w * 0.4)));
      // the outer side of a plate (away from the origin) carries a weak field: seed half as many
      const outer = Math.sign(p.vertical ? p.cx : p.cy) || 1;
      for (let i = 0; i < n; i++) {
        const t = -p.w / 2 + ((i + 0.5) * p.w) / n;
        for (const side of [1, -1]) {
          if (side === outer && i % 2 === 1) continue;
          const eps = 1e-4 * side;
          const x = p.vertical ? p.cx + eps : p.cx + t;
          const y = p.vertical ? p.cy + t : p.cy + eps;
          const res = traceFieldLine(src, x, y, sign, o);
          if (sign === -1 && res.endSign > 0) continue;
          lines.push(sign === 1 ? res.points : reversePairs(res.points));
        }
      }
    }
  }
  return lines;
}

function reversePairs(a: number[]): number[] {
  const out = new Array<number>(a.length);
  for (let i = 0; i < a.length; i += 2) {
    out[a.length - 2 - i] = a[i];
    out[a.length - 1 - i] = a[i + 1];
  }
  return out;
}

/** Potential sampled on an nx × ny grid covering the bounds (row-major, y from top). */
export function potentialGrid(src: Sources, b: Bounds, nx: number, ny: number): Float64Array {
  const g = new Float64Array(nx * ny);
  for (let j = 0; j < ny; j++) {
    const y = b.y1 - ((b.y1 - b.y0) * j) / (ny - 1);
    for (let i = 0; i < nx; i++) {
      const x = b.x0 + ((b.x1 - b.x0) * i) / (nx - 1);
      g[j * nx + i] = potentialAt(src, x, y);
    }
  }
  return g;
}

/**
 * Marching squares: line segments [x1, y1, x2, y2, ...] (world coordinates) of the contours
 * V = level for every level in `levels`. `levelOf` receives the level index per segment.
 */
export function contours(
  grid: Float64Array,
  nx: number,
  ny: number,
  b: Bounds,
  levels: number[],
  levelOf?: number[],
  /** cells near these points are skipped (the 1/r singularity of a point charge) */
  exclude: { x: number; y: number }[] = [],
): number[] {
  const seg: number[] = [];
  const dx = (b.x1 - b.x0) / (nx - 1);
  const dy = (b.y1 - b.y0) / (ny - 1);
  const X = (i: number) => b.x0 + i * dx;
  const Y = (j: number) => b.y1 - j * dy;
  // mask of cells too close to a singular point (within 3 cell diagonals)
  const skip = new Uint8Array((nx - 1) * (ny - 1));
  const rEx = 3 * Math.hypot(dx, dy);
  for (const p of exclude) {
    const i0 = Math.max(0, Math.floor((p.x - rEx - b.x0) / dx));
    const i1 = Math.min(nx - 2, Math.ceil((p.x + rEx - b.x0) / dx));
    const j0 = Math.max(0, Math.floor((b.y1 - p.y - rEx) / dy));
    const j1 = Math.min(ny - 2, Math.ceil((b.y1 - p.y + rEx) / dy));
    for (let j = j0; j <= j1; j++)
      for (let i = i0; i <= i1; i++)
        if (Math.hypot(X(i) + dx / 2 - p.x, Y(j) - dy / 2 - p.y) < rEx) skip[j * (nx - 1) + i] = 1;
  }
  for (let li = 0; li < levels.length; li++) {
    const L = levels[li];
    for (let j = 0; j < ny - 1; j++) {
      for (let i = 0; i < nx - 1; i++) {
        if (skip[j * (nx - 1) + i]) continue;
        const a = grid[j * nx + i]; // top-left
        const bb = grid[j * nx + i + 1]; // top-right
        const c = grid[(j + 1) * nx + i + 1]; // bottom-right
        const d = grid[(j + 1) * nx + i]; // bottom-left
        if (!Number.isFinite(a + bb + c + d)) continue;
        let code = 0;
        if (a > L) code |= 8;
        if (bb > L) code |= 4;
        if (c > L) code |= 2;
        if (d > L) code |= 1;
        if (code === 0 || code === 15) continue;
        const top = () => [X(i) + ((L - a) / (bb - a)) * dx, Y(j)];
        const right = () => [X(i + 1), Y(j) - ((L - bb) / (c - bb)) * dy];
        const bottom = () => [X(i) + ((L - d) / (c - d)) * dx, Y(j + 1)];
        const left = () => [X(i), Y(j) - ((L - a) / (d - a)) * dy];
        const add = (p: number[], q: number[]) => {
          seg.push(p[0], p[1], q[0], q[1]);
          levelOf?.push(li);
        };
        switch (code) {
          case 1:
          case 14:
            add(left(), bottom());
            break;
          case 2:
          case 13:
            add(bottom(), right());
            break;
          case 3:
          case 12:
            add(left(), right());
            break;
          case 4:
          case 11:
            add(top(), right());
            break;
          case 6:
          case 9:
            add(top(), bottom());
            break;
          case 7:
          case 8:
            add(left(), top());
            break;
          case 5:
          case 10: {
            // saddle: decide with the centre value
            const centre = (a + bb + c + d) / 4;
            const centreAbove = centre > L;
            if ((code === 5) === centreAbove) {
              add(left(), top());
              add(bottom(), right());
            } else {
              add(left(), bottom());
              add(top(), right());
            }
            break;
          }
        }
      }
    }
  }
  return seg;
}

/** Equally spaced potential levels ±spacing, ±2·spacing … up to ±vmax (excluding 0 unless asked). */
export function levelsFor(spacing: number, vmax: number, includeZero = true): number[] {
  const out: number[] = [];
  const n = Math.min(200, Math.floor(vmax / spacing));
  for (let i = -n; i <= n; i++) if (i !== 0 || includeZero) out.push(i * spacing);
  return out;
}
