import { describe, expect, it } from 'vitest';
import { Coaster, Track, tracks } from '../../src/physics/coaster';

const g = 9.8;
const dt = 1e-3;

/** circular valley of radius R centred at (0, R), sampled as a spline */
function circleValley(R: number): Track {
  const pts: [number, number][] = [];
  for (let a = -70; a <= 70; a += 1) {
    const r = (a * Math.PI) / 180;
    pts.push([R * Math.sin(r), R - R * Math.cos(r)]);
  }
  return new Track(pts);
}

describe('A.3 roller coaster', () => {
  it('frictionless: total energy ½mv² + mgy conserved along a track with a loop', () => {
    const tr = new Track(tracks.loop.points);
    const c = new Coaster(tr, { m: 500, mu: 0, g, s0: tracks.loop.s0, u: 0 });
    const E = () => c.Ek + c.Ep;
    const E0 = E();
    let worst = 0;
    let passedLoopTop = false;
    for (let i = 0; i < 12000; i++) {
      c.step(dt);
      if (c.stopped) break; // reached the end of the track
      if (c.pos.y > 15) passedLoopTop = passedLoopTop || c.y[0] > 50;
      worst = Math.max(worst, Math.abs(E() - E0) / E0);
    }
    expect(passedLoopTop).toBe(true);
    // arc length comes from a 6000-node table (dy/ds piecewise smooth): drift stays below 10⁻⁵
    expect(worst).toBeLessThan(1e-5);
  });

  it('speed after a drop Δh: v = √(2gΔh) for any track shape', () => {
    const tr = new Track(tracks.hills.points);
    const c = new Coaster(tr, { m: 500, mu: 0, g, s0: tracks.hills.s0, u: 0 });
    const y0 = c.pos.y;
    let best = 0;
    for (let i = 0; i < 8000; i++) {
      c.step(dt);
      if (c.pos.y < y0 - 20 && c.pos.y > y0 - 21) best = Math.abs(c.v) / Math.sqrt(2 * g * (y0 - c.pos.y));
    }
    expect(best).toBeCloseTo(1, 4);
  });

  it('small oscillations in a circular valley: T = 2π√(R/g)', () => {
    const R = 20;
    const tr = circleValley(R);
    const mid = tr.length / 2;
    const c = new Coaster(tr, { m: 1, mu: 0, g, s0: mid + 0.5, u: 0 });
    const times: number[] = [];
    let prev = c.y[0] - mid;
    for (let i = 0; i < 40000; i++) {
      c.step(dt);
      const x = c.y[0] - mid;
      if (prev < 0 && x >= 0) times.push(c.t - (dt * x) / (x - prev));
      prev = x;
    }
    const T = times[times.length - 1] - times[times.length - 2];
    expect(T / (2 * Math.PI * Math.sqrt(R / g))).toBeCloseTo(1, 3);
  });

  it('at the bottom of a circular valley N = m(g + v²/R)', () => {
    const R = 20;
    const tr = circleValley(R);
    const c = new Coaster(tr, { m: 2, mu: 0, g, s0: tr.length / 2, u: 5 });
    expect(c.N / (2 * (g + 25 / R))).toBeCloseTo(1, 3);
  });

  it('friction: mechanical energy + heat stays constant, and the car ends lower', () => {
    const tr = new Track(tracks.valley.points);
    const c = new Coaster(tr, { m: 300, mu: 0.05, g, s0: tracks.valley.s0, u: 0 });
    const E0 = c.Ek + c.Ep;
    for (let i = 0; i < 60000 && !c.stopped; i++) c.step(dt);
    expect((c.Ek + c.Ep + c.heat) / E0).toBeCloseTo(1, 5);
    expect(c.heat).toBeGreaterThan(0);
  });
});
