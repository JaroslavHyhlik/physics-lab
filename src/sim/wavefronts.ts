/**
 * Draws circular wavefronts from a source moving along x at constant speed u_s.
 * Fronts are emitted every period 1/f from the source position at that time; only every
 * `skip`-th front is drawn so that they stay clearly separated on screen.
 */
export function drawWavefronts(
  ctx: CanvasRenderingContext2D,
  X: (x: number) => number,
  Y: (y: number) => number,
  scale: number,
  t: number,
  f: number,
  v: number,
  xs0: number,
  us: number,
  maxR: number,
  color: string,
  skip: number,
): void {
  const T = 1 / f;
  const kMax = Math.floor(t / T);
  const kMin = Math.max(0, Math.ceil((t - maxR / v) / T));
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  for (let k = Math.ceil(kMin / skip) * skip; k <= kMax; k += skip) {
    const te = k * T;
    const r = v * (t - te);
    const xe = xs0 + us * te;
    ctx.beginPath();
    ctx.arc(X(xe), Y(0), r * scale, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.lineWidth = 1;
}
