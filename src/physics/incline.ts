/**
 * Block on an inclined plane with static and dynamic friction and an optional applied force
 * parallel to the slope. Coordinate s = distance up the slope from the bottom, v = ds/dt.
 *
 *   F_N = mg cosθ
 *   at rest:  stays if |F − mg sinθ| ≤ μ_s F_N  (static friction balances it)
 *   moving:   F_f = μ_d F_N opposite to v
 *
 * The forces are constant while the direction of motion does not change, so the motion is
 * piecewise uniformly accelerated. Each step is integrated EXACTLY with the suvat equations;
 * the moment the block stops is found analytically inside the step. No numerical error.
 */
export interface InclineParams {
  theta: number; // [rad]
  m: number; // [kg]
  muS: number;
  muD: number;
  F: number; // applied force along the slope, + = up the slope [N]
  L: number; // slope length [m]
  s0: number; // start position [m]
  u: number; // initial velocity along the slope [m s^-1]
  g: number;
  friction: boolean;
}

export type BlockState = 'rest' | 'up' | 'down';

export class Incline {
  p: InclineParams;
  t = 0;
  s = 0;
  v = 0;
  /** work done against friction (thermal energy) [J] */
  heat = 0;
  /** work done by the applied force [J] */
  workF = 0;
  /** at an end of the slope */
  stopped = false;

  constructor(p: InclineParams) {
    this.p = { ...p };
    this.reset();
  }

  reset(p?: Partial<InclineParams>): void {
    if (p) this.p = { ...this.p, ...p };
    this.t = 0;
    this.s = this.p.s0;
    this.v = this.p.u;
    this.heat = 0;
    this.workF = 0;
    this.stopped = false;
  }

  get normal(): number {
    return this.p.m * this.p.g * Math.cos(this.p.theta);
  }
  /** component of the weight along the slope (magnitude, acts down the slope) */
  get weightAlong(): number {
    return this.p.m * this.p.g * Math.sin(this.p.theta);
  }
  get weightPerp(): number {
    return this.normal;
  }
  /** net force without friction, + = up the slope */
  private get drive(): number {
    return this.p.F - this.weightAlong;
  }

  get state(): BlockState {
    if (this.v > 0) return 'up';
    if (this.v < 0) return 'down';
    const d = this.drive;
    if (!this.p.friction) return d > 0 ? 'up' : d < 0 ? 'down' : 'rest';
    return Math.abs(d) <= this.p.muS * this.normal + 1e-12 ? 'rest' : d > 0 ? 'up' : 'down';
  }

  /** Friction force on the block (+ = up the slope) [N] */
  get friction(): number {
    if (!this.p.friction) return 0;
    const st = this.state;
    if (st === 'rest') return -this.drive; // static friction, exactly what is needed
    return (st === 'up' ? -1 : 1) * this.p.muD * this.normal;
  }

  /** Acceleration along the slope [m s^-2] */
  get a(): number {
    if (this.stopped) return 0;
    return (this.drive + this.friction) / this.p.m;
  }

  get isStatic(): boolean {
    return this.state === 'rest';
  }

  step(dt: number): void {
    let left = dt;
    for (let guard = 0; guard < 4 && left > 0; guard++) {
      if (this.stopped) break;
      const st = this.state;
      if (st === 'rest') {
        this.v = 0;
        break;
      }
      const a = this.a;
      // time until v crosses zero (only if decelerating)
      let tau = left;
      let stops = false;
      if (this.v !== 0 && Math.sign(a) !== Math.sign(this.v)) {
        const ts = -this.v / a;
        if (ts <= left) {
          tau = ts;
          stops = true;
        }
      }
      const s1 = this.s + this.v * tau + 0.5 * a * tau * tau;
      const v1 = stops ? 0 : this.v + a * tau;
      const ds = s1 - this.s;
      this.heat += this.p.friction ? this.p.muD * this.normal * Math.abs(ds) : 0;
      this.workF += this.p.F * ds;
      this.s = s1;
      this.v = v1;
      left -= tau;
      // ends of the slope
      if (this.s <= 0 || this.s >= this.p.L) {
        this.s = Math.min(this.p.L, Math.max(0, this.s));
        this.v = 0;
        this.stopped = true;
      }
      if (!stops) break;
      // after stopping, the next pass re-evaluates static vs sliding
      if (this.state === 'rest') break;
      if (this.v === 0) {
        // starts sliding the other way from rest: continue with the new regime
        const a2 = this.a;
        const s2 = this.s + 0.5 * a2 * left * left;
        const v2 = a2 * left;
        const d2 = s2 - this.s;
        this.heat += this.p.friction ? this.p.muD * this.normal * Math.abs(d2) : 0;
        this.workF += this.p.F * d2;
        this.s = s2;
        this.v = v2;
        left = 0;
        if (this.s <= 0 || this.s >= this.p.L) {
          this.s = Math.min(this.p.L, Math.max(0, this.s));
          this.v = 0;
          this.stopped = true;
        }
      }
    }
    this.t += dt;
  }

  get Ek(): number {
    return 0.5 * this.p.m * this.v * this.v;
  }
  /** gravitational potential energy relative to the bottom of the slope */
  get Ep(): number {
    return this.p.m * this.p.g * this.s * Math.sin(this.p.theta);
  }
  /** angle above which a block at rest starts to slide (no applied force) */
  get criticalAngle(): number {
    return Math.atan(this.p.muS);
  }
}
