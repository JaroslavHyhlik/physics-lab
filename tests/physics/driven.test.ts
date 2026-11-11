import { describe, expect, it } from 'vitest';
import { DrivenOscillators, steadyAmplitude, phaseLag } from '../../src/physics/driven';

describe('C.4 resonance and damping', () => {
  const m = 0.5;
  const k = 50; // ω₀ = 10 rad/s
  const b = 0.5;
  it('after the transient, the amplitude equals the analytic A(ω)', () => {
    for (const w of [5, 9.5, 10, 14]) {
      const d = new DrivenOscillators(new Float64Array([m]), new Float64Array([k]), new Float64Array([b]));
      d.w = w;
      d.F0 = 2;
      while (d.t < 60) d.step(0.01); // transient decays as e^{−bt/2m} = e^{−0.5 t}
      let amp = 0;
      const T = (2 * Math.PI) / w;
      const t0 = d.t;
      while (d.t < t0 + 2 * T) {
        d.step(T / 2000);
        amp = Math.max(amp, Math.abs(d.y[0]));
      }
      expect(Math.abs(amp / steadyAmplitude(m, k, b, 2, w) - 1)).toBeLessThan(0.002);
    }
  });

  it('phase lag is π/2 at ω = ω₀, small below and close to π above', () => {
    expect(phaseLag(m, k, b, 10)).toBeCloseTo(Math.PI / 2, 12);
    expect(phaseLag(m, k, b, 2)).toBeLessThan(0.05);
    expect(phaseLag(m, k, b, 50)).toBeGreaterThan(Math.PI - 0.05);
  });

  it('the resonance peak is at ω_r = √(ω₀² − b²/2m²) and is higher for lighter damping', () => {
    let best = 0;
    let bw = 0;
    for (let w = 5; w < 15; w += 1e-4) {
      const a = steadyAmplitude(m, k, b, 1, w);
      if (a > best) {
        best = a;
        bw = w;
      }
    }
    expect(bw).toBeCloseTo(Math.sqrt(100 - (b * b) / (2 * m * m)), 3);
    expect(steadyAmplitude(m, k, 0.2, 1, 10)).toBeGreaterThan(steadyAmplitude(m, k, 1, 1, 10));
  });
});
