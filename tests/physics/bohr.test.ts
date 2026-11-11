import { describe, expect, it } from 'vitest';
import { A0, energyEV, radius, speed, transition } from '../../src/physics/bohr';
import { h, m_e, e, epsilon_0 } from '../../src/core/constants';

describe('E.1 (HL) Bohr model', () => {
  it('E = −13.6/n² eV and r = n²a₀ with a₀ ≈ 5.3 × 10⁻¹¹ m', () => {
    expect(energyEV(1)).toBe(-13.6);
    expect(energyEV(3)).toBeCloseTo(-13.6 / 9, 14);
    expect(A0).toBeCloseTo(5.3e-11, 12);
    expect(radius(2) / radius(1)).toBeCloseTo(4, 14);
  });

  it('angular momentum mvr = nh/2π, and the Coulomb force provides the centripetal force', () => {
    for (const n of [1, 2, 5]) {
      expect((m_e * speed(n) * radius(n)) / ((n * h) / (2 * Math.PI))).toBeCloseTo(1, 12);
      const coulomb = (e * e) / (4 * Math.PI * epsilon_0 * radius(n) ** 2);
      const centripetal = (m_e * speed(n) ** 2) / radius(n);
      expect(coulomb / centripetal).toBeCloseTo(1, 12);
    }
  });

  it('3 → 2 gives the red Balmer line near 656 nm; 2 → 1 is ultraviolet (Lyman α ≈ 122 nm)', () => {
    expect(transition(3, 2).lambda * 1e9).toBeCloseTo(656, -1);
    expect(Math.abs(transition(3, 2).lambda * 1e9 - 656.3) / 656.3).toBeLessThan(0.01);
    expect(transition(2, 1).lambda * 1e9).toBeLessThan(130);
  });
});
