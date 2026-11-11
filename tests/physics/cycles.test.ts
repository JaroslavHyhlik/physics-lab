import { describe, expect, it } from 'vitest';
import { buildCycle, summarize, cycleState, type CycleKind } from '../../src/physics/cycles';
import { GAMMA, stateAt, energiesAt } from '../../src/physics/thermoProcess';

const P = { n: 1, Th: 800, Tc: 300, V1: 0.005, ratio: 3 };

/** enclosed area by the shoelace formula along the closed path */
function area(kind: CycleKind): number {
  const legs = buildCycle(kind, P);
  const N = 4000;
  let a = 0;
  let prev = cycleState(legs, 0);
  for (let i = 1; i <= N; i++) {
    const s = cycleState(legs, (legs.length * i) / N);
    a += (prev.V * s.p - s.V * prev.p) / 2;
    prev = s;
  }
  return -a; // clockwise cycle on a p–V diagram → positive work
}

describe('B.4 heat engines', () => {
  it('every cycle returns to its starting state (ΔU over a cycle = 0)', () => {
    for (const k of ['carnot', 'otto', 'stirling'] as CycleKind[]) {
      const legs = buildCycle(k, P);
      const a = stateAt(legs[0].spec, 0);
      const b = stateAt(legs[legs.length - 1].spec, 1);
      expect(b.V / a.V).toBeCloseTo(1, 10);
      expect(b.T / a.T).toBeCloseTo(1, 10);
      const dU = legs.reduce((s, l) => s + energiesAt(l.spec, 1).dU, 0);
      expect(Math.abs(dU)).toBeLessThan(1e-8);
    }
  });

  it('net work = area enclosed by the cycle', () => {
    for (const k of ['carnot', 'otto', 'stirling'] as CycleKind[]) {
      const W = summarize(buildCycle(k, P)).Wnet;
      expect(Math.abs(area(k) / W - 1)).toBeLessThan(1e-4);
    }
  });

  it('Carnot: η = 1 − T_c/T_h; Otto: η = 1 − r^(1−γ); every engine is below the Carnot limit', () => {
    const c = summarize(buildCycle('carnot', P));
    expect(c.efficiency).toBeCloseTo(1 - 300 / 800, 10);
    const o = summarize(buildCycle('otto', { ...P, Th: 2000, ratio: 8 }));
    expect(o.efficiency).toBeCloseTo(1 - Math.pow(8, 1 - GAMMA), 10);
    expect(o.efficiency).toBeLessThan(o.carnot);
    const s = summarize(buildCycle('stirling', P));
    expect(s.efficiency).toBeLessThan(s.carnot);
    expect(s.Qin - s.Qout).toBeCloseTo(s.Wnet, 8);
  });
});
