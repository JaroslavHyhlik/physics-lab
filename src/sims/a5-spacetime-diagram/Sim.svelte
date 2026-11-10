<script lang="ts">
  import { onMount } from 'svelte';
  import SimShell from '../../sim/SimShell.svelte';
  import SimCanvas from '../../sim/SimCanvas.svelte';
  import Readouts from '../../sim/Readouts.svelte';
  import Slider from '../../ui/Slider.svelte';
  import Toggle from '../../ui/Toggle.svelte';
  import { SimController } from '../../sim/controller.svelte';
  import { useParams, usePalette, redrawOn } from '../../sim/setup.svelte';
  import { View } from '../../sim/view';
  import { Interaction } from '../../sim/interaction';
  import type { SimEntry } from '../../app/registry';
  import type { NumberParamDef } from '../../sim/params.svelte';
  import type { SimInfo } from '../../sim/types';
  import { gamma, lorentz, interval } from '../../physics/relativity';
  import { alpha } from '../../sim/palette';
  import { drawSymbol } from '../../sim/draw';
  import { fmt } from '../../core/format';

  let { entry }: { entry: SimEntry } = $props();
  const sliders: NumberParamDef[] = [
    { key: 'beta', label: 'Speed of frame S′', symbol: 'v/c', unit: '', min: -0.95, max: 0.95, step: 0.01 },
    { key: 'tb', label: 'Travelling twin speed', symbol: 'v/c', unit: '', min: 0.1, max: 0.95, step: 0.01 },
  ];
  const defaults = { beta: 0.5, ax: -2, act: 1, bx: 2, bct: 1, grid: true, hyper: false, twin: false, tb: 0.6 };
  const { params, sl } = useParams(defaults, sliders);
  const presets = [
    { id: 'sim', label: 'Relativity of simultaneity', values: { beta: 0.5, ax: -2, act: 1, bx: 2, bct: 1, twin: false } },
    { id: 'time', label: 'Timelike events (cause and effect)', values: { beta: 0.5, ax: 0, act: 0.5, bx: 1, bct: 3.5, twin: false } },
    { id: 'space', label: 'Spacelike events (order can swap)', values: { beta: 0.6, ax: -1, act: 1.2, bx: 2.5, bct: 0.6, twin: false } },
    { id: 'twin', label: 'Twin paradox', values: { twin: true, tb: 0.6, beta: 0.6 } },
  ];
  const info: SimInfo = {
    about: [
      'A spacetime (Minkowski) diagram shows events as points with position x across and time (as ct) up. The worldline of an object at rest is vertical; light travels along 45° lines.',
      'An observer moving at v draws their own axes: ct′ is their worldline (slope c/v) and x′ — their line of “now” — tilts up by the same angle, tanθ = v/c. Lines parallel to x′ join events that are simultaneous for the moving observer, so events that happen at the same time in S generally do not in S′.',
      'The spacetime interval s² = (ct)² − x² between two events is the same for all observers. If s² > 0 (timelike) one event can cause the other and every observer agrees on their order; if s² < 0 (spacelike) the order depends on the observer.',
      'Twin paradox: the twin who travels out and back ages less, because the proper time along a worldline is shortest for the path that is not inertial all the way.',
    ],
    formulas: [
      { label: 'Lorentz transformation', tex: "x' = \\gamma(x - vt), \\qquad t' = \\gamma\\left(t - \\dfrac{vx}{c^{2}}\\right)", hl: true },
      { label: 'Lorentz factor', tex: '\\gamma = \\dfrac{1}{\\sqrt{1 - v^{2}/c^{2}}}', hl: true },
      { label: 'Spacetime interval (invariant)', tex: "(ct')^{2} - (x')^{2} = (ct)^{2} - x^{2}", hl: true },
      { label: 'Angle of the moving axes', tex: '\\tan\\theta = \\dfrac{v}{c}', hl: true },
      { label: 'Time dilation', tex: '\\Delta t = \\gamma\\,\\Delta t_0', hl: true },
    ],
    assumptions: [
      'One space dimension; both frames are inertial and their origins coincide at x = ct = 0.',
      'Units: x and ct in light-seconds (ls), so light lines are at 45°.',
      'Twin paradox: the turnaround is instantaneous; the travelling twin’s age is the sum of the proper times of the two straight legs.',
    ],
    tryThis: [
      'Drag event B until it is simultaneous with A in S′ (on a line parallel to x′).',
      'Make the two events spacelike, then change v/c until their order reverses. Can you do the same for timelike events?',
      'Check that s² in the readouts never changes when you move the v/c slider.',
      'Twin paradox: for v = 0.6c, how many years does each twin age on a 10-year (home) trip?',
    ],
  };

  const view = new View();
  const inter = new Interaction();
  let ctx: CanvasRenderingContext2D | null = null;
  const R = 5;
  // on wide screens keep the diagram on the left, clear of the readouts box
  const fitView = () => view.fit(-R - 0.6, view.width > 760 ? R + 7 : R + 0.6, -R - 0.6, R + 0.6, 16, 16);

  function line(x1: number, y1: number, x2: number, y2: number) {
    ctx!.beginPath();
    ctx!.moveTo(view.sx(x1), view.sy(y1));
    ctx!.lineTo(view.sx(x2), view.sy(y2));
    ctx!.stroke();
  }
  /** S coordinates of the S′ event (x′, ct′) */
  const fromPrime = (xp: number, ctp: number) => lorentz(xp, ctp, -params.beta);

  function draw() {
    if (!ctx) return;
    const pal = palette.pal;
    const b = params.beta;
    ctx.fillStyle = pal.bg;
    ctx.fillRect(0, 0, view.width, view.height);
    ctx.save();
    ctx.beginPath();
    ctx.rect(view.sx(-R - 0.5), view.sy(R + 0.5), (2 * R + 1) * view.scale, (2 * R + 1) * view.scale);
    ctx.clip();
    // S grid
    ctx.lineWidth = 1;
    ctx.strokeStyle = pal.grid;
    for (let k = -R; k <= R; k++) {
      line(k, -R, k, R);
      line(-R, k, R, k);
    }
    // invariant hyperbolas
    if (params.hyper) {
      ctx.strokeStyle = alpha(pal.series[4].startsWith('#') ? pal.series[4] : '#7c4dff', 0.5);
      for (const s2 of [1, 4, 9]) {
        const a = Math.sqrt(s2);
        for (const sgn of [1, -1]) {
          ctx.beginPath();
          for (let u = -3; u <= 3; u += 0.05) {
            const x = a * Math.sinh(u);
            const ct = sgn * a * Math.cosh(u);
            if (u === -3) ctx.moveTo(view.sx(x), view.sy(ct));
            else ctx.lineTo(view.sx(x), view.sy(ct));
          }
          ctx.stroke();
        }
      }
    }
    // light cone
    ctx.strokeStyle = pal.hl;
    ctx.setLineDash([6, 5]);
    ctx.lineWidth = 1.5;
    line(-R, -R, R, R);
    line(-R, R, R, -R);
    ctx.setLineDash([]);
    // S axes
    ctx.strokeStyle = pal.ink;
    ctx.lineWidth = 2;
    line(-R, 0, R, 0);
    line(0, -R, 0, R);
    // S′ grid and axes
    if (Math.abs(b) > 1e-9 || params.grid) {
      const col = pal.series[1];
      ctx.strokeStyle = alpha(col.startsWith('#') ? col : '#f2711c', 0.22);
      ctx.lineWidth = 1;
      if (params.grid) {
        for (let k = -8; k <= 8; k++) {
          const [x1, y1] = fromPrime(k, -10);
          const [x2, y2] = fromPrime(k, 10);
          line(x1, y1, x2, y2);
          const [x3, y3] = fromPrime(-10, k);
          const [x4, y4] = fromPrime(10, k);
          line(x3, y3, x4, y4);
        }
      }
      ctx.strokeStyle = col;
      ctx.lineWidth = 2;
      const [ax1, ay1] = fromPrime(-10, 0);
      const [ax2, ay2] = fromPrime(10, 0);
      line(ax1, ay1, ax2, ay2);
      const [bx1, by1] = fromPrime(0, -10);
      const [bx2, by2] = fromPrime(0, 10);
      line(bx1, by1, bx2, by2);
    }
    ctx.restore();
    // axis labels
    drawSymbol(ctx, 'x', view.sx(R + 0.3), view.sy(0.25), pal.ink);
    drawSymbol(ctx, 'ct', view.sx(0.35), view.sy(R + 0.3), pal.ink);
    // label the S′ axes where they leave the square: x′ along (1, β), ct′ along (β, 1)
    const reach = (0.92 * R) / Math.max(1, Math.abs(b));
    drawSymbol(ctx, "x'", view.sx(reach), view.sy(b * reach) - 14, pal.series[1]);
    drawSymbol(ctx, "ct'", view.sx(b * reach) + 18, view.sy(reach), pal.series[1]);
    // twin paradox worldlines
    if (params.twin) {
      const T = 5;
      const tb = params.tb;
      ctx.strokeStyle = pal.series[0];
      ctx.lineWidth = 3;
      line(0, 0, 0, 2 * T * 0.95);
      ctx.strokeStyle = pal.series[3];
      line(0, 0, tb * T * 0.95, T * 0.95);
      line(tb * T * 0.95, T * 0.95, 0, 2 * T * 0.95);
    } else {
      // events with projections onto the S′ axes
      for (const [ex, ect, name, col] of [
        [params.ax, params.act, 'A', pal.series[0]],
        [params.bx, params.bct, 'B', pal.series[3]],
      ] as const) {
        const [xp, ctp] = lorentz(ex, ect, b);
        ctx.strokeStyle = alpha(col.startsWith('#') ? col : '#4361ee', 0.6);
        ctx.setLineDash([3, 4]);
        ctx.lineWidth = 1.2;
        const [p1x, p1y] = fromPrime(xp, 0);
        const [p2x, p2y] = fromPrime(0, ctp);
        line(ex, ect, p1x, p1y);
        line(ex, ect, p2x, p2y);
        ctx.setLineDash([]);
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.arc(view.sx(ex), view.sy(ect), 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.font = '700 10px Inter Variable, system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(name, view.sx(ex), view.sy(ect));
      }
    }
    ctx.fillStyle = pal.text3;
    ctx.font = '500 10px Inter Variable, system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText('grid: 1 light-second', 10, view.height - 8);
  }

  const ctrl = new SimController({ step: () => {}, render: draw, reset: () => {} }, { dt: 1, autoplay: false });
  const palette = usePalette(() => ctrl);
  redrawOn(ctrl, () => [params.beta, params.ax, params.act, params.bx, params.bct, params.grid, params.hyper, params.twin, params.tb]);

  for (const [kx, kt] of [
    ['ax', 'act'],
    ['bx', 'bct'],
  ] as const) {
    inter.add({
      priority: 10,
      cursor: 'grab',
      hit: (px, py) => (params.twin ? Infinity : Math.hypot(px - view.sx(params[kx]), py - view.sy(params[kt]))),
      move: (px, py) => {
        params[kx] = Math.round(Math.max(-R, Math.min(R, view.wx(px))) * 20) / 20;
        params[kt] = Math.round(Math.max(-R, Math.min(R, view.wy(py))) * 20) / 20;
      },
    });
  }
  inter.onChange = () => ctrl.invalidate();

  const rows = $derived.by(() => {
    const b = params.beta;
    const g = gamma(b);
    const base = [
      { label: 'γ', value: g.toFixed(4) },
      { label: 'axis angle θ = tan⁻¹(v/c)', value: ((Math.atan(b) * 180) / Math.PI).toFixed(1), unit: '°' },
    ];
    if (params.twin) {
      const T = 5;
      const gt = gamma(params.tb);
      return [
        { label: 'home twin ages', value: fmt(2 * T, 3), unit: 's (ct in ls)', color: '--series-1', strong: true },
        { label: 'travelling twin ages 2T/γ', value: fmt((2 * T) / gt, 3), unit: 's', color: '--series-4', strong: true },
        { label: 'γ of the traveller', value: gt.toFixed(4) },
      ];
    }
    const [axp, actp] = lorentz(params.ax, params.act, b);
    const [bxp, bctp] = lorentz(params.bx, params.bct, b);
    const s2 = interval(params.bx - params.ax, params.bct - params.act);
    const type = Math.abs(s2) < 1e-9 ? 'lightlike' : s2 > 0 ? 'timelike' : 'spacelike';
    const ord = (d: number) => (Math.abs(d) < 1e-9 ? 'simultaneous' : d > 0 ? 'A first' : 'B first');
    return [
      ...base,
      { label: 'A in S → S′', value: `(${fmt(params.ax, 3)}, ${fmt(params.act, 3)}) → (${fmt(axp, 3)}, ${fmt(actp, 3)})`, color: '--series-1' },
      { label: 'B in S → S′', value: `(${fmt(params.bx, 3)}, ${fmt(params.bct, 3)}) → (${fmt(bxp, 3)}, ${fmt(bctp, 3)})`, color: '--series-4' },
      { label: 's² = (cΔt)² − Δx²', value: `${fmt(s2, 4)} ls² (${type})`, strong: true },
      { label: 'order in S / in S′', value: `${ord(params.bct - params.act)} / ${ord(bctp - actp)}` },
    ];
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
  onpreset={(id) => Object.assign(params, presets.find((p) => p.id === id)?.values ?? {})}
  stopwatch={false}
  transport={false}
>
  {#snippet stage()}
    <SimCanvas
      {view}
      interaction={inter}
      label="Spacetime (Minkowski) diagram"
      onready={(c) => {
        ctx = c;
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
      <Slider def={sl('beta')} bind:value={params.beta} />
      <Toggle label="Grid of frame S′" bind:checked={params.grid} />
      <Toggle label="Invariant hyperbolas" hint="s² = 1, 4, 9 ls²" bind:checked={params.hyper} />
      <Toggle label="Twin paradox" bind:checked={params.twin} />
      {#if params.twin}<Slider def={sl('tb')} bind:value={params.tb} />{:else}<p class="tip">Drag events A and B.</p>{/if}
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
