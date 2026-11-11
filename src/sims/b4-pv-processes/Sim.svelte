<script lang="ts">
  import { onMount } from 'svelte';
  import SimShell from '../../sim/SimShell.svelte';
  import SimCanvas from '../../sim/SimCanvas.svelte';
  import Readouts from '../../sim/Readouts.svelte';
  import Slider from '../../ui/Slider.svelte';
  import Segmented from '../../ui/Segmented.svelte';
  import { SimController } from '../../sim/controller.svelte';
  import { useParams, usePalette, resetOn } from '../../sim/setup.svelte';
  import { View } from '../../sim/view';
  import type { SimEntry } from '../../app/registry';
  import type { NumberParamDef } from '../../sim/params.svelte';
  import type { SimInfo, GraphDef } from '../../sim/types';
  import type { ChannelDef } from '../../core/recorder';
  import { startState, stateAt, energiesAt, type ProcessKind, type ProcessSpec } from '../../physics/thermoProcess';
  import { pvFrame, drawPVAxes } from '../../sim/pvPlot';
  import { alpha } from '../../sim/palette';
  import { drawArrow, drawTag } from '../../sim/draw';
  import { fmt } from '../../core/format';

  let { entry }: { entry: SimEntry } = $props();
  const sliders: NumberParamDef[] = [
    { key: 'n', label: 'Amount of gas', symbol: 'n', unit: 'mol', min: 0.1, max: 2, step: 0.05 },
    { key: 'p1', label: 'Starting pressure', symbol: 'p_1', unit: 'kPa', min: 50, max: 400, step: 5 },
    { key: 'V1', label: 'Starting volume', symbol: 'V_1', unit: 'dm³', min: 2, max: 30, step: 0.5 },
    { key: 'V2', label: 'Final volume', symbol: 'V_2', unit: 'dm³', min: 2, max: 30, step: 0.5 },
    { key: 'T2', label: 'Final temperature', symbol: 'T_2', unit: 'K', min: 50, max: 1500, step: 5 },
  ];
  const { params, sl } = useParams({ kind: 'isothermal', n: 1, p1: 200, V1: 10, V2: 25, T2: 400 }, sliders);
  const presets = [
    { id: 'iso', label: 'Isothermal expansion', values: { kind: 'isothermal', n: 1, p1: 200, V1: 10, V2: 25 } },
    { id: 'adi', label: 'Adiabatic expansion', values: { kind: 'adiabatic', n: 1, p1: 200, V1: 10, V2: 25 } },
    { id: 'comp', label: 'Adiabatic compression (bicycle pump)', values: { kind: 'adiabatic', n: 1, p1: 100, V1: 25, V2: 8 } },
    { id: 'bar', label: 'Isobaric heating', values: { kind: 'isobaric', n: 1, p1: 200, V1: 10, V2: 20 } },
    { id: 'cho', label: 'Isochoric heating', values: { kind: 'isochoric', n: 1, p1: 100, V1: 15, T2: 400 } },
  ];
  const DURATION = 4;
  const channels: ChannelDef[] = [
    { key: 't', label: 't', unit: 's' },
    { key: 'Q', label: 'heat supplied Q', unit: 'J', color: '--series-4' },
    { key: 'W', label: 'work done by the gas W', unit: 'J', color: '--series-1', dash: [6, 4] },
    { key: 'U', label: 'change in internal energy ΔU', unit: 'J', color: '--series-3' },
  ];
  const graphs: GraphDef[] = [{ id: 'E', title: 'First law: Q = ΔU + W', series: ['Q', 'W', 'U'] }];
  const info: SimInfo = {
    about: [
      'A gas in a cylinder can change its state in different ways. On a p–V diagram each process is a path, and the area under the path is the work done by the gas.',
      'Isobaric: constant pressure (a free piston with a weight). Isochoric: constant volume (piston clamped), no work. Isothermal: constant temperature (slow, in contact with a heat reservoir), internal energy stays the same. Adiabatic: no heat flows in or out (fast, or insulated): the gas cools when it expands and warms when compressed.',
      'Energy is conserved: the heat supplied equals the increase in internal energy plus the work done by the gas, Q = ΔU + W. For a monatomic ideal gas U = (3/2)nRT.',
    ],
    formulas: [
      { label: 'First law of thermodynamics', tex: 'Q = \\Delta U + W', hl: true },
      { label: 'Work at constant pressure', tex: 'W = P\\Delta V', hl: true },
      { label: 'Internal energy change (monatomic)', tex: '\\Delta U = \\tfrac{3}{2}nR\\Delta T', hl: true },
      { label: 'Adiabatic process (monatomic)', tex: 'PV^{5/3} = \\text{constant}', hl: true },
      { label: 'Isothermal work', tex: 'W = nRT\\ln\\dfrac{V_2}{V_1}', beyond: true },
    ],
    assumptions: [
      'Ideal monatomic gas (γ = 5/3); the process is slow enough that the gas is in equilibrium at every moment (quasi-static).',
      'Sign convention as in the IB: Q is heat supplied to the gas, W is work done by the gas.',
      'The piston is frictionless; the animation takes 4 s whatever the real duration.',
    ],
    tryThis: [
      'Expand from 10 to 25 dm³ isothermally and adiabatically. Which does more work? Why does the adiabatic curve fall more steeply?',
      'In an isothermal expansion where does the energy for the work come from?',
      'Compress adiabatically: what happens to the temperature? (This is why a bicycle pump gets warm.)',
    ],
  };

  const view = new View();
  let ctx: CanvasRenderingContext2D | null = null;
  let t = 0;
  const spec = $derived<ProcessSpec>({
    kind: params.kind as ProcessKind,
    n: params.n,
    start: startState(params.n, params.p1 * 1e3, params.V1 * 1e-3),
    V2: params.V2 * 1e-3,
    T2: params.T2,
  });
  const sNow = () => Math.min(1, t / DURATION);

  function draw() {
    if (!ctx) return;
    const pal = palette.pal;
    const W = view.width;
    const usable = view.height - 76;
    ctx.fillStyle = pal.bg;
    ctx.fillRect(0, 0, W, view.height);
    const sp = spec;
    const s = sNow();
    const st = stateAt(sp, s);
    const en = energiesAt(sp, s);
    const end = stateAt(sp, 1);
    // cylinder
    const cw = 100;
    const chMax = Math.min(240, usable - 90);
    const cx = 30;
    const cy = 50;
    const hgt = Math.max(8, (st.V / 0.03) * chMax);
    const top = cy + chMax - hgt;
    const hot = pal.series[3].startsWith('#') ? pal.series[3] : '#e11d48';
    ctx.fillStyle = alpha(pal.series[0].startsWith('#') ? pal.series[0] : '#3b82f6', 0.2);
    ctx.fillRect(cx, top, cw, hgt);
    ctx.fillStyle = alpha(hot, Math.max(0, Math.min(0.6, (st.T - 150) / 1200)));
    ctx.fillRect(cx, top, cw, hgt);
    ctx.strokeStyle = sp.kind === 'adiabatic' ? pal.text2 : pal.text3;
    ctx.lineWidth = sp.kind === 'adiabatic' ? 6 : 3;
    ctx.beginPath();
    ctx.moveTo(cx, cy - 10);
    ctx.lineTo(cx, cy + chMax);
    ctx.lineTo(cx + cw, cy + chMax);
    ctx.lineTo(cx + cw, cy - 10);
    ctx.stroke();
    ctx.lineWidth = 1;
    ctx.fillStyle = pal.text2;
    ctx.fillRect(cx + 2, top - 10, cw - 4, 10);
    if (sp.kind === 'isochoric') {
      ctx.fillRect(cx - 8, top - 14, cw + 16, 4);
    }
    drawTag(ctx, cx + cw / 2, top + hgt / 2, `${st.T.toFixed(0)} K`, pal.ink, pal.surface);
    // heat flow arrows (rate dQ/ds sign)
    const dQ = energiesAt(sp, Math.min(1, s + 0.01)).Q - energiesAt(sp, Math.max(0, s - 0.01)).Q;
    if (s < 1 && t > 0 && Math.abs(dQ) > 1e-6 * Math.abs(energiesAt(sp, 1).W + 1)) {
      const col = dQ > 0 ? hot : pal.series[0];
      const y = cy + chMax + 26;
      if (dQ > 0) drawArrow(ctx, cx + cw / 2, y + 26, cx + cw / 2, y + 2, col, 'Q in', 3);
      else drawArrow(ctx, cx + cw / 2, y + 2, cx + cw / 2, y + 26, col, 'Q out', 3);
    }
    if (sp.kind === 'adiabatic') {
      ctx.fillStyle = pal.text3;
      ctx.font = '600 10px Inter Variable, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText('insulated', cx + cw / 2, cy + chMax + 8);
    }
    // p–V diagram
    const Vmax = 0.032;
    const pmax = 1.15 * Math.max(sp.start.p, end.p, stateAt(sp, 0.5).p);
    const f = pvFrame(cx + cw + 80, 30, W > 760 ? W - 260 : W - 20, usable - 30, Vmax, pmax);
    drawPVAxes(ctx, f, pal, { n: sp.n, T: [200, 300, 400, 600, 900].filter((T) => (sp.n * 8.31 * T) / 0.005 < 3 * pmax) });
    // full path (faint), traced part and the area = work
    const N = 120;
    ctx.save();
    ctx.beginPath();
    ctx.rect(f.x0, f.y0, f.x1 - f.x0, f.y1 - f.y0);
    ctx.clip();
    if (sp.kind !== 'isochoric' && s > 0) {
      ctx.fillStyle = alpha(pal.series[0].startsWith('#') ? pal.series[0] : '#3b82f6', en.W >= 0 ? 0.18 : 0.1);
      ctx.beginPath();
      ctx.moveTo(f.X(sp.start.V), f.Y(0));
      for (let i = 0; i <= N; i++) {
        const q = stateAt(sp, (s * i) / N);
        ctx.lineTo(f.X(q.V), f.Y(q.p));
      }
      ctx.lineTo(f.X(st.V), f.Y(0));
      ctx.closePath();
      ctx.fill();
    }
    ctx.strokeStyle = pal.text3;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    for (let i = 0; i <= N; i++) {
      const q = stateAt(sp, i / N);
      if (i === 0) ctx.moveTo(f.X(q.V), f.Y(q.p));
      else ctx.lineTo(f.X(q.V), f.Y(q.p));
    }
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = pal.series[1];
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let i = 0; i <= N; i++) {
      const q = stateAt(sp, (s * i) / N);
      if (i === 0) ctx.moveTo(f.X(q.V), f.Y(q.p));
      else ctx.lineTo(f.X(q.V), f.Y(q.p));
    }
    ctx.stroke();
    ctx.lineWidth = 1;
    ctx.restore();
    ctx.fillStyle = pal.series[1];
    ctx.beginPath();
    ctx.arc(f.X(st.V), f.Y(st.p), 6, 0, Math.PI * 2);
    ctx.fill();
    drawTag(ctx, f.X(sp.start.V), f.Y(sp.start.p) - 14, '1', pal.ink, pal.surface);
    drawTag(ctx, f.X(end.V), f.Y(end.p) - 14, '2', pal.ink, pal.surface);
    if (sp.kind !== 'isochoric' && s > 0.1) drawTag(ctx, (f.X(sp.start.V) + f.X(st.V)) / 2, f.Y(0) - 16, `area = W = ${fmt(en.W, 3)} J`, pal.series[0], pal.surface);
  }

  const ctrl: SimController = new SimController(
    {
      step: (dt) => {
        t += dt;
        if (t >= DURATION + 0.3) ctrl.pause();
      },
      render: draw,
      sample: (tt, out) => {
        const e = energiesAt(spec, Math.min(1, tt / DURATION));
        out[0] = tt;
        out[1] = e.Q;
        out[2] = e.W;
        out[3] = e.dU;
      },
      reset: () => {
        t = 0;
      },
    },
    { dt: 1 / 120, channels, sampleInterval: 1 / 30, autoplay: true },
  );
  const palette = usePalette(() => ctrl);
  resetOn(ctrl, () => [params.kind, params.n, params.p1, params.V1, params.V2, params.T2]);
  $effect(() => {
    void [params.kind, params.n, params.p1, params.V1, params.V2, params.T2];
    if (ctx) ctrl.play();
  });

  const rows = $derived.by(() => {
    void ctrl.renderCount;
    const st = stateAt(spec, sNow());
    const e = energiesAt(spec, sNow());
    return [
      { label: 'p, V, T', value: `${fmt(st.p / 1e3, 3)} kPa, ${fmt(st.V * 1e3, 3)} dm³, ${st.T.toFixed(0)} K` },
      { label: 'heat supplied Q', value: fmt(e.Q, 4), unit: 'J', color: '--series-4', strong: true },
      { label: 'ΔU = (3/2)nRΔT', value: fmt(e.dU, 4), unit: 'J', color: '--series-3' },
      { label: 'work by gas W', value: fmt(e.W, 4), unit: 'J', color: '--series-1' },
      { label: 'check ΔU + W', value: fmt(e.dU + e.W, 4), unit: 'J' },
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
  {graphs}
  initialGraphs={['E']}
  {presets}
  onpreset={(id) => Object.assign(params, presets.find((q) => q.id === id)?.values ?? {})}
  stopwatch={false}
>
  {#snippet stage()}
    <SimCanvas
      {view}
      label="Gas in a cylinder and its process on a p–V diagram"
      onready={(c2) => {
        ctx = c2;
        ctrl.invalidate();
      }}
      onresize={() => ctrl.invalidate()}
    />
  {/snippet}
  {#snippet readouts()}<Readouts {rows} />{/snippet}
  {#snippet controls()}
    <div class="controls">
      <Segmented
        label="Process"
        bind:value={params.kind}
        options={[
          { value: 'isobaric', label: 'Isobaric' },
          { value: 'isochoric', label: 'Isochoric' },
          { value: 'isothermal', label: 'Isothermal' },
          { value: 'adiabatic', label: 'Adiabatic' },
        ]}
      />
      <Slider def={sl('n')} bind:value={params.n} />
      <Slider def={sl('p1')} bind:value={params.p1} />
      <Slider def={sl('V1')} bind:value={params.V1} />
      {#if params.kind === 'isochoric'}<Slider def={sl('T2')} bind:value={params.T2} />{:else}<Slider def={sl('V2')} bind:value={params.V2} />{/if}
    </div>
  {/snippet}
</SimShell>

<style>
  .controls {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }
</style>
