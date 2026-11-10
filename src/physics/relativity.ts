/**
 * Galilean and special relativity (one space dimension, frame S′ moving at v along +x).
 * Natural units are used where convenient: β = v/c, and positions as ct (same unit as x).
 *
 *   Galilean:  x′ = x − vt,  t′ = t,  u′ = u − v
 *   Lorentz:   x′ = γ(x − vt),  t′ = γ(t − vx/c²),  γ = 1/√(1 − v²/c²)
 *   velocity addition: u′ = (u − v)/(1 − uv/c²)
 *   spacetime interval: s² = (ct)² − x² is the same in every inertial frame
 *   time dilation: Δt = γΔt₀;  length contraction: L = L₀/γ
 *   Minkowski diagram: the x′ and ct′ axes make angle θ with x and ct, tanθ = v/c
 */
import { c } from '../core/constants';

export function gamma(beta: number): number {
  if (Math.abs(beta) >= 1) return Infinity;
  return 1 / Math.sqrt(1 - beta * beta);
}

/** Galilean transformation of an event (x [m], t [s]) into a frame moving at v [m/s]. */
export function galilean(x: number, t: number, v: number): [number, number] {
  return [x - v * t, t];
}

/** Lorentz transformation of an event given as (x, ct) — both in the same length unit. */
export function lorentz(x: number, ct: number, beta: number): [number, number] {
  const g = gamma(beta);
  return [g * (x - beta * ct), g * (ct - beta * x)];
}

/** Lorentz transformation in SI units (x [m], t [s], v [m/s]). */
export function lorentzSI(x: number, t: number, v: number): [number, number] {
  const g = gamma(v / c);
  return [g * (x - v * t), g * (t - (v * x) / (c * c))];
}

/** velocity of an object (u in S) as measured in S′ moving at v; both as fractions of c */
export function velocityAdd(u: number, v: number): number {
  return (u - v) / (1 - u * v);
}

/** spacetime interval s² = (ct)² − x² */
export function interval(x: number, ct: number): number {
  return ct * ct - x * x;
}

/** angle of the S′ axes on a Minkowski diagram, tanθ = v/c */
export function axisAngle(beta: number): number {
  return Math.atan(beta);
}

/** Muon experiment: fraction surviving a trip of length L (ground frame) at speed βc. */
export function muonSurvival(L: number, beta: number, tauHalf: number): { classical: number; relativistic: number; tGround: number; tProper: number } {
  const tGround = L / (beta * c);
  const tProper = tGround / gamma(beta);
  return {
    tGround,
    tProper,
    classical: Math.pow(0.5, tGround / tauHalf),
    relativistic: Math.pow(0.5, tProper / tauHalf),
  };
}

/**
 * Random proper lifetimes of n muons (exponential decay with half-life τ½), seeded so the
 * animation and its test are reproducible.
 */
export function sampleLifetimes(n: number, tauHalf: number, rng: { next(): number }): Float64Array {
  const out = new Float64Array(n);
  const mean = tauHalf / Math.LN2;
  for (let i = 0; i < n; i++) {
    let u = rng.next();
    while (u <= 1e-300) u = rng.next();
    out[i] = -mean * Math.log(u);
  }
  return out;
}

/**
 * Train (proper length L0) passes through a tunnel (proper length T0) at speed βc.
 * Frame S = tunnel, frame S′ = train. Lengths and times as x and ct in metres.
 * The train front reaches the tunnel entrance at ct = ct′ = 0 at x = x′ = 0.
 * If the train fits in S (L0/γ ≤ T0), both tunnel doors are closed at the same instant
 * ctD in S, half-way between "rear in" and "front out". In S′ these two events are
 * not simultaneous: the exit door closes earlier by γβT0.
 */
export function trainTunnel(beta: number, L0: number, T0: number) {
  const g = gamma(beta);
  const ctRearIn = L0 / (g * beta); // S: rear passes the entrance
  const ctFrontOut = T0 / beta; // S: front reaches the exit
  const fits = L0 / g <= T0;
  const ctDoors = (ctRearIn + ctFrontOut) / 2;
  const entrance = lorentz(0, ctDoors, beta); // door event at the entrance, in S′
  const exit = lorentz(T0, ctDoors, beta); // door event at the exit, in S′
  return {
    gamma: g,
    trainInS: L0 / g,
    tunnelInSp: T0 / g,
    fits,
    ctRearIn,
    ctFrontOut,
    ctDoors,
    /** door events in S′ as [x′, ct′] */
    entranceSp: entrance,
    exitSp: exit,
    /** S: train front and rear */
    frontS: (ct: number) => beta * ct,
    rearS: (ct: number) => beta * ct - L0 / g,
    /** S′: tunnel entrance and exit */
    entranceSpAt: (ctp: number) => -beta * ctp,
    exitSpAt: (ctp: number) => T0 / g - beta * ctp,
  };
}
