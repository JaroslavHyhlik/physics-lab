import { describe, expect, it } from 'vitest';
import { stringFreq, pipeFreq, stringShape, pipeDisplacement, pipePressure, stringNodes } from '../../src/physics/standing';

describe('C.4 standing waves', () => {
  it('string: f_n = nv/2L, n + 1 nodes including the fixed ends, λ_n = 2L/n', () => {
    const L = 0.8;
    const v = 120;
    for (let n = 1; n <= 5; n++) {
      expect(stringFreq(n, L, v)).toBeCloseTo((n * v) / (2 * L), 12);
      const nodes = stringNodes(n, L);
      expect(nodes.length).toBe(n + 1);
      for (const x of nodes) expect(Math.abs(stringShape(n, x, L))).toBeLessThan(1e-12);
      expect(v / stringFreq(n, L, v)).toBeCloseTo((2 * L) / n, 12);
    }
  });

  it('pipes: open–open all harmonics nv/2L; open–closed only odd (2n − 1)v/4L', () => {
    const L = 0.5;
    const v = 343;
    expect(pipeFreq('open', 1, L, v)).toBeCloseTo(343, 10);
    expect(pipeFreq('closed', 1, L, v)).toBeCloseTo(171.5, 10);
    expect(pipeFreq('closed', 2, L, v) / pipeFreq('closed', 1, L, v)).toBeCloseTo(3, 12);
  });

  it('boundary conditions: displacement antinodes and pressure nodes at open ends; displacement node at a closed end', () => {
    const L = 1;
    for (let n = 1; n <= 4; n++) {
      expect(Math.abs(pipeDisplacement('open', n, 0, L))).toBeCloseTo(1, 12);
      expect(Math.abs(pipeDisplacement('open', n, L, L))).toBeCloseTo(1, 12);
      expect(pipePressure('open', n, 0, L)).toBeCloseTo(0, 12);
      expect(pipeDisplacement('closed', n, L, L)).toBeCloseTo(0, 12);
      expect(Math.abs(pipePressure('closed', n, L, L))).toBeCloseTo(1, 12);
    }
  });

  it('two opposite travelling waves add up to a standing wave', () => {
    const k = 3;
    const w = 7;
    for (const [x, t] of [[0.2, 0.1], [1.3, 0.77]]) {
      expect(Math.sin(w * t - k * x) + Math.sin(w * t + k * x)).toBeCloseTo(2 * Math.cos(k * x) * Math.sin(w * t), 12);
    }
  });
});
