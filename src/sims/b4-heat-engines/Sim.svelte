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
  import { buildCycle, summarize, cycleState, type CycleKind } from '../../physics/cycles';
  import { energiesAt, stateAt } from '../../physics/thermoProcess';
  import { pvFrame, drawPVAxes } from '../../sim/pvPlot';
  import { alpha } from '../../sim/palette';
  import { drawTag } from '../../sim/draw';
  import { fmt } from '../../core/format';

  let { entry }: { entry: SimEntry } = $props();
  const sliders: NumberParamDef[] = [
    { key: 'Th', label: 'Hot temperature', symbol: 'T_h', unit: 'K', min: 350, max: 2500, step: 10 },
    { key: 'Tc', label: 'Cold temperature', symbol: 'T_c', unit: 'K', min: 200, max: 600, step: 5 },
    { key: 'ratio', label: 'Volume ratio (compression ratio for Otto)', symbol: 'r', unit: '', min: 1.5, max: 12, step: 0.1 },
  ];
  const { params, sl } = useParams({ kind: 'carnot', Th: 800, Tc: 300, ratio: 3 }, sliders);
  const presets = [
    { id: 'carnot', label: 'Carnot cycle, 800 K and 300 K', values: { kind: 'carnot', Th: 800, Tc: 300, ratio: 3 } },
    { id: 'otto', label: 'Otto cycle (petrol engine), r = 8', values: { kind: 'otto', Th: 2000, Tc: 300, ratio: 8 } },
    { id: 'stirling', label: 'Stirling cycle (no regenerator)', values: { kind: 'stirling', Th: 800, Tc: 300, ratio: 3 } },
  ];
  const n = 1;
  const V1 = 0.005;
  const LEG_TIME = 1.5;
  const channels: ChannelDef[] = [
    { key: 't', label: 't', unit: 's' },
    { key: 'T', label: 'gas temperature', unit: 'K', color: '--series-4' },
    { key: 'p', label: 'pressure', unit: 'kPa', color: '--series-1' },
  ];
  const graphs: GraphDef[] = [
    { id: 'T', title: 'Temperature of the gas', series: ['T'] },
    { id: 'p', title: 'Pressure', series: ['p'] },
  ];
  const info: SimInfo = {
    about: [
      'A heat engine takes in heat Q_in from a hot reservoir, turns part of it into work W and gives the rest, Q_out, to a cold reservoir. It repeats a cycle, so its gas returns to the same state and ΔU = 0 over a cycle: W = Q_in − Q_out.',
      'On a p–V diagram the cycle is a closed loop and the net work done by the gas is the area inside it (clockwise loops do positive work).',
      'Efficiency η = useful work / input energy. No engine working between T_h and T_c can beat the Carnot engine: η_Carnot = 1 − T_c/T_h (temperatures in kelvin). This is one form of the second law of thermodynamics.',
      'Car petrol engines follow (roughly) the Otto cycle: their efficiency depends on the compression ratio r. A Stirling engine without a heat regenerator wastes heat in its constant-volume steps.',
    ],
    formulas: [
      { label: 'Efficiency', tex: '\\eta = \\dfrac{\\text{useful work}}{\\text{input energy}} = \\dfrac{W}{Q_\\text{in}}', hl: true },
      { label: 'Carnot efficiency', tex: '\\eta_\\text{Carnot} = 1 - \\dfrac{T_c}{T_h}', hl: true },
      { label: 'Energy over a cycle', tex: 'W = Q_\\text{in} - Q_\\text{out}', hl: true },
      { label: 'Otto cycle', tex: '\\eta_\\text{Otto} = 1 - r^{1-\\gamma}', beyond: true },
    ],
    assumptions: [
      '1 mol of ideal monatomic gas (γ = 5/3); every step is slow and frictionless (reversible).',
      'Smallest volume 5 dm³. For Otto the cycle starts at the largest volume at T_c and T_h is the peak temperature after ignition; real engines use air (γ ≈ 1.4) and lose heat, so they are less efficient.',
      'Stirling engine without a regenerator: the heat given out while cooling at constant volume is lost (with a perfect regenerator it would reach the Carnot efficiency).',
      'Each step of the cycle takes 1.5 s in the animation.',
    ],
    tryThis: [
      'Carnot: double the absolute hot temperature. Does the efficiency double?',
      'Compare the Otto and Carnot efficiencies for the same highest and lowest temperatures.',
      'Where on the loop is heat taken in, and where is it given out?',
    ],
  };

  const view = new View();
  let ctx: CanvasRenderingContext2D | null = null;
  let t = 0;
  const legs = $derived(buildCycle(params.kind as CycleKind, { n, Th: params.Th, Tc: Math.min(params.Tc, params.Th - 20), V1, ratio: params.ratio }));
  const sum = $derived(summarize(legs));
  const u = () => (t / LEG_TIME) % legs.length;

  function draw() {
    if (!ctx) return;
    const pal = palette.pal;
    const W = view.width;
    const usable = view.height - 76;
    ctx.fillStyle = pal.bg;
    ctx.fillRect(0, 0, W, view.height);
    const L = legs;
    let Vmax = 0;
    let pmax = 0;
    for (const l of L)
      for (let i = 0; i <= 20; i++) {
        const q = stateAt(l.spec, i / 20);
        Vmax = Math.max(Vmax, q.V);
        pmax = Math.max(pmax, q.p);
      }
    const wide = W > 760;
    const f = pvFrame(70, 30, wide ? W - 290 : W - 20, wide ? usable - 30 : usable - 110, Vmax * 1.12, pmax * 1.12);
    drawPVAxes(ctx, f, pal, null);
    // enclosed area
    const N = 60;
    ctx.fillStyle = alpha(pal.series[0].startsWith('#') ? pal.series[0] : '#3b82f6', 0.15);
    ctx.beginPath();
    L.forEach((l, k) => {
      for (let i = 0; i <= N; i++) {
        const q = stateAt(l.spec, i / N);
        if (k === 0 && i === 0) ctx!.moveTo(f.X(q.V), f.Y(q.p));
        else ctx!.lineTo(f.X(q.V), f.Y(q.p));
      }
    });
    ctx.closePath();
    ctx.fill();
    // legs coloured by heat flow
    const hot = pal.series[3];
    const cold = pal.series[0];
    L.forEach((l, k) => {
      const Q = energiesAt(l.spec, 1).Q;
      ctx!.strokeStyle = Math.abs(Q) < 1e-6 ? pal.text2 : Q > 0 ? hot : cold;
      ctx!.lineWidth = 3;
      ctx!.beginPath();
      for (let i = 0; i <= N; i++) {
        const q = stateAt(l.spec, i / N);
        if (i === 0) ctx!.moveTo(f.X(q.V), f.Y(q.p));
        else ctx!.lineTo(f.X(q.V), f.Y(q.p));
      }
      ctx!.stroke();
      const a = stateAt(l.spec, 0);
      drawTag(ctx!, f.X(a.V), f.Y(a.p) - 14, `${k + 1}`, pal.ink, pal.surface);
    });
    ctx.lineWidth = 1;
    const now = cycleState(L, u());
    ctx.fillStyle = pal.series[1];
    ctx.beginPath();
    ctx.arc(f.X(now.V), f.Y(now.p), 7, 0, Math.PI * 2);
    ctx.fill();
    const legNow = L[Math.floor(u())];
    drawTag(ctx, (f.x0 + f.x1) / 2, f.y0 + 10, `${Math.floor(u()) + 1}: ${legNow.label}`, pal.ink, pal.surface);
    drawTag(ctx, f.X(Vmax * 0.55), f.Y(pmax * 0.15), `area = W = ${fmt(sum.Wnet, 3)} J`, pal.series[0], pal.surface);
    // energy flow bar: Q_in → W + Q_out
    const bx0 = wide ? W - 260 : 70;
    const by0 = wide ? 200 : usable - 80;
    const bw = wide ? 220 : W - 100;
    const s = sum;
    const kpx = bw / s.Qin;
    ctx.font = '600 11px Inter Variable, system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const bar = (y: number, x: number, w: number, col: string, label: string) => {
      ctx!.fillStyle = col;
      ctx!.fillRect(x, y, Math.max(1, w), 16);
      ctx!.fillStyle = pal.text2;
      ctx!.fillText(label, x, y + 28);
    };
    bar(by0, bx0, s.Qin * kpx, hot, `Q_in ${fmt(s.Qin, 3)} J`);
    bar(by0 + 46, bx0, s.Wnet * kpx, pal.series[1], `W ${fmt(s.Wnet, 3)} J (${(100 * s.efficiency).toFixed(1)} %)`);
    bar(by0 + 92, bx0 + s.Wnet * kpx, s.Qout * kpx, cold, `Q_out ${fmt(s.Qout, 3)} J`);
  }

  const ctrl: SimController = new SimController(
    {
      step: (dt) => {
        t += dt;
      },
      render: draw,
      sample: (tt, out) => {
        const q = cycleState(legs, (tt / LEG_TIME) % legs.length);
        out[0] = tt;
        out[1] = q.T;
        out[2] = q.p / 1e3;
      },
      reset: () => {
        t = 0;
      },
    },
    { dt: 1 / 120, channels, sampleInterval: 1 / 30, autoplay: true },
  );
  const palette = usePalette(() => ctrl);
  resetOn(ctrl, () => [params.kind, params.Th, params.Tc, params.ratio]);
  $effect(() => {
    void [params.kind, params.Th, params.Tc, params.ratio];
    if (ctx) ctrl.play();
  });

  const rows = $derived.by(() => {
    const s = sum;
    return [
      { label: 'efficiency η = W/Q_in', value: `${(100 * s.efficiency).toFixed(1)} %`, color: '--series-2', strong: true },
      { label: 'Carnot limit 1 − T_c/T_h', value: `${(100 * s.carnot).toFixed(1)} %`, strong: true },
      { label: 'temperatures in the cycle', value: `${s.Tmin.toFixed(0)} – ${s.Tmax.toFixed(0)}`, unit: 'K' },
      { label: 'Q_in − Q_out', value: fmt(s.Qin - s.Qout, 4), unit: 'J' },
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
  initialGraphs={['T', 'p']}
  {presets}
  onpreset={(id) => Object.assign(params, presets.find((q) => q.id === id)?.values ?? {})}
  stopwatch={false}
>
  {#snippet stage()}
    <SimCanvas
      {view}
      label="Heat engine cycle on a p–V diagram with its energy flow"
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
        label="Cycle"
        bind:value={params.kind}
        options={[
          { value: 'carnot', label: 'Carnot' },
          { value: 'otto', label: 'Otto' },
          { value: 'stirling', label: 'Stirling' },
        ]}
      />
      <Slider def={sl('Th')} bind:value={params.Th} />
      <Slider def={sl('Tc')} bind:value={params.Tc} />
      <Slider def={sl('ratio')} bind:value={params.ratio} />
      <p class="tip">Red: heat taken in · blue: heat given out · grey: no heat (adiabatic).</p>
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
