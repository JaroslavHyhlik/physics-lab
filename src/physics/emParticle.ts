/**
 * Charged particle in electric and magnetic fields (motion in the x–y plane, B along z).
 * Integrator: Boris push (a pure magnetic field does no work, exactly; standard for plasmas).
 *   F = qE + qv × B;  in B alone: r = mv/(qB), T = 2πm/(qB) (independent of speed)
 *   crossed fields: undeflected when qE = qvB, i.e. v = E/B (velocity selector)
 *   E alone (perpendicular to v): parabola y = qE x²/(2mv²)
 *   cyclotron: an alternating field across the gap at f = qB/(2πm) accelerates the particle
 */
import { borisPush } from '../core/integrators';

export type FieldFn = (x: number, y: number, t: number, E: Float64Array, B: Float64Array) => void;

export class ChargedParticle {
  readonly x = new Float64Array(3);
  readonly v = new Float64Array(3);
  private E = new Float64Array(3);
  private B = new Float64Array(3);
  t = 0;
  constructor(
    readonly q: number,
    readonly m: number,
    public field: FieldFn,
  ) {}
  step(h: number): void {
    // standard Boris scheme: fields at the current position, then kick–rotate–kick and drift
    this.E.fill(0);
    this.B.fill(0);
    this.field(this.x[0], this.x[1], this.t, this.E, this.B);
    borisPush(this.x, this.v, this.E, this.B, this.q / this.m, h);
    this.t += h;
  }
  get speed(): number {
    return Math.hypot(this.v[0], this.v[1], this.v[2]);
  }
}

export const larmorRadius = (m: number, v: number, q: number, B: number) => (m * v) / (Math.abs(q) * B);
export const cyclotronPeriod = (m: number, q: number, B: number) => (2 * Math.PI * m) / (Math.abs(q) * B);
