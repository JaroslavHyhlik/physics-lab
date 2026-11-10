/**
 * Car seen from above: a rigid body in the plane ("bicycle model": one front and one rear
 * axle), rear-wheel drive.
 *
 * State (body frame): forward speed vx, sideways speed vy, yaw rate r; world position X, Y and
 * heading ψ. Equations of motion:
 *   m(v̇x − r vy) = ΣFx,   m(v̇y + r vx) = ΣFy,   I_z ṙ = a·Fy,front − b·Fy,rear
 *
 * Tyres: each axle asks for a force — sideways F_y = −C α (α = slip angle) and lengthwise from
 * the throttle or brakes. Static friction can supply it while |F| ≤ μ_s F_N (friction circle).
 * If more is needed the tyre starts to SLIDE and the force drops to μ_d F_N, pointing against
 * the sliding; it grips again only when the request falls below μ_d F_N (hysteresis).
 * That drop from static to dynamic friction is what lets a car drift.
 *
 * Integrator: RK4 with a fixed 1 ms step; the grip/slide state changes between steps.
 */
import { RK4, type Derivative } from '../core/integrators';

export interface DriftParams {
  m: number; // [kg]
  a: number; // CG → front axle [m]
  b: number; // CG → rear axle [m]
  Iz: number; // yaw moment of inertia [kg m^2]
  muS: number;
  muD: number;
  Ck: number; // cornering stiffness per unit normal force [rad^-1] (C = Ck·F_N)
  Pmax: number; // engine power at the rear wheels [W]
  g: number;
  CdA: number; // drag area [m^2]
  rho: number;
}

export interface Controls {
  steer: number; // front wheel angle [rad] (+ = left)
  throttle: number; // 0..1
  brake: number; // 0..1
  handbrake: boolean;
}

export interface AxleState {
  sliding: boolean;
  /** tyre force in the body frame [N] */
  fx: number;
  fy: number;
  Fz: number;
  alpha: number;
}

export class DriftCar {
  p: DriftParams;
  /** [X, Y, psi, vx, vy, r] */
  readonly y = new Float64Array(6);
  t = 0;
  readonly front: AxleState = { sliding: false, fx: 0, fy: 0, Fz: 0, alpha: 0 };
  readonly rear: AxleState = { sliding: false, fx: 0, fy: 0, Fz: 0, alpha: 0 };
  ctl: Controls = { steer: 0, throttle: 0, brake: 0, handbrake: false };
  private rk = new RK4(6);
  private tmpF = { fx: 0, fy: 0, alpha: 0 };
  private tmpR = { fx: 0, fy: 0, alpha: 0 };

  constructor(p: DriftParams) {
    this.p = { ...p };
    this.reset();
  }

  reset(p?: Partial<DriftParams>, v0 = 0): void {
    if (p) this.p = { ...this.p, ...p };
    this.y.fill(0);
    this.y[3] = v0;
    this.t = 0;
    this.front.sliding = this.rear.sliding = false;
    const L = this.p.a + this.p.b;
    this.front.Fz = (this.p.m * this.p.g * this.p.b) / L;
    this.rear.Fz = (this.p.m * this.p.g * this.p.a) / L;
  }

  get L(): number {
    return this.p.a + this.p.b;
  }

  /**
   * Force on one axle (tyre frame: x along the wheel, y sideways), then rotated into the body
   * frame by the steer angle. Contact velocity (u, w) in the tyre frame.
   */
  private axleForce(ax: AxleState, u: number, w: number, fxReq: number, locked: boolean, out: { fx: number; fy: number; alpha: number }) {
    const { muS, muD, Ck } = this.p;
    const Fz = ax.Fz;
    const alpha = Math.atan2(w, Math.max(Math.abs(u), 1)); // regularised at very low speed
    const fyReq = -Ck * Fz * alpha;
    const req = Math.hypot(fxReq, fyReq);
    let sliding = ax.sliding;
    if (locked) sliding = true;
    else if (!sliding && req > muS * Fz) sliding = true;
    else if (sliding && req < muD * Fz) sliding = false;
    if (!sliding) {
      out.fx = fxReq;
      out.fy = fyReq;
    } else if (locked) {
      // locked wheel: the whole patch slides; friction opposes the contact velocity
      const sp = Math.hypot(u, w);
      const k = sp > 1e-3 ? (muD * Fz) / sp : 0;
      out.fx = -k * u;
      out.fy = -k * w;
    } else {
      // sliding: the force falls to μ_d F_N, in the direction that was asked for
      const k = req > 0 ? (muD * Fz) / req : 0;
      out.fx = k * fxReq;
      out.fy = k * fyReq;
    }
    out.alpha = alpha;
    return sliding;
  }

  private forces(y: ArrayLike<number>, commit: boolean) {
    const { a, b, Pmax, muS } = this.p;
    const vx = y[3];
    const vy = y[4];
    const r = y[5];
    const d = this.ctl.steer;
    const c = Math.cos(d);
    const s = Math.sin(d);
    // front contact velocity in the wheel frame
    const vfx = vx;
    const vfy = vy + a * r;
    const uf = vfx * c + vfy * s;
    const wf = -vfx * s + vfy * c;
    const sgn = vx >= 0 ? 1 : -1;
    const brakeF = -sgn * this.ctl.brake * muS * this.front.Fz * 1.2;
    const fs = this.axleForce(this.front, uf, wf, Math.abs(vx) > 0.01 ? brakeF : 0, false, this.tmpF);
    // rear
    const ur = vx;
    const wr = vy - b * r;
    let fxr = 0;
    if (this.ctl.throttle > 0) fxr = this.ctl.throttle * Math.min(1.5 * this.p.m * this.p.g, Pmax / Math.max(Math.abs(vx), 1));
    if (this.ctl.brake > 0 && Math.abs(vx) > 0.01) fxr -= sgn * this.ctl.brake * muS * this.rear.Fz * 1.2;
    const locked = this.ctl.handbrake && Math.abs(vx) > 0.3;
    const rs = this.axleForce(this.rear, ur, wr, fxr, locked, this.tmpR);
    // rotate the front force into the body frame
    const Ffx = this.tmpF.fx * c - this.tmpF.fy * s;
    const Ffy = this.tmpF.fx * s + this.tmpF.fy * c;
    if (commit) {
      this.front.sliding = fs;
      this.rear.sliding = rs;
      this.front.fx = Ffx;
      this.front.fy = Ffy;
      this.front.alpha = this.tmpF.alpha;
      this.rear.fx = this.tmpR.fx;
      this.rear.fy = this.tmpR.fy;
      this.rear.alpha = this.tmpR.alpha;
    }
    return { Ffx, Ffy, Frx: this.tmpR.fx, Fry: this.tmpR.fy };
  }

  private deriv: Derivative = (_t, y, out) => {
    const { m, a, b, Iz, CdA, rho } = this.p;
    const F = this.forces(y, false);
    const vx = y[3];
    const vy = y[4];
    const r = y[5];
    const v = Math.hypot(vx, vy);
    const drag = 0.5 * rho * CdA * v;
    const psi = y[2];
    out[0] = vx * Math.cos(psi) - vy * Math.sin(psi);
    out[1] = vx * Math.sin(psi) + vy * Math.cos(psi);
    out[2] = r;
    out[3] = (F.Ffx + F.Frx - drag * vx) / m + r * vy;
    out[4] = (F.Ffy + F.Fry - drag * vy) / m - r * vx;
    out[5] = (a * F.Ffy - b * F.Fry) / Iz;
  };

  step(dt: number): void {
    // decide grip/slide from the state at the start of the step (kept fixed during it)
    this.forces(this.y, true);
    const fS = this.front.sliding;
    const rS = this.rear.sliding;
    this.rk.step(this.deriv, this.t, this.y, dt);
    this.front.sliding = fS;
    this.rear.sliding = rS;
    // at (almost) rest with no throttle: stop creeping
    if (this.ctl.throttle === 0 && Math.hypot(this.y[3], this.y[4]) < 0.05 && Math.abs(this.y[5]) < 0.05) {
      this.y[3] = this.y[4] = this.y[5] = 0;
    }
    this.t += dt;
  }

  get speed(): number {
    return Math.hypot(this.y[3], this.y[4]);
  }
  /** drift (body slip) angle β = atan(vy / vx) */
  get beta(): number {
    return Math.abs(this.y[3]) < 0.5 ? 0 : Math.atan2(this.y[4], Math.abs(this.y[3]));
  }
  /** sideways acceleration felt in the car, a_y = v̇y + r vx (body frame) */
  get latAccel(): number {
    return (this.front.fy + this.rear.fy) / this.p.m;
  }
}

/** Linear (small-angle) steady-state yaw rate: r = vδ / (L + K v²), K = (m/L)(b/C_f − a/C_r). */
export function steadyYawRate(p: DriftParams, v: number, delta: number): number {
  const L = p.a + p.b;
  const Fzf = (p.m * p.g * p.b) / L;
  const Fzr = (p.m * p.g * p.a) / L;
  const Cf = p.Ck * Fzf;
  const Cr = p.Ck * Fzr;
  const K = (p.m / L) * (p.b / Cf - p.a / Cr);
  return (v * delta) / (L + K * v * v);
}
