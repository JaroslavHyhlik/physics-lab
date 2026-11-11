import { describe, expect, it } from 'vitest';
import { magField, loopField, solenoid } from '../../src/physics/magnet';
import { ellipticKE, ellipticK } from '../../src/core/special';
import { mu_0 } from '../../src/core/constants';

/** Biot–Savart sum over a loop of radius a (axis x) for comparison */
function biotSavart(a: number, I: number, x: number, y: number, n = 4000): [number, number] {
  let bx = 0;
  let by = 0;
  for (let i = 0; i < n; i++) {
    const p = (2 * Math.PI * (i + 0.5)) / n;
    // loop point (0, a cos p, a sin p); dl = a dp (0, −sin p, cos p)
    const lx = 0;
    const ly = a * Math.cos(p);
    const lz = a * Math.sin(p);
    const dl = [0, -a * Math.sin(p) * ((2 * Math.PI) / n), a * Math.cos(p) * ((2 * Math.PI) / n)];
    const r = [x - lx, y - ly, -lz];
    const rm = Math.hypot(r[0], r[1], r[2]);
    const c = (mu_0 * I) / (4 * Math.PI * rm ** 3);
    bx += c * (dl[1] * r[2] - dl[2] * r[1]);
    by += c * (dl[2] * r[0] - dl[0] * r[2]);
  }
  return [bx, by];
}

describe('D.2 magnetic field patterns', () => {
  it('elliptic integrals: K(0) = E(0) = π/2; matches the existing K', () => {
    const [K0, E0] = ellipticKE(0);
    expect(K0).toBeCloseTo(Math.PI / 2, 14);
    expect(E0).toBeCloseTo(Math.PI / 2, 14);
    expect(ellipticKE(0.7)[0]).toBeCloseTo(ellipticK(0.7), 13);
    // E(k) = ∫₀^{π/2} √(1 − k² sin²θ) dθ by the midpoint rule
    let E = 0;
    const n = 20000;
    for (let i = 0; i < n; i++) E += Math.sqrt(1 - 0.49 * Math.sin((Math.PI / 2) * ((i + 0.5) / n)) ** 2);
    expect(ellipticKE(0.7)[1]).toBeCloseTo((E * Math.PI) / 2 / n, 9);
  });

  it('straight wire: B = μ₀I/(2πr), circling the wire', () => {
    const [bx, by] = magField([{ kind: 'wire', x: 0, y: 0, I: 5 }], 0.02, 0);
    expect(Math.hypot(bx, by)).toBeCloseTo((mu_0 * 5) / (2 * Math.PI * 0.02), 14);
    expect(by).toBeGreaterThan(0); // anticlockwise for current out of the page
  });

  it('loop: centre B = μ₀I/2a; exact formula agrees with a Biot–Savart sum', () => {
    const a = 0.05;
    expect(loopField(a, 2, 0, 0)[0]).toBeCloseTo((mu_0 * 2) / (2 * a), 14);
    for (const [x, y] of [[0.02, 0.03], [-0.04, 0.07], [0.1, 0.01]]) {
      const [ex, ey] = magField([{ kind: 'loop', x: 0, y: 0, a, I: 2 }], x, y);
      const [nx, ny] = biotSavart(a, 2, x, y);
      expect(ex / nx).toBeCloseTo(1, 5);
      expect(ey / ny).toBeCloseTo(1, 5);
    }
  });

  it('long solenoid: B inside ≈ μ₀nI (length 20 × radius: within 1 %)', () => {
    const L = 0.4;
    const N = 400;
    const s = solenoid(0, 0, 0.01, L, N, 0.5);
    const [bx] = magField(s, 0, 0);
    expect(Math.abs(bx / (mu_0 * (N / L) * 0.5) - 1)).toBeLessThan(0.01);
  });
});
