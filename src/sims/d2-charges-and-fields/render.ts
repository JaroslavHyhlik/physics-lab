import type { View } from '../../sim/view';
import { alpha, type Palette } from '../../sim/palette';
import { drawArrow, drawTag } from '../../sim/draw';
import { fieldAt, type Sources } from '../../physics/charges';
import type { FieldMapResult } from '../../physics/fieldMaps';
import { fmt } from '../../core/format';

export interface ChargeDrawState {
  sources: Sources;
  /** UI charges in nC for labels */
  qnC: number[];
  selected: number;
  maps: FieldMapResult | null;
  heatCanvas: HTMLCanvasElement | null;
  show: { lines: boolean; equip: boolean; heat: boolean; vectors: boolean; grid: boolean };
  probeE: { on: boolean; x: number; y: number };
  probeV: { on: boolean; x: number; y: number };
}

export function chargeRadiusPx(qnC: number): number {
  return Math.min(24, 12 + 2.2 * Math.abs(qnC));
}

const E = [0, 0];

export function drawCharges(ctx: CanvasRenderingContext2D, view: View, pal: Palette, s: ChargeDrawState): void {
  ctx.fillStyle = pal.bg;
  ctx.fillRect(0, 0, view.width, view.height);
  const m = s.maps;

  // potential colour map
  if (s.show.heat && m && s.heatCanvas) {
    const b = m.bounds;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(
      s.heatCanvas,
      view.sx(b.x0),
      view.sy(b.y1),
      (b.x1 - b.x0) * view.scale,
      (b.y1 - b.y0) * view.scale,
    );
  }

  // grid (1 m major, 0.5 m minor)
  if (s.show.grid) {
    ctx.lineWidth = 1;
    for (let x = Math.ceil(view.left * 2) / 2; x <= view.right; x += 0.5) {
      ctx.strokeStyle = Math.abs(x % 1) < 1e-9 ? pal.gridStrong : pal.grid;
      ctx.beginPath();
      ctx.moveTo(Math.round(view.sx(x)) + 0.5, 0);
      ctx.lineTo(Math.round(view.sx(x)) + 0.5, view.height);
      ctx.stroke();
    }
    for (let y = Math.ceil(view.bottom * 2) / 2; y <= view.top; y += 0.5) {
      ctx.strokeStyle = Math.abs(y % 1) < 1e-9 ? pal.gridStrong : pal.grid;
      ctx.beginPath();
      ctx.moveTo(0, Math.round(view.sy(y)) + 0.5);
      ctx.lineTo(view.width, Math.round(view.sy(y)) + 0.5);
      ctx.stroke();
    }
    ctx.fillStyle = pal.text3;
    ctx.font = '500 10px Inter Variable, system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText('grid: 0.5 m', 12, view.height - 8);
  }

  // equipotentials
  if (s.show.equip && m) {
    const c = m.contours;
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = alpha(pal.dark ? '#e8eaf0' : '#0e1525', 0.38);
    ctx.beginPath();
    for (let i = 0; i < c.length; i += 4) {
      if (m.contourLevel[i >> 2] === 0) continue;
      ctx.moveTo(view.sx(c[i]), view.sy(c[i + 1]));
      ctx.lineTo(view.sx(c[i + 2]), view.sy(c[i + 3]));
    }
    ctx.stroke();
    // V = 0 contour dashed
    ctx.setLineDash([5, 5]);
    ctx.strokeStyle = alpha(pal.dark ? '#e8eaf0' : '#0e1525', 0.55);
    ctx.beginPath();
    for (let i = 0; i < c.length; i += 4) {
      if (m.contourLevel[i >> 2] !== 0) continue;
      ctx.moveTo(view.sx(c[i]), view.sy(c[i + 1]));
      ctx.lineTo(view.sx(c[i + 2]), view.sy(c[i + 3]));
    }
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // field lines with direction arrows
  if (s.show.lines && m) {
    const L = m.lines;
    const st = m.lineStarts;
    ctx.strokeStyle = pal.ink;
    ctx.fillStyle = pal.ink;
    ctx.lineWidth = 1.4;
    ctx.globalAlpha = 0.8;
    for (let k = 0; k + 1 < st.length; k++) {
      const a = st[k];
      const b = st[k + 1];
      if (b - a < 4) continue;
      ctx.beginPath();
      ctx.moveTo(view.sx(L[a]), view.sy(L[a + 1]));
      for (let i = a + 2; i < b; i += 2) ctx.lineTo(view.sx(L[i]), view.sy(L[i + 1]));
      ctx.stroke();
      // arrowheads every ~110 px of screen length, starting 45 px in
      let acc = -45;
      for (let i = a + 2; i < b; i += 2) {
        const x0 = view.sx(L[i - 2]);
        const y0 = view.sy(L[i - 1]);
        const x1 = view.sx(L[i]);
        const y1 = view.sy(L[i + 1]);
        const d = Math.hypot(x1 - x0, y1 - y0);
        acc += d;
        if (acc >= 110 && d > 0) {
          acc = 0;
          if (x1 < -20 || x1 > view.width + 20 || y1 < -20 || y1 > view.height + 20) continue;
          const ux = (x1 - x0) / d;
          const uy = (y1 - y0) / d;
          ctx.beginPath();
          ctx.moveTo(x1 + ux * 5, y1 + uy * 5);
          ctx.lineTo(x1 - ux * 4 - uy * 4.5, y1 - uy * 4 + ux * 4.5);
          ctx.lineTo(x1 - ux * 4 + uy * 4.5, y1 - uy * 4 - ux * 4.5);
          ctx.closePath();
          ctx.fill();
        }
      }
    }
    ctx.globalAlpha = 1;
  }

  // field vectors on a grid (same length, brightness ∝ log|E|)
  if (s.show.vectors) {
    const step = 46;
    const len = step * 0.72;
    for (let py = step / 2; py < view.height; py += step) {
      for (let px = step / 2; px < view.width; px += step) {
        const x = view.wx(px);
        const y = view.wy(py);
        if (s.sources.charges.some((c) => Math.hypot(view.sx(c.x) - px, view.sy(c.y) - py) < 20)) continue;
        fieldAt(s.sources, x, y, E);
        const mag = Math.hypot(E[0], E[1]);
        if (mag < 1e-6) continue;
        const t = Math.max(0.08, Math.min(1, (Math.log10(mag) - 0) / 3)); // 1 → 1000 N/C
        const ux = E[0] / mag;
        const uy = -E[1] / mag;
        ctx.globalAlpha = t;
        drawArrow(ctx, px - (ux * len) / 2, py - (uy * len) / 2, px + (ux * len) / 2, py + (uy * len) / 2, pal.accent, undefined, 2);
      }
    }
    ctx.globalAlpha = 1;
  }

  // plates
  for (const p of s.sources.plates) {
    const pos = p.sigma > 0;
    const col = pos ? pal.positive : pal.negative;
    const thick = 7;
    const x = view.sx(p.vertical ? p.cx : p.cx - p.w / 2);
    const y = view.sy(p.vertical ? p.cy + p.w / 2 : p.cy);
    const w = p.vertical ? thick : p.w * view.scale;
    const h = p.vertical ? p.w * view.scale : thick;
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.roundRect(p.vertical ? x - thick / 2 : x, p.vertical ? y : y - thick / 2, w, h, 3);
    ctx.fill();
    ctx.fillStyle = col;
    ctx.font = '700 14px Inter Variable, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const n = Math.max(3, Math.floor((p.w * view.scale) / 34));
    for (let i = 0; i < n; i++) {
      const t = -p.w / 2 + ((i + 0.5) * p.w) / n;
      const off = pos ? -14 : 14;
      if (p.vertical) ctx.fillText(pos ? '+' : '−', view.sx(p.cx) + off, view.sy(p.cy + t));
      else ctx.fillText(pos ? '+' : '−', view.sx(p.cx + t), view.sy(p.cy) + (p.cy >= 0 ? -14 : 14));
    }
  }

  // point charges
  s.sources.charges.forEach((c, i) => {
    const r = chargeRadiusPx(s.qnC[i]);
    const x = view.sx(c.x);
    const y = view.sy(c.y);
    const col = c.q > 0 ? pal.positive : c.q < 0 ? pal.negative : pal.text3;
    if (i === s.selected) {
      ctx.strokeStyle = alpha(col.startsWith('#') ? col : '#888888', 0.45);
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(x, y, r + 4, 0, Math.PI * 2);
      ctx.stroke();
    }
    const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.1, x, y, r);
    g.addColorStop(0, alpha(col.startsWith('#') ? col : '#888888', 0.75));
    g.addColorStop(1, col);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    const a = r * 0.42;
    ctx.moveTo(x - a, y);
    ctx.lineTo(x + a, y);
    if (c.q > 0) {
      ctx.moveTo(x, y - a);
      ctx.lineTo(x, y + a);
    }
    ctx.stroke();
    ctx.fillStyle = pal.text2;
    ctx.font = '600 11px Inter Variable, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(`${s.qnC[i] > 0 ? '+' : s.qnC[i] < 0 ? '−' : ''}${fmt(Math.abs(s.qnC[i]), 2)} nC`, x, y + r + 4);
  });

  // E-field probe
  if (s.probeE.on) {
    const x = view.sx(s.probeE.x);
    const y = view.sy(s.probeE.y);
    fieldAt(s.sources, s.probeE.x, s.probeE.y, E);
    const mag = Math.hypot(E[0], E[1]);
    if (mag > 1e-9) {
      const len = Math.max(16, Math.min(90, 26 * Math.log10(1 + mag)));
      drawArrow(ctx, x, y, x + (E[0] / mag) * len, y - (E[1] / mag) * len, pal.hl, 'E', 3);
    }
    ctx.strokeStyle = pal.hl;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, 9, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x - 14, y);
    ctx.lineTo(x + 14, y);
    ctx.moveTo(x, y - 14);
    ctx.lineTo(x, y + 14);
    ctx.stroke();
    drawTag(ctx, x, y + 28, `E = ${fmt(mag, 3)} N C⁻¹`, pal.ink, alpha(pal.surface.startsWith('#') ? pal.surface : '#ffffff', 0.9));
  }

  // voltage probe
  if (s.probeV.on) {
    const x = view.sx(s.probeV.x);
    const y = view.sy(s.probeV.y);
    ctx.fillStyle = pal.surface;
    ctx.strokeStyle = pal.series[4];
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = pal.series[4];
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}
