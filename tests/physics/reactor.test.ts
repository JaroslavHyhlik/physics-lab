import { describe, expect, it } from 'vitest';
import {
  BETA,
  GEN_TIME,
  LAMBDA_D,
  T_IN,
  criticalRods,
  kineticsStep,
  precursorsFor,
  reactivity,
  reactorStep,
  stablePeriod,
  type ReactorControls,
  type ReactorState,
} from '../../src/physics/reactor';

/** reference: RK4 with tiny steps on the same equations (no source) */
function rk4(n: number, C: number, rho: number, T: number, h = 1e-5): [number, number] {
  const f = (n: number, C: number): [number, number] => [((rho - BETA) / GEN_TIME) * n + LAMBDA_D * C, (BETA / GEN_TIME) * n - LAMBDA_D * C];
  for (let t = 0; t < T - 1e-12; t += h) {
    const k1 = f(n, C);
    const k2 = f(n + (h / 2) * k1[0], C + (h / 2) * k1[1]);
    const k3 = f(n + (h / 2) * k2[0], C + (h / 2) * k2[1]);
    const k4 = f(n + h * k3[0], C + h * k3[1]);
    n += (h / 6) * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]);
    C += (h / 6) * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]);
  }
  return [n, C];
}

describe('E.4 nuclear reactor (point kinetics)', () => {
  it('k = 1 (ρ = 0): the power stays exactly steady', () => {
    let n = 1;
    let C = precursorsFor(1);
    for (let i = 0; i < 1000; i++) [n, C] = kineticsStep(n, C, 0, 0.05, BETA, LAMBDA_D, GEN_TIME, 0);
    expect(n).toBeCloseTo(1, 10);
  });

  it('the exact step agrees with a fine RK4 solution, for big steps too (stiff equations)', () => {
    for (const rho of [0.002, -0.01]) {
      const ref = rk4(1, precursorsFor(1), rho, 2);
      let n = 1;
      let C = precursorsFor(1);
      for (let i = 0; i < 20; i++) [n, C] = kineticsStep(n, C, rho, 0.1, BETA, LAMBDA_D, GEN_TIME, 0);
      expect(n / ref[0]).toBeCloseTo(1, 6);
    }
  });

  it('pulling rods out a little (ρ = +0.001): prompt jump β/(β − ρ), then growth with the stable period', () => {
    const rho = 0.001;
    let n = 1;
    let C = precursorsFor(1);
    [n, C] = kineticsStep(n, C, rho, 0.2, BETA, LAMBDA_D, GEN_TIME, 0);
    expect(n).toBeCloseTo(BETA / (BETA - rho), 1);
    let n1 = 0;
    for (let i = 0; i < 1000; i++) {
      [n, C] = kineticsStep(n, C, rho, 0.1, BETA, LAMBDA_D, GEN_TIME, 0);
      if (i === 499) n1 = n;
    }
    const T = stablePeriod(rho);
    expect(Math.log(n / n1) / 50).toBeCloseTo(1 / T, 8);
    // one-group estimate T ≈ (β − ρ)/(λρ) ≈ 69 s
    expect(T).toBeGreaterThan(60);
    expect(T).toBeLessThan(75);
  });

  it('dropping the rods (ρ = −0.01): prompt drop to β/(β − ρ), then a slow decay set by the delayed neutrons', () => {
    let n = 1;
    let C = precursorsFor(1);
    [n, C] = kineticsStep(n, C, -0.01, 0.2, BETA, LAMBDA_D, GEN_TIME, 0);
    expect(n).toBeCloseTo(BETA / (BETA + 0.01), 1);
    [n, C] = kineticsStep(n, C, -0.01, 60, BETA, LAMBDA_D, GEN_TIME, 0);
    expect(n).toBeGreaterThan(0.01); // not instant: delayed neutrons keep it going for minutes
    expect(stablePeriod(-0.01)).toBeLessThan(0);
  });

  it('with the negative temperature coefficient the reactor settles where ρ = 0 (self-regulation)', () => {
    const c: ReactorControls = { rods: criticalRods(320), flow: 1, moderator: true, feedback: true };
    const s: ReactorState = { n: 1, C: precursorsFor(1), T: 320, E: 0 };
    expect(reactivity(s, c)).toBeCloseTo(0, 10);
    c.rods -= 0.01; // pull out a little
    for (let i = 0; i < 20000; i++) reactorStep(s, c, 0.05);
    expect(Math.abs(reactivity(s, c))).toBeLessThan(1e-6);
    expect(s.n).toBeGreaterThan(1); // more power, hotter core
    expect(s.T).toBeGreaterThan(320);
    // energy balance at steady state: P = h (T − T_in)
    expect((s.T - T_IN) / 30).toBeCloseTo(s.n, 3);
  });

  it('removing the moderator or a SCRAM shuts the reactor down', () => {
    const s: ReactorState = { n: 1, C: precursorsFor(1), T: 320, E: 0 };
    const c: ReactorControls = { rods: 1, flow: 1, moderator: true, feedback: true };
    for (let i = 0; i < 6000; i++) reactorStep(s, c, 0.05); // 5 minutes
    expect(s.n).toBeLessThan(0.01);
  });
});
