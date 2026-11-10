/**
 * Runs a stepped simulation in a Web Worker (or on the main thread if Workers fail).
 * Every requested step is executed (nothing is dropped, unlike LatestWorker); while the worker is
 * busy, new steps are added up and sent together with the newest settings. The state comes back
 * with a Float32Array that is transferred, and the previous one is sent back for reuse.
 */
export interface StepRequest<C, S> {
  id: number;
  reset?: C;
  steps: number;
  set: S;
  buf?: Float32Array;
}

export type StepHandler<C, S, R> = (req: StepRequest<C, S>) => R;

export class StepClient<C, S, R extends { buf: Float32Array }> {
  private worker: Worker | null = null;
  private busy = false;
  private pending = 0;
  private resetCfg: C | null = null;
  private spare: Float32Array | undefined;
  private id = 0;
  private localHandler: StepHandler<C, S, R> | null = null;
  latest: R | null = null;

  constructor(
    create: () => Worker,
    private makeLocal: () => StepHandler<C, S, R>,
    private settings: () => S,
    private onState: (r: R) => void,
    private maxSteps = 20000,
  ) {
    try {
      this.worker = create();
      this.worker.onmessage = (e: MessageEvent<R>) => this.receive(e.data, true);
      this.worker.onerror = () => {
        this.worker?.terminate();
        this.worker = null;
        this.busy = false;
        this.flush();
      };
    } catch {
      this.worker = null;
    }
  }

  private receive(r: R, transferred: boolean): void {
    if (transferred) this.spare = this.latest?.buf;
    this.latest = r;
    this.busy = false;
    this.onState(r);
    this.flush();
  }

  reset(cfg: C): void {
    this.resetCfg = cfg;
    this.pending = 0;
  }

  add(steps: number): void {
    this.pending = Math.min(this.pending + steps, this.maxSteps);
  }

  flush(): void {
    if (this.busy || (this.resetCfg === null && this.pending === 0)) return;
    const req: StepRequest<C, S> = { id: ++this.id, steps: this.pending, set: this.settings() };
    if (this.resetCfg !== null) req.reset = this.resetCfg;
    this.resetCfg = null;
    this.pending = 0;
    if (this.worker) {
      this.busy = true;
      if (this.spare) req.buf = this.spare;
      this.spare = undefined;
      this.worker.postMessage(req, req.buf ? [req.buf.buffer] : []);
    } else {
      this.localHandler ??= this.makeLocal();
      req.buf = this.latest?.buf;
      this.receive(this.localHandler(req), false);
    }
  }

  destroy(): void {
    this.worker?.terminate();
    this.worker = null;
  }
}
