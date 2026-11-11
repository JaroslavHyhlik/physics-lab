import { describe, expect, it } from 'vitest';
import { deflection, closestApproach, trajectory, impactFor, nuclearRadius, MEV, M_ALPHA } from '../../src/physics/rutherford';
import { Rng } from '../../src/core/rng';

const Ek = 5 * MEV;
const fm = 1e-15;

describe('E.1 Rutherford scattering', () => {
  it('numerical paths agree with tan(θ/2) = kZ₁Z₂e²/(2E_k b)', () => {
    for (const b of [5 * fm, 20 * fm, 60 * fm]) {
      const tr = trajectory(b, Ek, 2, 79, M_ALPHA, 20000 * fm);
      // starts/ends 20 000 fm away (energy and angular momentum matched): asymptote error < 0.3 %
      expect(Math.abs(tr.angle / deflection(b, Ek, 2, 79) - 1)).toBeLessThan(0.003);
    }
  });

  it('head-on: closest approach d = kZ₁Z₂e²/E_k (about 45 fm for 5 MeV α on gold), larger than the nucleus', () => {
    const d = closestApproach(Ek, 2, 79);
    expect(d / fm).toBeCloseTo(45.5, 0);
    const tr = trajectory(1e-20, Ek, 2, 79, M_ALPHA, 2000 * fm);
    expect(tr.rmin / d).toBeCloseTo(1, 3);
    expect(nuclearRadius(197) / fm).toBeCloseTo(7.0, 1);
  });

  it('beam spread uniformly over a disc: fraction deflected by more than θ = (b(θ)/b_max)², i.e. ∝ 1/sin⁴(θ/2) per solid angle', () => {
    const bmax = 600 * fm;
    const n = 40000;
    const rng = new Rng(3);
    const angles: number[] = [];
    for (let i = 0; i < n; i++) {
      const b = bmax * Math.sqrt(rng.next()); // uniform over the disc
      angles.push(deflection(b, Ek, 2, 79));
    }
    for (const th of [0.2, 0.5, Math.PI / 2]) {
      const f = angles.filter((a) => a > th).length / n;
      const pred = (impactFor(th, Ek, 2, 79) / bmax) ** 2;
      const sigma = Math.sqrt((pred * (1 - pred)) / n);
      expect(Math.abs(f - pred)).toBeLessThan(4 * sigma + 1e-12);
    }
  });
});
