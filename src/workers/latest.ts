/**
 * "Latest wins" worker client: at most one request is in flight; while the worker is busy,
 * only the newest request is kept. Ideal for recomputing something while the user drags.
 * Falls back to computing on the main thread if Workers are unavailable.
 */
export class LatestWorker<Req extends { id: number }, Res extends { id: number }> {
  private worker: Worker | null = null;
  private busy = false;
  private pending: Req | null = null;
  private nextId = 1;

  constructor(
    create: () => Worker,
    private onResult: (r: Res) => void,
    private fallback: (req: Req) => Res,
  ) {
    try {
      this.worker = create();
      this.worker.onmessage = (e: MessageEvent<Res>) => {
        this.busy = false;
        this.onResult(e.data);
        this.flush();
      };
      this.worker.onerror = () => {
        // permanently fall back to the main thread
        this.worker?.terminate();
        this.worker = null;
        this.busy = false;
        this.flush();
      };
    } catch {
      this.worker = null;
    }
  }

  request(req: Omit<Req, 'id'>): void {
    this.pending = { ...(req as Req), id: this.nextId++ };
    this.flush();
  }

  private flush(): void {
    if (this.busy || !this.pending) return;
    const req = this.pending;
    this.pending = null;
    if (this.worker) {
      this.busy = true;
      this.worker.postMessage(req);
    } else {
      this.onResult(this.fallback(req));
    }
  }

  terminate(): void {
    this.worker?.terminate();
    this.worker = null;
  }
}
