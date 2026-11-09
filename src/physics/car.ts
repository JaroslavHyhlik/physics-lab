/**
 * Straight-line car acceleration on a flat road.
 *   m·dv/dt = F_drive − F_drag − F_roll
 *   F_drive = min(engine/motor force at the wheels, μ_s·(weight on driven wheels))
 *   F_drag  = ½ρC_dAv²   (quadratic air resistance)
 *   F_roll  = C_rr·m·g   (rolling resistance)
 *
 * Powertrains:
 *  - 'ice':   petrol/diesel engine, power curve P(n) = P_max(r + r² − r³) with r = n/n_peak,
 *             gearbox with automatic shifts (no drive force during a shift), clutch-slip launch.
 *  - 'ev':    electric motor, constant torque up to base speed then constant power, single gear.
 *  - 'ideal': textbook constant power P at the wheels (P = Fv).
 *
 * Integrator: RK4 on [x, v, W_drive, W_drag, W_roll] with a fixed step. Gear changes are
 * discrete events between steps. The work integrals let tests check the energy balance.
 */
import { RK4, type Derivative } from '../core/integrators';
import { g } from '../core/constants';

export type Powertrain = 'ice' | 'ev' | 'ideal';

export interface CarParams {
  m: number; // mass [kg]
  powertrain: Powertrain;
  Pmax: number; // peak power [W]
  rpmPeak: number; // ICE: rpm at peak power
  rpmLaunch: number; // ICE: engine speed held by the slipping clutch at launch
  rpmRedline: number; // ICE / EV: maximum rpm
  Tmax: number; // EV: maximum motor torque [N m]
  gears: number[]; // gear ratios
  finalDrive: number;
  rWheel: number; // [m]
  eta: number; // drivetrain efficiency (0–1)
  shiftRpm: number; // ICE: shift up at this rpm
  shiftTime: number; // [s]
  Cd: number;
  A: number; // frontal area [m^2]
  rho: number; // air density [kg m^-3]
  Crr: number; // rolling resistance coefficient
  mu: number; // tyre–road coefficient of static friction
  drivenFraction: number; // fraction of the weight on the driven wheels
  u: number; // initial speed [m/s]
  drag: boolean;
  roll: boolean;
  grip: boolean;
}

const RPM = (2 * Math.PI) / 60; // rad/s per rpm

export class Car {
  p: CarParams;
  /** [x, v, W_drive, W_drag, W_roll] */
  readonly y = new Float64Array(5);
  t = 0;
  gear = 0;
  /** remaining shift time [s]; drive force is zero while > 0 */
  shiftLeft = 0;
  /** set when the driving force is limited by tyre grip */
  wheelspin = false;
  t100 = NaN; // time to reach 100 km/h [s]
  tQuarter = NaN; // time to cover 402.336 m (quarter mile) [s]
  private rk = new RK4(5);

  constructor(p: CarParams) {
    this.p = { ...p, gears: [...p.gears] };
    this.reset();
  }

  reset(p?: Partial<CarParams>): void {
    if (p) this.p = { ...this.p, ...p, gears: [...(p.gears ?? this.p.gears)] };
    this.y.fill(0);
    this.y[1] = this.p.u;
    this.t = 0;
    this.gear = 0;
    this.shiftLeft = 0;
    this.wheelspin = false;
    this.t100 = this.p.u >= 100 / 3.6 ? 0 : NaN;
    this.tQuarter = NaN;
    if (this.p.powertrain === 'ice') {
      // start in the highest gear that keeps the engine above launch rpm (for u > 0)
      while (this.gear < this.p.gears.length - 1 && this.rpmAt(this.p.u, this.gear) > this.p.shiftRpm) this.gear++;
    }
  }

  get x(): number {
    return this.y[0];
  }
  get v(): number {
    return this.y[1];
  }

  /** Overall ratio engine (motor) speed : wheel speed in the given gear. */
  private ratio(gear: number): number {
    return this.p.gears[Math.min(gear, this.p.gears.length - 1)] * this.p.finalDrive;
  }

  /** Engine/motor rpm implied by road speed (no clutch slip). */
  rpmAt(v: number, gear = this.gear): number {
    return ((v / this.p.rWheel) * this.ratio(gear)) / RPM;
  }

  /** Engine speed shown to the driver (clutch holds it at launch rpm when slipping). */
  get rpm(): number {
    const n = this.rpmAt(this.v);
    return this.p.powertrain === 'ice' ? Math.max(n, this.p.rpmLaunch) : n;
  }

  /** ICE power curve [W] at engine speed n [rpm]. */
  enginePower(n: number): number {
    const r = n / this.p.rpmPeak;
    return Math.max(0, this.p.Pmax * (r + r * r - r * r * r));
  }

  /** Soft limiter: power fades to zero over the last 2 % below the redline. */
  private limiter(n: number): number {
    const start = 0.98 * this.p.rpmRedline;
    if (n <= start) return 1;
    if (n >= this.p.rpmRedline) return 0;
    return (this.p.rpmRedline - n) / (this.p.rpmRedline - start);
  }

  /** Maximum force the tyres can transmit, μ_s × normal force on the driven wheels [N]. */
  get gripLimit(): number {
    return this.p.mu * this.p.m * g * this.p.drivenFraction;
  }

  /** Force the powertrain delivers at the wheels before the grip limit [N]. */
  powertrainForce(v: number): number {
    const p = this.p;
    if (p.powertrain === 'ideal') {
      return p.Pmax / Math.max(v, 0.1); // constant power; capped below 0.1 m/s
    }
    if (this.shiftLeft > 0) return 0;
    const G = this.ratio(this.gear);
    const nRoad = this.rpmAt(v);
    if (p.powertrain === 'ev') {
      const w = Math.max(nRoad * RPM, 1e-9);
      const T = Math.min(p.Tmax, p.Pmax / w) * this.limiter(nRoad);
      return (T * G * p.eta) / p.rWheel;
    }
    // ICE: below launch rpm the clutch slips and the engine runs at launch rpm
    const n = Math.max(nRoad, p.rpmLaunch);
    const T = (this.enginePower(n) / (n * RPM)) * this.limiter(n);
    return (T * G * p.eta) / p.rWheel;
  }

  driveForce(v: number): number {
    const f = this.powertrainForce(v);
    return this.p.grip ? Math.min(f, this.gripLimit) : f;
  }

  dragForce(v: number): number {
    return this.p.drag ? 0.5 * this.p.rho * this.p.Cd * this.p.A * v * v : 0;
  }

  rollForce(v: number, drive: number): number {
    if (!this.p.roll) return 0;
    const f = this.p.Crr * this.p.m * g;
    // at rest, rolling resistance cannot exceed the applied force (no backwards motion)
    return v > 1e-9 ? f : Math.min(f, drive);
  }

  /** Net acceleration at speed v [m s^-2]. */
  accel(v: number): number {
    const fd = this.driveForce(v);
    return (fd - this.dragForce(v) - this.rollForce(v, fd)) / this.p.m;
  }

  private deriv: Derivative = (_t, y, out) => {
    const v = Math.max(0, y[1]);
    const fd = this.driveForce(v);
    const fa = this.dragForce(v);
    const fr = this.rollForce(v, fd);
    out[0] = v;
    out[1] = (fd - fa - fr) / this.p.m;
    out[2] = fd * v;
    out[3] = fa * v;
    out[4] = fr * v;
  };

  step(dt: number): void {
    const p = this.p;
    // gearbox logic (discrete, between steps)
    if (p.powertrain === 'ice') {
      if (this.shiftLeft > 0) {
        this.shiftLeft -= dt;
        if (this.shiftLeft <= 1e-12) {
          this.shiftLeft = 0;
          this.gear++;
        }
      } else if (this.gear < p.gears.length - 1 && this.rpmAt(this.v) >= p.shiftRpm) {
        if (p.shiftTime > 0) this.shiftLeft = p.shiftTime;
        else this.gear++;
      }
    }
    this.wheelspin = p.grip && this.powertrainForce(this.v) > this.gripLimit;
    const v0 = this.v;
    const x0 = this.x;
    this.rk.step(this.deriv, this.t, this.y, dt);
    if (this.y[1] < 0) this.y[1] = 0;
    // event times (linear interpolation within the step)
    const v100 = 100 / 3.6;
    if (Number.isNaN(this.t100) && v0 < v100 && this.v >= v100) {
      this.t100 = this.t + (dt * (v100 - v0)) / (this.v - v0);
    }
    const q = 402.336;
    if (Number.isNaN(this.tQuarter) && x0 < q && this.x >= q) {
      this.tQuarter = this.t + (dt * (q - x0)) / (this.x - x0);
    }
    this.t += dt;
  }

  get kineticEnergy(): number {
    return 0.5 * this.p.m * this.v * this.v;
  }
  get workDrive(): number {
    return this.y[2];
  }
  get workDrag(): number {
    return this.y[3];
  }
  get workRoll(): number {
    return this.y[4];
  }
  /** Power delivered at the wheels, F_drive·v [W] */
  get wheelPower(): number {
    return this.driveForce(this.v) * this.v;
  }
}

/** Top speed where wheel power balances resistance: P = (½ρC_dAv² + C_rr·m·g)·v (bisection). */
export function topSpeedConstantPower(P: number, halfRhoCdA: number, Froll: number): number {
  let lo = 0;
  let hi = 1;
  while ((halfRhoCdA * hi * hi + Froll) * hi < P) hi *= 2;
  for (let i = 0; i < 200; i++) {
    const mid = 0.5 * (lo + hi);
    if ((halfRhoCdA * mid * mid + Froll) * mid < P) lo = mid;
    else hi = mid;
  }
  return 0.5 * (lo + hi);
}
