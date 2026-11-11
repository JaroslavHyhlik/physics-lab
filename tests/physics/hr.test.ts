import { describe, expect, it } from 'vitest';
import { T_SUN, bolometric, lumFromRT, msLuminosity, msTemperature, radiusFrom, tempFromBV } from '../../src/physics/hr';
import { NAME, LUM, CI, DIST } from '../../src/data/hyg';

describe('E.5 HR diagram', () => {
  it('radius lines from L = 4πR²σT⁴: the Sun sits at L = L☉, T = 5772 K on the R = R☉ line', () => {
    expect(lumFromRT(1, T_SUN)).toBe(1);
    expect(radiusFrom(1, T_SUN)).toBe(1);
    // ten times the radius at the same T: 100 L☉; twice the temperature at the same R: 16 L☉
    expect(lumFromRT(10, T_SUN)).toBeCloseTo(100, 10);
    expect(lumFromRT(1, 2 * T_SUN)).toBeCloseTo(16, 10);
    expect(radiusFrom(lumFromRT(3.7, 9000), 9000)).toBeCloseTo(3.7, 10);
  });

  it('colour index → temperature: the Sun (B−V = 0.656) ≈ 5770 K; blue stars hotter, red cooler', () => {
    expect(Math.abs(tempFromBV(0.656) / T_SUN - 1)).toBeLessThan(0.01);
    expect(tempFromBV(-0.2)).toBeGreaterThan(12000);
    expect(tempFromBV(1.5)).toBeLessThan(4000);
  });

  it('bolometric correction is 1 for the Sun and raises very hot and very cool stars', () => {
    expect(bolometric(1, T_SUN)).toBeCloseTo(1, 12);
    expect(bolometric(1, 30000)).toBeGreaterThan(5);
    expect(bolometric(1, 3000)).toBeGreaterThan(2);
    expect(bolometric(1, 7000)).toBeLessThan(1.3);
  });

  it('catalogue: the Sun is included with L_V = 1; Sirius is about 25 L☉ at 2.6 pc', () => {
    const sol = NAME.indexOf('Sol');
    expect(sol).toBeGreaterThanOrEqual(0);
    expect(LUM[sol]).toBeCloseTo(1, 2);
    const s = NAME.indexOf('Sirius');
    expect(DIST[s]).toBeCloseTo(2.64, 1);
    expect(LUM[s]).toBeGreaterThan(18);
    expect(LUM[s]).toBeLessThan(30);
    expect(CI[s]).toBeLessThan(0.1);
  });

  it('main sequence: L ∝ M^3.5; heavier stars are hotter', () => {
    expect(msLuminosity(2)).toBeCloseTo(11.31, 2);
    expect(msTemperature(1)).toBeCloseTo(T_SUN, 6);
    expect(msTemperature(5)).toBeGreaterThan(msTemperature(1));
  });
});
