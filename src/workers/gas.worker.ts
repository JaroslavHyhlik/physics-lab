/// <reference lib="webworker" />
import { createGasHandler } from '../physics/gasState';

const handle = createGasHandler();
self.onmessage = (e) => {
  const res = handle(e.data);
  (self as unknown as DedicatedWorkerGlobalScope).postMessage(res, [res.buf.buffer]);
};
