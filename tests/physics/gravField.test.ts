import { describe, expect, it } from 'vitest';
import { gField, gPotential, neutralPoint } from '../../src/physics/gravField';
import { G } from '../../src/core/constants';

const ME = 5.97e24;
const MM = 7.35e22;
const D = 3.84e8;

describe('D.1 gravitational field and potential', () => {
  it('one mass: g = GM/r² towards it, V = −GM/r', () => {
    const ms = [{ x: 0, y: 0, M: ME }];
    const [gx, gy] = gField(ms, 7e6, 0);
    expect(gx).toBeCloseTo((-G * ME) / 7e6 ** 2, 10);
    expect(gy).toBe(0);
    expect(gPotential(ms, 7e6, 0)).toBeCloseTo((-G * ME) / 7e6, 6);
  });

  it('superposition, and g = −ΔV/Δr', () => {
    const a = { x: 0, y: 0, M: ME };
    const b = { x: D, y: 0, M: MM };
    const [gx, gy] = gField([a, b], 1e8, 5e7);
    const [ax, ay] = gField([a], 1e8, 5e7);
    const [bx, by] = gField([b], 1e8, 5e7);
    expect(gx).toBeCloseTo(ax + bx, 14);
    expect(gy).toBeCloseTo(ay + by, 14);
    const h = 1e3;
    const dVdx = (gPotential([a, b], 1e8 + h, 5e7) - gPotential([a, b], 1e8 - h, 5e7)) / (2 * h);
    const dVdy = (gPotential([a, b], 1e8, 5e7 + h) - gPotential([a, b], 1e8, 5e7 - h)) / (2 * h);
    expect(-dVdx / gx).toBeCloseTo(1, 6);
    expect(-dVdy / gy).toBeCloseTo(1, 6);
  });

  it('Earth–Moon neutral point: g = 0 at r₁/r₂ = √(M₁/M₂) (about 0.9 of the way to the Moon)', () => {
    const r1 = neutralPoint(ME, MM, D);
    const [gx] = gField([{ x: 0, y: 0, M: ME }, { x: D, y: 0, M: MM }], r1, 0);
    expect(Math.abs(gx) / ((G * ME) / r1 ** 2)).toBeLessThan(1e-12);
    expect(r1 / D).toBeCloseTo(0.9, 2);
  });
});
