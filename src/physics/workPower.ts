/**
 * A motor (input power P_in, efficiency η) pulls a crate of mass m up a slope of angle θ with
 * a rope parallel to the slope (θ = 90° is a crane lifting a load). Friction μ on the slope.
 *   output power P_out = η P_in;  rope force F = min(F_max, P_out / v)  (P = Fv)
 *   m dv/dt = F − mg(sinθ + μ cosθ)   (moving up the slope)
 * Terminal speed: v_t = P_out / (mg(sinθ + μ cosθ)).
 * Energy bookkeeping (integrated alongside): work by the rope W = ∫Fv dt, friction heat
 * Q_f = ∫μmg cosθ v dt, motor heat Q_m = (1/η − 1)W, input energy E_in = W/η.
 * Integrator: RK4 on [s, v, W, Q_f].
 */
import { RK4, type Derivative } from '../core/integrators';

export interface WorkParams {
  Pin: number; // [W]
  eta: number;
  Fmax: number; // largest force the winch can give [N]
  m: number;
  theta: number; // [rad]
  mu: number;
  g: number;
  L: number; // length of the slope [m]
}

export class Winch {
  p: WorkParams;
  readonly y = new Float64Array(4); // s, v, W, Qf
  t = 0;
  atTop = false;
  private rk = new RK4(4);

  constructor(p: WorkParams) {
    this.p = { ...p };
    this.reset();
  }

  reset(p?: Partial<WorkParams>): void {
    if (p) this.p = { ...this.p, ...p };
    this.y.fill(0);
    this.t = 0;
    this.atTop = false;
  }

  get Pout(): number {
    return this.p.eta * this.p.Pin;
  }
  /** resistive force while moving up: weight component + friction */
  get resist(): number {
    const { m, g, theta, mu } = this.p;
    return m * g * (Math.sin(theta) + mu * Math.cos(theta));
  }
  force(v = this.y[1]): number {
    if (this.atTop) return this.resist; // holding the load
    return Math.min(this.p.Fmax, this.Pout / Math.max(v, 1e-9));
  }
  get moves(): boolean {
    return Math.min(this.p.Fmax, this.Pout / 1e-9) > this.resist;
  }
  get terminalSpeed(): number {
    return this.Pout / this.resist;
  }

  private deriv: Derivative = (_t, y, out) => {
    const v = Math.max(0, y[1]);
    const F = Math.min(this.p.Fmax, this.Pout / Math.max(v, 1e-9));
    const { m, g, theta, mu } = this.p;
    const net = F - this.resist;
    out[0] = v;
    out[1] = v === 0 && net <= 0 ? 0 : net / m;
    out[2] = F * v;
    out[3] = mu * m * g * Math.cos(theta) * v;
  };

  step(dt: number): void {
    this.t += dt;
    if (this.atTop || !this.moves) return;
    this.rk.step(this.deriv, this.t - dt, this.y, dt);
    if (this.y[1] < 0) this.y[1] = 0;
    if (this.y[0] >= this.p.L) {
      this.y[0] = this.p.L;
      this.y[1] = 0;
      this.atTop = true;
    }
  }

  get s(): number {
    return this.y[0];
  }
  get v(): number {
    return this.y[1];
  }
  get a(): number {
    if (this.atTop || !this.moves) return 0;
    return (this.force() - this.resist) / this.p.m;
  }
  get work(): number {
    return this.y[2];
  }
  get frictionHeat(): number {
    return this.y[3];
  }
  get Ep(): number {
    return this.p.m * this.p.g * this.y[0] * Math.sin(this.p.theta);
  }
  get Ek(): number {
    return 0.5 * this.p.m * this.y[1] ** 2;
  }
  get inputEnergy(): number {
    return this.work / this.p.eta;
  }
  get motorHeat(): number {
    return this.inputEnergy - this.work;
  }
}
