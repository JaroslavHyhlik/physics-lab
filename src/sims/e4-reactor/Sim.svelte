<script lang="ts">
  import { onMount } from 'svelte';
  import SimShell from '../../sim/SimShell.svelte';
  import SimCanvas from '../../sim/SimCanvas.svelte';
  import Readouts from '../../sim/Readouts.svelte';
  import Slider from '../../ui/Slider.svelte';
  import Toggle from '../../ui/Toggle.svelte';
  import { SimController } from '../../sim/controller.svelte';
  import { useParams, usePalette } from '../../sim/setup.svelte';
  import { View } from '../../sim/view';
  import type { SimEntry } from '../../app/registry';
  import type { NumberParamDef } from '../../sim/params.svelte';
  import type { SimInfo, GraphDef } from '../../sim/types';
  import type { ChannelDef } from '../../core/recorder';
  import {
    P_FULL,
    T_IN,
    criticalRods,
    precursorsFor,
    reactivity,
    reactorStep,
    stablePeriod,
    type ReactorState,
  } from '../../physics/reactor';
  import { u, e as eCharge } from '../../core/constants';
  import { Rng } from '../../core/rng';
  import { alpha } from '../../sim/palette';
  import { drawTag } from '../../sim/draw';
  import { fmt } from '../../core/format';

  let { entry }: { entry: SimEntry } = $props();
  const ROD0 = criticalRods(320) * 100; // % for exactly full power at 320 °C (not rounded, so it is exactly critical)
  const sliders: NumberParamDef[] = [
    { key: 'rods', label: 'Control rods inserted', symbol: '', unit: '%', min: 0, max: 100, step: 0.1 },
    { key: 'flow', label: 'Coolant pump flow', symbol: '', unit: '%', min: 10, max: 100, step: 1 },
  ];
  const { params, sl } = useParams({ rods: ROD0, flow: 100, moderator: true, feedback: true }, sliders);
  const presets = [
    { id: 'full', label: 'Steady at full power (k = 1)', values: { rods: ROD0, flow: 100, moderator: true, feedback: true } },
    { id: 'out', label: 'Pull the rods out a little', values: { rods: ROD0 - 1, flow: 100, moderator: true, feedback: true } },
    { id: 'in', label: 'Push the rods in a little', values: { rods: ROD0 + 2, flow: 100, moderator: true, feedback: true } },
    { id: 'nofb', label: 'No temperature feedback: power keeps rising', values: { rods: ROD0 - 0.5, flow: 100, moderator: true, feedback: false } },
    { id: 'pump', label: 'Coolant pump slows down', values: { rods: ROD0, flow: 50, moderator: true, feedback: true } },
    { id: 'scram', label: 'SCRAM: all rods in', values: { rods: 100, flow: 100, moderator: true, feedback: true } },
  ];
  const info: SimInfo = {
    about: [
      'In a reactor the chain reaction is kept exactly critical (k = 1), so the power stays steady. Each fission releases about 200 MeV, which heats the coolant; the hot coolant makes steam that turns a turbine.',
      'Moderator: the neutrons from fission are very fast. Collisions with light nuclei (here the hydrogen in water) slow them down to thermal speeds, where U-235 is far more likely to absorb them and split. Without the moderator this reactor cannot stay critical.',
      'Control rods contain neutron absorbers (boron, cadmium). Pushing them in absorbs more neutrons: k falls below 1 and the power drops. Pulling them out makes k slightly above 1 and the power rises. A SCRAM drops all rods in to shut the reactor down.',
      'A reactor can be controlled because about 0.65 % of the neutrons are delayed: they come seconds later from the decay of fission products. This slows every change down to a time scale of seconds to minutes. As the water heats up it moderates less well, so k falls: a negative temperature coefficient that makes the reactor steady itself.',
    ],
    formulas: [
      { label: 'Mass–energy', tex: 'E = mc^{2}' },
      { label: 'Reactivity', tex: '\\rho = \\dfrac{k - 1}{k}', beyond: true },
      { label: 'Point kinetics (one delayed group)', tex: '\\dfrac{dn}{dt} = \\dfrac{\\rho - \\beta}{\\Lambda}n + \\lambda_d C', beyond: true },
    ],
    assumptions: [
      'Point-kinetics model: the whole core is described by one number for the neutron population. One group of delayed neutrons (β = 0.0065, λ_d = 0.08 s⁻¹); generation time Λ = 10⁻⁴ s. Solved with an exact step, so the result does not depend on the frame rate.',
      'Illustrative pressurised-water reactor: 3000 MW thermal at full power, coolant 290 °C in, 320 °C out at full flow, thermal time constant 10 s, temperature coefficient −3 × 10⁻⁵ K⁻¹. Rods worth 8 % in total (S-shaped curve), excess reactivity of the core 5 %.',
      'An automatic trip drops the rods if the power exceeds 120 %. Xenon poisoning, fuel burn-up and decay heat are not modelled; the U-235 used up is calculated from the energy released (200 MeV per fission).',
    ],
    tryThis: [
      'Pull the rods out by 1 %. Why does the power not shoot up at once? Where does it settle, and why?',
      'Turn off the temperature feedback and pull the rods out a little. Compare.',
      'Slow the coolant pump. What happens to the temperature and the power?',
      'How much U-235 is used up in one minute at full power?',
    ],
  };
  const channels: ChannelDef[] = [
    { key: 't', label: 't', unit: 's' },
    { key: 'P', label: 'thermal power', unit: 'MW', color: '--series-4' },
    { key: 'T', label: 'core temperature', unit: '°C', color: '--series-1' },
    { key: 'k', label: 'k', unit: '', color: '--series-2' },
  ];
  const graphs: GraphDef[] = [
    { id: 'P', title: 'Thermal power', series: ['P'] },
    { id: 'T', title: 'Core temperature', series: ['T'] },
    { id: 'k', title: 'Multiplication factor k', series: ['k'] },
  ];

  const st: ReactorState = { n: 1, C: precursorsFor(1), T: 320, E: 0 };
  let tripped = $state(false);
  const controls = () => ({ rods: params.rods / 100, flow: params.flow / 100, moderator: params.moderator, feedback: params.feedback });
  const rng = new Rng(2);

  const view = new View();
  let ctx: CanvasRenderingContext2D | null = null;

  function draw() {
    if (!ctx) return;
    const pal = palette.pal;
    const W = view.width;
    const H = view.height;
    const usable = H - 76;
    ctx.fillStyle = pal.bg;
    ctx.fillRect(0, 0, W, H);
    const wide = W > 760;
    const areaW = wide ? W - 300 : W;
    const cw = Math.min(260, areaW * 0.45);
    const ch = Math.min(usable - 80, 300);
    const cx0 = wide ? 40 : 20;
    const cy0 = 50;
    // vessel
    ctx.strokeStyle = pal.text2;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(cx0, cy0, cw, ch, 18);
    ctx.stroke();
    ctx.lineWidth = 1;
    if (params.moderator) {
      ctx.fillStyle = alpha(pal.series[0].startsWith('#') ? pal.series[0] : '#3b82f6', 0.16);
      ctx.beginPath();
      ctx.roundRect(cx0 + 2, cy0 + 2, cw - 4, ch - 4, 16);
      ctx.fill();
    }
    // fuel rods glow with power
    const glow = Math.max(0, Math.min(1, 0.15 + 0.85 * Math.min(st.n, 1.2) / 1.2));
    const nf = 7;
    const fw = 10;
    const gap = (cw - 40) / (nf - 1);
    const fy0 = cy0 + 40;
    const fy1 = cy0 + ch - 20;
    for (let i = 0; i < nf; i++) {
      const x = cx0 + 20 + i * gap - fw / 2;
      ctx.fillStyle = alpha(pal.hl.startsWith('#') ? pal.hl : '#f59e0b', 0.25 + 0.75 * glow * (st.n > 1e-3 ? 1 : 0.2));
      ctx.fillRect(x, fy0, fw, fy1 - fy0);
    }
    // control rods between the fuel rods, inserted from the top
    const depth = (params.rods / 100) * (fy1 - fy0);
    ctx.fillStyle = pal.ink;
    for (let i = 0; i < nf - 1; i++) {
      const x = cx0 + 20 + (i + 0.5) * gap - 3;
      ctx.fillRect(x, cy0 - 30, 6, 30 + 10 + depth);
    }
    // neutrons: number drawn ∝ log of the power (not to scale)
    const nDots = Math.round(Math.max(0, Math.min(160, 30 * (Math.log10(Math.max(st.n, 1e-9)) + 4))));
    ctx.fillStyle = pal.series[0];
    for (let i = 0; i < nDots; i++) {
      ctx.beginPath();
      ctx.arc(cx0 + 10 + rng.next() * (cw - 20), fy0 + rng.next() * (fy1 - fy0), 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = pal.text2;
    ctx.font = '500 10px Inter Variable, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(params.moderator ? 'core: fuel rods (orange), control rods (dark), water moderator' : 'core: moderator drained!', cx0 + cw / 2, cy0 + ch + 6);
    // coolant loop to the steam generator
    const sgx = cx0 + cw + 60;
    const sgw = Math.min(140, areaW - sgx - 20);
    if (sgw > 60) {
      const hot = Math.min(1, Math.max(0, (st.T - T_IN) / 60));
      ctx.lineWidth = 6;
      ctx.strokeStyle = alpha(pal.series[3].startsWith('#') ? pal.series[3] : '#e11d48', 0.4 + 0.6 * hot);
      ctx.beginPath();
      ctx.moveTo(cx0 + cw, cy0 + 60);
      ctx.lineTo(sgx, cy0 + 60);
      ctx.stroke();
      ctx.strokeStyle = alpha(pal.series[0].startsWith('#') ? pal.series[0] : '#3b82f6', 0.7);
      ctx.beginPath();
      ctx.moveTo(sgx, cy0 + ch - 60);
      ctx.lineTo(cx0 + cw, cy0 + ch - 60);
      ctx.stroke();
      ctx.lineWidth = 1;
      ctx.strokeStyle = pal.text2;
      ctx.strokeRect(sgx, cy0 + 30, sgw, ch - 60);
      ctx.fillStyle = pal.text2;
      ctx.fillText('steam generator', sgx + sgw / 2, cy0 + 36);
      ctx.fillText('→ turbine', sgx + sgw / 2, cy0 + 52);
      drawTag(ctx, (cx0 + cw + sgx) / 2, cy0 + 40, `${st.T.toFixed(1)} °C`, pal.series[3], pal.surface);
      drawTag(ctx, (cx0 + cw + sgx) / 2, cy0 + ch - 80, `${T_IN} °C`, pal.series[0], pal.surface);
      drawTag(ctx, (cx0 + cw + sgx) / 2, cy0 + ch - 40, `pump ${params.flow} %`, pal.text2, pal.surface);
    }
    drawTag(ctx, cx0 + cw / 2, 20, `${fmt(st.n * P_FULL, 4)} MW (${fmt(st.n * 100, 3)} %)`, pal.ink, pal.surface, '700 14px Inter Variable, system-ui, sans-serif');
    if (tripped) drawTag(ctx, cx0 + cw / 2, cy0 + ch / 2, 'TRIP: power above 120 %, rods dropped', pal.negative, pal.surface);
  }

  const ctrl: SimController = new SimController(
    {
      step: (dt) => {
        reactorStep(st, controls(), dt);
        if (st.n > 1.2 && !tripped) {
          tripped = true;
          params.rods = 100;
        }
      },
      render: draw,
      sample: (t, out) => {
        out[0] = t;
        out[1] = st.n * P_FULL;
        out[2] = st.T;
        out[3] = 1 / (1 - reactivity(st, controls()));
      },
      reset: () => {
        st.n = 1;
        st.C = precursorsFor(1);
        st.T = 320;
        st.E = 0;
        tripped = false;
      },
    },
    { dt: 1 / 60, channels, sampleInterval: 0.25, autoplay: true },
  );
  const palette = usePalette(() => ctrl);
  $effect(() => {
    void [params.rods, params.flow, params.moderator, params.feedback];
    if (ctx) {
      if (params.rods < 100) tripped = false;
      ctrl.play();
    }
  });

  const rows = $derived.by(() => {
    void ctrl.renderCount;
    const rho = reactivity(st, controls());
    const T = stablePeriod(rho);
    const fissions = st.E / (200e6 * eCharge);
    const mass = fissions * 235 * u; // kg
    return [
      { label: 'thermal power', value: fmt(st.n * P_FULL, 4), unit: 'MW', strong: true, color: '--series-4' },
      { label: 'electrical power (≈ 33 % efficient)', value: fmt(st.n * P_FULL * 0.33, 3), unit: 'MW' },
      { label: 'k = 1/(1 − ρ)', value: (1 / (1 - rho)).toFixed(5), color: '--series-2' },
      { label: 'reactivity ρ', value: Math.abs(rho) < 1e-8 ? '0' : fmt(rho * 1e5, 3), unit: 'pcm' },
      { label: 'reactor period', value: Math.abs(T) > 3000 || Math.abs(rho) < 1e-6 ? 'steady' : `${fmt(T, 3)} s`, unit: undefined },
      { label: 'core temperature', value: st.T.toFixed(1), unit: '°C', color: '--series-1' },
      { label: 'energy released', value: fmt(st.E / 3.6e9, 3), unit: 'MWh' },
      { label: 'U-235 used up (200 MeV per fission)', value: fmt(mass * 1e3, 3), unit: 'g' },
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
  initialGraphs={['P', 'T']}
  {presets}
  onpreset={(id) => {
    // presets change the controls of the running reactor; restart from full power except for SCRAM
    Object.assign(params, presets.find((q) => q.id === id)?.values ?? {});
    if (id !== 'scram') ctrl.reset();
  }}
  stopwatch={false}
>
  {#snippet stage()}
    <SimCanvas
      {view}
      label="Reactor core with fuel rods, control rods, moderator and coolant loop"
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
      <Slider def={sl('rods')} bind:value={params.rods} />
      <button type="button" class="scram" onclick={() => (params.rods = 100)}>SCRAM (all rods in)</button>
      <Slider def={sl('flow')} bind:value={params.flow} />
      <Toggle label="Water moderator" bind:checked={params.moderator} />
      <Toggle label="Temperature feedback" hint="the water moderates less when hot" bind:checked={params.feedback} />
    </div>
  {/snippet}
</SimShell>

<style>
  .controls {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }
  .scram {
    min-height: 44px;
    border-radius: var(--radius-s);
    border: 1px solid var(--negative);
    background: transparent;
    color: var(--negative);
    font: inherit;
    font-weight: 700;
    cursor: pointer;
  }
</style>
