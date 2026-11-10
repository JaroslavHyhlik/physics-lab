import { describe, expect, it } from 'vitest';
import { Beam, beamInertia, beamTorque, ladderForces, pivotReaction, type BeamParams } from '../../src/physics/torque';

const deg = Math.PI / 180;
const g = 9.8;
const base: BeamParams = { L: 4, mb: 0, xp: 0, masses: [{ m: 3, x: -1 }, { m: 2, x: 1.5 }], g, thetaMax: 15 * deg };

describe('A.4 torque & equilibrium', () => {
  it('principle of moments: m₁d₁ = m₂d₂ gives zero torque and the beam stays level', () => {
    expect(beamTorque(base)).toBeCloseTo(0, 12);
    const b = new Beam(base);
    for (let i = 0; i < 2000; i++) b.step(1e-3);
    expect(b.theta).toBe(0);
  });

  it('pivot reaction equals the total weight (ΣF = 0)', () => {
    expect(pivotReaction({ ...base, mb: 1.5 })).toBeCloseTo(6.5 * g, 12);
  });

  it('τ = Fr sinθ: the heavier side turns down; α = τ/I at the start', () => {
    const p = { ...base, masses: [{ m: 3, x: -1 }, { m: 1, x: 1 }] };
    const tau = beamTorque(p);
    expect(tau).toBeCloseTo(2 * g, 12); // anticlockwise: left side goes down
    const b = new Beam(p);
    b.step(1e-4);
    expect(b.om[0] / 1e-4).toBeCloseTo(tau / beamInertia(p), 3);
  });

  it('a uniform beam balances on its centre; off-centre pivot needs a counterweight', () => {
    const p: BeamParams = { L: 4, mb: 2, xp: 0.5, masses: [{ m: 2, x: 1 }], g, thetaMax: 0.3 };
    // beam weight 2g at 0.5 m left of the pivot, mass 2g at 0.5 m right → balanced
    expect(beamTorque(p)).toBeCloseTo(0, 12);
    expect(beamInertia(p)).toBeCloseTo(2 * (16 / 12 + 0.25) + 2 * 0.25, 12);
  });

  it('ladder: N_wall from torques about the foot, friction = N_wall, slipping threshold', () => {
    const p = { L: 5, theta: 60 * deg, m: 10, M: 70, d: 3, mu: 0.3, g };
    const F = ladderForces(p);
    expect(F.Nw).toBeCloseTo(((10 * 2.5 + 70 * 3) * g * 0.5) / (5 * Math.sin(60 * deg)), 10);
    expect(F.Nf).toBeCloseTo(80 * g, 12);
    expect(F.slips).toBe(F.f > 0.3 * 80 * g);
    // at d = dmax the friction is exactly at its limit
    const atMax = ladderForces({ ...p, d: F.dmax });
    expect(atMax.f / atMax.fmax).toBeCloseTo(1, 10);
  });
});
