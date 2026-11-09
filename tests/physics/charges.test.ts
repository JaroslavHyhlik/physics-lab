import { describe, expect, it } from 'vitest';
import {
  fieldAt,
  potentialAt,
  traceFieldLine,
  potentialGrid,
  contours,
  type Sources,
} from '../../src/physics/charges';
import { computeFieldMaps } from '../../src/physics/fieldMaps';
import { k_e, epsilon_0 } from '../../src/core/constants';
import { Rng } from '../../src/core/rng';

const nC = 1e-9;
const E = [0, 0];

describe('D.2 charges and fields', () => {
  it("point charge: E = kq/r² (Coulomb) and V = kq/r", () => {
    const src: Sources = { charges: [{ x: 0.3, y: -0.2, q: 2 * nC }], plates: [] };
    const r = 0.5;
    fieldAt(src, 0.3 + r * 0.6, -0.2 + r * 0.8, E);
    const mag = (k_e * 2 * nC) / (r * r);
    expect(Math.hypot(E[0], E[1]) / mag).toBeCloseTo(1, 12);
    expect(E[0] / E[1]).toBeCloseTo(0.6 / 0.8, 12); // radially outwards
    expect(potentialAt(src, 0.3 + r, -0.2) / ((k_e * 2 * nC) / r)).toBeCloseTo(1, 12);
  });

  it('dipole midpoint: V = 0 and E = 2kq/(d/2)² from + to −', () => {
    const d = 0.8;
    const src: Sources = {
      charges: [
        { x: -d / 2, y: 0, q: nC },
        { x: d / 2, y: 0, q: -nC },
      ],
      plates: [],
    };
    fieldAt(src, 0, 0, E);
    expect(potentialAt(src, 0, 0)).toBeCloseTo(0, 12);
    expect(E[0] / ((2 * k_e * nC) / ((d / 2) * (d / 2)))).toBeCloseTo(1, 12);
    expect(E[1]).toBeCloseTo(0, 12);
  });

  it('E = −ΔV/Δr everywhere (point charges + capacitor plates), checked numerically', () => {
    const src: Sources = {
      charges: [
        { x: -1, y: 0.4, q: 1.5 * nC },
        { x: 0.7, y: -0.3, q: -2 * nC },
      ],
      plates: [
        { cx: 0.2, cy: 0.9, w: 1.2, vertical: false, sigma: 0.8 * nC },
        { cx: 0.2, cy: -0.9, w: 1.2, vertical: false, sigma: -0.8 * nC },
        { cx: 1.6, cy: 0, w: 0.8, vertical: true, sigma: 0.5 * nC },
        { cx: 2.2, cy: 0, w: 0.8, vertical: true, sigma: -0.5 * nC },
      ],
    };
    const rng = new Rng(3);
    const h = 1e-5;
    for (let n = 0; n < 200; n++) {
      const x = rng.uniform(-2.5, 2.5);
      const y = rng.uniform(-1.5, 1.5);
      fieldAt(src, x, y, E);
      const gx = -(potentialAt(src, x + h, y) - potentialAt(src, x - h, y)) / (2 * h);
      const gy = -(potentialAt(src, x, y + h) - potentialAt(src, x, y - h)) / (2 * h);
      const mag = Math.hypot(E[0], E[1]);
      expect(Math.hypot(gx - E[0], gy - E[1]) / mag).toBeLessThan(1e-5);
    }
  });

  it('parallel plates: uniform field E = σ/ε₀ = V/d between wide plates', () => {
    const sigma = 1 * nC;
    const d = 0.5;
    const w = 40; // w/d = 80
    const src: Sources = {
      charges: [],
      plates: [
        { cx: 0, cy: d / 2, w, vertical: false, sigma },
        { cx: 0, cy: -d / 2, w, vertical: false, sigma: -sigma },
      ],
    };
    fieldAt(src, 0, 0, E);
    // exact finite-width result: E = (2σ/πε₀)·atan(w/d)
    const exact = ((2 * sigma) / (Math.PI * epsilon_0)) * Math.atan(w / d);
    expect(-E[1] / exact).toBeCloseTo(1, 10);
    expect(E[0]).toBeCloseTo(0, 10);
    // infinite-plate (booklet) value within 1 %
    expect(Math.abs(-E[1] / (sigma / epsilon_0) - 1)).toBeLessThan(0.01);
    // E = V/d (booklet D.2)
    const V = potentialAt(src, 0, d / 2 - 1e-9) - potentialAt(src, 0, -d / 2 + 1e-9);
    expect(Math.abs(V / d / (sigma / epsilon_0) - 1)).toBeLessThan(0.01);
    // field is uniform: within 1 % at x = ±2 m, y = ±0.2 m
    for (const [x, y] of [
      [2, 0.2],
      [-2, -0.2],
    ]) {
      fieldAt(src, x, y, E);
      expect(Math.abs(-E[1] / exact - 1)).toBeLessThan(0.01);
    }
  });

  it('field lines are tangent to E and run from + to −', () => {
    const src: Sources = {
      charges: [
        { x: -0.6, y: 0, q: nC },
        { x: 0.6, y: 0, q: -nC },
      ],
      plates: [],
    };
    const res = traceFieldLine(src, -0.6 + 0.05, 0.03, 1, {
      bounds: { x0: -5, x1: 5, y0: -5, y1: 5 },
      stopRadius: 0.04,
      maxLength: 20,
      maxStep: 0.02,
      tol: 1e-7,
    });
    expect(res.end).toBe('charge');
    expect(res.endSign).toBe(-1);
    const p = res.points;
    for (let i = 2; i + 3 < p.length - 2; i += 6) {
      const mx = (p[i] + p[i + 2]) / 2;
      const my = (p[i + 1] + p[i + 3]) / 2;
      const tx = p[i + 2] - p[i];
      const ty = p[i + 3] - p[i + 1];
      fieldAt(src, mx, my, E);
      const sin = (tx * E[1] - ty * E[0]) / (Math.hypot(tx, ty) * Math.hypot(E[0], E[1]));
      expect(Math.abs(sin)).toBeLessThan(2e-3);
    }
  });

  it('equipotential contour vertices lie on their potential level', () => {
    const src: Sources = { charges: [{ x: 0.1, y: 0.05, q: nC }, { x: -0.8, y: 0.3, q: -0.5 * nC }], plates: [] };
    const b = { x0: -2, x1: 2, y0: -1.2, y1: 1.2 };
    const nx = 241;
    const ny = 145;
    const grid = potentialGrid(src, b, nx, ny);
    const lv: number[] = [];
    const levels = [-10, -5, 5, 10, 20];
    const seg = contours(grid, nx, ny, b, levels, lv, src.charges);
    expect(seg.length).toBeGreaterThan(100);
    let worst = 0;
    for (let s = 0; s < seg.length; s += 2) {
      const L = levels[lv[s >> 2]];
      const v = potentialAt(src, seg[s], seg[s + 1]);
      worst = Math.max(worst, Math.abs(v - L) / Math.abs(L));
    }
    // linear interpolation on a 1.7 cm grid: within 2 % of the level
    expect(worst).toBeLessThan(0.02);
  });

  it('field-map computation returns consistent buffers', () => {
    const res = computeFieldMaps({
      id: 1,
      sources: { charges: [{ x: 0, y: 0, q: nC }, { x: 1, y: 0, q: -nC }], plates: [] },
      bounds: { x0: -2, x1: 2, y0: -1, y1: 1 },
      nx: 80,
      ny: 40,
      heatmap: true,
      equipotentials: true,
      lines: true,
      spacing: 5,
      stopRadius: 0.05,
      colors: { pos: [255, 0, 0], neg: [0, 0, 255], bg: [0, 0, 0] },
    });
    expect(res.image!.length).toBe(80 * 40 * 4);
    expect(res.contours.length / 4).toBe(res.contourLevel.length);
    expect(res.lineStarts[res.lineStarts.length - 1]).toBe(res.lines.length);
    expect(res.lineStarts.length - 1).toBeGreaterThanOrEqual(8);
  });
});
