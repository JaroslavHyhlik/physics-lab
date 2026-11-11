/**
 * Travelling sinusoidal wave in a chain of particles:
 *   displacement of the particle whose rest position is x:  s(x, t) = A sin(ωt − kx)
 *   (wave moving in +x), ω = 2πf, k = 2π/λ, wave speed v = fλ = ω/k.
 * Transverse: s is perpendicular to x. Longitudinal: s is along x, so particles bunch up
 * (compression) where ∂s/∂x is most negative and spread out (rarefaction) where it is most positive.
 */
export interface WaveParams {
  A: number;
  lambda: number;
  f: number;
}

export function displacement(x: number, t: number, w: WaveParams): number {
  return w.A * Math.sin(2 * Math.PI * (w.f * t - x / w.lambda));
}

/** ∂s/∂x: local strain of a longitudinal wave (negative = compressed) */
export function strain(x: number, t: number, w: WaveParams): number {
  return (-2 * Math.PI * w.A / w.lambda) * Math.cos(2 * Math.PI * (w.f * t - x / w.lambda));
}

/** positions of compression centres in [0, L] at time t */
export function compressions(L: number, t: number, w: WaveParams): number[] {
  // cos(2π(ft − x/λ)) = 1 → x = λ(ft − n)
  const out: number[] = [];
  const base = w.lambda * (w.f * t);
  for (let n = Math.floor((base - L) / w.lambda) - 1; n <= Math.ceil(base / w.lambda) + 1; n++) {
    const x = base - n * w.lambda;
    if (x >= 0 && x <= L) out.push(x);
  }
  return out.sort((a, b) => a - b);
}
