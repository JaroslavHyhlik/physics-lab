import { describe, expect, it } from 'vitest';
import { mutualInductanceLoops, fluxFromMagnet, emfMagnetCoil, generatorEmf, rodOnRails, type MagnetModel } from '../../src/physics/induction';
import { loopField } from '../../src/physics/magnet';

describe('D.4 induction', () => {
  it('mutual inductance formula equals the flux of the exact loop field through the other loop', () => {
    const R = 0.02;
    const a = 0.01;
    // (d = 0 is avoided: there the field is singular at the wire and the check integral converges slowly)
    for (const d of [0.005, 0.01, 0.04]) {
      // Φ = ∫₀^R B_axial(ρ) 2πρ dρ for I = 1 A (midpoint rule)
      let phi = 0;
      const n = 4000;
      for (let i = 0; i < n; i++) {
        const rho = ((i + 0.5) / n) * R;
        phi += loopField(a, 1, d, rho)[0] * 2 * Math.PI * rho * (R / n);
      }
      expect(mutualInductanceLoops(R, a, d) / phi).toBeCloseTo(1, 4);
    }
  });

  it("Faraday: emf = −N dΦ/dt agrees with the numerical derivative of the flux along a motion", () => {
    const mag: MagnetModel = { a: 0.008, length: 0.04, loops: 30, I: 300 };
    const R = 0.02;
    const N = 100;
    const v = 0.5;
    const x = (t: number) => -0.1 + v * t;
    const scale = Math.abs(emfMagnetCoil(mag, R, N, x(0.15), v));
    for (const t of [0.1, 0.15, 0.2, 0.25]) {
      const dt = 1e-6;
      const dPhidt = (fluxFromMagnet(mag, R, x(t + dt)) - fluxFromMagnet(mag, R, x(t - dt))) / (2 * dt);
      // compared on an absolute scale: at t = 0.2 s the magnet is centred and both are zero
      expect(Math.abs(emfMagnetCoil(mag, R, N, x(t), v) + N * dPhidt) / scale).toBeLessThan(1e-5);
    }
  });

  it("Lenz: as the magnet approaches the flux rises and the emf has the opposite sign", () => {
    const mag: MagnetModel = { a: 0.008, length: 0.04, loops: 30, I: 300 };
    const phiFar = fluxFromMagnet(mag, 0.02, -0.08);
    const phiNear = fluxFromMagnet(mag, 0.02, -0.04);
    expect(phiNear).toBeGreaterThan(phiFar);
    expect(emfMagnetCoil(mag, 0.02, 50, -0.06, 0.5)).toBeLessThan(0);
  });

  it('AC generator: peak emf NBAω and rms ε₀/√2', () => {
    const N = 200;
    const B = 0.1;
    const A = 0.004;
    const w = 2 * Math.PI * 50;
    let peak = 0;
    let s2 = 0;
    const n = 100000;
    for (let i = 0; i < n; i++) {
      const e = generatorEmf(N, B, A, w, (i / n) * (2 * Math.PI / w));
      peak = Math.max(peak, e);
      s2 += e * e;
    }
    expect(peak).toBeCloseTo(N * B * A * w, 4);
    expect(Math.sqrt(s2 / n)).toBeCloseTo((N * B * A * w) / Math.SQRT2, 6);
    // emf = −N dΦ/dt with Φ = BA cos ωt
    const t = 0.0013;
    const dt = 1e-8;
    const dPhi = (B * A * Math.cos(w * (t + dt)) - B * A * Math.cos(w * (t - dt))) / (2 * dt);
    expect(generatorEmf(N, B, A, w, t) / (-N * dPhi)).toBeCloseTo(1, 6);
  });

  it('rod on rails: approaches v_t = FR/(B²L²); work by F = heat + kinetic energy', () => {
    const p = { m: 0.1, R: 2, B: 0.5, L: 0.4, F: 0.2 };
    const r = rodOnRails(p.m, p.R, p.B, p.L, p.F, 0, 200); // 40 time constants
    expect(r.v).toBeCloseTo((p.F * p.R) / (p.B ** 2 * p.L ** 2), 6);
    // energy over [0, T] by numerical integration of I²R
    const T = 3;
    let heat = 0;
    const n = 100000;
    for (let i = 0; i < n; i++) {
      const s = rodOnRails(p.m, p.R, p.B, p.L, p.F, 0, ((i + 0.5) / n) * T);
      heat += s.I * s.I * p.R * (T / n);
    }
    const end = rodOnRails(p.m, p.R, p.B, p.L, p.F, 0, T);
    expect((p.F * end.x) / (heat + 0.5 * p.m * end.v ** 2)).toBeCloseTo(1, 6);
  });
});
