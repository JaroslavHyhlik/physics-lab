<script lang="ts">
  import { onMount } from 'svelte';
  import SimShell from '../../sim/SimShell.svelte';
  import SimCanvas from '../../sim/SimCanvas.svelte';
  import Readouts from '../../sim/Readouts.svelte';
  import Slider from '../../ui/Slider.svelte';
  import Segmented from '../../ui/Segmented.svelte';
  import { SimController } from '../../sim/controller.svelte';
  import { useParams, usePalette, redrawOn } from '../../sim/setup.svelte';
  import { View } from '../../sim/view';
  import { Interaction } from '../../sim/interaction';
  import type { SimEntry } from '../../app/registry';
  import type { NumberParamDef } from '../../sim/params.svelte';
  import type { SimInfo } from '../../sim/types';
  import { magField, solenoid, type MagSource } from '../../physics/magnet';
  import { mu_0 } from '../../core/constants';
  import { drawTag } from '../../sim/draw';
  import { fmt } from '../../core/format';

  let { entry }: { entry: SimEntry } = $props();
  const sliders: NumberParamDef[] = [
    { key: 'I', label: 'Current', symbol: 'I', unit: 'A', min: -20, max: 20, step: 0.5 },
    { key: 'N', label: 'Number of turns', symbol: 'N', unit: '', min: 4, max: 60, step: 1 },
  ];
  const { params, sl } = useParams({ src: 'wire', I: 10, N: 30 }, sliders);
  const presets = [
    { id: 'wire', label: 'Long straight wire', values: { src: 'wire', I: 10 } },
    { id: 'loop', label: 'Single loop (cross-section)', values: { src: 'loop', I: 10 } },
    { id: 'sol', label: 'Solenoid', values: { src: 'sol', I: 2, N: 30 } },
    { id: 'bar', label: 'Bar magnet', values: { src: 'bar', I: 10 } },
  ];
  const info: SimInfo = {
    about: [
      'An electric current creates a magnetic field. Around a long straight wire the field lines are circles centred on the wire; their direction follows the right-hand grip rule (thumb along the current, fingers curl with the field). The field gets weaker further away: B = μ₀I/(2πr).',
      'A loop of wire concentrates the field inside the loop. A solenoid (many loops) has a strong, almost uniform field inside, B = μ₀nI where n is the number of turns per metre, and outside its field looks like that of a bar magnet.',
      'A bar magnet’s field comes out of its north pole and goes into its south pole outside the magnet; inside the magnet it continues from S to N, so the lines are closed loops. Drag the compass to see the direction of the field anywhere.',
    ],
    formulas: [
      { label: 'Field of a long straight wire', tex: 'B = \\dfrac{\\mu_0 I}{2\\pi r}', beyond: true },
      { label: 'Field inside a long solenoid', tex: 'B = \\mu_0 n I', beyond: true },
      { label: 'Field at the centre of a loop', tex: 'B = \\dfrac{\\mu_0 I}{2a}', beyond: true },
    ],
    assumptions: [
      'The picture is a slice through the middle of each arrangement. The wire is perpendicular to the screen (• = current out of the screen, × = into it).',
      'Loops and solenoids: exact field of circular turns (complete elliptic integrals). Solenoid: radius 3 cm, length 12 cm. The bar magnet is modelled as a short solenoid with the same field (its equivalent surface current).',
      'Field lines are traced from points inside; the compass shows the field direction and its strength in the readouts. μ₀ from the data booklet.',
    ],
    tryThis: [
      'Reverse the current through the wire. What happens to the field lines?',
      'Move the compass twice as far from the wire. By what factor does B change?',
      'Inside the solenoid, move the compass along the axis: is B uniform? Compare with μ₀nI.',
      'Find a point outside the solenoid where the field points the opposite way to the inside.',
    ],
  };

  const BX = 0.16;
  const BY = 0.1;
  const sources = $derived.by<MagSource[]>(() => {
    const I = params.I;
    if (params.src === 'wire') return [{ kind: 'wire', x: 0, y: 0, I }];
    if (params.src === 'loop') return [{ kind: 'loop', x: 0, y: 0, a: 0.04, I }];
    if (params.src === 'sol') return solenoid(0, 0, 0.03, 0.12, Math.round(params.N), I);
    return solenoid(0, 0, 0.015, 0.1, 40, I);
  });
  let probe = $state({ x: 0.06, y: 0.04 });

  const view = new View();
  const inter = new Interaction();
  let ctx: CanvasRenderingContext2D | null = null;
  const fitView = () => view.fit(-BX, BX, -BY, BY, 16, 16);
  inter.add({
    priority: 10,
    cursor: 'grab',
    hit: (px, py) => {
      const d = Math.hypot(px - view.sx(probe.x), py - view.sy(probe.y));
      return d < 34 ? d / 2 : Infinity;
    },
    move: (px, py) => {
      probe = { x: Math.max(-BX, Math.min(BX, view.wx(px))), y: Math.max(-BY, Math.min(BY, view.wy(py))) };
    },
  });

  /** trace a field line from (x, y) in direction dir (±1) with RK4 on the unit field */
  function trace(x0: number, y0: number, dir: number, ds: number): number[] {
    const pts: number[] = [x0, y0];
    let x = x0;
    let y = y0;
    const b: [number, number] = [0, 0];
    const unit = (xx: number, yy: number): [number, number] => {
      magField(sources, xx, yy, b);
      const m = Math.hypot(b[0], b[1]);
      return m > 0 && Number.isFinite(m) ? [(dir * b[0]) / m, (dir * b[1]) / m] : [0, 0];
    };
    for (let i = 0; i < 1500; i++) {
      const k1 = unit(x, y);
      const k2 = unit(x + 0.5 * ds * k1[0], y + 0.5 * ds * k1[1]);
      const k3 = unit(x + 0.5 * ds * k2[0], y + 0.5 * ds * k2[1]);
      const k4 = unit(x + ds * k3[0], y + ds * k3[1]);
      const nx = x + (ds / 6) * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]);
      const ny = y + (ds / 6) * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]);
      if (nx === x && ny === y) break;
      x = nx;
      y = ny;
      pts.push(x, y);
      if (Math.abs(x) > BX * 1.05 || Math.abs(y) > BY * 1.05) break;
      if (i > 20 && Math.hypot(x - x0, y - y0) < ds * 0.8) break; // closed
    }
    return pts;
  }

  function draw() {
    if (!ctx) return;
    const pal = palette.pal;
    const W = view.width;
    const H = view.height;
    ctx.fillStyle = pal.bg;
    ctx.fillRect(0, 0, W, H);
    const lineCol = pal.series[0];
    ctx.strokeStyle = lineCol;
    ctx.lineWidth = 1.5;
    const arrowOn = (pts: number[], every: number) => {
      for (let k = every; k + 2 < pts.length / 2; k += every) {
        const x = view.sx(pts[2 * k]);
        const y = view.sy(pts[2 * k + 1]);
        const a = Math.atan2(view.sy(pts[2 * k + 3]) - y, view.sx(pts[2 * k + 2]) - x);
        ctx!.fillStyle = lineCol;
        ctx!.beginPath();
        ctx!.moveTo(x + Math.cos(a) * 6, y + Math.sin(a) * 6);
        ctx!.lineTo(x + Math.cos(a + 2.5) * 6, y + Math.sin(a + 2.5) * 6);
        ctx!.lineTo(x + Math.cos(a - 2.5) * 6, y + Math.sin(a - 2.5) * 6);
        ctx!.closePath();
        ctx!.fill();
      }
    };
    const drawLine = (pts: number[]) => {
      ctx!.beginPath();
      for (let i = 0; i < pts.length; i += 2) {
        if (i === 0) ctx!.moveTo(view.sx(pts[i]), view.sy(pts[i + 1]));
        else ctx!.lineTo(view.sx(pts[i]), view.sy(pts[i + 1]));
      }
      ctx!.stroke();
    };
    if (params.I !== 0) {
      if (params.src === 'wire') {
        for (const r of [0.012, 0.025, 0.042, 0.065, 0.095]) {
          const pts = trace(r, 0, 1, Math.max(0.0015, r * 0.04));
          drawLine(pts);
          arrowOn(pts, 40);
        }
      } else {
        const a = params.src === 'loop' ? 0.04 : params.src === 'sol' ? 0.03 : 0.015;
        const seeds = params.src === 'loop' ? [-0.85, -0.6, -0.35, -0.12, 0.12, 0.35, 0.6, 0.85] : [-0.8, -0.5, -0.2, 0, 0.2, 0.5, 0.8];
        for (const s of seeds) {
          for (const dir of [1, -1]) {
            const pts = trace(0, s * a, dir, 0.002);
            drawLine(pts);
            if (dir === 1) arrowOn(pts, 30);
          }
        }
      }
    }
    ctx.lineWidth = 1;
    // the sources
    if (params.src === 'wire') {
      const X = view.sx(0);
      const Y = view.sy(0);
      ctx.fillStyle = pal.surface;
      ctx.strokeStyle = pal.ink;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(X, Y, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      if (params.I >= 0) {
        ctx.fillStyle = pal.ink;
        ctx.beginPath();
        ctx.arc(X, Y, 3, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.moveTo(X - 6, Y - 6);
        ctx.lineTo(X + 6, Y + 6);
        ctx.moveTo(X + 6, Y - 6);
        ctx.lineTo(X - 6, Y + 6);
        ctx.stroke();
      }
      ctx.lineWidth = 1;
    } else if (params.src === 'bar') {
      const x0 = view.sx(-0.05);
      const x1 = view.sx(0.05);
      const y0 = view.sy(0.015);
      const y1 = view.sy(-0.015);
      const northRight = params.I >= 0;
      ctx.fillStyle = northRight ? pal.series[0] : pal.series[3];
      ctx.fillRect(x0, y0, (x1 - x0) / 2, y1 - y0);
      ctx.fillStyle = northRight ? pal.series[3] : pal.series[0];
      ctx.fillRect((x0 + x1) / 2, y0, (x1 - x0) / 2, y1 - y0);
      ctx.fillStyle = pal.surface;
      ctx.font = '700 14px Inter Variable, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(northRight ? 'S' : 'N', (3 * x0 + x1) / 4, (y0 + y1) / 2);
      ctx.fillText(northRight ? 'N' : 'S', (x0 + 3 * x1) / 4, (y0 + y1) / 2);
    } else {
      for (const s of sources) {
        if (s.kind !== 'loop') continue;
        for (const sgn of [1, -1]) {
          const X = view.sx(s.x);
          const Y = view.sy(s.y + sgn * s.a);
          ctx.fillStyle = pal.surface;
          ctx.strokeStyle = pal.ink;
          ctx.beginPath();
          ctx.arc(X, Y, params.src === 'loop' ? 7 : 3.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          // top: current out of the screen for I > 0 (field along +x inside)
          const out = (sgn > 0) === params.I >= 0;
          ctx.fillStyle = pal.ink;
          if (out) {
            ctx.beginPath();
            ctx.arc(X, Y, 1.6, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
    }
    // compass
    const [bx, by] = magField(sources, probe.x, probe.y);
    const a = Math.atan2(by, bx);
    const X = view.sx(probe.x);
    const Y = view.sy(probe.y);
    ctx.fillStyle = pal.surface;
    ctx.strokeStyle = pal.text2;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(X, Y, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.lineWidth = 1;
    ctx.fillStyle = pal.series[3];
    ctx.beginPath();
    ctx.moveTo(X + Math.cos(a) * 15, Y - Math.sin(a) * 15);
    ctx.lineTo(X + Math.cos(a + Math.PI / 2) * 4, Y - Math.sin(a + Math.PI / 2) * 4);
    ctx.lineTo(X + Math.cos(a - Math.PI / 2) * 4, Y - Math.sin(a - Math.PI / 2) * 4);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = pal.text3;
    ctx.beginPath();
    ctx.moveTo(X - Math.cos(a) * 15, Y + Math.sin(a) * 15);
    ctx.lineTo(X + Math.cos(a + Math.PI / 2) * 4, Y - Math.sin(a + Math.PI / 2) * 4);
    ctx.lineTo(X + Math.cos(a - Math.PI / 2) * 4, Y - Math.sin(a - Math.PI / 2) * 4);
    ctx.closePath();
    ctx.fill();
    drawTag(ctx, X, Y + 32, 'compass (red end = north)', pal.text2, pal.surface);
  }

  const ctrl = new SimController({ step: () => {}, render: draw, reset: () => {} }, { dt: 1, autoplay: false });
  const palette = usePalette(() => ctrl);
  redrawOn(ctrl, () => [params.src, params.I, params.N, probe.x, probe.y]);
  inter.onChange = () => ctrl.invalidate();

  const rows = $derived.by(() => {
    const [bx, by] = magField(sources, probe.x, probe.y);
    const B = Math.hypot(bx, by);
    const r: { label: string; value: string; unit?: string; strong?: boolean }[] = [{ label: 'B at the compass', value: fmt(B * 1e6, 4), unit: 'μT', strong: true }];
    if (params.src === 'wire') {
      const rr = Math.hypot(probe.x, probe.y);
      r.push({ label: 'distance r', value: fmt(rr * 100, 3), unit: 'cm' });
      r.push({ label: 'μ₀I/(2πr)', value: fmt(((mu_0 * Math.abs(params.I)) / (2 * Math.PI * rr)) * 1e6, 4), unit: 'μT' });
    } else if (params.src === 'sol') {
      r.push({ label: 'μ₀nI (long-solenoid value)', value: fmt(mu_0 * (Math.round(params.N) / 0.12) * Math.abs(params.I) * 1e6, 4), unit: 'μT' });
    } else if (params.src === 'loop') {
      r.push({ label: 'centre μ₀I/(2a)', value: fmt(((mu_0 * Math.abs(params.I)) / (2 * 0.04)) * 1e6, 4), unit: 'μT' });
    }
    return r;
  });

  onMount(() => {
    ctrl.mount();
    return () => ctrl.destroy();
  });
</script>

<SimShell
  {entry}
  {ctrl}
  {info}
  graphs={[]}
  {presets}
  onpreset={(id) => Object.assign(params, presets.find((q) => q.id === id)?.values ?? {})}
  stopwatch={false}
  transport={false}
>
  {#snippet stage()}
    <SimCanvas
      {view}
      interaction={inter}
      label="Magnetic field lines of a wire, loop, solenoid or bar magnet with a compass"
      onready={(c2) => {
        ctx = c2;
        fitView();
        ctrl.invalidate();
      }}
      onresize={() => {
        fitView();
        ctrl.invalidate();
      }}
    />
  {/snippet}
  {#snippet readouts()}<Readouts {rows} />{/snippet}
  {#snippet controls()}
    <div class="controls">
      <Segmented
        label="Source"
        bind:value={params.src}
        options={[
          { value: 'wire', label: 'Wire' },
          { value: 'loop', label: 'Loop' },
          { value: 'sol', label: 'Solenoid' },
          { value: 'bar', label: 'Bar magnet' },
        ]}
      />
      {#if params.src !== 'bar'}<Slider def={sl('I')} bind:value={params.I} />{/if}
      {#if params.src === 'sol'}<Slider def={sl('N')} bind:value={params.N} />{/if}
      <p class="tip">Drag the compass.</p>
    </div>
  {/snippet}
</SimShell>

<style>
  .controls {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }
  .tip {
    font-size: var(--text-xs);
    color: var(--text-3);
  }
</style>
