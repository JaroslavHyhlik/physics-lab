/// <reference lib="webworker" />
import { computeFieldMaps, type FieldMapRequest } from '../physics/fieldMaps';

self.onmessage = (e: MessageEvent<FieldMapRequest>) => {
  const res = computeFieldMaps(e.data);
  const transfer: Transferable[] = [res.contours.buffer, res.contourLevel.buffer, res.lines.buffer, res.lineStarts.buffer];
  if (res.image) transfer.push(res.image.buffer);
  (self as unknown as DedicatedWorkerGlobalScope).postMessage(res, transfer);
};
