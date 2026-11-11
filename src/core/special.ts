/** Special functions used for exact reference results. */

/** Arithmetic–geometric mean. */
export function agm(a: number, b: number): number {
  for (let i = 0; i < 64; i++) {
    const an = 0.5 * (a + b);
    const bn = Math.sqrt(a * b);
    if (Math.abs(an - bn) <= 1e-16 * an) return an;
    a = an;
    b = bn;
  }
  return 0.5 * (a + b);
}

/** Complete elliptic integral of the first kind K(k), modulus k (0 ≤ k < 1). */
export function ellipticK(k: number): number {
  if (k < 0 || k >= 1) throw new RangeError('ellipticK: need 0 <= k < 1');
  return Math.PI / (2 * agm(1, Math.sqrt(1 - k * k)));
}

/**
 * Exact period of a simple pendulum with amplitude theta0 (rad):
 * T = 4·√(l/g)·K(sin(θ₀/2)).
 */
export function pendulumPeriodExact(l: number, gField: number, theta0: number): number {
  return 4 * Math.sqrt(l / gField) * ellipticK(Math.sin(Math.abs(theta0) / 2));
}

/**
 * Complete elliptic integrals K(k) and E(k) together (modulus k, 0 ≤ k < 1), by the AGM:
 * E = K (1 − Σ 2^{n−1} c_n²) with c₀ = k.
 */
export function ellipticKE(k: number): [number, number] {
  let a = 1;
  let b = Math.sqrt(1 - k * k);
  let c = k;
  let sum = 0.5 * c * c;
  let pow = 0.5;
  for (let i = 0; i < 64 && Math.abs(c) > 1e-17; i++) {
    const an = 0.5 * (a + b);
    const bn = Math.sqrt(a * b);
    c = 0.5 * (a - b);
    a = an;
    b = bn;
    pow *= 2;
    sum += pow * c * c;
  }
  const K = Math.PI / (2 * a);
  return [K, K * (1 - sum)];
}
