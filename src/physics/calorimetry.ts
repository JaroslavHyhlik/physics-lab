/**
 * Method of mixtures in a calorimeter.
 * A hot object (heat capacity C1 = m1c1) is put into water (C2 = m2c2 + C_cup). Heat flows from
 * the hotter to the colder at a rate proportional to the temperature difference:
 *   P = K(T1 − T2),  C1 dT1/dt = −P,  C2 dT2/dt = P − h(T2 − T_room)
 * K (object ↔ water) only sets how quickly equilibrium is reached, not the final temperature.
 * h is an optional heat loss from the calorimeter to the room (beyond syllabus), which is the
 * main error in real experiments. Integrator: RK4 (smooth, dissipative linear ODE).
 * Without losses the exact result is T_f = (C1T1 + C2T2)/(C1 + C2).
 */
import { RK4 } from '../core/integrators';

/** Specific heat capacities [J kg⁻¹ K⁻¹], typical values (CRC Handbook), rounded. */
export const MATERIALS = {
  copper: 385,
  aluminium: 900,
  iron: 450,
  lead: 130,
  water: 4180,
} as const;
export type Material = keyof typeof MATERIALS;

export class Calorimeter {
  /** y = [T1, T2, Q_loss] */
  readonly y = new Float64Array(3);
  t = 0;
  private rk = new RK4(3);
  private f = (_t: number, y: Float64Array, out: Float64Array) => {
    const P = this.K * (y[0] - y[1]);
    const loss = this.h * (y[1] - this.Troom);
    out[0] = -P / this.C1;
    out[1] = (P - loss) / this.C2;
    out[2] = loss;
  };

  constructor(
    public C1: number,
    public C2: number,
    public T1: number,
    public T2: number,
    public K = 5,
    public h = 0,
    public Troom = 20,
  ) {
    this.reset();
  }

  reset(): void {
    this.y[0] = this.T1;
    this.y[1] = this.T2;
    this.y[2] = 0;
    this.t = 0;
  }

  step(dt: number): void {
    this.rk.step(this.f, this.t, this.y, dt);
    this.t += dt;
  }

  /** final temperature without losses */
  equilibrium(): number {
    return (this.C1 * this.T1 + this.C2 * this.T2) / (this.C1 + this.C2);
  }

  /** exact temperatures at time t without losses */
  exact(t: number): [number, number] {
    const Tf = this.equilibrium();
    const d = (this.T1 - this.T2) * Math.exp(-this.K * (1 / this.C1 + 1 / this.C2) * t);
    return [Tf + (this.C2 / (this.C1 + this.C2)) * d, Tf - (this.C1 / (this.C1 + this.C2)) * d];
  }

  /** energy given out by the object so far [J] */
  get Qout(): number {
    return this.C1 * (this.T1 - this.y[0]);
  }
  /** energy taken in by the water (and cup) so far [J] */
  get Qin(): number {
    return this.C2 * (this.y[1] - this.T2);
  }
}

/** specific heat capacity of the object from a mixtures experiment (ignoring losses) */
export function cFromMixture(m1: number, T1: number, m2: number, c2: number, T2: number, Tf: number, Ccup = 0): number {
  return ((m2 * c2 + Ccup) * (Tf - T2)) / (m1 * (T1 - Tf));
}
