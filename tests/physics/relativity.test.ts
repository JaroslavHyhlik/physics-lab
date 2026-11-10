import { describe, expect, it } from 'vitest';
import { gamma, galilean, lorentz, lorentzSI, velocityAdd, interval, axisAngle, muonSurvival, sampleLifetimes, trainTunnel } from '../../src/physics/relativity';
import { c } from '../../src/core/constants';
import { Rng } from '../../src/core/rng';

describe('A.5 relativity', () => {
  it('γ values: γ(0.6) = 1.25, γ(0.8) = 5/3, γ → ∞ as v → c', () => {
    expect(gamma(0.6)).toBeCloseTo(1.25, 14);
    expect(gamma(0.8)).toBeCloseTo(5 / 3, 14);
    expect(gamma(0)).toBe(1);
    expect(gamma(1)).toBe(Infinity);
  });

  it('Galilean: x′ = x − vt, t′ = t; accelerations are the same in both frames', () => {
    expect(galilean(100, 5, 12)).toEqual([40, 5]);
    // x(t) = ½at² in S → x′(t) = ½at² − vt: second difference identical
    const a = 2;
    const v = 7;
    const x = (t: number) => galilean(0.5 * a * t * t, t, v)[0];
    const h = 0.01;
    expect((x(1 + h) - 2 * x(1) + x(1 - h)) / (h * h)).toBeCloseTo(a, 6);
  });

  it('Lorentz transformation: back-and-forth is the identity; interval is invariant', () => {
    const rng = new Rng(11);
    for (let i = 0; i < 200; i++) {
      const x = rng.uniform(-10, 10);
      const ct = rng.uniform(-10, 10);
      const b = rng.uniform(-0.99, 0.99);
      const [x1, ct1] = lorentz(x, ct, b);
      const [x2, ct2] = lorentz(x1, ct1, -b);
      expect(x2).toBeCloseTo(x, 9);
      expect(ct2).toBeCloseTo(ct, 9);
      expect(interval(x1, ct1)).toBeCloseTo(interval(x, ct), 8);
    }
  });

  it('Lorentz reduces to Galilean for v ≪ c', () => {
    const [x, t] = lorentzSI(1000, 2, 30);
    expect(x).toBeCloseTo(1000 - 60, 6);
    expect(t).toBeCloseTo(2, 9);
  });

  it('velocity addition never exceeds c; light has speed c in every frame', () => {
    expect(velocityAdd(0.9, -0.9)).toBeCloseTo(1.8 / 1.81, 14);
    expect(velocityAdd(1, 0.7)).toBeCloseTo(1, 14);
    expect(velocityAdd(-1, 0.3)).toBeCloseTo(-1, 14);
    expect(Math.abs(velocityAdd(0.99, -0.99))).toBeLessThan(1);
  });

  it('time dilation and length contraction follow from the transformation', () => {
    const b = 0.8;
    const g = gamma(b);
    // a clock at rest in S′ (x′ = 0) ticks once: Δt′ = 1 → in S: Δt = γ
    // event (x′=0, ct′=1) seen in S: use the inverse transformation (−β)
    const [, ct] = lorentz(0, 1, -b);
    expect(ct).toBeCloseTo(g, 12);
    // a rod of proper length L0 at rest in S′, measured in S at one instant: L = L0/γ
    const L0 = 3;
    // rod ends in S′: x′ = 0 and x′ = L0; in S at time t = 0: x = x′/γ
    const xEnd = L0 / g;
    expect(lorentz(xEnd, 0, b)[0]).toBeCloseTo(L0, 12);
  });

  it('Minkowski axes: tanθ = v/c', () => {
    expect(Math.tan(axisAngle(0.5))).toBeCloseTo(0.5, 14);
  });

  it('muons: many more survive than the classical estimate', () => {
    const r = muonSurvival(10e3, 0.995, 1.56e-6);
    expect(r.tGround).toBeCloseTo(10e3 / (0.995 * c), 15);
    expect(r.tProper).toBeCloseTo(r.tGround / gamma(0.995), 15);
    expect(r.relativistic).toBeGreaterThan(100 * r.classical);
  });
});

describe('A.5 muon lifetimes (sampling)', () => {
  it('sampled lifetimes: mean τ½/ln2 and half survive one half-life (within 4σ)', () => {
    const n = 20000;
    const t = sampleLifetimes(n, 1.56e-6, new Rng(5));
    const mean = t.reduce((a, b) => a + b, 0) / n;
    const mu = 1.56e-6 / Math.LN2;
    expect(Math.abs(mean - mu)).toBeLessThan((4 * mu) / Math.sqrt(n));
    const alive = t.filter((x) => x > 1.56e-6).length / n;
    expect(Math.abs(alive - 0.5)).toBeLessThan(4 * Math.sqrt(0.25 / n));
  });
});

describe('A.5 train in a tunnel (length contraction)', () => {
  it('lengths contract by γ in the other frame; doors simultaneous in S, not in S′', () => {
    const b = 0.8;
    const L0 = 100;
    const T0 = 80;
    const r = trainTunnel(b, L0, T0);
    expect(r.trainInS).toBeCloseTo(60, 12);
    expect(r.tunnelInSp).toBeCloseTo(48, 12);
    expect(r.fits).toBe(true);
    // the exit door closes earlier in S′ by γβT0 (relativity of simultaneity)
    expect(r.entranceSp[1] - r.exitSp[1]).toBeCloseTo(r.gamma * b * T0, 10);
    // door events lie on the moving tunnel ends in S′
    expect(r.entranceSp[0]).toBeCloseTo(r.entranceSpAt(r.entranceSp[1]), 10);
    expect(r.exitSp[0]).toBeCloseTo(r.exitSpAt(r.exitSp[1]), 10);
    // no paradox: in S′ the train (x′ from −L0 to 0) is not at either door when it closes
    expect(r.exitSp[0]).toBeGreaterThan(0); // front has not reached the exit yet
    expect(r.entranceSp[0]).toBeLessThan(-L0); // rear is already past the entrance
  });

  it('the train does not fit at low speed', () => {
    expect(trainTunnel(0.3, 100, 80).fits).toBe(false);
  });
});
