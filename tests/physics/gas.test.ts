import { describe, expect, it } from 'vitest';
import { Gas3D } from '../../src/physics/gas';
import { k_B } from '../../src/core/constants';

const nm = 1e-9;
const make = (T0 = 300, counts: Record<string, number> = { He: 300 }) => new Gas3D({ counts, L: 30 * nm, Lx: 30 * nm, T0, seed: 4 });

describe('B.3 gas in a container (kinetic model)', () => {
  it('insulated box: the total kinetic energy is conserved (elastic collisions, speed-preserving walls)', () => {
    const g = make(300, { He: 150, Ar: 150 });
    const E0 = g.KE;
    for (let i = 0; i < 20000; i++) g.step();
    expect(g.collisions).toBeGreaterThan(0);
    expect(Math.abs(g.KE / E0 - 1)).toBeLessThan(1e-10);
  });

  it('pressure from wall impacts agrees with p = NkT/V (kinetic theory)', () => {
    const g = make(300);
    for (let i = 0; i < 200000; i++) g.step();
    const p = g.impulseTotal / g.areaTime;
    // ≈ 2 × 10⁴ wall hits: statistical error ≈ 1 %; allow 4 % (4σ). Hard-sphere correction ≈ 0.04 %.
    expect(Math.abs(p / g.pIdeal - 1)).toBeLessThan(0.04);
    // and ⟨½mv²⟩ = (3/2)kT ⇔ p = ⅓ρ⟨v²⟩ with ρ = Nm/V
    let v2 = 0;
    for (let i = 0; i < g.N; i++) v2 += g.vx[i] ** 2 + g.vy[i] ** 2 + g.vz[i] ** 2;
    const rho = (g.N * g.m[0]) / g.V;
    expect(((rho * v2) / g.N / 3) / g.pIdeal).toBeCloseTo(1, 12);
  });

  it('heat bath: the gas reaches the bath temperature and Q = ΔU', () => {
    const g = make(300);
    g.bath = true;
    g.Tbath = 600;
    const U0 = g.KE;
    for (let i = 0; i < 150000; i++) g.step();
    let s = 0;
    for (let i = 0; i < 50000; i++) {
      g.step();
      s += g.T;
    }
    expect(Math.abs(s / 50000 / 600 - 1)).toBeLessThan(0.05);
    expect(Math.abs((g.KE - U0) / g.Q - 1)).toBeLessThan(1e-9);
  });

  it('insulated compression: ΔU = W done by the piston, and TV^(2/3) stays constant (slow piston)', () => {
    const g = make(300);
    g.pistonSpeedMax = 20;
    g.LxTarget = 15 * nm;
    const U0 = g.KE;
    const c0 = g.T * Math.pow(g.V, 2 / 3);
    while (Math.abs(g.Lx - g.LxTarget) > 1e-15) g.step();
    for (let i = 0; i < 20000; i++) g.step();
    expect(Math.abs((g.KE - U0) / g.W - 1)).toBeLessThan(1e-9);
    expect(g.T).toBeGreaterThan(400);
    // adiabatic for a monatomic gas: γ = 5/3, TV^{γ−1} constant; slow but finite speed: allow 5 %
    expect(Math.abs((g.T * Math.pow(g.V, 2 / 3)) / c0 - 1)).toBeLessThan(0.05);
  });

  it('temperature definition: ⟨½mv²⟩ = (3/2)k_BT', () => {
    const g = make(250);
    expect((g.KE / g.N) / (1.5 * k_B * g.T)).toBeCloseTo(1, 12);
  });
});
