/**
 * Car taking a circular curve of radius r on a road banked at angle θ, with static friction μ_s.
 * Steady circular motion at constant speed v: the resultant force is horizontal, towards the
 * centre, of size mv²/r. Resolving vertically and horizontally (friction f positive DOWN the
 * slope, i.e. towards the centre's side):
 *   N cosθ − f sinθ = mg
 *   N sinθ + f cosθ = mv²/r
 * ⇒ N = m(g cosθ + (v²/r) sinθ),  f = m((v²/r) cosθ − g sinθ)
 * The car keeps its line while |f| ≤ μ_s N. Exact algebra, no numerics.
 * The motion around the curve is uniform circular motion: φ = (v/r)·t.
 */
export interface CurveParams {
  m: number;
  r: number;
  theta: number; // bank angle [rad]
  mu: number;
  g: number;
}

export interface CurveForces {
  N: number;
  f: number; // + down the slope (towards the inside of the curve)
  fMax: number;
  ac: number; // centripetal acceleration v²/r
  Fc: number; // required centripetal force
  holds: boolean;
  /** 'ideal' (no friction needed), 'down' (friction acts down the bank), 'up', or the way it slides */
  regime: 'ideal' | 'friction-down' | 'friction-up' | 'slides-out' | 'slides-in';
}

export function curveForces(p: CurveParams, v: number): CurveForces {
  const ac = (v * v) / p.r;
  const c = Math.cos(p.theta);
  const s = Math.sin(p.theta);
  const N = p.m * (p.g * c + ac * s);
  const f = p.m * (ac * c - p.g * s);
  const fMax = p.mu * N;
  const holds = Math.abs(f) <= fMax * (1 + 1e-12);
  let regime: CurveForces['regime'];
  if (!holds) regime = f > 0 ? 'slides-out' : 'slides-in';
  else if (Math.abs(f) < 1e-9 * p.m * p.g) regime = 'ideal';
  else regime = f > 0 ? 'friction-down' : 'friction-up';
  return { N, f, fMax, ac, Fc: p.m * ac, holds, regime };
}

/** Speed at which no friction is needed: v = √(rg tanθ). */
export function idealSpeed(p: CurveParams): number {
  return Math.sqrt(p.r * p.g * Math.tan(p.theta));
}

/** Largest speed before sliding outwards (Infinity if it never slides out). */
export function maxSpeed(p: CurveParams): number {
  const c = Math.cos(p.theta);
  const s = Math.sin(p.theta);
  const den = c - p.mu * s;
  if (den <= 0) return Infinity;
  return Math.sqrt((p.r * p.g * (s + p.mu * c)) / den);
}

/** Smallest speed before sliding down the bank (0 if it can stand still). */
export function minSpeed(p: CurveParams): number {
  const c = Math.cos(p.theta);
  const s = Math.sin(p.theta);
  const num = s - p.mu * c;
  if (num <= 0) return 0;
  return Math.sqrt((p.r * p.g * num) / (c + p.mu * s));
}

/** Uniform circular motion around the curve. */
export class CurveRun {
  phi = 0;
  t = 0;
  constructor(
    public r: number,
    public v: number,
  ) {}
  step(dt: number): void {
    this.phi += (this.v / this.r) * dt;
    if (this.phi > 2 * Math.PI) this.phi -= 2 * Math.PI;
    this.t += dt;
  }
  get period(): number {
    return (2 * Math.PI * this.r) / this.v;
  }
}
