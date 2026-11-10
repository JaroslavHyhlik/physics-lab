import { FixedStepper } from '../core/loop';
import { Recorder, type ChannelDef } from '../core/recorder';

export interface SimHooks {
  /** Advance the physics model by exactly dt seconds. */
  step(dt: number): void;
  /** Draw the current state. Never changes physics state. */
  render(): void;
  /** Fill one data sample (values in channel order, first channel = time). Return false to skip it. */
  sample?(t: number, out: Float64Array): void | boolean;
  /** Rebuild the initial state from the current parameters. */
  reset(): void;
}

export interface ControllerOptions {
  dt: number;
  channels?: ChannelDef[];
  /** Simulated seconds between recorded samples. */
  sampleInterval?: number;
  /** Simulated seconds advanced by one press of "step". */
  frameStep?: number;
  maxSubsteps?: number;
  autoplay?: boolean;
}

export const SPEEDS = [0.1, 0.25, 0.5, 1, 2, 5, 10] as const;

/**
 * Runs a simulation: animation-frame loop, fixed physics step, pause / single step /
 * slow motion / reset, data recording and simple performance statistics.
 */
export class SimController {
  running = $state(false);
  private _speed = $state(1);
  /** Simulated time shown in the UI. */
  time = $state(0);
  fps = $state(0);
  physicsMs = $state(0);
  /** Increments on every redraw; readouts derive from it to stay in sync with the canvas. */
  renderCount = $state(0);

  readonly stepper: FixedStepper;
  readonly recorder: Recorder | null;
  private hooks: SimHooks;
  private sampleInterval: number;
  private frameStep: number;
  private nextSample = 0;
  private sampleBuf: Float64Array;
  private raf = 0;
  private last = 0;
  private dirty = true;
  private frames = 0;
  private statT = 0;
  private physAcc = 0;
  private destroyed = false;

  constructor(hooks: SimHooks, opts: ControllerOptions) {
    this.hooks = hooks;
    this.stepper = new FixedStepper(opts.dt, opts.maxSubsteps ?? 4000);
    this.recorder = opts.channels ? new Recorder(opts.channels) : null;
    this.sampleBuf = new Float64Array(opts.channels?.length ?? 0);
    this.sampleInterval = opts.sampleInterval ?? 1 / 60;
    this.frameStep = opts.frameStep ?? 1 / 60;
    this.running = opts.autoplay ?? false;
  }

  /** Slow-motion factor (1 = real time). */
  get speed(): number {
    return this._speed;
  }
  set speed(v: number) {
    this._speed = v;
    this.stepper.timeScale = v;
  }

  /**
   * Start the animation loop. Call from onMount (never from $effect: reset() reads parameters,
   * and an effect would restart the loop on every parameter change).
   */
  mount(): void {
    cancelAnimationFrame(this.raf);
    this.destroyed = false;
    this.reset();
    this.last = performance.now();
    this.statT = this.last;
    const frame = (now: number) => {
      if (this.destroyed) return;
      this.tick(now);
      this.raf = requestAnimationFrame(frame);
    };
    this.raf = requestAnimationFrame(frame);
    document.addEventListener('visibilitychange', this.onVisibility);
  }

  destroy(): void {
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    document.removeEventListener('visibilitychange', this.onVisibility);
  }

  private onVisibility = () => {
    // Avoid a large time jump when the tab becomes visible again.
    this.last = performance.now();
  };

  private stepAndSample = (dt: number) => {
    this.hooks.step(dt);
    const t = this.stepper.time + dt; // time after this step
    if (this.recorder && this.hooks.sample && t >= this.nextSample - 1e-9) {
      if (this.hooks.sample(t, this.sampleBuf) !== false) this.recorder.push(this.sampleBuf);
      this.nextSample += this.sampleInterval;
      if (this.nextSample < t) this.nextSample = t + this.sampleInterval;
    }
  };

  private tick(now: number): void {
    const realDt = (now - this.last) / 1000;
    this.last = now;
    if (this.running) {
      const t0 = performance.now();
      this.stepper.advance(realDt, this.stepAndSample);
      this.physAcc += performance.now() - t0;
      this.dirty = true;
      this.time = this.stepper.time;
    }
    if (this.dirty) {
      this.hooks.render();
      this.dirty = false;
      this.renderCount++;
    }
    this.frames++;
    if (now - this.statT >= 250) {
      const sec = (now - this.statT) / 1000;
      this.fps = Math.round(this.frames / sec);
      this.physicsMs = this.frames ? this.physAcc / this.frames : 0;
      this.frames = 0;
      this.physAcc = 0;
      this.statT = now;
    }
  }

  /** Ask for one redraw (e.g. after a parameter change while paused). */
  invalidate(): void {
    this.dirty = true;
  }

  play(): void {
    this.running = true;
    this.last = performance.now();
  }

  pause(): void {
    this.running = false;
    this.time = this.stepper.time;
  }

  toggle(): void {
    if (this.running) this.pause();
    else this.play();
  }

  /** Advance one frame's worth of simulated time while paused. */
  stepFrame(): void {
    this.running = false;
    const n = Math.max(1, Math.round(this.frameStep / this.stepper.dt));
    this.stepper.stepN(n, this.stepAndSample);
    this.time = this.stepper.time;
    this.dirty = true;
  }

  reset(): void {
    this.stepper.reset();
    this.nextSample = 0;
    this.recorder?.clear();
    this.hooks.reset();
    if (this.recorder && this.hooks.sample) {
      this.hooks.sample(0, this.sampleBuf);
      this.recorder.push(this.sampleBuf);
      this.nextSample = this.sampleInterval;
    }
    this.time = 0;
    this.dirty = true;
  }

  /** Simulated time without waiting for the throttled `time` state. */
  get now(): number {
    return this.stepper.time;
  }
}
