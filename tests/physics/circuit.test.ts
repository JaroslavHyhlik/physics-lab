import { describe, expect, it } from 'vitest';
import { solveCircuit, ldrR, thermistorR, type El, type Env } from '../../src/physics/circuit';
import { lampI } from '../../src/physics/components';

const env: Env = { lux: 100, tempC: 25, realMeters: false };
let id = 0;
const el = (kind: El['kind'], a: number, b: number, extra: Partial<El> = {}): El => ({ id: ++id, kind, a, b, ...extra });

/** KCL at every point: total current leaving through all elements is zero */
function kclResidual(n: number, els: El[], sol: ReturnType<typeof solveCircuit>): number {
  const sum = new Float64Array(n);
  let scale = 0;
  for (const e of els) {
    const r = sol.els.get(e.id)!;
    sum[e.a] += r.I;
    sum[e.b] -= r.I;
    scale = Math.max(scale, Math.abs(r.I));
  }
  return Math.max(...sum.map(Math.abs)) / Math.max(scale, 1e-300);
}

describe('B.5 circuit solver (modified nodal analysis)', () => {
  it('series circuit: I = ε/(R₁ + R₂ + r); KCL holds; terminal p.d. = ε − Ir', () => {
    const els = [el('cell', 0, 1, { emf: 6, r: 1 }), el('wire', 1, 2), el('resistor', 2, 3, { R: 2 }), el('resistor', 3, 4, { R: 3 }), el('wire', 4, 0)];
    const s = solveCircuit(5, els, env);
    expect(s.ok).toBe(true);
    expect(s.els.get(els[0].id)!.I).toBeCloseTo(1, 12);
    expect(s.els.get(els[2].id)!.I).toBeCloseTo(1, 12);
    expect(s.phi[1] - s.phi[0]).toBeCloseTo(5, 12); // ε − Ir
    expect(kclResidual(5, els, s)).toBeLessThan(1e-12);
  });

  it('parallel resistors: currents split as 1/R; ideal ammeter reads the total', () => {
    // cell 0→1, ammeter 1→2, R=6 and R=3 from 2 to 3 (two paths via points 4,5), wire 3→0
    const els = [
      el('cell', 0, 1, { emf: 12, r: 0 }),
      el('ammeter', 1, 2),
      el('resistor', 2, 3, { R: 6 }),
      el('wire', 2, 4),
      el('resistor', 4, 5, { R: 3 }),
      el('wire', 5, 3),
      el('wire', 3, 0),
    ];
    const s = solveCircuit(6, els, env);
    expect(s.els.get(els[2].id)!.I).toBeCloseTo(2, 12);
    expect(s.els.get(els[4].id)!.I).toBeCloseTo(4, 12);
    expect(s.els.get(els[1].id)!.I).toBeCloseTo(6, 12);
    expect(kclResidual(6, els, s)).toBeLessThan(1e-12);
  });

  it('KVL around a loop and power balance: Σ I²R = εI − I²r', () => {
    const els = [el('cell', 0, 1, { emf: 9, r: 0.5 }), el('resistor', 1, 2, { R: 4 }), el('lamp', 2, 3), el('resistor', 3, 0, { R: 1.5 })];
    const s = solveCircuit(4, els, env);
    const I = s.els.get(els[0].id)!.I;
    const drops = els.slice(1).reduce((t, e) => t + s.els.get(e.id)!.V, 0);
    expect(drops).toBeCloseTo(9 - I * 0.5, 10); // KVL
    const Pdiss = els.slice(1).reduce((t, e) => t + s.els.get(e.id)!.P, 0);
    expect(Pdiss).toBeCloseTo(9 * I - I * I * 0.5, 9);
    // the lamp is on its own I–V curve
    const lamp = s.els.get(els[2].id)!;
    expect(lamp.I).toBeCloseTo(lampI(lamp.V), 9);
  });

  it('potential divider and balanced Wheatstone bridge (no current through the middle)', () => {
    const div = [el('cell', 0, 1, { emf: 10, r: 0 }), el('resistor', 1, 2, { R: 3000 }), el('resistor', 2, 0, { R: 2000 }), el('voltmeter', 2, 0)];
    const d = solveCircuit(3, div, env);
    expect(d.els.get(div[3].id)!.V).toBeCloseTo(4, 12);
    // bridge: top node 1, bottom 0; left 1–2–0 (100, 200), right 1–3–0 (50, 100): balanced
    const br = [
      el('cell', 0, 1, { emf: 6, r: 0.2 }),
      el('resistor', 1, 2, { R: 100 }),
      el('resistor', 2, 0, { R: 200 }),
      el('resistor', 1, 3, { R: 50 }),
      el('resistor', 3, 0, { R: 100 }),
      el('ammeter', 2, 3),
    ];
    const b = solveCircuit(4, br, env);
    expect(Math.abs(b.els.get(br[5].id)!.I)).toBeLessThan(1e-12);
  });

  it('short circuit of an ideal cell is reported; floating parts do not break the solve', () => {
    const sc = [el('cell', 0, 1, { emf: 1.5, r: 0 }), el('wire', 1, 0)];
    expect(solveCircuit(2, sc, env).ok).toBe(false);
    const fl = [el('resistor', 0, 1, { R: 10 })];
    expect(solveCircuit(2, fl, env).ok).toBe(true);
  });

  it('LDR resistance falls with light; thermistor resistance falls with temperature', () => {
    expect(ldrR(10)).toBeCloseTo(1e4, 6);
    expect(ldrR(1000)).toBeLessThan(ldrR(10));
    expect(thermistorR(25)).toBeCloseTo(1e4, 6);
    expect(thermistorR(80)).toBeLessThan(thermistorR(25));
  });
});
