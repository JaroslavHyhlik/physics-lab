import { describe, expect, it } from 'vitest';
import { ALL, chain, daughter, get, isStable, shift, formatHalfLife } from '../../src/physics/nuclides';

describe('E.3 nuclide chart and decay modes (NUBASE2020)', () => {
  it('every decay conserves nucleon number and charge', () => {
    // emitted particle: [A, charge]; α = ⁴He²⁺, β⁻ = e⁻, β⁺ = e⁺; EC absorbs an electron (charge −1 in)
    const emitted: Record<string, [number, number]> = { A: [4, 2], 'B-': [0, -1], 'B+': [0, 1], EC: [0, -1], n: [1, 0], p: [1, 1] };
    for (const n of ALL) {
      const d = daughter(n);
      if (!d || !(n.mode in emitted)) continue;
      const [a, q] = emitted[n.mode];
      expect(d.A + a).toBe(n.A);
      if (n.mode === 'EC') expect(d.Z).toBe(n.Z + q); // the captured electron's charge cancels a proton's
      else expect(d.Z + q).toBe(n.Z);
    }
  });

  it('the ²³⁸U series ends at stable ²⁰⁶Pb after 8 α and 6 β⁻ decays', () => {
    const c = chain(get(92, 146)!);
    const end = c[c.length - 1];
    expect([end.Z, end.A]).toEqual([82, 206]);
    expect(isStable(end)).toBe(true);
    const modes = c.slice(0, -1).map((n) => n.mode);
    expect(modes.filter((m) => m === 'A').length).toBe(8);
    expect(modes.filter((m) => m === 'B-').length).toBe(6);
  });

  it('known cases: ¹⁴C β⁻ with T½ ≈ 5700 y; ¹⁸F β⁺/EC; ²⁴¹Am α; stable nuclides form the valley', () => {
    const c14 = get(6, 8)!;
    expect(c14.mode).toBe('B-');
    expect(10 ** c14.logT / 3.15576e7).toBeCloseTo(5700, -2);
    expect(['B+', 'EC']).toContain(get(9, 9)!.mode);
    expect(get(95, 146)!.mode).toBe('A');
    expect(formatHalfLife(get(95, 146)!.logT)).toMatch(/years/);
    const stable = ALL.filter(isStable);
    expect(stable.length).toBeGreaterThan(240);
    expect(stable.length).toBeLessThan(300);
    expect(shift('A')).toEqual([-2, -2]);
  });
});
