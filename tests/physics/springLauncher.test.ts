import { describe, expect, it } from 'vitest';
import { SpringLauncher } from '../../src/physics/springLauncher';

const dt = 1e-4;
const base = { k: 400, dx: 0.1, m: 0.05, g: 9.8 };
const run = (s: SpringLauncher, T: number) => {
  for (let i = 0; i < Math.round(T / dt); i++) s.step(dt);
};

describe('A.3 spring launcher & elastic energy', () => {
  it('maximum height above the release point: ½kΔx² = mgH', () => {
    const s = new SpringLauncher(base);
    run(s, 1.5);
    const H = s.maxY + base.dx;
    expect(H / s.predictedRise).toBeCloseTo(1, 10);
  });

  it('launch speed: ½kΔx² = ½mv² + mgΔx', () => {
    const s = new SpringLauncher(base);
    run(s, 0.1);
    const v = Math.sqrt((base.k * base.dx ** 2) / base.m - 2 * base.g * base.dx);
    expect(s.launchSpeed / v).toBeCloseTo(1, 10);
  });

  it('total energy E_k + E_p + E_H conserved over several bounces', () => {
    const s = new SpringLauncher(base);
    const E0 = s.Ek + s.Ep + s.EH;
    let worst = 0;
    for (let i = 0; i < 6e4; i++) {
      s.step(dt);
      worst = Math.max(worst, Math.abs(s.Ek + s.Ep + s.EH - E0) / E0);
    }
    expect(worst).toBeLessThan(1e-10);
  });

  it("Hooke's law: F_H = −kx while compressed", () => {
    const s = new SpringLauncher(base);
    expect(s.springForce).toBeCloseTo(400 * 0.1, 12);
  });

  it('too weak a spring (kΔx < 2mg) does not launch the ball', () => {
    const s = new SpringLauncher({ ...base, k: 5 });
    expect(s.launches).toBe(false);
    run(s, 1);
    expect(s.maxY).toBeLessThan(0);
  });
});
