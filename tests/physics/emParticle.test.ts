import { describe, expect, it } from 'vitest';
import { ChargedParticle, larmorRadius, cyclotronPeriod } from '../../src/physics/emParticle';
import { m_p, e } from '../../src/core/constants';

describe('D.3 charged particle in E and B fields', () => {
  it('uniform B: circle of radius mv/(qB), period 2πm/(qB), speed unchanged', () => {
    const B = 0.1;
    const v = 1e6;
    const p = new ChargedParticle(e, m_p, (_x, _y, _t, _E, Bf) => {
      Bf[2] = B;
    });
    p.v[0] = v;
    const T = cyclotronPeriod(m_p, e, B);
    const h = T / 4000;
    let ymin = 0;
    let ymax = 0;
    // run exactly one period: the particle comes back to the start
    for (let i = 0; i < 4000; i++) {
      p.step(h);
      ymin = Math.min(ymin, p.x[1]);
      ymax = Math.max(ymax, p.x[1]);
    }
    const r = larmorRadius(m_p, v, e, B);
    expect((ymax - ymin) / (2 * r)).toBeCloseTo(1, 5);
    expect(Math.hypot(p.x[0], p.x[1]) / r).toBeLessThan(1e-5);
    expect(p.speed / v).toBeCloseTo(1, 12);
  });

  it('velocity selector: only v = E/B passes undeflected', () => {
    const E = 2e4;
    const B = 0.02;
    const run = (v: number) => {
      const p = new ChargedParticle(e, m_p, (_x, _y, _t, Ef, Bf) => {
        Ef[1] = -E;
        Bf[2] = -B;
      });
      p.v[0] = v;
      const h = 1e-10;
      while (p.x[0] < 0.2) p.step(h);
      return p.x[1];
    };
    expect(Math.abs(run(E / B))).toBeLessThan(1e-9);
    expect(Math.abs(run(0.8 * E / B))).toBeGreaterThan(1e-4);
  });

  it('E only: parabola y = qEx²/(2mv²)', () => {
    const E = 1e3;
    const v = 1e6;
    const p = new ChargedParticle(e, m_p, (_x, _y, _t, Ef) => {
      Ef[1] = E;
    });
    p.v[0] = v;
    const h = 1e-11;
    while (p.x[0] < 0.1) p.step(h);
    const x = p.x[0];
    // leapfrog starts with the velocity half a step early: relative error ≈ h/t = 10⁻⁴
    expect(p.x[1] / ((e * E * x * x) / (2 * m_p * v * v))).toBeCloseTo(1, 3);
  });
});
