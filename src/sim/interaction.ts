/**
 * Pointer interaction for canvases (mouse, touch and pen through Pointer Events).
 * Targets are tested in priority order; the closest hit within its radius wins.
 */
export interface DragTarget {
  /** Higher numbers are tested first (tools above simulation objects). */
  priority: number;
  /** Distance in CSS px from the pointer to the target, or Infinity if not hit. */
  hit(px: number, py: number): number;
  start?(px: number, py: number): void;
  move(px: number, py: number): void;
  end?(): void;
  cursor?: string;
}

export class Interaction {
  private targets: DragTarget[] = [];
  private active: DragTarget | null = null;
  private pointerId: number | null = null;
  /** Called after any drag movement (to request a redraw). */
  onChange: () => void = () => {};

  add(t: DragTarget): () => void {
    this.targets.push(t);
    this.targets.sort((a, b) => b.priority - a.priority);
    return () => {
      this.targets = this.targets.filter((x) => x !== t);
    };
  }

  /** Touch needs a larger grab radius than a mouse. */
  static radius(e: PointerEvent): number {
    return e.pointerType === 'touch' ? 26 : 12;
  }

  private find(px: number, py: number, radius: number): DragTarget | null {
    let best: DragTarget | null = null;
    let bestD = Infinity;
    let bestP = -Infinity;
    for (const t of this.targets) {
      if (best && t.priority < bestP) break;
      const d = t.hit(px, py);
      if (d <= radius && d < bestD) {
        best = t;
        bestD = d;
        bestP = t.priority;
      }
    }
    return best;
  }

  attach(el: HTMLElement): () => void {
    const pos = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      return [e.clientX - r.left, e.clientY - r.top] as const;
    };
    const down = (e: PointerEvent) => {
      if (this.active) return;
      const [x, y] = pos(e);
      const t = this.find(x, y, Interaction.radius(e));
      if (!t) return;
      e.preventDefault();
      this.active = t;
      this.pointerId = e.pointerId;
      el.setPointerCapture(e.pointerId);
      t.start?.(x, y);
      t.move(x, y);
      this.onChange();
    };
    const move = (e: PointerEvent) => {
      const [x, y] = pos(e);
      if (this.active && e.pointerId === this.pointerId) {
        e.preventDefault();
        this.active.move(x, y);
        this.onChange();
        return;
      }
      if (e.pointerType === 'mouse') {
        const t = this.find(x, y, Interaction.radius(e));
        el.style.cursor = t ? (t.cursor ?? 'grab') : '';
      }
    };
    const up = (e: PointerEvent) => {
      if (!this.active || e.pointerId !== this.pointerId) return;
      this.active.end?.();
      this.active = null;
      this.pointerId = null;
      this.onChange();
    };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    return () => {
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
    };
  }

  get dragging(): boolean {
    return this.active !== null;
  }
}
