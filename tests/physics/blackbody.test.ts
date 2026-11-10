import { describe, expect, it } from 'vitest';
import { planck, planckTotal, stefanBoltzmann, peakWavelength, blackbodyRGB } from '../../src/physics/blackbody';
import { wienConstant } from '../../src/core/constants';

/** Simpson's rule on a log-spaced grid: ∫ f dλ = ∫ f(λ) λ d(ln λ) */
function integrate(T: number): number {
  const lo = Math.log(1e-3 * (wienConstant / T));
  const hi = Math.log(1e3 * (wienConstant / T));
  const n = 20000;
  const hstep = (hi - lo) / n;
  let s = 0;
  for (let i = 0; i <= n; i++) {
    const l = Math.exp(lo + i * hstep);
    const w = i === 0 || i === n ? 1 : i % 2 ? 4 : 2;
    s += w * planck(l, T) * l;
  }
  return (s * hstep) / 3;
}

describe('B.1 black-body radiation', () => {
  it('area under the Planck curve = σT⁴ (exact for the booklet h, c, k; booklet σ within 1 %)', () => {
    for (const T of [310, 2800, 5800, 9940]) {
      const area = integrate(T);
      expect(Math.abs(area / planckTotal(T) - 1)).toBeLessThan(1e-6);
      // rounding of the booklet constants: 2π⁵k⁴/(15c²h³) = 5.64 × 10⁻⁸ vs σ = 5.67 × 10⁻⁸
      expect(Math.abs(area / stefanBoltzmann(T) - 1)).toBeLessThan(0.01);
    }
  });

  it("Wien's law: λ_max T = 2.9 × 10⁻³ m K (within the booklet's 2 significant figures)", () => {
    for (const T of [310, 3000, 5800, 20000]) {
      const lt = peakWavelength(T) * T;
      expect(Math.abs(lt / wienConstant - 1)).toBeLessThan(0.005);
    }
  });

  it('doubling T multiplies the total power by 16', () => {
    expect(planckTotal(6000) / planckTotal(3000)).toBeCloseTo(16, 12);
  });

  it('colours: cool bodies are red, the Sun is near white, hot stars are bluish', () => {
    const [r1, g1, b1] = blackbodyRGB(2000);
    expect(r1).toBeGreaterThan(g1);
    expect(g1).toBeGreaterThan(b1);
    const sun = blackbodyRGB(5800);
    for (const v of sun) expect(v).toBeGreaterThan(0.8);
    const [r3, , b3] = blackbodyRGB(20000);
    expect(b3).toBeGreaterThanOrEqual(r3);
  });
});
