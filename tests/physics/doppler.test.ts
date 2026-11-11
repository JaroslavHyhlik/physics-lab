import { describe, expect, it } from 'vitest';
import { dopplerSource, dopplerObserver, dopplerBoth, machAngle, arrivalTimes, redshiftedLambda } from '../../src/physics/doppler';
import { c } from '../../src/core/constants';

describe('C.5 Doppler effect', () => {
  const f = 440;
  const v = 340;
  it('(HL) moving source: f′ = fv/(v ∓ u_s), checked against the arrival times of wavefronts', () => {
    const us = 40;
    // observer ahead (approaching source) and behind (receding)
    const ahead = arrivalTimes(f, v, 0, us, 1000, 0, 20);
    const behind = arrivalTimes(f, v, 0, us, -1000, 0, 20);
    expect(1 / (ahead[10] - ahead[9])).toBeCloseTo(dopplerSource(f, v, us, true), 9);
    expect(1 / (behind[10] - behind[9])).toBeCloseTo(dopplerSource(f, v, us, false), 9);
  });

  it('(HL) moving observer: f′ = f(v ± u_o)/v; both moving: f(v + u_o)/(v − u_s)', () => {
    const uo = 25;
    const towards = arrivalTimes(f, v, 0, 0, 1000, -uo, 20);
    expect(1 / (towards[5] - towards[4])).toBeCloseTo(dopplerObserver(f, v, uo, true), 9);
    const both = arrivalTimes(f, v, 0, 30, 1000, -uo, 20);
    expect(1 / (both[5] - both[4])).toBeCloseTo(dopplerBoth(f, v, uo, 30), 9);
  });

  it('shock waves: sinθ = v/u_s for a supersonic source; no cone below the speed of sound', () => {
    expect(Math.sin(machAngle(340, 680)!)).toBeCloseTo(0.5, 14);
    expect(machAngle(340, 300)).toBeNull();
  });

  it('redshift: Δλ/λ = v/c for light from a receding galaxy', () => {
    const vg = 0.02 * c;
    const l = redshiftedLambda(656.3, vg, c);
    expect((l - 656.3) / 656.3).toBeCloseTo(0.02, 14);
  });
});
