/**
 * Greenhouse effect with photon packets (qualitative Monte Carlo model, 2D slice).
 * Every packet carries the same energy. Sunlight packets (visible) arrive from the top at a
 * rate that stands for S/4 = 340 W m⁻²; a fraction α is reflected, the rest warms the ground.
 * The ground emits infrared packets at a rate given by σT⁴ (in packet units), so its
 * temperature is the one a black body would need to radiate that power. Greenhouse molecules
 * in the air absorb infrared packets that hit them (visible light passes) and re-emit them
 * after a short random delay in a random direction — half of them back down.
 * Energy is tracked exactly: sunlight in = reflected out + infrared out + stored + in flight.
 * Time and distances are not to scale. Seeded RNG, so runs are reproducible.
 */
import { Rng } from '../core/rng';
import { sigma } from '../core/constants';

export const MAX_PHOTONS = 800;
export const MAX_MOLECULES = 80;
/** packet energy expressed as W m⁻² per (packet per second) */
export const SUN_RATE = 40; // packets per second ↔ 340 W m⁻²
export const W_PER_RATE = 340 / SUN_RATE;

export class GreenhouseBox {
  // photons: x, y in [0, 1] (y up, ground at 0, space above 1), direction, kind (0 visible, 1 IR)
  readonly px = new Float64Array(MAX_PHOTONS);
  readonly py = new Float64Array(MAX_PHOTONS);
  readonly dx = new Float64Array(MAX_PHOTONS);
  readonly dy = new Float64Array(MAX_PHOTONS);
  readonly kind = new Uint8Array(MAX_PHOTONS);
  readonly alive = new Uint8Array(MAX_PHOTONS);
  readonly mx = new Float64Array(MAX_MOLECULES);
  readonly my = new Float64Array(MAX_MOLECULES);
  /** time left before an excited molecule re-emits (0 = not excited) */
  readonly excited = new Float64Array(MAX_MOLECULES);
  nMol = 0;
  t = 0;
  /** ground energy in packets; T = E/C */
  Eg: number;
  Eg0: number;
  sunIn = 0;
  reflectedOut = 0;
  irOut = 0;
  absorbedByMolecules = 0;
  speed = 0.45; // box heights per second (animation)
  capture = 0.03; // molecule capture radius
  delay = 0.25; // mean re-emission delay [s]
  private rng: Rng;

  constructor(
    public albedo: number,
    molecules: number,
    /** ground heat capacity in packets per kelvin (sets only how fast T changes) */
    public C = 1.3,
    T0 = 255,
    seed = 3,
  ) {
    this.rng = new Rng(seed);
    this.Eg = C * T0;
    this.Eg0 = this.Eg;
    this.setMolecules(molecules);
  }

  /**
   * Fills the air with the stream of sunlight and lets the ground settle without greenhouse
   * molecules, then restarts the clock and counters (so the start is the no-greenhouse balance).
   */
  warmUp(seconds: number, dt = 1 / 120): void {
    const n = this.nMol;
    this.nMol = 0;
    while (this.t < seconds) this.step(dt);
    this.nMol = n;
    this.t = 0;
    this.sunIn = 0;
    this.reflectedOut = 0;
    this.irOut = 0;
    this.absorbedByMolecules = 0;
    this.Eg0 = this.Eg + this.inFlight;
  }

  setMolecules(n: number): void {
    const r = new Rng(99);
    this.nMol = Math.min(MAX_MOLECULES, Math.max(0, Math.round(n)));
    for (let i = 0; i < MAX_MOLECULES; i++) {
      this.mx[i] = r.next();
      this.my[i] = 0.18 + 0.55 * r.next();
    }
  }

  get T(): number {
    return this.Eg / this.C;
  }
  /** infrared emission rate of the ground [packets per second] */
  emissionRate(T = this.T): number {
    return (sigma * T ** 4) / W_PER_RATE;
  }

  private spawn(x: number, y: number, dx: number, dy: number, kind: number): void {
    for (let i = 0; i < MAX_PHOTONS; i++) {
      if (this.alive[i]) continue;
      this.alive[i] = 1;
      this.px[i] = x;
      this.py[i] = y;
      this.dx[i] = dx;
      this.dy[i] = dy;
      this.kind[i] = kind;
      return;
    }
    // pool full: keep the energy in the ground so the bookkeeping stays exact
    this.Eg += 1;
  }

  get inFlight(): number {
    let n = 0;
    for (let i = 0; i < MAX_PHOTONS; i++) n += this.alive[i];
    return n;
  }
  get excitedCount(): number {
    let n = 0;
    for (let i = 0; i < this.nMol; i++) if (this.excited[i] > 0) n++;
    return n;
  }

  step(dt: number): void {
    const rng = this.rng;
    // sunlight enters at the top
    if (rng.next() < SUN_RATE * dt) {
      this.sunIn++;
      this.spawn(rng.next(), 1, rng.uniform(-0.15, 0.15), -1, 0);
    }
    // ground emits infrared (Lambertian: sinθ uniform in [−1, 1])
    const expect = this.emissionRate() * dt;
    const count = Math.floor(expect) + (rng.next() < expect - Math.floor(expect) ? 1 : 0);
    for (let k = 0; k < count && this.Eg >= 1; k++) {
      this.Eg -= 1;
      const s = 2 * rng.next() - 1;
      this.spawn(rng.next(), 0.001, s, Math.sqrt(1 - s * s), 1);
    }
    // excited molecules re-emit
    for (let m = 0; m < this.nMol; m++) {
      if (this.excited[m] <= 0) continue;
      this.excited[m] -= dt;
      if (this.excited[m] <= 0) {
        this.excited[m] = 0;
        const a = 2 * Math.PI * rng.next();
        this.spawn(this.mx[m] + Math.cos(a) * 1.2 * this.capture, this.my[m] + Math.sin(a) * 1.2 * this.capture, Math.cos(a), Math.sin(a), 1);
      }
    }
    // move photons
    const v = this.speed * dt;
    const c2 = this.capture * this.capture;
    for (let i = 0; i < MAX_PHOTONS; i++) {
      if (!this.alive[i]) continue;
      const n = Math.hypot(this.dx[i], this.dy[i]);
      this.px[i] += (this.dx[i] / n) * v;
      this.py[i] += (this.dy[i] / n) * v;
      if (this.px[i] < 0) this.px[i] += 1;
      if (this.px[i] >= 1) this.px[i] -= 1;
      if (this.py[i] > 1) {
        this.alive[i] = 0;
        if (this.kind[i] === 0) this.reflectedOut++;
        else this.irOut++;
        continue;
      }
      if (this.py[i] <= 0) {
        // hits the ground
        if (this.kind[i] === 0 && rng.next() < this.albedo) {
          this.py[i] = 0.001;
          this.dy[i] = Math.abs(this.dy[i]);
        } else {
          this.alive[i] = 0;
          this.Eg += 1;
        }
        continue;
      }
      if (this.kind[i] === 1) {
        for (let m = 0; m < this.nMol; m++) {
          if (this.excited[m] > 0) continue;
          let ddx = this.px[i] - this.mx[m];
          if (ddx > 0.5) ddx -= 1;
          if (ddx < -0.5) ddx += 1;
          const ddy = this.py[i] - this.my[m];
          if (ddx * ddx + ddy * ddy < c2) {
            this.alive[i] = 0;
            this.excited[m] = -this.delay * Math.log(1 - rng.next());
            if (this.excited[m] <= 0) this.excited[m] = 1e-6;
            this.absorbedByMolecules++;
            break;
          }
        }
      }
    }
    this.t += dt;
  }

  /** energy bookkeeping: should always be exactly zero */
  get imbalance(): number {
    return this.sunIn - this.reflectedOut - this.irOut - (this.Eg - this.Eg0) - this.inFlight - this.excitedCount;
  }
}
