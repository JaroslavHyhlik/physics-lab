/**
 * Numerical integrators. All work on preallocated Float64Arrays (no allocation per step).
 *
 * - RK4: classic 4th-order Runge–Kutta for smooth (possibly dissipative) first-order systems.
 * - DormandPrince45: adaptive 5(4) Runge–Kutta with error control (field lines, stiff-ish paths).
 * - velocityVerlet / yoshida4: symplectic methods for conservative x'' = a(x) systems; energy
 *   errors stay bounded instead of drifting.
 * - semiImplicitEuler: 1st-order symplectic, cheap (large particle systems).
 * - borisPush: charged particle in E and B; a pure magnetic field does no work, exactly.
 */

/** dy/dt = f(t, y). Writes the derivative into `out`. */
export type Derivative = (t: number, y: Float64Array, out: Float64Array) => void;

export class RK4 {
  private k1: Float64Array;
  private k2: Float64Array;
  private k3: Float64Array;
  private k4: Float64Array;
  private tmp: Float64Array;

  constructor(readonly n: number) {
    this.k1 = new Float64Array(n);
    this.k2 = new Float64Array(n);
    this.k3 = new Float64Array(n);
    this.k4 = new Float64Array(n);
    this.tmp = new Float64Array(n);
  }

  /** Advance y in place from t to t + h. */
  step(f: Derivative, t: number, y: Float64Array, h: number): void {
    const { n, k1, k2, k3, k4, tmp } = this;
    f(t, y, k1);
    for (let i = 0; i < n; i++) tmp[i] = y[i] + 0.5 * h * k1[i];
    f(t + 0.5 * h, tmp, k2);
    for (let i = 0; i < n; i++) tmp[i] = y[i] + 0.5 * h * k2[i];
    f(t + 0.5 * h, tmp, k3);
    for (let i = 0; i < n; i++) tmp[i] = y[i] + h * k3[i];
    f(t + h, tmp, k4);
    for (let i = 0; i < n; i++) y[i] += (h / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]);
  }
}

/** Dormand–Prince 5(4) coefficients. */
const DP = {
  c2: 1 / 5, c3: 3 / 10, c4: 4 / 5, c5: 8 / 9,
  a21: 1 / 5,
  a31: 3 / 40, a32: 9 / 40,
  a41: 44 / 45, a42: -56 / 15, a43: 32 / 9,
  a51: 19372 / 6561, a52: -25360 / 2187, a53: 64448 / 6561, a54: -212 / 729,
  a61: 9017 / 3168, a62: -355 / 33, a63: 46732 / 5247, a64: 49 / 176, a65: -5103 / 18656,
  b1: 35 / 384, b3: 500 / 1113, b4: 125 / 192, b5: -2187 / 6784, b6: 11 / 84,
  // error coefficients: b (5th order) − b* (4th order)
  e1: 71 / 57600, e3: -71 / 16695, e4: 71 / 1920, e5: -17253 / 339200, e6: 22 / 525, e7: -1 / 40,
};

export class DormandPrince45 {
  private k: Float64Array[];
  private tmp: Float64Array;
  private y5: Float64Array;

  constructor(readonly n: number) {
    this.k = Array.from({ length: 7 }, () => new Float64Array(n));
    this.tmp = new Float64Array(n);
    this.y5 = new Float64Array(n);
  }

  /**
   * Attempt one step of size h. On success y is advanced and the function returns
   * { accepted: true, hNext }. On rejection y is unchanged and hNext is a smaller step.
   * Error norm: max |err_i| / (atol + rtol·|y_i|).
   */
  tryStep(
    f: Derivative,
    t: number,
    y: Float64Array,
    h: number,
    atol: number,
    rtol: number,
  ): { accepted: boolean; hNext: number; err: number } {
    const { n, k, tmp, y5 } = this;
    const [k1, k2, k3, k4, k5, k6, k7] = k;
    f(t, y, k1);
    for (let i = 0; i < n; i++) tmp[i] = y[i] + h * DP.a21 * k1[i];
    f(t + DP.c2 * h, tmp, k2);
    for (let i = 0; i < n; i++) tmp[i] = y[i] + h * (DP.a31 * k1[i] + DP.a32 * k2[i]);
    f(t + DP.c3 * h, tmp, k3);
    for (let i = 0; i < n; i++) tmp[i] = y[i] + h * (DP.a41 * k1[i] + DP.a42 * k2[i] + DP.a43 * k3[i]);
    f(t + DP.c4 * h, tmp, k4);
    for (let i = 0; i < n; i++)
      tmp[i] = y[i] + h * (DP.a51 * k1[i] + DP.a52 * k2[i] + DP.a53 * k3[i] + DP.a54 * k4[i]);
    f(t + DP.c5 * h, tmp, k5);
    for (let i = 0; i < n; i++)
      tmp[i] =
        y[i] + h * (DP.a61 * k1[i] + DP.a62 * k2[i] + DP.a63 * k3[i] + DP.a64 * k4[i] + DP.a65 * k5[i]);
    f(t + h, tmp, k6);
    for (let i = 0; i < n; i++)
      y5[i] = y[i] + h * (DP.b1 * k1[i] + DP.b3 * k3[i] + DP.b4 * k4[i] + DP.b5 * k5[i] + DP.b6 * k6[i]);
    f(t + h, y5, k7);
    let err = 0;
    for (let i = 0; i < n; i++) {
      const ei =
        h * (DP.e1 * k1[i] + DP.e3 * k3[i] + DP.e4 * k4[i] + DP.e5 * k5[i] + DP.e6 * k6[i] + DP.e7 * k7[i]);
      const sc = atol + rtol * Math.max(Math.abs(y[i]), Math.abs(y5[i]));
      err = Math.max(err, Math.abs(ei) / sc);
    }
    const factor = err === 0 ? 5 : Math.min(5, Math.max(0.2, 0.9 * Math.pow(err, -0.2)));
    if (err <= 1) {
      y.set(y5);
      return { accepted: true, hNext: h * factor, err };
    }
    return { accepted: false, hNext: h * Math.min(1, factor), err };
  }

  /** Integrate from t0 to t1 adaptively. Returns the number of accepted steps. */
  integrate(
    f: Derivative,
    t0: number,
    t1: number,
    y: Float64Array,
    h0: number,
    atol = 1e-10,
    rtol = 1e-10,
  ): number {
    let t = t0;
    let h = Math.min(h0, t1 - t0);
    let steps = 0;
    while (t < t1) {
      if (t + h > t1) h = t1 - t;
      const r = this.tryStep(f, t, y, h, atol, rtol);
      if (r.accepted) {
        t += h;
        steps++;
      }
      h = r.hNext;
      if (h < 1e-14 * Math.max(1, Math.abs(t))) throw new Error('DormandPrince45: step size underflow');
    }
    return steps;
  }
}

/** Acceleration a(x, t) for second-order systems; writes into `out`. */
export type Acceleration = (x: Float64Array, t: number, out: Float64Array) => void;

/**
 * Velocity Verlet (2nd order, symplectic). `a` must hold the acceleration at the current x
 * on entry and holds the acceleration at the new x on exit (one force evaluation per step).
 */
export function velocityVerlet(
  x: Float64Array,
  v: Float64Array,
  a: Float64Array,
  h: number,
  t: number,
  accel: Acceleration,
): void {
  const n = x.length;
  for (let i = 0; i < n; i++) {
    v[i] += 0.5 * h * a[i];
    x[i] += h * v[i];
  }
  accel(x, t + h, a);
  for (let i = 0; i < n; i++) v[i] += 0.5 * h * a[i];
}

const CBRT2 = Math.cbrt(2);
const Y_W1 = 1 / (2 - CBRT2);
const Y_W0 = -CBRT2 / (2 - CBRT2);
/** Yoshida 4th-order coefficients: position (c) and velocity (d) sub-steps. */
const Y_C = [Y_W1 / 2, (Y_W0 + Y_W1) / 2, (Y_W0 + Y_W1) / 2, Y_W1 / 2];
const Y_D = [Y_W1, Y_W0, Y_W1];

/** Yoshida 4th-order symplectic integrator (position-only forces). `a` is scratch space. */
export function yoshida4(
  x: Float64Array,
  v: Float64Array,
  a: Float64Array,
  h: number,
  t: number,
  accel: Acceleration,
): void {
  const n = x.length;
  let tt = t;
  for (let s = 0; s < 4; s++) {
    const ch = Y_C[s] * h;
    for (let i = 0; i < n; i++) x[i] += ch * v[i];
    tt += ch;
    if (s < 3) {
      accel(x, tt, a);
      const dh = Y_D[s] * h;
      for (let i = 0; i < n; i++) v[i] += dh * a[i];
    }
  }
}

/** Semi-implicit (symplectic) Euler: v += a·h, then x += v·h. */
export function semiImplicitEuler(
  x: Float64Array,
  v: Float64Array,
  a: Float64Array,
  h: number,
  t: number,
  accel: Acceleration,
): void {
  const n = x.length;
  accel(x, t, a);
  for (let i = 0; i < n; i++) {
    v[i] += h * a[i];
    x[i] += h * v[i];
  }
}

/**
 * Boris pusher for a non-relativistic charged particle (3D vectors, in place).
 * x, v: position and velocity; E, B: field at the particle; qm = q/m.
 */
export function borisPush(
  x: Float64Array,
  v: Float64Array,
  E: ArrayLike<number>,
  B: ArrayLike<number>,
  qm: number,
  h: number,
): void {
  const hq = 0.5 * qm * h;
  // half electric kick
  const vmx = v[0] + hq * E[0];
  const vmy = v[1] + hq * E[1];
  const vmz = v[2] + hq * E[2];
  // magnetic rotation
  const tx = hq * B[0];
  const ty = hq * B[1];
  const tz = hq * B[2];
  const t2 = tx * tx + ty * ty + tz * tz;
  const sx = (2 * tx) / (1 + t2);
  const sy = (2 * ty) / (1 + t2);
  const sz = (2 * tz) / (1 + t2);
  const vpx = vmx + (vmy * tz - vmz * ty);
  const vpy = vmy + (vmz * tx - vmx * tz);
  const vpz = vmz + (vmx * ty - vmy * tx);
  const vnx = vmx + (vpy * sz - vpz * sy);
  const vny = vmy + (vpz * sx - vpx * sz);
  const vnz = vmz + (vpx * sy - vpy * sx);
  // second half electric kick
  v[0] = vnx + hq * E[0];
  v[1] = vny + hq * E[1];
  v[2] = vnz + hq * E[2];
  x[0] += h * v[0];
  x[1] += h * v[1];
  x[2] += h * v[2];
}
