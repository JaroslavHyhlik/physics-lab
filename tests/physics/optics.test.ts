import { describe, expect, it } from 'vitest';
import { refract, criticalAngle, fresnelR, acceptanceAngle } from '../../src/physics/optics';

describe('C.3 reflection and refraction', () => {
  it("Snell's law n₁ sinθ₁ = n₂ sinθ₂ (air to glass bends towards the normal)", () => {
    for (const t1 of [0.1, 0.5, 1.0, 1.4]) {
      const t2 = refract(1, 1.5, t1)!;
      expect(1 * Math.sin(t1)).toBeCloseTo(1.5 * Math.sin(t2), 14);
      expect(t2).toBeLessThan(t1);
    }
  });

  it('critical angle sinθ_c = n₂/n₁; total internal reflection beyond it', () => {
    const c = criticalAngle(1.5, 1)!;
    expect(Math.sin(c)).toBeCloseTo(1 / 1.5, 14);
    expect((c * 180) / Math.PI).toBeCloseTo(41.8, 1);
    expect(refract(1.5, 1, c - 1e-6)).not.toBeNull();
    expect(refract(1.5, 1, c + 1e-6)).toBeNull();
    expect(criticalAngle(1, 1.5)).toBeNull();
    expect(fresnelR(1.5, 1, c + 0.01)).toBe(1);
  });

  it('Fresnel: 4 % reflected at normal incidence on glass; R → 1 at grazing incidence', () => {
    expect(fresnelR(1, 1.5, 0)).toBeCloseTo(0.04, 10);
    expect(fresnelR(1, 1.5, Math.PI / 2 - 1e-6)).toBeGreaterThan(0.999);
  });

  it('optical fibre acceptance angle: sinθ_a = √(n₁² − n₂²)', () => {
    const a = acceptanceAngle(1, 1.5, 1.4);
    expect(Math.sin(a)).toBeCloseTo(Math.sqrt(1.5 ** 2 - 1.4 ** 2), 12);
    // a ray entering at θ_a meets the core wall exactly at the critical angle
    const inside = refract(1, 1.5, a)!;
    expect(Math.PI / 2 - inside).toBeCloseTo(criticalAngle(1.5, 1.4)!, 10);
  });
});
