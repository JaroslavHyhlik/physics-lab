/**
 * Doppler effect for sound (1D motion along x) and wavefronts of a moving source.
 *   moving source:   f′ = f v / (v ∓ u_s)   (− when approaching)
 *   moving observer: f′ = f (v ± u_o) / v   (+ when approaching)
 *   both, velocities measured towards each other: f′ = f (v + u_o) / (v − u_s)
 * Wavefronts: emitted every period T from the source position at that moment; each is a circle
 * of radius v(t − t_emit). For u_s > v the fronts pile up into a cone with sin θ = v/u_s.
 * Light (non-relativistic): Δλ/λ = Δf/f ≈ v/c.
 */
export function dopplerSource(f: number, v: number, us: number, approaching: boolean): number {
  return (f * v) / (approaching ? v - us : v + us);
}
export function dopplerObserver(f: number, v: number, uo: number, approaching: boolean): number {
  return (f * (approaching ? v + uo : v - uo)) / v;
}
/** general 1D formula; u_o and u_s positive when moving towards the other */
export const dopplerBoth = (f: number, v: number, uo: number, us: number) => (f * (v + uo)) / (v - us);

export const machAngle = (v: number, us: number) => (us > v ? Math.asin(v / us) : null);

/**
 * Times at which successive wavefronts reach an observer (1D): source at x_s0 + u_s t,
 * observer at x_o0 + u_o t (velocities along +x), wave speed v; fronts emitted at t = kT.
 */
export function arrivalTimes(f: number, v: number, xs0: number, us: number, xo0: number, uo: number, count: number): number[] {
  const out: number[] = [];
  for (let k = 0; k < count; k++) {
    const te = k / f;
    const xe = xs0 + us * te;
    // solve |xo0 + uo t − xe| = v (t − te) for t > te
    const dir = Math.sign(xo0 + uo * te - xe) || 1;
    // dir (xo0 + uo t − xe) = v (t − te) → t (dir·uo − v) = −v te − dir (xo0 − xe)
    const t = (-v * te - dir * (xo0 - xe)) / (dir * uo - v);
    out.push(t);
  }
  return out;
}

/** hydrogen Balmer lines in the laboratory [nm] */
export const BALMER = [656.3, 486.1, 434.0, 410.2];
export const redshiftedLambda = (lambda: number, v: number, c: number) => lambda * (1 + v / c);
