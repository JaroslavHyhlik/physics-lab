import { describe, expect, it } from 'vitest';
import { A_SUN, OneZoneStar, accel, smallOscillationOmega2 } from '../../src/physics/stellarEquilibrium';

describe('E.5 stellar equilibrium (one-zone model)', () => {
  it('x = 1 is an equilibrium: pressure balances gravity and nothing moves', () => {
    expect(accel(1, 5 / 3, A_SUN)).toBe(0);
    const s = new OneZoneStar(1);
    for (let i = 0; i < 1000; i++) s.step(60);
    expect(s.x).toBe(1);
  });

  it('γ = 5/3: a small squeeze oscillates with ω² = A(3γ − 4), and energy is conserved', () => {
    const gamma = 5 / 3;
    const s = new OneZoneStar(0.99, gamma);
    const E0 = s.energy();
    const w = Math.sqrt(smallOscillationOmega2(gamma, A_SUN));
    const T = (2 * Math.PI) / w;
    const dt = T / 2000;
    // time between successive maxima of x (start is a minimum)
    let prev = s.x;
    let rising = false;
    const maxima: number[] = [];
    while (s.t < 3.2 * T) {
      s.step(dt);
      if (s.x > prev) rising = true;
      else if (rising) {
        maxima.push(s.t - dt);
        rising = false;
      }
      prev = s.x;
    }
    expect(Math.abs((maxima[2] - maxima[1]) / T - 1)).toBeLessThan(0.005);
    expect(Math.abs((s.energy() - E0) / E0)).toBeLessThan(1e-7);
    // the Sun's fundamental period in this model is a few hours
    expect(T / 3600).toBeGreaterThan(1);
    expect(T / 3600).toBeLessThan(5);
  });

  it('γ < 4/3 (radiation-dominated): a small disturbance grows, the star is unstable', () => {
    const s = new OneZoneStar(0.99, 1.25);
    for (let i = 0; i < 200000 && s.x > 0.3; i++) s.step(20);
    expect(s.x).toBeLessThan(0.5);
  });
});
