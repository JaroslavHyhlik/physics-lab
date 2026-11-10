/**
 * Vertical spring launcher. A ball of mass m rests on a light spring (stiffness k) that is
 * compressed by Δx and released. y = height of the bottom of the ball above the top of the
 * relaxed spring (y < 0: spring compressed by −y and pushing; the ball is not attached).
 *   m y'' = −mg − k·min(y, 0)
 * Energy: E_k + E_p + E_H = constant, with E_p = mgy and E_H = ½k·min(y,0)².
 *
 * Solved EXACTLY, piece by piece:
 *  - on the spring: SHM about y_eq = −mg/k with ω = √(k/m)
 *  - in the air: free fall, y = y₀ + v₀t − ½gt²
 * The moments of leaving / landing on the spring (y = 0) are found analytically, so the
 * energy is conserved to rounding error and nothing depends on the step size.
 */
export interface LauncherParams {
  k: number; // [N m^-1]
  dx: number; // compression [m]
  m: number; // [kg]
  g: number;
}

export class SpringLauncher {
  p: LauncherParams;
  yy = 0;
  vv = 0;
  t = 0;
  maxY = -Infinity;
  launchSpeed = NaN;

  constructor(p: LauncherParams) {
    this.p = { ...p };
    this.reset();
  }

  reset(p?: Partial<LauncherParams>): void {
    if (p) this.p = { ...this.p, ...p };
    this.yy = -this.p.dx;
    this.vv = 0;
    this.t = 0;
    this.maxY = -this.p.dx;
    this.launchSpeed = NaN;
  }

  private get omega(): number {
    return Math.sqrt(this.p.k / this.p.m);
  }

  /** advance on the spring for time h (SHM about y_eq) */
  private shm(h: number): void {
    const w = this.omega;
    const yeq = (-this.p.m * this.p.g) / this.p.k;
    const u0 = this.yy - yeq;
    const c = Math.cos(w * h);
    const s = Math.sin(w * h);
    this.yy = yeq + u0 * c + (this.vv / w) * s;
    this.vv = -u0 * w * s + this.vv * c;
  }

  /** time until the ball leaves the spring (y = 0 moving up), or Infinity */
  private timeToLeave(): number {
    const w = this.omega;
    const yeq = (-this.p.m * this.p.g) / this.p.k;
    const u0 = this.yy - yeq;
    const R = Math.hypot(u0, this.vv / w);
    const cth = -yeq / R; // u = R cos(ωt − φ) must reach −y_eq
    if (cth > 1) return Infinity;
    const phi = Math.atan2(this.vv / w, u0);
    let th = -Math.acos(cth) + phi; // ωt = θ* + φ with θ* = −acos(c) (u increasing there)
    const T = 2 * Math.PI;
    while (th <= 1e-12) th += T;
    while (th > T + 1e-12) th -= T;
    return th / w;
  }

  step(dt: number): void {
    let left = dt;
    const g = this.p.g;
    for (let guard = 0; guard < 6 && left > 0; guard++) {
      if (this.yy > 0 || (this.yy === 0 && this.vv > 0)) {
        // in the air: time to come back to y = 0
        const tau = (this.vv + Math.sqrt(this.vv * this.vv + 2 * g * this.yy)) / g;
        // highest point inside this piece
        if (this.vv > 0) {
          const ta = this.vv / g;
          if (ta <= Math.min(tau, left)) this.maxY = Math.max(this.maxY, this.yy + (this.vv * this.vv) / (2 * g));
        }
        if (tau >= left) {
          this.yy += this.vv * left - 0.5 * g * left * left;
          this.vv -= g * left;
          left = 0;
        } else {
          this.vv -= g * tau;
          this.yy = 0;
          left -= tau; // lands on the spring (y = 0, moving down): next piece is SHM
        }
      } else {
        const tl = this.timeToLeave();
        if (tl >= left) {
          this.shm(left);
          left = 0;
        } else {
          this.shm(tl);
          this.yy = 0;
          this.vv = Math.abs(this.vv);
          if (Number.isNaN(this.launchSpeed)) this.launchSpeed = this.vv;
          left -= tl;
        }
      }
      this.maxY = Math.max(this.maxY, this.yy);
    }
    this.t += dt;
  }

  get y(): number {
    return this.yy;
  }
  get vel(): number {
    return this.vv;
  }
  get Ek(): number {
    return 0.5 * this.p.m * this.vv ** 2;
  }
  /** gravitational PE relative to the release point */
  get Ep(): number {
    return this.p.m * this.p.g * (this.yy + this.p.dx);
  }
  get EH(): number {
    const c = Math.min(this.yy, 0);
    return 0.5 * this.p.k * c * c;
  }
  get springForce(): number {
    return -this.p.k * Math.min(this.yy, 0);
  }
  get a(): number {
    return -this.p.g + this.springForce / this.p.m;
  }
  /** predicted height gained above the release point: ½kΔx² = mgH */
  get predictedRise(): number {
    return (this.p.k * this.p.dx ** 2) / (2 * this.p.m * this.p.g);
  }
  /** can the spring launch the ball at all? needs ½kΔx² > mgΔx */
  get launches(): boolean {
    return this.p.k * this.p.dx > 2 * this.p.m * this.p.g;
  }
}
