import { describe, expect, it } from 'vitest';
import { startState, stateAt, energiesAt, GAMMA, type ProcessKind, type ProcessSpec } from '../../src/physics/thermoProcess';
import { R } from '../../src/core/constants';

const n = 1;
const start = startState(n, 2e5, 0.01);
const spec = (kind: ProcessKind): ProcessSpec => ({ kind, n, start, V2: 0.025, T2: 600 });

/** ∫p dV along the path by Simpson's rule */
function workIntegral(sp: ProcessSpec): number {
  const N = 2000;
  let s = 0;
  for (let i = 0; i <= N; i++) {
    const a = stateAt(sp, i / N);
    const w = i === 0 || i === N ? 1 : i % 2 ? 4 : 2;
    s += w * a.p;
  }
  const dV = (stateAt(sp, 1).V - stateAt(sp, 0).V) / N;
  return (s * dV) / 3;
}

describe('B.4 thermodynamic processes (ideal monatomic gas)', () => {
  it('work done by the gas equals the area under the p–V curve for every process', () => {
    for (const k of ['isobaric', 'isochoric', 'isothermal', 'adiabatic'] as ProcessKind[]) {
      const sp = spec(k);
      const W = energiesAt(sp, 1).W;
      const I = workIntegral(sp);
      expect(Math.abs(W - I)).toBeLessThan(1e-6 * Math.max(1, Math.abs(W)));
    }
  });

  it('isothermal: W = nRT ln(V₂/V₁), ΔU = 0; adiabatic: pV^(5/3) constant and Q = 0', () => {
    const iso = energiesAt(spec('isothermal'), 1);
    expect(iso.W).toBeCloseTo(n * R * start.T * Math.log(0.025 / 0.01), 8);
    expect(iso.dU).toBeCloseTo(0, 9);
    const sp = spec('adiabatic');
    for (const s of [0, 0.3, 0.7, 1]) {
      const st = stateAt(sp, s);
      expect(st.p * st.V ** GAMMA).toBeCloseTo(start.p * start.V ** GAMMA, 6);
    }
    expect(energiesAt(sp, 1).Q).toBeCloseTo(0, 9);
  });

  it('first law: Q = ΔU + W, with Q from the molar heat capacities (Cp = 5R/2, Cv = 3R/2)', () => {
    const b = spec('isobaric');
    const e = energiesAt(b, 1);
    expect(e.Q).toBeCloseTo(2.5 * n * R * (stateAt(b, 1).T - start.T), 8);
    const c = spec('isochoric');
    expect(energiesAt(c, 1).Q).toBeCloseTo(1.5 * n * R * (600 - start.T), 8);
    expect(energiesAt(c, 1).W).toBe(0);
  });
});
