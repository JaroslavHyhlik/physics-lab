import { describe, expect, it } from 'vitest';
import { Spinner, Discs, MerryGoRound, mgrOmega } from '../../src/physics/angularMomentum';

describe('A.4 conservation of angular momentum', () => {
  it('spinner: L = Iω stays constant; ω₂/ω₁ = I₁/I₂; E_k = L²/2I rises', () => {
    const s = new Spinner({ I0: 2, m: 3, omega0: 2, r0: 0.9 });
    const L = s.L;
    const I1 = s.I;
    const E1 = s.Ek;
    s.r = 0.2;
    expect(s.I * s.omega).toBeCloseTo(L, 12);
    expect(s.omega / 2).toBeCloseTo(I1 / s.I, 12);
    expect(s.Ek - E1).toBeCloseTo(0.5 * L * L * (1 / s.I - 1 / I1), 10);
    expect(s.Ek).toBeGreaterThan(E1);
  });

  it('two discs: final ω = I₁ω₁/(I₁+I₂), L conserved throughout, E_k falls to I₁/(I₁+I₂)', () => {
    const d = new Discs({ I1: 0.4, I2: 0.6, omega1: 10, tau: 0.5, tDrop: 1 });
    const L0 = d.L;
    const E0 = d.Ek;
    for (let i = 0; i < 6000; i++) {
      d.step(1e-3);
      expect(d.L).toBeCloseTo(L0, 10);
    }
    expect(d.joined).toBe(true);
    expect(d.w1).toBeCloseTo(4, 12);
    expect(d.Ek / E0).toBeCloseTo(0.4, 10);
  });

  it('merry-go-round: walking one way turns the platform the other way; total L = 0', () => {
    const p = { Ip: 300, m: 60, R: 2, u: 1.2 };
    const g = new MerryGoRound(p);
    expect(g.omegaP).toBeCloseTo((-60 * 2 * 1.2) / (300 + 240), 12);
    expect(g.L).toBeCloseTo(0, 12);
    for (let i = 0; i < 5000; i++) g.step(1e-3);
    // angles: I_p·φ_p + mR²·φ_person = 0
    expect(300 * g.platform + 60 * 4 * g.person).toBeCloseTo(0, 9);
    expect(mgrOmega(p)).toBeLessThan(0);
  });
});
