import { describe, expect, it } from 'vitest';
import { COMPTON_WAVELENGTH, scatter } from '../../src/physics/compton';
import { linearFit } from '../../src/physics/dc';
import { h, c, m_e } from '../../src/core/constants';

describe('E.2 (HL) Compton scattering', () => {
  it('Δλ = h/(m_e c)(1 − cos θ): 0 at 0°, 2.43 pm at 90°, largest (4.85 pm) at 180°', () => {
    expect(COMPTON_WAVELENGTH * 1e12).toBeCloseTo(2.43, 2);
    expect(scatter(71e-12, 0).dLambda).toBe(0);
    expect(scatter(71e-12, Math.PI / 2).dLambda).toBeCloseTo(COMPTON_WAVELENGTH, 25);
    expect(scatter(71e-12, Math.PI).dLambda).toBeCloseTo(2 * COMPTON_WAVELENGTH, 25);
    // independent of the incoming wavelength
    expect(scatter(2e-12, 1).dLambda).toBeCloseTo(scatter(80e-12, 1).dLambda, 25);
  });

  it('energy and momentum are conserved with a relativistic electron', () => {
    for (const lambda of [1.87e-12, 20e-12, 71e-12]) {
      for (const th of [0.3, 1, 2, 3]) {
        const r = scatter(lambda, th);
        // relativistic: K = √((p_e c)² + (m c²)²) − m c²
        const mc2 = m_e * c * c;
        const Kfromp = Math.sqrt((r.pe * c) ** 2 + mc2 * mc2) - mc2;
        expect(Kfromp / r.K).toBeCloseTo(1, 8);
        // momentum components: incoming = scattered photon + electron
        const p2 = h / r.lambda2;
        expect(p2 * Math.cos(th) + r.pe * Math.cos(r.phi)).toBeCloseTo(h / lambda, 30);
        expect(p2 * Math.sin(th) - r.pe * Math.sin(r.phi)).toBeCloseTo(0, 30);
        expect(r.v).toBeLessThan(c);
      }
    }
  });

  it('gradient of Δλ against (1 − cos θ) gives h/(m_e c), so h', () => {
    const ths = [0.5, 1, 1.5, 2, 2.5, 3];
    const fit = linearFit(
      ths.map((t) => 1 - Math.cos(t)),
      ths.map((t) => scatter(71e-12, t).dLambda),
    );
    expect((fit.slope * m_e * c) / h).toBeCloseTo(1, 10);
    expect(fit.intercept).toBeCloseTo(0, 25);
  });
});
