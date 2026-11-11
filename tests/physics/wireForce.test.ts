import { describe, expect, it } from 'vitest';
import { wireForce, parallelForcePerLength } from '../../src/physics/wireForce';
import { mu_0 } from '../../src/core/constants';

describe('D.3 forces on conductors', () => {
  it('F = BIL sinθ, perpendicular to both the wire and B', () => {
    const B = 0.3;
    for (const th of [0, 0.4, Math.PI / 2, 2.5]) {
      const F = wireForce(4, 0.2, [Math.cos(th), Math.sin(th), 0], [B, 0, 0]);
      expect(Math.hypot(...F)).toBeCloseTo(B * 4 * 0.2 * Math.abs(Math.sin(th)), 14);
      expect(F[0]).toBeCloseTo(0, 14);
      expect(F[1]).toBeCloseTo(0, 14);
    }
  });

  it('parallel wires: F/L = μ₀I₁I₂/(2πr); same direction attract, opposite repel; equal and opposite forces', () => {
    const f = parallelForcePerLength(10, 5, 0.02);
    expect(Math.abs(f)).toBeCloseTo((mu_0 * 10 * 5) / (2 * Math.PI * 0.02), 14);
    expect(f).toBeLessThan(0); // wire 2 (at +x) pushed towards wire 1: attraction
    expect(parallelForcePerLength(10, -5, 0.02)).toBeGreaterThan(0); // repulsion
    // force on wire 1 from wire 2 (mirror the geometry): same size, opposite direction
    expect(-parallelForcePerLength(5, 10, 0.02)).toBeCloseTo(-f, 14);
  });
});
