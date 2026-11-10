/**
 * One-dimensional motion driven in different ways, for studying x–t, v–t and a–t graphs.
 *  - 'acc':    you set the acceleration a directly
 *  - 'vel':    you set a target velocity; the object changes speed at most at a_max
 *  - 'pos':    you set a target position (drag); critically damped approach, |a| ≤ a_max
 *  - 'script': a(t) follows a preset (suvat situations)
 * Within one step the acceleration is constant, so x and v are advanced exactly:
 *   x += v dt + ½ a dt²,  v += a dt.
 * The object stops at walls x = ±xmax.
 */
export type DriveMode = 'acc' | 'vel' | 'pos' | 'script';

export interface Script {
  /** acceleration at time t */
  a: (t: number) => number;
  x0: number;
  u: number;
  T: number; // duration
}

export const scripts: Record<string, { label: string; s: Script }> = {
  uniform: { label: 'Uniform velocity', s: { a: () => 0, x0: -8, u: 1.5, T: 10 } },
  accel: { label: 'Uniform acceleration from rest', s: { a: () => 0.4, x0: -8, u: 0, T: 8 } },
  brake: { label: 'Moving, then braking to a stop', s: { a: (t) => (t < 3 ? 0 : t < 6 ? -0.8 : 0), x0: -8, u: 2.4, T: 9 } },
  turn: { label: 'Slows down, turns round, comes back', s: { a: () => -0.6, x0: -6, u: 3, T: 10 } },
  trip: { label: 'Speed up, cruise, slow down', s: { a: (t) => (t < 2 ? 1 : t < 6 ? 0 : t < 8 ? -1 : 0), x0: -9, u: 0, T: 10 } },
};

export class Mover {
  x = 0;
  v = 0;
  a = 0;
  t = 0;
  mode: DriveMode = 'acc';
  /** acceleration command (acc mode), target velocity (vel), target position (pos) */
  input = 0;
  amax = 3;
  xmax = 10;
  script: Script = scripts.uniform.s;

  reset(x0 = 0, u = 0): void {
    this.x = x0;
    this.v = u;
    this.a = 0;
    this.t = 0;
  }

  /** acceleration chosen for this step (constant during the step) */
  private command(dt: number): number {
    const { amax } = this;
    switch (this.mode) {
      case 'acc':
        return this.input;
      case 'vel': {
        const need = (this.input - this.v) / dt;
        return Math.max(-amax, Math.min(amax, need));
      }
      case 'pos': {
        // critically damped approach with ω = 2 s⁻¹, limited to a_max
        const w = 2;
        const a = w * w * (this.input - this.x) - 2 * w * this.v;
        return Math.max(-amax, Math.min(amax, a));
      }
      case 'script': {
        // evaluate at the middle of the step, so phase changes land on the right step
        const tm = this.t + dt / 2;
        return tm < this.script.T ? this.script.a(tm) : 0;
      }
    }
  }

  step(dt: number): void {
    let a = this.command(dt);
    // walls: stop dead at ±xmax
    let x = this.x + this.v * dt + 0.5 * a * dt * dt;
    let v = this.v + a * dt;
    if (Math.abs(x) >= this.xmax) {
      x = Math.sign(x) * this.xmax;
      v = 0;
      a = 0;
    }
    this.x = x;
    this.v = v;
    this.a = a;
    this.t += dt;
  }
}
