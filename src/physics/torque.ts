/**
 * Rotational equilibrium.
 *
 * Beam (see-saw): a uniform beam of length L and mass m_b rests on a pivot at x_p; point masses
 * m_i sit at positions x_i along it (x measured from the centre of the beam).
 *   torque about the pivot (anticlockwise +): τ = −Σ m_i g (x_i − x_p) cosθ − m_b g (0 − x_p) cosθ
 *   moment of inertia about the pivot: I = Σ m_i (x_i − x_p)² + m_b (L²/12 + x_p²)
 * In equilibrium ΣF = 0 (pivot pushes up with the total weight) and Στ = 0.
 * Out of balance the beam turns: Iα = τ(θ) until it touches the ground at ±θ_max.
 * Integrator: Yoshida 4 (the motion is conservative while it swings).
 *
 * Ladder: uniform ladder (length L, mass m) at angle θ to the floor, leaning on a smooth wall,
 * with a person of mass M a distance d up it. Torques about the foot:
 *   N_wall L sinθ = (m L/2 + M d) g cosθ;  floor friction f = N_wall;  N_floor = (m + M) g
 * The ladder slips if f > μ_s N_floor.
 */
import { yoshida4, type Acceleration } from '../core/integrators';

export interface PointMass {
  m: number;
  x: number;
}

export interface BeamParams {
  L: number;
  mb: number;
  xp: number;
  masses: PointMass[];
  g: number;
  thetaMax: number; // [rad] beam touches the ground
}

/** torque about the pivot (anticlockwise +) for a beam tilted by θ */
export function beamTorque(p: BeamParams, theta = 0): number {
  let tau = p.mb * p.g * p.xp; // beam weight acts at x = 0: −mb g (0 − xp)
  for (const q of p.masses) tau -= q.m * p.g * (q.x - p.xp);
  return tau * Math.cos(theta);
}

export function beamInertia(p: BeamParams): number {
  let I = p.mb * (p.L * p.L / 12 + p.xp * p.xp);
  for (const q of p.masses) I += q.m * (q.x - p.xp) ** 2;
  return I;
}

/** upward force of the pivot when the beam is held still: equals the total weight */
export function pivotReaction(p: BeamParams): number {
  return p.g * (p.mb + p.masses.reduce((s, q) => s + q.m, 0));
}

export class Beam {
  p: BeamParams;
  readonly th = new Float64Array(1);
  readonly om = new Float64Array(1);
  private a = new Float64Array(1);
  t = 0;
  resting = false;
  constructor(p: BeamParams) {
    this.p = { ...p, masses: p.masses.map((q) => ({ ...q })) };
  }
  reset(p?: Partial<BeamParams>) {
    if (p) this.p = { ...this.p, ...p, masses: (p.masses ?? this.p.masses).map((q) => ({ ...q })) };
    this.th[0] = 0;
    this.om[0] = 0;
    this.t = 0;
    this.resting = false;
  }
  private acc: Acceleration = (x, _t, out) => {
    const I = beamInertia(this.p);
    out[0] = I > 0 ? beamTorque(this.p, x[0]) / I : 0;
  };
  step(dt: number) {
    this.t += dt;
    if (this.resting) return;
    if (Math.abs(beamTorque(this.p, this.th[0])) < 1e-9 && this.om[0] === 0) return; // balanced
    yoshida4(this.th, this.om, this.a, dt, this.t, this.acc);
    if (Math.abs(this.th[0]) >= this.p.thetaMax) {
      this.th[0] = Math.sign(this.th[0]) * this.p.thetaMax;
      this.om[0] = 0;
      this.resting = true;
    }
  }
  get theta() {
    return this.th[0];
  }
}

export interface LadderParams {
  L: number;
  theta: number; // angle with the floor [rad]
  m: number; // ladder mass
  M: number; // person mass
  d: number; // person's distance up the ladder [m]
  mu: number; // floor static friction
  g: number;
}

export function ladderForces(p: LadderParams) {
  const { L, theta, m, M, d, mu, g } = p;
  const Nw = ((m * L) / 2 + M * d) * g * Math.cos(theta) / (L * Math.sin(theta));
  const Nf = (m + M) * g;
  const f = Nw;
  const fmax = mu * Nf;
  // furthest the person can climb before the ladder slips
  const dmax = ((mu * Nf * L * Math.sin(theta)) / (g * Math.cos(theta)) - (m * L) / 2) / M;
  return { Nw, Nf, f, fmax, slips: f > fmax * (1 + 1e-12), dmax: Math.max(0, Math.min(L, dmax)) };
}
