import { describe, expect, it } from 'vitest';
import { fft, gFromPendulum, haversine, integrate, kFromSpring, peakFrequency, period, rmsDb, sampleRate, soundTriggers, spectrum, stats } from '../../src/lab/analysis';
import { Rng } from '../../src/core/rng';
import { subscriptText } from '../../src/core/format';

describe('mobile lab: analysis of measured data', () => {
  it('mean, standard deviation and standard error', () => {
    const s = stats([9.7, 9.8, 9.9, 9.8]);
    expect(s.mean).toBeCloseTo(9.8, 12);
    expect(s.sd).toBeCloseTo(Math.sqrt(0.02 / 3), 12);
    expect(s.sem).toBeCloseTo(s.sd / 2, 12);
    // noisy data: the mean is within 4 standard errors of the true value
    const rng = new Rng(1);
    const xs = Array.from({ length: 2000 }, () => 9.81 + 0.05 * rng.gaussian());
    const t = stats(xs);
    expect(Math.abs(t.mean - 9.81)).toBeLessThan(4 * t.sem);
    expect(t.sd).toBeCloseTo(0.05, 2);
  });

  it('sample rate from timestamps, robust to a dropped event', () => {
    const ts = Array.from({ length: 200 }, (_, i) => i / 60);
    ts.splice(100, 1);
    expect(sampleRate(ts)).toBeCloseTo(60, 6);
  });

  it('period of a noisy oscillation sampled at 60 Hz (pendulum, T = 2.006 s)', () => {
    const rng = new Rng(4);
    const T = 2.006;
    const ts: number[] = [];
    const ys: number[] = [];
    for (let i = 0; i < 60 * 30; i++) {
      const t = i / 60 + 0.002 * rng.next();
      ts.push(t);
      ys.push(0.3 + Math.sin((2 * Math.PI * t) / T) + 0.05 * rng.gaussian());
    }
    const p = period(ts, ys);
    expect(Math.abs(p.T - T)).toBeLessThan(0.005);
    expect(p.n).toBeGreaterThan(12);
    expect(gFromPendulum(1, T)).toBeCloseTo(9.81, 1);
    expect(kFromSpring(0.2, 0.5)).toBeCloseTo(31.6, 1);
  });

  it('FFT: a pure tone gives one peak, located to well within one bin', () => {
    const n = 4096;
    const fs = 48000;
    for (const f of [440, 1234.5, 3000]) {
      const x = Array.from({ length: n }, (_, i) => 0.5 * Math.sin((2 * Math.PI * f * i) / fs));
      const sp = spectrum(x);
      const pk = peakFrequency(sp, fs, n);
      expect(Math.abs(pk.f - f)).toBeLessThan(0.1 * (fs / n));
      expect(pk.amp).toBeGreaterThan(0.2);
    }
    // FFT of an impulse is flat
    const re = new Float64Array(8);
    const im = new Float64Array(8);
    re[0] = 1;
    fft(re, im);
    for (let k = 0; k < 8; k++) expect(Math.hypot(re[k], im[k])).toBeCloseTo(1, 12);
  });

  it('sound level in dB: full-scale sine −3 dB; ten times quieter −20 dB more', () => {
    const s = (A: number) => Array.from({ length: 4800 }, (_, i) => A * Math.sin((2 * Math.PI * 1000 * i) / 48000));
    expect(rmsDb(s(1))).toBeCloseTo(-3.01, 1);
    expect(rmsDb(s(0.1)) - rmsDb(s(1))).toBeCloseTo(-20, 1);
    expect(rmsDb(new Float32Array(100))).toBe(-120);
  });

  it('acoustic stopwatch: two claps 0.25 s apart, the ringing of the first is ignored', () => {
    const fs = 48000;
    const x = new Float32Array(fs);
    const clap = (t: number) => {
      for (let i = 0; i < 2000; i++) x[Math.round(t * fs) + i] = 0.8 * Math.exp(-i / 300) * Math.sin(i);
    };
    clap(0.1);
    clap(0.35);
    const tr = soundTriggers(x, fs, 0.3, 0.05);
    expect(tr.length).toBe(2);
    expect(tr[1] - tr[0]).toBeCloseTo(0.25, 3);
  });

  it('integrating angular velocity gives the angle; haversine distance along a meridian', () => {
    const ts = Array.from({ length: 601 }, (_, i) => i / 60);
    const w = ts.map(() => Math.PI / 5); // 36° per second for 10 s
    const ang = integrate(ts, w);
    expect(ang[600]).toBeCloseTo(2 * Math.PI, 10);
    // 1° of latitude ≈ 111.2 km
    expect(haversine(50, 14, 51, 14) / 1000).toBeCloseTo(111.2, 1);
    expect(haversine(50, 14, 50, 14)).toBe(0);
  });
});

describe('plain-text subscripts for graph legends', () => {
  it('uses Unicode subscripts where they exist, otherwise just drops the underscore', () => {
    expect(subscriptText('v_t')).toBe('vₜ');
    expect(subscriptText('a_x and E_k')).toBe('aₓ and Eₖ');
    expect(subscriptText('a_y (m s⁻²)')).toBe('ay (m s⁻²)');
    expect(subscriptText('F_N')).toBe('FN');
    expect(subscriptText('no subscript')).toBe('no subscript');
  });
});
