import { describe, expect, it } from 'vitest';
import { lampI, lampT, lampR, LAMP, LAMP_RCOLD, diodeI, DIODE } from '../../src/physics/components';

describe('B.5 I–V characteristics', () => {
  it('filament lamp: rated 12 V gives 2 A (24 W) at 2700 K; R = V/I matches R(T)', () => {
    expect(lampT(12)).toBeCloseTo(LAMP.Thot, 6);
    expect(lampI(12)).toBeCloseTo(2, 8);
    for (const V of [0.5, 2, 6, 10]) expect(V / lampI(V)).toBeCloseTo(lampR(lampT(V)), 9);
  });

  it('lamp is non-ohmic: resistance rises with current; near 0 V it tends to the cold resistance; symmetric', () => {
    let prevR = 0;
    for (const V of [0.01, 1, 3, 6, 9, 12]) {
      const R = V / lampI(V);
      expect(R).toBeGreaterThan(prevR);
      prevR = R;
    }
    expect(0.001 / lampI(0.001)).toBeCloseTo(LAMP_RCOLD, 3);
    expect(lampI(-5)).toBeCloseTo(-lampI(5), 12);
  });

  it('diode follows the Shockley equation: zero at 0 V, tiny reverse current, exponential forward', () => {
    expect(diodeI(0)).toBe(0);
    expect(diodeI(-1)).toBeCloseTo(-DIODE.Is, 15);
    const a = diodeI(0.6);
    const b = diodeI(0.6 + DIODE.n * DIODE.VT);
    expect(b / a).toBeCloseTo(Math.E, 3);
    expect(diodeI(0.7)).toBeGreaterThan(0.02); // conducts well near 0.7 V
  });
});
