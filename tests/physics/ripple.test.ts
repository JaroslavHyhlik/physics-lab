import { describe, expect, it } from 'vitest';
import { RippleTank } from '../../src/physics/ripple';

describe('C.3 ripple tank (2D wave equation)', () => {
  it('a plane wave travels at the set speed: c = fλ within 1 %', () => {
    const c = 0.25;
    // long and tall enough that the measured part never meets waves reflected by the sponge
    const tank = new RippleTank(1.0, 0.3, 0.002, c);
    tank.f = 5; // λ = 5 cm = 25 cells
    tank.sources = [{ kind: 'line', x: 0.06, y: 0, phase: 0 }];
    while (tank.t < 2.8) tank.step(); // front at x ≈ 0.76 m, still inside the tank
    // find successive crests along the middle row, away from the source and the sponge
    const j = Math.round(tank.ny / 2);
    const row = (i: number) => tank.u[j * tank.nx + i];
    let amax = 0;
    for (let i = 60; i < 300; i++) amax = Math.max(amax, Math.abs(row(i)));
    const crests: number[] = [];
    for (let i = 60; i < 300; i++) {
      if (row(i) > row(i - 1) && row(i) >= row(i + 1) && row(i) > 0.3 * amax) {
        // parabolic refinement of the peak
        const a = row(i - 1);
        const b = row(i);
        const d = row(i + 1);
        crests.push(i + (0.5 * (a - d)) / (a - 2 * b + d));
      }
    }
    const lam = ((crests[crests.length - 1] - crests[0]) / (crests.length - 1)) * tank.dx;
    expect(Math.abs((tank.f * lam) / c - 1)).toBeLessThan(0.01);
  });

  it('two point sources: maxima of the time-averaged intensity where the path difference is nλ', () => {
    const c = 0.25;
    const tank = new RippleTank(0.4, 0.4, 0.002, c);
    tank.f = 6.25; // λ = 4 cm
    const d = 0.08;
    tank.sources = [
      { kind: 'point', x: 0.2 - d / 2, y: 0.06, phase: 0 },
      { kind: 'point', x: 0.2 + d / 2, y: 0.06, phase: 0 },
    ];
    while (tank.t < 3.2) tank.step();
    // scan a circle of radius R around the midpoint (intensity averaged over a few cells)
    const R = 0.22;
    const lam = c / tank.f;
    const I = (th: number) => {
      let sum = 0;
      for (const dr of [-0.004, 0, 0.004]) sum += tank.avg[tank.idx(0.2 + (R + dr) * Math.sin(th), 0.06 + (R + dr) * Math.cos(th))];
      return sum;
    };
    // first-order maximum: search a window around the far-field prediction d sinθ = λ
    const pred = Math.asin(lam / d);
    let best = pred;
    for (let th = pred - 0.2; th <= pred + 0.2; th += 0.002) if (I(th) > I(best)) best = th;
    // R is only ~3 d, so the far-field formula is approximate: allow 6 %
    expect(Math.abs(best / pred - 1)).toBeLessThan(0.06);
    // and the first minimum (d sinθ = λ/2) is much darker than the maximum
    expect(I(Math.asin(lam / (2 * d)))).toBeLessThan(0.3 * I(best));
  });
});
