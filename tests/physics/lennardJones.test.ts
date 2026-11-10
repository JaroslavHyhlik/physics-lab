import { describe, expect, it } from 'vitest';
import { MDSystem, ARGON } from '../../src/physics/lennardJones';

const E = (s: MDSystem) => s.KE + s.PE;

describe('B.1 particle model (2D Lennard-Jones MD)', () => {
  it('force between two atoms is zero at r = 2^(1/6)σ, repulsive closer, attractive further', () => {
    const s = new MDSystem({ N: 2, boxSigma: 20, seed: 1, T0: 1, start: 'gas' });
    const a = (r: number) => {
      s.x[0] = 10 * ARGON.sigma;
      s.y[0] = 10 * ARGON.sigma;
      s.x[1] = s.x[0] + r * ARGON.sigma;
      s.y[1] = s.y[0];
      s.forces();
      return s.ax[1];
    };
    expect(Math.abs(a(Math.pow(2, 1 / 6)))).toBeLessThan(1e-6 * Math.abs(a(1.0)));
    expect(a(1.0)).toBeGreaterThan(0); // pushed away
    expect(a(1.5)).toBeLessThan(0); // pulled back
  });

  it('isolated system: total energy is conserved (velocity Verlet)', () => {
    const s = new MDSystem({ N: 120, boxSigma: 20, seed: 3, T0: 90, start: 'gas' });
    const E0 = E(s);
    let maxErr = 0;
    let keSum = 0;
    for (let i = 0; i < 5000; i++) {
      s.step();
      maxErr = Math.max(maxErr, Math.abs(E(s) - E0));
      keSum += s.KE;
    }
    // bounded energy error: below 0.5 % of the mean kinetic energy
    expect(maxErr).toBeLessThan(0.005 * (keSum / 5000));
  });

  it('equipartition in 2D: ⟨vx²⟩ = ⟨vy²⟩ and speeds follow Maxwell–Boltzmann (⟨v⁴⟩/⟨v²⟩² = 2)', () => {
    const s = new MDSystem({ N: 200, boxSigma: 45, seed: 5, T0: 250, start: 'gas' });
    for (let i = 0; i < 3000; i++) s.step();
    let sx = 0;
    let sy = 0;
    let s4 = 0;
    let n = 0;
    for (let k = 0; k < 300; k++) {
      for (let i = 0; i < 25; i++) s.step();
      for (let i = 0; i < s.N; i++) {
        const a = s.vx[i] ** 2;
        const b = s.vy[i] ** 2;
        sx += a;
        sy += b;
        s4 += (a + b) ** 2;
        n++;
      }
    }
    const mx = sx / n;
    const my = sy / n;
    // 60 000 samples (partly correlated): relative σ of ⟨vx²⟩ ≈ √2/√(n_eff); allow 4 % (≈ 4σ for n_eff ≈ 20 000)
    expect(Math.abs(mx / my - 1)).toBeLessThan(0.04);
    const v2 = mx + my;
    expect(Math.abs(s4 / n / (v2 * v2) - 2)).toBeLessThan(0.1);
  });

  it('thermostat brings the temperature to the target', () => {
    const s = new MDSystem({ N: 150, boxSigma: 25, seed: 7, T0: 30, start: 'solid' });
    s.mode = 'thermostat';
    s.Ttarget = 80;
    for (let i = 0; i < 4000; i++) s.step();
    let sum = 0;
    for (let i = 0; i < 1000; i++) {
      s.step();
      sum += s.T;
    }
    expect(Math.abs(sum / 1000 / 80 - 1)).toBeLessThan(0.03);
  });

  it('constant heating power: energy rises by P·N·t', () => {
    const s = new MDSystem({ N: 100, boxSigma: 20, seed: 9, T0: 20, start: 'solid' });
    s.mode = 'power';
    s.power = (0.05 * ARGON.epsilon) / (0.004 * 2.16e-12) / 100; // small rate per particle
    const E0 = E(s);
    for (let i = 0; i < 2000; i++) s.step();
    expect(Math.abs(s.heatIn / (s.power * s.N * s.t) - 1)).toBeLessThan(1e-9);
    expect(Math.abs((E(s) - E0) / s.heatIn - 1)).toBeLessThan(0.01);
  });

  it('a cold crystal has ~6 close neighbours; a hot dilute gas almost none', () => {
    const solid = new MDSystem({ N: 150, boxSigma: 25, seed: 11, T0: 10, start: 'solid' });
    for (let i = 0; i < 500; i++) solid.step();
    expect(solid.neighbours()).toBeGreaterThan(5);
    const gas = new MDSystem({ N: 100, boxSigma: 45, seed: 12, T0: 400, start: 'gas' });
    for (let i = 0; i < 500; i++) gas.step();
    expect(gas.neighbours()).toBeLessThan(1);
  });
});
