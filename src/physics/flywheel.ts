/**
 * Flywheel (moment of inertia I) on an axle of radius r; a string wound on the axle carries a
 * hanging mass m that falls a height h. A constant friction torque τ_f acts in the bearing.
 *   while the mass falls:  mg − T = ma,  Tr − τ_f = Iα,  a = αr
 *     ⇒ a = (mgr − τ_f) r / (I + mr²),  T = m(g − a)
 *   after the mass lands (string comes off): α = −τ_f / I until the wheel stops.
 * Both phases have constant acceleration, so the motion is solved exactly.
 */
export interface FlywheelParams {
  I: number;
  r: number;
  m: number;
  h: number;
  tauF: number;
  g: number;
}

export class Flywheel {
  p: FlywheelParams;
  t = 0;
  y = 0; // distance fallen [m]
  omega = 0;
  theta = 0;
  landed = false;
  heat = 0;
  constructor(p: FlywheelParams) {
    this.p = { ...p };
  }
  reset(p?: Partial<FlywheelParams>) {
    if (p) this.p = { ...this.p, ...p };
    this.t = 0;
    this.y = 0;
    this.omega = 0;
    this.theta = 0;
    this.landed = false;
    this.heat = 0;
  }
  /** does the mass start moving at all? */
  get moves(): boolean {
    return this.p.m * this.p.g * this.p.r > this.p.tauF;
  }
  get aFall(): number {
    const { I, r, m, tauF, g } = this.p;
    return this.moves ? ((m * g * r - tauF) * r) / (I + m * r * r) : 0;
  }
  get alpha(): number {
    if (!this.landed) return this.aFall / this.p.r;
    return this.omega > 0 ? -this.p.tauF / this.p.I : 0;
  }
  get tension(): number {
    return this.landed ? 0 : this.p.m * (this.p.g - this.aFall);
  }
  get v(): number {
    return this.landed ? 0 : this.omega * this.p.r;
  }
  step(dt: number) {
    let left = dt;
    if (!this.landed && this.moves) {
      const a = this.aFall;
      const alpha = a / this.p.r;
      // time until the mass has fallen h
      const tl = (-this.omega * this.p.r + Math.sqrt((this.omega * this.p.r) ** 2 + 2 * a * (this.p.h - this.y))) / a;
      const h = Math.min(left, tl);
      this.theta += this.omega * h + 0.5 * alpha * h * h;
      this.heat += this.p.tauF * (this.omega * h + 0.5 * alpha * h * h);
      this.omega += alpha * h;
      this.y = this.p.r * this.theta;
      this.t += h;
      left -= h;
      if (h >= tl - 1e-15) {
        this.y = this.p.h;
        this.landed = true;
      }
    }
    if (left > 0 && this.landed && this.omega > 0) {
      const alpha = -this.p.tauF / this.p.I;
      const ts = alpha < 0 ? this.omega / -alpha : Infinity;
      const h = Math.min(left, ts);
      const dth = this.omega * h + 0.5 * alpha * h * h;
      this.theta += dth;
      this.heat += this.p.tauF * dth;
      this.omega = h >= ts ? 0 : this.omega + alpha * h;
    }
    this.t += left;
  }
  get EkMass(): number {
    return 0.5 * this.p.m * this.v * this.v;
  }
  get EkRot(): number {
    return 0.5 * this.p.I * this.omega * this.omega;
  }
  get EpLost(): number {
    return this.p.m * this.p.g * this.y;
  }
}
