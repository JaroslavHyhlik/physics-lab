import type { CurveForces, CurveParams } from '../../physics/bankedCurve';
import { alpha, type Palette } from '../../sim/palette';
import { drawArrow, drawSymbol, drawTag } from '../../sim/draw';
import { fmt } from '../../core/format';

export interface CurveDrawState {
  p: CurveParams;
  v: number;
  phi: number;
  F: CurveForces;
  vIdeal: number;
  vMin: number;
  vMax: number;
  fbd: boolean;
  components: boolean;
}

export function drawCurve(ctx: CanvasRenderingContext2D, W: number, H: number, pal: Palette, s: CurveDrawState): void {
  ctx.fillStyle = pal.bg;
  ctx.fillRect(0, 0, W, H);
  const usable = H - 70; // keep clear of the transport bar
  const side = W / usable > 1.3;
  const A = side ? { x: 0, y: 0, w: W * 0.45, h: usable } : { x: 0, y: 0, w: W, h: usable * 0.45 };
  const B = side ? { x: W * 0.45, y: 0, w: W * 0.55, h: usable } : { x: 0, y: usable * 0.45, w: W, h: usable * 0.55 };
  const ok = s.F.holds;
  const carCol = ok ? pal.series[0] : pal.positive;

  // ---- top view -------------------------------------------------------------------------
  const cx = A.x + A.w / 2;
  const cy = A.y + A.h / 2 + 10;
  const R = Math.max(30, Math.min(A.w, A.h) * 0.36);
  ctx.strokeStyle = alpha(pal.dark ? '#5d6678' : '#aab2c0', 0.55);
  ctx.lineWidth = Math.max(14, R * 0.18);
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = pal.text3;
  ctx.lineWidth = 1;
  ctx.setLineDash([6, 6]);
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = pal.ink;
  ctx.beginPath();
  ctx.arc(cx, cy, 3, 0, Math.PI * 2);
  ctx.fill();
  // radius label
  ctx.strokeStyle = pal.text3;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx - R * 0.7071, cy + R * 0.7071);
  ctx.stroke();
  ctx.fillStyle = pal.text2;
  ctx.font = '600 11px Inter Variable, system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(`r = ${fmt(s.p.r, 3)} m`, cx - R * 0.36 - 6, cy + R * 0.36 + 4);
  // car (anticlockwise)
  const px = cx + R * Math.cos(s.phi);
  const py = cy - R * Math.sin(s.phi);
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(-s.phi - Math.PI / 2);
  ctx.fillStyle = carCol;
  ctx.beginPath();
  ctx.roundRect(-14, -8, 28, 16, 5);
  ctx.fill();
  ctx.fillStyle = alpha('#e8f0ff', 0.8);
  ctx.fillRect(4, -6, 6, 12);
  ctx.restore();
  const tx = -Math.sin(s.phi);
  const ty = -Math.cos(s.phi);
  drawArrow(ctx, px, py, px + tx * 52, py + ty * 52, pal.series[1]);
  drawSymbol(ctx, 'v', px + tx * 64, py + ty * 64, pal.series[1]);
  const ax = cx - px;
  const ay = cy - py;
  const al = Math.hypot(ax, ay);
  drawArrow(ctx, px, py, px + (ax / al) * 42, py + (ay / al) * 42, pal.series[2]);
  drawSymbol(ctx, 'a', px + (ax / al) * 54, py + (ay / al) * 54, pal.series[2]);
  ctx.fillStyle = pal.text3;
  ctx.font = '600 10px Inter Variable, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('VIEW FROM ABOVE', cx, A.y + 14);

  // ---- cross-section ------------------------------------------------------------------------
  const th = s.p.theta;
  const c = Math.cos(th);
  const sn = Math.sin(th);
  const bx = B.x + B.w * 0.55;
  const by = B.y + B.h * (side ? 0.74 : 0.62);
  const L = Math.min(B.w * 0.42, B.h * 0.6);
  // road surface rises to the right (outside of the curve); centre is to the left
  ctx.fillStyle = alpha(pal.dark ? '#5d6678' : '#aab2c0', 0.45);
  ctx.beginPath();
  ctx.moveTo(bx - L * c, by + L * sn);
  ctx.lineTo(bx + L * c, by - L * sn);
  ctx.lineTo(bx + L * c, by + L * sn + 20);
  ctx.lineTo(bx - L * c, by + L * sn + 20);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = pal.text3;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(bx - L * c, by + L * sn);
  ctx.lineTo(bx + L * c, by - L * sn);
  ctx.stroke();
  if (th > 0.01) {
    ctx.strokeStyle = pal.hl;
    ctx.lineWidth = 1.5;
    const ox = bx - L * c;
    const oy = by + L * sn;
    ctx.beginPath();
    ctx.moveTo(ox, oy);
    ctx.lineTo(ox + 60, oy);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(ox, oy, 44, 0, -th, true);
    ctx.stroke();
    ctx.fillStyle = pal.hl;
    ctx.font = 'italic 600 13px "Times New Roman", Georgia, serif';
    ctx.textAlign = 'left';
    ctx.fillText(`θ = ${((th * 180) / Math.PI).toFixed(1)}°`, ox + 50, oy - 8);
  }
  // car cross-section (rear view) sitting on the slope
  const half = 18;
  const hgt = 22;
  const ccx = bx - sn * (hgt / 2);
  const ccy = by - c * (hgt / 2);
  ctx.save();
  ctx.translate(ccx, ccy);
  ctx.rotate(-th);
  ctx.fillStyle = carCol;
  ctx.beginPath();
  ctx.roundRect(-half, -hgt / 2, 2 * half, hgt, 4);
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = pal.text3;
  ctx.font = '600 10px Inter Variable, system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('CROSS-SECTION (REAR VIEW)', bx - L * c, by + L * sn - 44);
  ctx.fillText('← centre of the curve', bx - L * c, by + L * sn - 30);

  if (s.fbd) {
    const W0 = s.p.m * s.p.g;
    const k = Math.min(80, B.h * 0.22) / W0;
    const lab = (f: number) => (Math.abs(f) >= 1000 ? `${fmt(Math.abs(f) / 1000, 3)} kN` : `${fmt(Math.abs(f), 3)} N`);
    drawArrow(ctx, ccx, ccy, ccx, ccy + W0 * k, pal.series[1], 'mg');
    // normal: perpendicular to the road, up and towards the centre
    const nx = -sn;
    const ny = -c;
    drawArrow(ctx, ccx, ccy, ccx + nx * s.F.N * k, ccy + ny * s.F.N * k, pal.series[2], 'F_N');
    drawTag(ctx, ccx + nx * s.F.N * k - 30, ccy + ny * s.F.N * k - 10, lab(s.F.N), pal.series[2], pal.surface);
    // friction along the road: + = down the slope (towards the centre)
    const dx = -c;
    const dy = sn;
    if (Math.abs(s.F.f) > 1e-6 * W0) {
      const f = ok ? s.F.f : Math.sign(s.F.f) * s.F.fMax;
      drawArrow(ctx, ccx, ccy, ccx + dx * f * k, ccy + dy * f * k, pal.series[3], 'F_f');
      drawTag(ctx, ccx + dx * f * k * 0.5, ccy + dy * f * k * 0.5 + 18, lab(f), pal.series[3], pal.surface);
    }
    // resultant (needed centripetal force), horizontal towards the centre
    ctx.setLineDash([6, 4]);
    drawArrow(ctx, ccx, ccy - 40, ccx - s.F.Fc * k, ccy - 40, pal.hl, undefined, 2);
    ctx.setLineDash([]);
    drawTag(ctx, ccx - (s.F.Fc * k) / 2, ccy - 56, `needed mv²/r = ${lab(s.F.Fc)}`, pal.hl, pal.surface);
    if (s.components) {
      ctx.globalAlpha = 0.6;
      ctx.setLineDash([3, 4]);
      drawArrow(ctx, ccx, ccy, ccx, ccy - s.F.N * c * k, pal.series[2], undefined, 1.6);
      drawArrow(ctx, ccx, ccy, ccx - s.F.N * sn * k, ccy, pal.series[2], undefined, 1.6);
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    }
  }

  // ---- speed range bar ---------------------------------------------------------------------
  const top = Number.isFinite(s.vMax) ? Math.max(s.vMax * 1.25, s.v * 1.1) : Math.max(s.vIdeal * 2, s.v * 1.2, 10);
  // top-left of the cross-section panel (the readouts sit top-right)
  const x0 = B.x + 14;
  const x1 = B.x + Math.max(150, B.w - 330);
  const y = B.y + 44;
  const X = (v: number) => x0 + ((x1 - x0) * Math.min(v, top)) / top;
  ctx.fillStyle = alpha(pal.positive.startsWith('#') ? pal.positive : '#e0393e', 0.25);
  ctx.fillRect(x0, y - 5, x1 - x0, 10);
  ctx.fillStyle = alpha(pal.dark ? '#34d399' : '#138a5e', 0.5);
  ctx.fillRect(X(s.vMin), y - 5, X(Number.isFinite(s.vMax) ? s.vMax : top) - X(s.vMin), 10);
  ctx.fillStyle = pal.text2;
  ctx.font = '600 10px Inter Variable, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('safe speeds', (X(s.vMin) + X(Number.isFinite(s.vMax) ? s.vMax : top)) / 2, y - 10);
  if (s.p.theta > 0) {
    ctx.fillStyle = pal.ink;
    ctx.fillRect(X(s.vIdeal) - 1, y - 9, 2, 18);
  }
  ctx.fillStyle = carCol;
  ctx.beginPath();
  ctx.moveTo(X(s.v), y + 6);
  ctx.lineTo(X(s.v) - 6, y + 15);
  ctx.lineTo(X(s.v) + 6, y + 15);
  ctx.closePath();
  ctx.fill();
}
