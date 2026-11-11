import { describe, expect, it } from 'vitest';
import { L_SUN, brightness, distanceFrom, luminosity, R_SUN } from '../../src/physics/luminosity';
import { AU, S_solar, sigma } from '../../src/core/constants';

describe('E.5 luminosity and apparent brightness', () => {
  it('L = σAT⁴: the Sun gives about 3.8 × 10²⁶ W', () => {
    expect(L_SUN).toBeCloseTo(4 * Math.PI * R_SUN ** 2 * sigma * 5772 ** 4, -20);
    expect(L_SUN / 3.83e26).toBeCloseTo(1, 1);
  });

  it('b = L/(4πd²): at 1 AU this is the solar constant ≈ 1.36 kW m⁻²', () => {
    expect(Math.abs(brightness(L_SUN, AU) / S_solar - 1)).toBeLessThan(0.01);
  });

  it('inverse square law, and d = √(L/4πb) recovers the distance', () => {
    expect(brightness(L_SUN, 2 * AU) / brightness(L_SUN, AU)).toBeCloseTo(0.25, 12);
    expect(distanceFrom(L_SUN, brightness(L_SUN, 3.2e17)) / 3.2e17).toBeCloseTo(1, 12);
  });

  it('doubling T multiplies L by 16; doubling R by 4', () => {
    expect(luminosity(2, 2000) / luminosity(2, 1000)).toBeCloseTo(16, 10);
    expect(luminosity(4, 1000) / luminosity(2, 1000)).toBeCloseTo(4, 10);
  });
});
