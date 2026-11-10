/**
 * Two pucks (discs) on a frictionless air table.
 *
 * Event-driven, exact model: between collisions each puck moves uniformly, so positions are
 * advanced analytically. The moment of contact |r₂ − r₁| = r₁ + r₂ is the root of a quadratic,
 * found inside the step, and the step is split exactly there. The collision is instantaneous:
 * an impulse J along the line of centres (no friction between the pucks, so no spin and no
 * tangential impulse), with the normal relative velocity reversed and scaled by e:
 *   J = (1 + e) μ (u_rel · n),   μ = m₁m₂ / (m₁ + m₂)
 * Equal and opposite impulses → total momentum conserved to rounding error.
 * No numerical integrator is needed (motion is piecewise linear), so results never depend on
 * the step size.
 */

export interface Collision2DParams {
  m1: number;
  m2: number;
  r1: number; // puck radii [m]
  r2: number;
  e: number; // coefficient of restitution 0..1
  /** initial positions [m] and velocities [m s⁻¹] */
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  u1x: number;
  u1y: number;
  u2x: number;
  u2y: number;
}

export class Collision2D {
  p: Collision2DParams;
  /** [x1, y1, vx1, vy1, x2, y2, vx2, vy2] */
  readonly s = new Float64Array(8);
  t = 0;
  /** time of the collision (NaN until it happens) */
  tc = NaN;
  /** positions at the moment of contact [x1, y1, x2, y2] */
  readonly contact = new Float64Array(4);
  /** impulse on puck 2 [Jx, Jy] (on puck 1 it is the opposite) */
  readonly J = new Float64Array(2);

  constructor(p: Collision2DParams) {
    this.p = { ...p };
    this.reset();
  }

  reset(p?: Partial<Collision2DParams>): void {
    if (p) this.p = { ...this.p, ...p };
    const q = this.p;
    this.s.set([q.x1, q.y1, q.u1x, q.u1y, q.x2, q.y2, q.u2x, q.u2y]);
    this.t = 0;
    this.tc = NaN;
    this.contact.fill(NaN);
    this.J.fill(0);
  }

  get collided(): boolean {
    return !Number.isNaN(this.tc);
  }

  /** Time until contact from the current state, or Infinity if the pucks never touch. */
  timeToContact(): number {
    const s = this.s;
    const dx = s[4] - s[0];
    const dy = s[5] - s[1];
    const wx = s[6] - s[2];
    const wy = s[7] - s[3];
    const R = this.p.r1 + this.p.r2;
    const a = wx * wx + wy * wy;
    const b = dx * wx + dy * wy; // < 0 when approaching
    const c = dx * dx + dy * dy - R * R;
    if (b >= 0 || a === 0) return Infinity;
    const disc = b * b - a * c;
    if (disc < 0) return Infinity; // they pass each other
    if (c <= 0) return 0; // already touching and approaching
    return c / (-b + Math.sqrt(disc)); // smaller root, numerically stable form
  }

  private drift(h: number): void {
    const s = this.s;
    s[0] += s[2] * h;
    s[1] += s[3] * h;
    s[4] += s[6] * h;
    s[5] += s[7] * h;
  }

  private collide(): void {
    const s = this.s;
    const { m1, m2, e } = this.p;
    let nx = s[4] - s[0];
    let ny = s[5] - s[1];
    const d = Math.hypot(nx, ny);
    nx /= d;
    ny /= d;
    const vn = (s[2] - s[6]) * nx + (s[3] - s[7]) * ny; // approach speed along n (> 0)
    if (vn <= 0) return;
    const j = ((1 + e) * m1 * m2 * vn) / (m1 + m2);
    s[2] -= (j / m1) * nx;
    s[3] -= (j / m1) * ny;
    s[6] += (j / m2) * nx;
    s[7] += (j / m2) * ny;
    this.J[0] = j * nx;
    this.J[1] = j * ny;
    this.tc = this.t;
    this.contact.set([s[0], s[1], s[4], s[5]]);
  }

  step(dt: number): void {
    let left = dt;
    if (!this.collided) {
      const tau = this.timeToContact();
      if (tau <= left) {
        this.drift(tau);
        this.t += tau;
        left -= tau;
        this.collide();
      }
    }
    this.drift(left);
    this.t += left;
  }

  /** Puck positions at an arbitrary earlier time t′ (motion is piecewise linear). */
  positionAt(tp: number, out: Float64Array): Float64Array {
    const q = this.p;
    if (!this.collided || tp <= this.tc) {
      out[0] = q.x1 + q.u1x * tp;
      out[1] = q.y1 + q.u1y * tp;
      out[2] = q.x2 + q.u2x * tp;
      out[3] = q.y2 + q.u2y * tp;
    } else {
      const h = tp - this.tc;
      const s = this.s;
      out[0] = this.contact[0] + s[2] * h;
      out[1] = this.contact[1] + s[3] * h;
      out[2] = this.contact[2] + s[6] * h;
      out[3] = this.contact[3] + s[7] * h;
    }
    return out;
  }

  get M(): number {
    return this.p.m1 + this.p.m2;
  }
  get px(): number {
    return this.p.m1 * this.s[2] + this.p.m2 * this.s[6];
  }
  get py(): number {
    return this.p.m1 * this.s[3] + this.p.m2 * this.s[7];
  }
  get kinetic(): number {
    const s = this.s;
    return 0.5 * this.p.m1 * (s[2] ** 2 + s[3] ** 2) + 0.5 * this.p.m2 * (s[6] ** 2 + s[7] ** 2);
  }
  get xcm(): number {
    return (this.p.m1 * this.s[0] + this.p.m2 * this.s[4]) / this.M;
  }
  get ycm(): number {
    return (this.p.m1 * this.s[1] + this.p.m2 * this.s[5]) / this.M;
  }
}

/**
 * Standard set-up: puck 2 starts at the origin moving along x with u₂; puck 1 moves along +x
 * with u₁ on a line offset by the impact parameter b. Start positions are chosen so that the
 * centres line up in x at the origin. They start at most `reach` metres from the origin and at
 * least r₁ + r₂ + 0.05 m apart in x.
 */
export function standardSetup(
  m1: number,
  m2: number,
  r1: number,
  r2: number,
  u1: number,
  u2: number,
  b: number,
  e: number,
  reach = 1.2,
): Collision2DParams {
  const vr = Math.max(u1 - u2, 0.05);
  const vmax = Math.max(Math.abs(u1), Math.abs(u2), 1e-9);
  const gap = Math.max(r1 + r2 + 0.05, (reach * vr) / vmax);
  const T = gap / vr;
  return { m1, m2, r1, r2, e, x1: -u1 * T, y1: b, x2: -u2 * T, y2: 0, u1x: u1, u1y: 0, u2x: u2, u2y: 0 };
}
