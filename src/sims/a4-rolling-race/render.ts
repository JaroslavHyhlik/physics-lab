import { shapes, racerAt, type RollParams } from '../../physics/rolling';
import { alpha, type Palette } from '../../sim/palette';
import { fmt } from '../../core/format';

export function drawRace(ctx: CanvasRenderingContext2D, W: number, H: number, p: RollParams, t: number, pal: Palette, energy: boolean): void {
  ctx.fillStyle = pal.bg;
  ctx.fillRect(0, 0, W, H);
  const usable = H - 76;
  const n = shapes.length;
  const right = energy && W > 640 ? W - 230 : W - 20;
  const left = 175;
  const laneH = (usable - 30) / n;
  const c = Math.cos(p.theta);
  const s = Math.sin(p.theta);
  // each lane: a slope from (left, top) down to (right, bottom); height limited by the lane
  const run = right - left;
  const rise = Math.min(laneH * 0.75, run * Math.tan(p.theta));
  const lenPx = Math.hypot(run, rise);
  const ang = Math.atan2(rise, run);
  shapes.forEach((sh, i) => {
    const y0 = 20 + i * laneH + (laneH - rise) / 2;
    const R = racerAt(sh, p, t);
    const col = pal.series[i];
    // slope
    ctx.fillStyle = alpha(pal.dark ? '#5d6678' : '#aab2c0', 0.35);
    ctx.beginPath();
    ctx.moveTo(left, y0);
    ctx.lineTo(right, y0 + rise);
    ctx.lineTo(left, y0 + rise);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = pal.text3;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(left, y0);
    ctx.lineTo(right, y0 + rise);
    ctx.stroke();
    // finish line
    ctx.strokeStyle = pal.hl;
    ctx.beginPath();
    ctx.moveTo(right, y0 + rise - 22);
    ctx.lineTo(right, y0 + rise + 4);
    ctx.stroke();
    // label
    ctx.fillStyle = col;
    ctx.font = '700 11px Inter Variable, system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(sh.label.replace(' (no friction)', '').replace(' (ring)', ''), left - 10, y0 + rise / 2 - 6);
    ctx.fillStyle = pal.text3;
    ctx.font = '500 10px Inter Variable, system-ui, sans-serif';
    ctx.fillText(`${sh.slides ? 'slides' : R.M.rolls ? 'rolls' : 'rolls + slips'} · a = ${fmt(R.M.a, 3)} m s⁻²`, left - 10, y0 + rise / 2 + 8);
    ctx.fillText(R.finished ? `finished: ${R.tEnd.toFixed(3)} s` : `predicted t = ${R.tEnd.toFixed(3)} s`, left - 10, y0 + rise / 2 + 21);
    // object position along the slope
    const frac = R.s / p.L;
    const rad = Math.max(7, Math.min(13, laneH * 0.2));
    const bx = left + frac * lenPx * Math.cos(ang) - rad * Math.sin(ang);
    const by = y0 + frac * lenPx * Math.sin(ang) - rad * Math.cos(ang);
    ctx.save();
    ctx.translate(bx, by);
    if (sh.slides) {
      ctx.rotate(ang);
      ctx.fillStyle = col;
      ctx.fillRect(-rad, -rad, 2 * rad, 2 * rad);
    } else {
      // rotation angle on screen: the object rolls by φ (clockwise as it goes down to the right)
      ctx.rotate(R.phi);
      if (sh.id === 'hoop' || sh.id === 'shell') {
        ctx.strokeStyle = col;
        ctx.lineWidth = sh.id === 'hoop' ? 3 : 4;
        ctx.beginPath();
        ctx.arc(0, 0, rad - 1.5, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.arc(0, 0, rad, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.strokeStyle = sh.id === 'hoop' || sh.id === 'shell' ? col : pal.bg;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(rad - 2, 0);
      ctx.stroke();
    }
    ctx.restore();
    // energy split bar: translational | rotational | heat, as a share of mgh
    if (energy && W > 640) {
      const mgh = p.m * p.g * p.L * s;
      const bx0 = W - 210;
      const bw = 190;
      const yy = y0 + rise / 2 - 6;
      ctx.fillStyle = pal.grid;
      ctx.fillRect(bx0, yy, bw, 12);
      const parts = [
        [R.KEtrans, pal.series[1]],
        [R.KErot, pal.series[4]],
        [R.heat, pal.series[3]],
      ] as const;
      let x = bx0;
      for (const [e, cl] of parts) {
        const w = (bw * e) / mgh;
        ctx.fillStyle = cl;
        ctx.fillRect(x, yy, w, 12);
        x += w;
      }
    }
  });
  if (energy && W > 640) {
    ctx.fillStyle = pal.text3;
    ctx.font = '600 10px Inter Variable, system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('ENERGY: ½mv² · ½Iω² · heat (share of mgh)', W - 210, 4);
  }
  void c;
}
