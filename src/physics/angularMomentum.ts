/**
 * Conservation of angular momentum L = Iω when no external torque acts about the axis.
 *
 * Spinner: a person on a frictionless turntable holds two masses m at distance r from the axis.
 *   I(r) = I₀ + 2m r²,  L = I(r)ω = constant  ⇒  ω = L / I(r)
 *   Pulling the arms in does work: E_k = L²/(2I) increases.
 *
 * Two discs: disc 1 (I₁, ω₁) spins, disc 2 (I₂) is dropped onto it at t_d. Kinetic friction
 * between them gives a constant torque τ until they turn together:
 *   ω₁ falls at τ/I₁, ω₂ rises at τ/I₂;  final ω = I₁ω₁/(I₁ + I₂) (a "rotational inelastic
 *   collision"); E_k falls to I₁/(I₁+I₂) of its value.
 *
 * Merry-go-round: a person of mass m walks at speed u (relative to the platform) around its
 * edge (radius R). Platform (I_p) and person start at rest, so the total L stays 0:
 *   I_p ω + mR(Rω + u) = 0  ⇒  ω = −mRu/(I_p + mR²)
 * All formulas are exact; angles are advanced exactly (ω is constant or linear in each phase).
 */
export interface SpinnerParams {
  I0: number;
  m: number;
  omega0: number; // spin at the starting arm radius
  r0: number;
}

export class Spinner {
  p: SpinnerParams;
  r: number;
  angle = 0;
  t = 0;
  constructor(p: SpinnerParams) {
    this.p = { ...p };
    this.r = p.r0;
  }
  get I(): number {
    return this.p.I0 + 2 * this.p.m * this.r * this.r;
  }
  get L(): number {
    return (this.p.I0 + 2 * this.p.m * this.p.r0 * this.p.r0) * this.p.omega0;
  }
  get omega(): number {
    return this.L / this.I;
  }
  get Ek(): number {
    return (this.L * this.L) / (2 * this.I);
  }
  step(dt: number) {
    this.angle += this.omega * dt;
    this.t += dt;
  }
}

export interface DiscsParams {
  I1: number;
  I2: number;
  omega1: number;
  tau: number; // friction torque while slipping [N m]
  tDrop: number;
}

export class Discs {
  p: DiscsParams;
  t = 0;
  w1: number;
  w2 = 0;
  a1 = 0;
  a2 = 0;
  joined = false;
  constructor(p: DiscsParams) {
    this.p = { ...p };
    this.w1 = p.omega1;
  }
  get finalOmega(): number {
    return (this.p.I1 * this.p.omega1) / (this.p.I1 + this.p.I2);
  }
  /** friction torque on disc 2 right now */
  get torque(): number {
    return this.t >= this.p.tDrop && !this.joined ? this.p.tau : 0;
  }
  step(dt: number) {
    const { I1, I2, tau, tDrop } = this.p;
    let left = dt;
    // free spin before the drop
    if (this.t < tDrop) {
      const h = Math.min(left, tDrop - this.t);
      this.a1 += this.w1 * h;
      this.t += h;
      left -= h;
    }
    if (left > 0 && !this.joined) {
      // slipping: ω1 decreases, ω2 increases until equal
      const d1 = -tau / I1;
      const d2 = tau / I2;
      const tj = (this.w1 - this.w2) / (d2 - d1);
      const h = Math.min(left, tj);
      this.a1 += this.w1 * h + 0.5 * d1 * h * h;
      this.a2 += this.w2 * h + 0.5 * d2 * h * h;
      this.w1 += d1 * h;
      this.w2 += d2 * h;
      this.t += h;
      left -= h;
      if (h >= tj - 1e-15) {
        this.joined = true;
        this.w1 = this.w2 = this.finalOmega;
      }
    }
    if (left > 0) {
      this.a1 += this.w1 * left;
      this.a2 += this.w2 * left;
      this.t += left;
    }
  }
  get L(): number {
    return this.p.I1 * this.w1 + this.p.I2 * this.w2;
  }
  get Ek(): number {
    return 0.5 * this.p.I1 * this.w1 ** 2 + 0.5 * this.p.I2 * this.w2 ** 2;
  }
}

export interface MgrParams {
  Ip: number;
  m: number;
  R: number;
  u: number; // walking speed relative to the platform (+ = anticlockwise)
}

/** platform angular velocity while the person walks (total L = 0) */
export function mgrOmega(p: MgrParams): number {
  return (-p.m * p.R * p.u) / (p.Ip + p.m * p.R * p.R);
}

export class MerryGoRound {
  p: MgrParams;
  t = 0;
  platform = 0; // platform angle
  person = 0; // person's angle (ground frame)
  walking = true;
  constructor(p: MgrParams) {
    this.p = { ...p };
  }
  get omegaP(): number {
    return this.walking ? mgrOmega(this.p) : 0;
  }
  get omegaPerson(): number {
    return this.walking ? this.omegaP + this.p.u / this.p.R : 0;
  }
  step(dt: number) {
    this.platform += this.omegaP * dt;
    this.person += this.omegaPerson * dt;
    this.t += dt;
  }
  get L(): number {
    const { Ip, m, R } = this.p;
    return Ip * this.omegaP + m * R * R * this.omegaPerson;
  }
}
