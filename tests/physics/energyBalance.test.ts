import { describe, expect, it } from 'vitest';
import { EnergyBalance, equilibriumT, YEAR } from '../../src/physics/energyBalance';
import { S_solar } from '../../src/core/constants';

describe('B.2 planetary energy balance', () => {
  it('Earth without greenhouse effect: α = 0.3, ε = 1 → about 255 K', () => {
    const T = equilibriumT(S_solar, 0.3, 1);
    expect(T).toBeGreaterThan(254);
    expect(T).toBeLessThan(256);
    // hand calculation with booklet values
    expect(T).toBeCloseTo(Math.pow((0.7 * 1360) / (4 * 5.67e-8), 0.25), 10);
  });

  it('a lower emissivity (greenhouse) warms the planet: ε ≈ 0.61 gives about 288 K', () => {
    const T = equilibriumT(S_solar, 0.3, 0.61);
    expect(Math.abs(T - 288)).toBeLessThan(1.5);
  });

  it('the temperature relaxes to equilibrium with time constant C/(4εσT³)', () => {
    const p = new EnergyBalance(S_solar, 0.3, 0.61, 4.2e8, 270);
    const Te = equilibriumT(S_solar, 0.3, 0.61);
    const dt = 0.01 * YEAR;
    // after one time constant the (small) difference has shrunk to about 1/e
    const steps = Math.round(p.tau / dt);
    for (let i = 0; i < steps; i++) p.step(dt);
    const ratio = (Te - p.T) / (Te - 270);
    expect(Math.abs(ratio - Math.exp(-1))).toBeLessThan(0.03); // non-linear T⁴: a few % from the linear estimate
    for (let i = 0; i < 20 * steps; i++) p.step(dt);
    expect(p.T).toBeCloseTo(Te, 6);
  });

  it('energy stored = energy absorbed − energy emitted', () => {
    const p = new EnergyBalance(S_solar, 0.3, 1, 4.2e8, 200);
    for (let i = 0; i < 2000; i++) p.step(0.005 * YEAR);
    expect(p.C * (p.T - 200)).toBeCloseTo(p.Ein - p.Eout, -4); // J m⁻², values ~1e10
    expect(Math.abs((p.C * (p.T - 200)) / (p.Ein - p.Eout) - 1)).toBeLessThan(1e-6);
  });
});
