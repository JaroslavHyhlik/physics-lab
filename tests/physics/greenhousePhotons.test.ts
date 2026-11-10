import { describe, expect, it } from 'vitest';
import { GreenhouseBox, SUN_RATE } from '../../src/physics/greenhousePhotons';

function run(albedo: number, molecules: number, seconds: number, seed = 3) {
  const b = new GreenhouseBox(albedo, molecules, 1.3, 255, seed);
  const dt = 1 / 120;
  let Tsum = 0;
  let n = 0;
  const half = seconds / 2;
  while (b.t < seconds) {
    b.step(dt);
    if (b.t > half) {
      Tsum += b.T;
      n++;
    }
  }
  return { b, Tmean: Tsum / n };
}

describe('B.2 greenhouse photons', () => {
  it('energy is conserved exactly: in = reflected + infrared out + stored + in flight', () => {
    const { b } = run(0.3, 40, 60);
    expect(b.imbalance).toBe(0);
    const w = new GreenhouseBox(0.3, 40);
    w.warmUp(8);
    expect(w.imbalance).toBe(0);
    for (let i = 0; i < 2000; i++) w.step(1 / 120);
    expect(w.imbalance).toBe(0);
    expect(b.sunIn).toBeGreaterThan(0.9 * SUN_RATE * 60);
  });

  it('without greenhouse molecules the ground settles near 255 K (α = 0.3)', () => {
    const { Tmean } = run(0.3, 0, 400);
    // shot noise of ~11 000 packets: about 1 % in power, ¼ % in T; allow 2 %
    expect(Math.abs(Tmean / 255 - 1)).toBeLessThan(0.02);
  });

  it('steady state: power out at the top equals power in; more molecules → warmer ground', () => {
    const a = run(0.3, 0, 300);
    const g = run(0.3, 60, 300);
    expect(g.Tmean).toBeGreaterThan(a.Tmean + 5);
    const outFrac = (g.b.reflectedOut + g.b.irOut) / g.b.sunIn;
    expect(Math.abs(outFrac - 1)).toBeLessThan(0.05); // most of the warm-up is done early
  });
});
