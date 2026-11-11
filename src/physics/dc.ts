/**
 * Simple DC circuit models (exact formulas).
 *   Cell with emf ε and internal resistance r driving a load R:
 *     I = ε/(R + r),  V = ε − Ir (terminal p.d.),  P_load = I²R (largest when R = r)
 *   Resistivity: R = ρL/A
 *   Least-squares straight line through measured points (for V–I and R–L graphs).
 */
export function cellCircuit(emf: number, r: number, R: number) {
  const I = emf / (R + r);
  const V = emf - I * r;
  return { I, V, Pload: I * I * R, Plost: I * I * r, Ptotal: emf * I };
}

/** resistivity at 20 °C [Ω m], typical values (CRC Handbook) */
export const RESISTIVITY: Record<string, { name: string; rho: number }> = {
  copper: { name: 'Copper', rho: 1.68e-8 },
  aluminium: { name: 'Aluminium', rho: 2.65e-8 },
  tungsten: { name: 'Tungsten', rho: 5.6e-8 },
  iron: { name: 'Iron', rho: 9.7e-8 },
  constantan: { name: 'Constantan', rho: 4.9e-7 },
  nichrome: { name: 'Nichrome', rho: 1.1e-6 },
};

export const wireResistance = (rho: number, L: number, A: number) => (rho * L) / A;

export interface Fit {
  slope: number;
  intercept: number;
  n: number;
}
export function linearFit(xs: number[], ys: number[]): Fit {
  const n = xs.length;
  if (n < 2) return { slope: NaN, intercept: NaN, n };
  let sx = 0;
  let sy = 0;
  let sxx = 0;
  let sxy = 0;
  for (let i = 0; i < n; i++) {
    sx += xs[i];
    sy += ys[i];
    sxx += xs[i] * xs[i];
    sxy += xs[i] * ys[i];
  }
  const d = n * sxx - sx * sx;
  if (Math.abs(d) < 1e-300) return { slope: NaN, intercept: NaN, n };
  const slope = (n * sxy - sx * sy) / d;
  return { slope, intercept: (sy - slope * sx) / n, n };
}

/** round a meter reading to its resolution (a digital meter shows a fixed number of digits) */
export const meterReading = (x: number, resolution: number) => Math.round(x / resolution) * resolution;
