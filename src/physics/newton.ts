/**
 * Newton's second law with constant (piecewise constant) accelerations, solved exactly
 * with the suvat equations — no numerical error.
 *
 * Lift: a person of mass m stands on scales in a lift. The lift speeds up with acceleration a
 * for t₁, moves at constant speed for t₂, then slows down at the same rate for t₁ (up or down).
 * The scales read the normal force N = m(g + a_y) (a_y = acceleration, up positive).
 * "Cable snaps": the lift is in free fall, a_y = −g, so N = 0.
 *
 * Atwood machine: masses m₁ and m₂ hang over a light frictionless pulley:
 *   a = (m₁ − m₂)g/(m₁ + m₂) (m₁ moves down if positive),  T = 2m₁m₂g/(m₁ + m₂)
 * Table: m₁ on a horizontal table (friction μ_s, μ_d), pulled by a hanging mass m₂:
 *   moves if m₂g > μ_s m₁g;  a = (m₂ − μ_d m₁)g/(m₁ + m₂),  T = m₂(g − a)
 */

export interface LiftParams {
  m: number;
  a: number; // magnitude of the acceleration while speeding up / slowing down [m s^-2]
  t1: number; // time spent speeding up (and slowing down) [s]
  t2: number; // time at constant speed [s]
  dir: 1 | -1; // +1 up, −1 down
  g: number;
  freeFall: boolean; // cable snaps at t = 0 (the lift falls from rest)
}

export class Lift {
  p: LiftParams;
  t = 0;
  constructor(p: LiftParams) {
    this.p = { ...p };
  }
  reset(p?: Partial<LiftParams>) {
    if (p) this.p = { ...this.p, ...p };
    this.t = 0;
  }
  step(dt: number) {
    this.t += dt;
  }
  get duration(): number {
    return this.p.freeFall ? Infinity : 2 * this.p.t1 + this.p.t2;
  }
  /** acceleration at time t (up positive) */
  accel(t = this.t): number {
    const { a, t1, t2, dir, g, freeFall } = this.p;
    if (freeFall) return -g;
    if (t < t1) return dir * a;
    if (t < t1 + t2) return 0;
    if (t < 2 * t1 + t2) return -dir * a;
    return 0;
  }
  /** velocity (up positive), exact */
  velocity(t = this.t): number {
    const { a, t1, t2, dir, g, freeFall } = this.p;
    if (freeFall) return -g * t;
    const vmax = a * t1;
    if (t < t1) return dir * a * t;
    if (t < t1 + t2) return dir * vmax;
    if (t < 2 * t1 + t2) return dir * (vmax - a * (t - t1 - t2));
    return 0;
  }
  /** height above the start (up positive), exact */
  height(t = this.t): number {
    const { a, t1, t2, dir, g, freeFall } = this.p;
    if (freeFall) return -0.5 * g * t * t;
    const vmax = a * t1;
    const s1 = 0.5 * a * t1 * t1;
    if (t < t1) return dir * 0.5 * a * t * t;
    if (t < t1 + t2) return dir * (s1 + vmax * (t - t1));
    const tc = Math.min(t, 2 * t1 + t2) - t1 - t2;
    return dir * (s1 + vmax * t2 + vmax * tc - 0.5 * a * tc * tc);
  }
  /** scales reading = normal force N = m(g + a) */
  normal(t = this.t): number {
    return this.p.m * (this.p.g + this.accel(t));
  }
}

export interface PulleyParams {
  mode: 'atwood' | 'table';
  m1: number;
  m2: number;
  muS: number;
  muD: number;
  g: number;
  L: number; // distance available before something hits the pulley / floor [m]
}

export class Pulley {
  p: PulleyParams;
  t = 0;
  s = 0; // distance moved (m₁ down for atwood; m₁ towards the pulley for table) [m]
  v = 0;
  stopped = false;
  constructor(p: PulleyParams) {
    this.p = { ...p };
  }
  reset(p?: Partial<PulleyParams>) {
    if (p) this.p = { ...this.p, ...p };
    this.t = 0;
    this.s = 0;
    this.v = 0;
    this.stopped = false;
  }
  /** does the table system start to move? */
  get moves(): boolean {
    const { mode, m1, m2, muS } = this.p;
    return mode === 'atwood' ? m1 !== m2 : m2 > muS * m1;
  }
  /** acceleration of the system (signed along s) */
  get a(): number {
    if (this.stopped || !this.moves) return 0;
    const { mode, m1, m2, muD, g } = this.p;
    return mode === 'atwood' ? ((m1 - m2) * g) / (m1 + m2) : ((m2 - muD * m1) * g) / (m1 + m2);
  }
  /** string tension [N] */
  get tension(): number {
    const { mode, m1, m2, g } = this.p;
    if (mode === 'atwood') return m1 * (g - this.a);
    if (!this.moves || this.stopped) return m2 * g; // static: the hanging mass is held up
    return m2 * (g - this.a);
  }
  /** friction on the block on the table [N] (static when at rest) */
  get friction(): number {
    const { mode, m1, m2, muD, g } = this.p;
    if (mode !== 'table') return 0;
    if (!this.moves || this.stopped) return m2 * g;
    return muD * m1 * g;
  }
  step(dt: number) {
    this.t += dt;
    if (this.stopped) return;
    const a = this.a;
    let s = this.s + this.v * dt + 0.5 * a * dt * dt;
    let v = this.v + a * dt;
    if (Math.abs(s) >= this.p.L) {
      // reached the pulley / floor: stop there (the final partial step is not resolved)
      s = Math.sign(s) * this.p.L;
      v = 0;
      this.stopped = true;
    }
    this.s = s;
    this.v = v;
  }
}
