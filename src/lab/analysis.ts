/**
 * Mobile lab: analysis of measured data. Pure functions, no DOM, all SI units.
 */

export interface Stats {
  n: number;
  mean: number;
  sd: number; // sample standard deviation
  sem: number; // standard error of the mean, sd/√n
}

export function stats(xs: ArrayLike<number>, from = 0, to = xs.length): Stats {
  const n = Math.max(0, to - from);
  if (n === 0) return { n: 0, mean: NaN, sd: NaN, sem: NaN };
  let s = 0;
  for (let i = from; i < to; i++) s += xs[i];
  const mean = s / n;
  let v = 0;
  for (let i = from; i < to; i++) v += (xs[i] - mean) ** 2;
  const sd = n > 1 ? Math.sqrt(v / (n - 1)) : 0;
  return { n, mean, sd, sem: sd / Math.sqrt(n) };
}

/** sampling rate [Hz] from timestamps [s]: 1/median interval (robust to dropped events) */
export function sampleRate(ts: ArrayLike<number>, from = 0, to = ts.length): number {
  const d: number[] = [];
  for (let i = from + 1; i < to; i++) {
    const dt = ts[i] - ts[i - 1];
    if (dt > 0) d.push(dt);
  }
  if (!d.length) return NaN;
  d.sort((a, b) => a - b);
  return 1 / d[d.length >> 1];
}

/**
 * Period of an oscillation from upward crossings of its mean value, with hysteresis (a Schmitt
 * trigger): after a crossing, the next one counts only once the signal has gone below
 * mean − h, with h = 0.3 × standard deviation, so noise near zero cannot add false crossings.
 * Crossing times are interpolated linearly between samples. T = (last − first)/(number − 1).
 */
export function period(ts: ArrayLike<number>, ys: ArrayLike<number>, from = 0, to = ts.length): { T: number; n: number; sd: number } {
  const st = stats(ys, from, to);
  const m = st.mean;
  const h = 0.3 * st.sd;
  const cross: number[] = [];
  let armed = false;
  for (let i = from + 1; i < to; i++) {
    const a = ys[i - 1] - m;
    const b = ys[i] - m;
    if (b < -h) armed = true;
    if (armed && a < 0 && b >= 0) {
      cross.push(ts[i - 1] + ((ts[i] - ts[i - 1]) * -a) / (b - a));
      armed = false;
    }
  }
  if (cross.length < 2) return { T: NaN, n: 0, sd: NaN };
  const per = cross.slice(1).map((c, i) => c - cross[i]);
  return { T: (cross[cross.length - 1] - cross[0]) / (cross.length - 1), n: per.length, sd: stats(per).sd };
}

/** in-place iterative radix-2 FFT; length must be a power of two */
export function fft(re: Float64Array, im: Float64Array): void {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k;
        const b = a + len / 2;
        const tr = re[b] * cr - im[b] * ci;
        const ti = re[b] * ci + im[b] * cr;
        re[b] = re[a] - tr;
        im[b] = im[a] - ti;
        re[a] += tr;
        im[a] += ti;
        const t = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = t;
      }
    }
  }
}

/** amplitude spectrum (Hann window) of n = power-of-two samples; out has n/2 bins, bin k ↔ k·fs/n */
export function spectrum(samples: ArrayLike<number>, out = new Float64Array(samples.length >> 1)): Float64Array {
  const n = samples.length;
  const re = new Float64Array(n);
  const im = new Float64Array(n);
  for (let i = 0; i < n; i++) re[i] = samples[i] * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1)));
  fft(re, im);
  for (let k = 0; k < n >> 1; k++) out[k] = (2 * Math.hypot(re[k], im[k])) / (n / 2);
  return out;
}

/**
 * Frequency of the strongest peak [Hz], refined between bins by fitting a parabola to the
 * logarithm of the three highest bins (accurate to a small fraction of a bin for a pure tone).
 */
export function peakFrequency(spec: ArrayLike<number>, fs: number, n: number, fmin = 20): { f: number; amp: number } {
  const k0 = Math.max(1, Math.ceil((fmin * n) / fs));
  let k = k0;
  for (let i = k0; i < spec.length - 1; i++) if (spec[i] > spec[k]) k = i;
  if (k <= 0 || k >= spec.length - 1 || spec[k] <= 0) return { f: NaN, amp: 0 };
  const a = Math.log(spec[k - 1] + 1e-30);
  const b = Math.log(spec[k] + 1e-30);
  const c = Math.log(spec[k + 1] + 1e-30);
  const p = (0.5 * (a - c)) / (a - 2 * b + c);
  return { f: ((k + (Number.isFinite(p) ? p : 0)) * fs) / n, amp: spec[k] };
}

/** RMS level in dB relative to full scale (1.0); silence → −∞ is clamped to −120 dB */
export function rmsDb(samples: ArrayLike<number>): number {
  let s = 0;
  for (let i = 0; i < samples.length; i++) s += samples[i] * samples[i];
  const rms = Math.sqrt(s / Math.max(1, samples.length));
  return Math.max(-120, 20 * Math.log10(rms + 1e-12));
}

/**
 * Acoustic stopwatch: times [s] of the first two loud sounds. A sound starts where |x| first
 * exceeds the threshold; the second must come at least `dead` seconds after the first (so the
 * echo or ringing of the first one is not counted).
 */
export function soundTriggers(samples: ArrayLike<number>, fs: number, threshold: number, dead = 0.1, t0 = 0): number[] {
  const out: number[] = [];
  let next = 0;
  for (let i = 0; i < samples.length && out.length < 2; i++) {
    const t = t0 + i / fs;
    if (t >= next && Math.abs(samples[i]) > threshold) {
      out.push(t);
      next = t + dead;
    }
  }
  return out;
}

/** cumulative integral by the trapezium rule (e.g. angle from angular velocity) */
export function integrate(ts: ArrayLike<number>, ys: ArrayLike<number>, out = new Float64Array(ts.length)): Float64Array {
  if (ts.length) out[0] = 0;
  for (let i = 1; i < ts.length; i++) out[i] = out[i - 1] + 0.5 * (ys[i] + ys[i - 1]) * (ts[i] - ts[i - 1]);
  return out;
}

export const R_EARTH_GPS = 6.371e6; // m, mean Earth radius

/** great-circle distance [m] between two GPS positions in degrees (haversine formula) */
export function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const r = Math.PI / 180;
  const dLat = (lat2 - lat1) * r;
  const dLon = (lon2 - lon1) * r;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(dLon / 2) ** 2;
  return 2 * R_EARTH_GPS * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** pendulum: g = 4π²L/T² */
export const gFromPendulum = (L: number, T: number) => (4 * Math.PI * Math.PI * L) / (T * T);
/** spring: k = 4π²m/T² */
export const kFromSpring = (m: number, T: number) => (4 * Math.PI * Math.PI * m) / (T * T);
/** magnitude of a 3-vector */
export const mag3 = (x: number, y: number, z: number) => Math.sqrt(x * x + y * y + z * z);
