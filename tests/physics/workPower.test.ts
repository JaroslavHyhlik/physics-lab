import { describe, expect, it } from 'vitest';
import { Winch, type WorkParams } from '../../src/physics/workPower';

const deg = Math.PI / 180;
const base: WorkParams = { Pin: 2000, eta: 0.8, Fmax: 3000, m: 100, theta: 30 * deg, mu: 0.2, g: 9.8, L: 1000 };
const dt = 1e-3;
const run = (w: Winch, T: number) => {
  for (let i = 0; i < Math.round(T / dt); i++) w.step(dt);
};

describe('A.3 work, power & efficiency', () => {
  it('terminal speed: P = Fv with F = mg(sinθ + μ cosθ)', () => {
    const w = new Winch(base);
    run(w, 30);
    const vt = (0.8 * 2000) / (100 * 9.8 * (0.5 + 0.2 * Math.cos(30 * deg)));
    expect(w.v / vt).toBeCloseTo(1, 8);
    expect(w.force() * w.v).toBeCloseTo(w.Pout, 6);
  });

  it('energy: W_rope = ΔE_k + ΔE_p + friction heat; E_in = W/η', () => {
    const w = new Winch(base);
    run(w, 12);
    expect((w.Ek + w.Ep + w.frictionHeat) / w.work).toBeCloseTo(1, 10);
    expect(w.inputEnergy * 0.8).toBeCloseTo(w.work, 9);
  });

  it('crane (θ = 90°, μ = 0): lifting at constant speed, overall efficiency = η', () => {
    const w = new Winch({ ...base, theta: 90 * deg, mu: 0 });
    run(w, 30);
    expect((w.p.m * w.p.g * w.v) / w.p.Pin).toBeCloseTo(0.8, 8);
  });

  it('starts with constant acceleration while the force limit F_max applies', () => {
    const w = new Winch(base);
    // F_max applies until v = P_out/F_max = 0.53 m s⁻¹ (about 0.023 s)
    run(w, 0.01);
    expect(w.a).toBeCloseTo((3000 - w.resist) / 100, 9);
    expect(w.v).toBeCloseTo(((3000 - w.resist) / 100) * 0.01, 9);
  });

  it('cannot move if F_max is not larger than the resistive force', () => {
    const w = new Winch({ ...base, Fmax: 500 });
    run(w, 2);
    expect(w.s).toBe(0);
  });
});
