import { describe, expect, it } from 'vitest';
import { StokesFall, type StokesParams } from '../../src/physics/stokes';

const base: StokesParams = { r: 2e-3, rhoS: 7850, rhoF: 1260, eta: 1.41, g: 9.8, H: 10, u: 0 };
const dt = 1e-4;

describe('A.2 drag, buoyancy and terminal velocity', () => {
  it('terminal velocity v_t = 2r²g(ρ_s − ρ_f)/(9η): drag + buoyancy = weight', () => {
    const b = new StokesFall(base);
    const vt = b.terminalVelocity;
    expect(b.drag(vt) + b.buoyancy).toBeCloseTo(b.weight, 12);
    expect(vt).toBeCloseTo((2 * 4e-6 * 9.8 * 6590) / (9 * 1.41), 12);
  });

  it('velocity follows v = v_t(1 − e^(−t/τ)) from rest', () => {
    const b = new StokesFall(base);
    const T = 5 * b.tau;
    for (let i = 0; i < Math.round(T / dt); i++) b.step(dt);
    expect(b.y[1] / b.exactV(b.t)).toBeCloseTo(1, 9);
  });

  it('a sphere thrown down faster than v_t slows down to v_t', () => {
    const p = { ...base, u: 0.1 };
    const b = new StokesFall(p);
    for (let i = 0; i < Math.round((3 * b.tau) / dt); i++) b.step(dt);
    expect(b.y[1] / b.exactV(b.t)).toBeCloseTo(1, 9);
    expect(b.y[1]).toBeGreaterThan(b.terminalVelocity);
  });

  it('a sphere less dense than the fluid rises (v_t < 0) and stops at the surface', () => {
    const b = new StokesFall({ ...base, rhoS: 240, eta: 1e-3, rhoF: 1000, H: 0.5 });
    expect(b.terminalVelocity).toBeLessThan(0);
    for (let i = 0; i < 2e5 && !b.stopped; i++) b.step(dt);
    expect(b.stopped).toBe(true);
    expect(b.y[0]).toBeCloseTo(2e-3, 12);
  });

  it('equal densities: neutral buoyancy, no motion', () => {
    const b = new StokesFall({ ...base, rhoS: 1260 });
    for (let i = 0; i < 1000; i++) b.step(dt);
    expect(b.y[1]).toBe(0);
  });
});
