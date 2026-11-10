/**
 * Objects released from rest on an incline (angle θ, length L).
 * Moment of inertia I = k m r² with k = 2/5 (solid sphere), 1/2 (solid cylinder),
 * 2/3 (hollow sphere), 1 (hoop); a frictionless sliding block has no rotation (k = 0).
 *
 * Rolling without slipping (v = ωr) needs friction f = mg sinθ·k/(1+k) ≤ μ_s mg cosθ:
 *   a = g sinθ/(1 + k),   α = a/r
 * Otherwise it rolls AND slips: dynamic friction μ_d mg cosθ acts up the slope:
 *   a = g(sinθ − μ_d cosθ),   α = μ_d g cosθ/(k r)
 * Starting from rest on a uniform slope the object stays in one regime, so the motion is
 * uniformly accelerated (translation and rotation) and solved exactly with suvat.
 */
export interface Shape {
  id: string;
  label: string;
  k: number; // I / (m r²)
  slides?: boolean; // frictionless block (no rotation)
}

export const shapes: Shape[] = [
  { id: 'block', label: 'Sliding block (no friction)', k: 0, slides: true },
  { id: 'sphere', label: 'Solid sphere', k: 2 / 5 },
  { id: 'cylinder', label: 'Solid cylinder', k: 1 / 2 },
  { id: 'shell', label: 'Hollow sphere', k: 2 / 3 },
  { id: 'hoop', label: 'Hoop (ring)', k: 1 },
];

export interface RollParams {
  theta: number;
  L: number;
  muS: number;
  muD: number;
  m: number;
  r: number;
  g: number;
}

export interface Motion {
  a: number; // linear acceleration down the slope
  alpha: number; // angular acceleration
  rolls: boolean; // without slipping
  friction: number; // friction force (up the slope)
}

export function motionOf(shape: Shape, p: RollParams): Motion {
  const { theta, muS, muD, m, r, g } = p;
  const s = Math.sin(theta);
  const c = Math.cos(theta);
  if (shape.slides) return { a: g * s, alpha: 0, rolls: false, friction: 0 };
  const k = shape.k;
  const fNeeded = (m * g * s * k) / (1 + k);
  if (fNeeded <= muS * m * g * c + 1e-12) {
    const a = (g * s) / (1 + k);
    return { a, alpha: a / r, rolls: true, friction: fNeeded };
  }
  return { a: g * (s - muD * c), alpha: (muD * g * c) / (k * r), rolls: false, friction: muD * m * g * c };
}

/** State of one racer at time t (exact). */
export function racerAt(shape: Shape, p: RollParams, t: number) {
  const M = motionOf(shape, p);
  const tEnd = Math.sqrt((2 * p.L) / M.a);
  const tt = Math.min(t, tEnd);
  const s = 0.5 * M.a * tt * tt;
  const v = M.a * tt;
  const omega = M.alpha * tt;
  const phi = 0.5 * M.alpha * tt * tt;
  const I = shape.k * p.m * p.r * p.r;
  return {
    s,
    v,
    omega,
    phi,
    finished: t >= tEnd,
    tEnd,
    KEtrans: 0.5 * p.m * v * v,
    KErot: 0.5 * I * omega * omega,
    Ep: p.m * p.g * (p.L - s) * Math.sin(p.theta),
    heat: M.rolls || shape.slides ? 0 : M.friction * (s - (phi * p.r)),
    M,
  };
}
