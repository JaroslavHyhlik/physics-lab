/**
 * Everything the "Charges and fields" screen needs that is expensive to compute:
 * potential heat map, equipotential contours and field lines. Pure function, so it can
 * run in a Web Worker or (as a fallback) on the main thread.
 */
import {
  contours,
  levelsFor,
  potentialGrid,
  traceAllLines,
  type Bounds,
  type Sources,
} from './charges';

export interface FieldMapRequest {
  id: number;
  sources: Sources;
  bounds: Bounds;
  nx: number;
  ny: number;
  heatmap: boolean;
  equipotentials: boolean;
  lines: boolean;
  /** equipotential spacing [V] */
  spacing: number;
  stopRadius: number;
  /** RGB (0–255) for positive potential, negative potential and background */
  colors: { pos: [number, number, number]; neg: [number, number, number]; bg: [number, number, number] };
}

export interface FieldMapResult {
  id: number;
  nx: number;
  ny: number;
  bounds: Bounds;
  image: Uint8ClampedArray | null;
  /** segments x1,y1,x2,y2 */
  contours: Float32Array;
  contourLevel: Float32Array;
  /** polylines, concatenated; lineStarts[i] = start index (in floats) of line i */
  lines: Float32Array;
  lineStarts: Uint32Array;
  ms: number;
}

export function computeFieldMaps(req: FieldMapRequest): FieldMapResult {
  const t0 = performance.now();
  const { nx, ny, bounds } = req;
  let image: Uint8ClampedArray | null = null;
  let seg: number[] = [];
  const levelIdx: number[] = [];
  let levels: number[] = [];
  const needGrid = req.heatmap || req.equipotentials;
  const grid = needGrid ? potentialGrid(req.sources, bounds, nx, ny) : null;

  if (grid && req.heatmap) {
    image = new Uint8ClampedArray(nx * ny * 4);
    // colour scale: asinh compresses the 1/r divergence near charges (non-linear, labelled in the UI)
    const V0 = Math.max(req.spacing, 1e-9);
    const norm = Math.asinh(12);
    const { pos, neg, bg } = req.colors;
    for (let k = 0; k < nx * ny; k++) {
      const v = grid[k];
      let t = Math.asinh(v / V0) / norm;
      t = Math.max(-1, Math.min(1, t));
      const c = t >= 0 ? pos : neg;
      const s = Math.abs(t) * 0.78;
      image[4 * k] = bg[0] + (c[0] - bg[0]) * s;
      image[4 * k + 1] = bg[1] + (c[1] - bg[1]) * s;
      image[4 * k + 2] = bg[2] + (c[2] - bg[2]) * s;
      image[4 * k + 3] = 255;
    }
  }
  if (grid && req.equipotentials) {
    levels = levelsFor(req.spacing, req.spacing * 40);
    seg = contours(grid, nx, ny, bounds, levels, levelIdx, req.sources.charges);
  }
  let lineData = new Float32Array(0);
  let lineStarts = new Uint32Array(0);
  if (req.lines) {
    const w = bounds.x1 - bounds.x0;
    const h = bounds.y1 - bounds.y0;
    const margin = 0.5 * Math.max(w, h);
    const lines = traceAllLines(req.sources, {
      bounds: { x0: bounds.x0 - margin, x1: bounds.x1 + margin, y0: bounds.y0 - margin, y1: bounds.y1 + margin },
      stopRadius: req.stopRadius,
      maxLength: 4 * Math.max(w, h),
      maxStep: Math.max(w, h) / 150,
      tol: Math.max(w, h) * 1e-6,
    });
    const total = lines.reduce((s, l) => s + l.length, 0);
    lineData = new Float32Array(total);
    lineStarts = new Uint32Array(lines.length + 1);
    let off = 0;
    lines.forEach((l, i) => {
      lineStarts[i] = off;
      lineData.set(l, off);
      off += l.length;
    });
    lineStarts[lines.length] = off;
  }
  return {
    id: req.id,
    nx,
    ny,
    bounds,
    image,
    contours: new Float32Array(seg),
    contourLevel: new Float32Array(levelIdx.map((i) => levels[i])),
    lines: lineData,
    lineStarts,
    ms: performance.now() - t0,
  };
}
