/// <reference lib="webworker" />
import { MDSystem, type MDConfig, type HeatMode } from '../physics/lennardJones';
import { packState, type MDRequest } from '../physics/mdState';

let sys: MDSystem | null = null;

self.onmessage = (e: MessageEvent<MDRequest>) => {
  const req = e.data;
  if (req.reset) sys = new MDSystem(req.reset as MDConfig);
  if (!sys) return;
  sys.mode = req.mode as HeatMode;
  sys.Ttarget = req.Ttarget;
  sys.power = req.power;
  for (let i = 0; i < req.steps; i++) sys.step();
  const res = packState(sys, req.id, req.buf);
  (self as unknown as DedicatedWorkerGlobalScope).postMessage(res, [res.buf.buffer]);
};
