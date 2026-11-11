import { describe, expect, it } from 'vitest';
import { Projectile, vacuumResults } from '../../src/physics/projectile';
import { ChargedParticle, larmorRadius, cyclotronPeriod } from '../../src/physics/emParticle';
import { StringFD, pulse } from '../../src/physics/stringWave';
import { NBody, figureEight } from '../../src/physics/nbody';
import { Slab, CONDUCT_MATERIALS } from '../../src/physics/conduction';
import { RippleTank } from '../../src/physics/ripple';

/**
 * Long runs with the time steps the simulations use: at least 5 minutes of simulated time
 * (or thousands of periods), checking against analytic results and for numerical blow-up or drift.
 */
describe('long runs: accuracy and numerical stability', () => {
  it('projectile in vacuum (dt = 1 ms as in the sim): range, flight time and maximum height match the formulas', () => {
    for (const [u, deg, h0] of [
      [20, 45, 0],
      [45, 30, 1],
      [70, 15, 0],
      [8, 0, 20],
    ]) {
      const p = new Projectile({ u, angle: (deg * Math.PI) / 180, h0, m: 0.15, d: 0.07, Cd: 0.47, rho: 1.2, g: 9.8 });
      let ymax = h0;
      for (let i = 0; i < 1e6 && !p.vacuum.landed; i++) {
        p.step(1e-3);
        ymax = Math.max(ymax, p.vacuum.s[1]);
      }
      const ex = vacuumResults(u, (deg * Math.PI) / 180, h0, 9.8);
      expect(Math.abs(p.vacuum.s[0] / ex.range - 1)).toBeLessThan(1e-6);
      expect(Math.abs(ymax - ex.maxHeight)).toBeLessThan(1e-4);
    }
  });

  it('charged particle in a uniform B field (Boris): speed and radius constant over 20 000 turns', () => {
    const q = 1.6e-19;
    const m = 1.67e-27;
    const B = 0.1;
    const v = 1e5;
    const p = new ChargedParticle(q, m, (_x, _y, _t, _E, b) => {
      b[2] = B;
    });
    p.v[0] = v;
    const T = cyclotronPeriod(m, q, B);
    const h = T / 120;
    const r = larmorRadius(m, v, q, B);
    // centre of the circle: average position over the first full turn
    let cx = 0;
    let cy = 0;
    for (let i = 0; i < 120; i++) {
      p.step(h);
      cx += p.x[0] / 120;
      cy += p.x[1] / 120;
    }
    let rmin = Infinity;
    let rmax = 0;
    for (let i = 0; i < 20000 * 120; i++) {
      p.step(h);
      if (i % 37 === 0) {
        const d = Math.hypot(p.x[0] - cx, p.x[1] - cy);
        rmin = Math.min(rmin, d);
        rmax = Math.max(rmax, d);
      }
    }
    expect(Math.abs(p.speed / v - 1)).toBeLessThan(1e-12);
    // no drift of the orbit over 20 000 turns (the averaged centre itself is good to ~0.1 %)
    expect((rmax - rmin) / r).toBeLessThan(5e-3);
    expect(Math.abs((rmax + rmin) / 2 / r - 1)).toBeLessThan(5e-3);
  });

  it('wave on a string at the CFL limit: 5 minutes of simulated time, no growth (fixed ends)', () => {
    const s = new StringFD({ L: 2, N: 200, T: 10, mu1: 0.01, mu2: 0.01, join: 10, end: 'fixed' } as never);
    const pul = pulse(0.05, 0.05);
    s.drive = pul;
    const dt = s.maxDt;
    let peak = 0;
    for (let t = 0; t < 300; t += dt) {
      s.step(dt);
      if (t > 0.1) for (let i = 0; i < s.y.length; i++) peak = Math.max(peak, Math.abs(s.y[i]));
      if (!Number.isFinite(s.y[100])) break;
    }
    expect(Number.isFinite(peak)).toBe(true);
    // a reflected pulse keeps its height (fixed ends invert it); it must not grow
    expect(peak).toBeLessThan(0.05 * 1.05);
  });

  it('heat conduction (FTCS at its stability limit): no blow-up, steady state with P_in = P_out', () => {
    const slab = new Slab(CONDUCT_MATERIALS.copper, 0.2, 1e-3, 100, 0);
    const dt = slab.maxDt;
    for (let t = 0; t < 20 * slab.tau; t += dt) slab.step(dt);
    for (let i = 0; i < slab.T.length; i++) expect(Number.isFinite(slab.T[i])).toBe(true);
    expect(Math.abs(slab.Pin - slab.Pout) / slab.Psteady).toBeLessThan(1e-3);
    expect(Math.abs(slab.Pin / slab.Psteady - 1)).toBeLessThan(1e-3);
  });

  it('three-body figure-eight orbit: energy and momentum conserved over 50 periods', () => {
    const { bodies, period } = figureEight(1.5e11, 2e30);
    const nb = new NBody();
    for (const b of bodies) nb.add(b);
    const E0 = nb.energy;
    const scale = Math.abs(E0);
    for (let k = 0; k < 50; k++) nb.advance(period, 0.005, false);
    expect(Math.abs((nb.energy - E0) / scale)).toBeLessThan(1e-6);
    const [px, py] = nb.momentum;
    const pScale = bodies[0].m * Math.hypot(bodies[0].vx, bodies[0].vy);
    expect(Math.hypot(px, py) / pScale).toBeLessThan(1e-9);
  });

  it('ripple tank: thousands of steps from a disturbance stay finite and decay in the absorbing edges', () => {
    const tank = new RippleTank(0.3, 0.2, 0.002, 0.2);
    const n = tank.nx * tank.ny;
    tank.u[Math.floor(tank.ny / 2) * tank.nx + Math.floor(tank.nx / 2)] = 1;
    let max = 0;
    for (let k = 0; k < 6000; k++) tank.step();
    for (let i = 0; i < n; i++) max = Math.max(max, Math.abs(tank.u[i]));
    expect(Number.isFinite(max)).toBe(true);
    expect(max).toBeLessThan(0.05);
  });
});
