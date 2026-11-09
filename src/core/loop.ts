/**
 * Fixed-timestep driver. Physics always advances in whole steps of `dt`, no matter how
 * often the screen refreshes, so results are identical at 30, 60 or 120 fps.
 * Simulated time is stored as an integer step count to avoid floating-point drift.
 */
export class FixedStepper {
  readonly dt: number;
  maxSubsteps: number;
  timeScale = 1;
  private accumulator = 0;
  private steps = 0;
  /** Number of steps dropped because the frame budget (maxSubsteps) was exceeded. */
  dropped = 0;

  constructor(dt: number, maxSubsteps = 2000) {
    if (!(dt > 0)) throw new Error('dt must be positive');
    this.dt = dt;
    this.maxSubsteps = maxSubsteps;
  }

  /** Simulated time in seconds. */
  get time(): number {
    return this.steps * this.dt;
  }

  get stepCount(): number {
    return this.steps;
  }

  /**
   * Advance by a wall-clock interval (seconds). Long pauses (e.g. a hidden tab) are clamped
   * to 0.1 s so the simulation never jumps. Returns the number of physics steps taken.
   */
  advance(realDt: number, step: (dt: number) => void): number {
    const clamped = Math.min(Math.max(realDt, 0), 0.1);
    this.accumulator += clamped * this.timeScale;
    let n = Math.floor(this.accumulator / this.dt + 1e-9);
    if (n > this.maxSubsteps) {
      this.dropped += n - this.maxSubsteps;
      n = this.maxSubsteps;
      this.accumulator = 0;
    } else {
      this.accumulator -= n * this.dt;
      if (this.accumulator < 0) this.accumulator = 0;
    }
    for (let i = 0; i < n; i++) {
      step(this.dt);
      this.steps++;
    }
    return n;
  }

  /** Advance exactly n steps (used for single-stepping and tests). */
  stepN(n: number, step: (dt: number) => void): void {
    for (let i = 0; i < n; i++) {
      step(this.dt);
      this.steps++;
    }
  }

  reset(): void {
    this.accumulator = 0;
    this.steps = 0;
    this.dropped = 0;
  }
}
