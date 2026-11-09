/**
 * World ↔ screen transform for a canvas. World units are metres (SI), y points up.
 * Screen units are CSS pixels, y points down.
 */
export class View {
  width = 1;
  height = 1;
  /** Pixels per world unit. */
  scale = 100;
  /** World coordinates of the canvas centre. */
  cx = 0;
  cy = 0;

  sx(x: number): number {
    return this.width / 2 + (x - this.cx) * this.scale;
  }
  sy(y: number): number {
    return this.height / 2 - (y - this.cy) * this.scale;
  }
  wx(px: number): number {
    return this.cx + (px - this.width / 2) / this.scale;
  }
  wy(py: number): number {
    return this.cy - (py - this.height / 2) / this.scale;
  }

  /** World-space bounds currently visible. */
  get left(): number {
    return this.wx(0);
  }
  get right(): number {
    return this.wx(this.width);
  }
  get top(): number {
    return this.wy(0);
  }
  get bottom(): number {
    return this.wy(this.height);
  }

  /**
   * Fit a world rectangle into the canvas, keeping aspect ratio. `padding` in px on all
   * sides; `padBottom` reserves extra room (e.g. for the floating transport bar).
   */
  fit(minX: number, maxX: number, minY: number, maxY: number, padding = 16, padBottom = padding): void {
    const w = Math.max(1, this.width - 2 * padding);
    const h = Math.max(1, this.height - padding - padBottom);
    this.scale = Math.min(w / (maxX - minX), h / (maxY - minY));
    this.cx = (minX + maxX) / 2;
    const midY = (minY + maxY) / 2;
    this.cy = midY - (this.height / 2 - padding - h / 2) / this.scale;
  }
}
