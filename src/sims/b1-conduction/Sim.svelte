<script lang="ts">
  import { onMount } from 'svelte';
  import SimShell from '../../sim/SimShell.svelte';
  import SimCanvas from '../../sim/SimCanvas.svelte';
  import Readouts from '../../sim/Readouts.svelte';
  import Slider from '../../ui/Slider.svelte';
  import { SimController } from '../../sim/controller.svelte';
  import { useParams, usePalette, resetOn } from '../../sim/setup.svelte';
  import { View } from '../../sim/view';
  import type { SimEntry } from '../../app/registry';
  import type { NumberParamDef } from '../../sim/params.svelte';
  import type { SimInfo, GraphDef } from '../../sim/types';
  import type { ChannelDef } from '../../core/recorder';
  import { Slab, CONDUCT_MATERIALS } from '../../physics/conduction';
  import { alpha } from '../../sim/palette';
  import { drawArrow, drawTag, niceStep } from '../../sim/draw';
  import { fmt } from '../../core/format';

  let { entry }: { entry: SimEntry } = $props();
  const sliders: NumberParamDef[] = [
    { key: 'L', label: 'Thickness (length)', symbol: 'Δx', unit: 'm', min: 0.002, max: 1, step: 0.001, log: true },
    { key: 'A', label: 'Cross-sectional area', symbol: 'A', unit: 'm²', min: 1e-5, max: 10, step: 1e-5, log: true },
    { key: 'TH', label: 'Hot side', symbol: 'T_H', unit: '°C', min: 0, max: 100, step: 1 },
    { key: 'TC', label: 'Cold side', symbol: 'T_C', unit: '°C', min: -20, max: 50, step: 1 },
  ];
  const { params, sl } = useParams({ mat: 'copper', L: 0.3, A: 1e-4, TH: 100, TC: 20 }, sliders);
  const presets = [
    { id: 'rod', label: 'Copper rod, 30 cm, 1 cm²', values: { mat: 'copper', L: 0.3, A: 1e-4, TH: 100, TC: 20 } },
    { id: 'steel', label: 'Same rod in steel', values: { mat: 'steel', L: 0.3, A: 1e-4, TH: 100, TC: 20 } },
    { id: 'window', label: 'Window: 4 mm glass, 1 m²', values: { mat: 'glass', L: 0.004, A: 1, TH: 20, TC: 0 } },
    { id: 'foam', label: 'Insulation: 5 cm foam, 1 m²', values: { mat: 'foam', L: 0.05, A: 1, TH: 20, TC: 0 } },
    { id: 'wall', label: 'Brick wall: 20 cm, 10 m²', values: { mat: 'brick', L: 0.2, A: 10, TH: 20, TC: 0 } },
  ];
  const channels: ChannelDef[] = [
    { key: 't', label: 't', unit: 's' },
    { key: 'Pin', label: 'heat flow in (hot face)', unit: 'W', color: '--series-4' },
    { key: 'Pout', label: 'heat flow out (cold face)', unit: 'W', color: '--series-1' },
    { key: 'Ps', label: 'kAΔT/Δx', unit: 'W', color: '--series-3', dash: [6, 4] },
    { key: 'Tm', label: 'temperature in the middle', unit: '°C', color: '--series-2' },
  ];
  const graphs: GraphDef[] = [
    { id: 'P', title: 'Rate of heat flow', series: ['Pin', 'Pout', 'Ps'] },
    { id: 'Tm', title: 'Temperature in the middle', series: ['Tm'] },
  ];
  const info: SimInfo = {
    about: [
      'A slab of material (or a rod with insulated sides) is placed between a hot and a cold heat bath. Energy is passed on by collisions between particles (and, in metals, by free electrons) from the hot side to the cold side: conduction.',
      'At first the energy entering the hot face mostly warms the material, so less leaves the cold face. After a while a steady state is reached: the temperature falls in a straight line across the slab and the same power flows through every layer.',
      'In the steady state the rate of heat flow is ΔQ/Δt = kAΔT/Δx. Good conductors (metals) have a large thermal conductivity k; insulators such as foam have a tiny k, so a thin layer stops most of the heat flow.',
    ],
    formulas: [
      { label: 'Thermal conduction (steady state)', tex: '\\dfrac{\\Delta Q}{\\Delta t} = kA\\dfrac{\\Delta T}{\\Delta x}' },
      { label: 'Heat equation (how the profile changes)', tex: '\\dfrac{\\partial T}{\\partial t} = \\dfrac{k}{\\rho c}\\,\\dfrac{\\partial^{2} T}{\\partial x^{2}}', beyond: true },
    ],
    assumptions: [
      'Heat flows only along the slab (one dimension): the sides of a rod are perfectly insulated; a wide slab has no edge effects.',
      'The two faces are held at T_H and T_C by ideal heat baths. At the start the material is at T_C everywhere.',
      'k, ρ and c are constant (typical room-temperature values, CRC Handbook / engineering tables): copper k = 400, aluminium 237, steel 50, glass 0.8, brick 0.7, pine wood 0.12, polystyrene foam 0.033 W m⁻¹ K⁻¹.',
      'Solved with finite differences (40 cells, stable time step enforced). Time is sped up in the animation; the graphs show real time.',
    ],
    tryThis: [
      'Compare the copper and steel rods: how much faster does heat flow through copper? Is it the ratio of k?',
      'Window preset: how many watts flow through 1 m² of glass? Now replace the glass by 5 cm of foam.',
      'Double the thickness. What happens to the heat flow, and to the time needed to reach the steady state?',
    ],
  };

  const view = new View();
  let ctx: CanvasRenderingContext2D | null = null;
  const build = () => new Slab(CONDUCT_MATERIALS[params.mat] ?? CONDUCT_MATERIALS.copper, params.L, params.A, params.TH, params.TC);
  let slab = build();
  let ta = 0;
  const RUN = 15; // s of animation to (nearly) reach the steady state
  const speedUp = () => (6 * slab.tau) / RUN;

  function draw() {
    if (!ctx) return;
    const pal = palette.pal;
    const W = view.width;
    const usable = view.height - 76;
    ctx.fillStyle = pal.bg;
    ctx.fillRect(0, 0, W, view.height);
    const hot = pal.series[3].startsWith('#') ? pal.series[3] : '#e11d48';
    const cold = pal.series[0].startsWith('#') ? pal.series[0] : '#3b82f6';
    const lo = Math.min(params.TH, params.TC);
    const hi = Math.max(params.TH, params.TC);
    const frac = (T: number) => (hi - lo < 1e-9 ? 0 : (T - lo) / (hi - lo));
    // slab between two baths
    const x0 = 110;
    const x1 = W > 700 ? W - 300 : W - 60;
    const sy = 70;
    const sh = Math.min(80, usable * 0.2);
    ctx.fillStyle = alpha(params.TH >= params.TC ? hot : cold, 0.35);
    ctx.fillRect(x0 - 70, sy - 14, 64, sh + 28);
    ctx.fillStyle = alpha(params.TH >= params.TC ? cold : hot, 0.35);
    ctx.fillRect(x1 + 6, sy - 14, 64, sh + 28);
    ctx.fillStyle = pal.text2;
    ctx.font = '600 11px Inter Variable, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(`${params.TH} °C`, x0 - 38, sy + sh + 18);
    ctx.fillText(`${params.TC} °C`, x1 + 38, sy + sh + 18);
    const N = slab.N;
    const cw = (x1 - x0) / (N - 1);
    for (let i = 0; i < N; i++) {
      const x = x0 + (i - 0.5) * cw;
      const w = cw + 1;
      const xa = Math.max(x0, x);
      const xb = Math.min(x1, x + w);
      ctx.fillStyle = alpha(cold, 0.9);
      ctx.fillRect(xa, sy, xb - xa, sh);
      ctx.fillStyle = alpha(hot, frac(slab.T[i]));
      ctx.fillRect(xa, sy, xb - xa, sh);
    }
    ctx.strokeStyle = pal.text2;
    ctx.strokeRect(x0, sy, x1 - x0, sh);
    ctx.fillStyle = pal.text3;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(`${slab.mat.name.toLowerCase()}, Δx = ${fmt(params.L, 3)} m, A = ${fmt(params.A, 3)} m²`, (x0 + x1) / 2, sy - 8);
    // heat flow arrows
    const Pmax = Math.max(Math.abs(slab.Psteady), 1e-12);
    const arrow = (x: number, P: number, label: string) => {
      const len = 10 + 46 * Math.min(1.5, Math.abs(P) / Pmax);
      const y = sy + sh / 2;
      const dir = P >= 0 ? 1 : -1;
      drawArrow(ctx!, x - (dir * len) / 2, y, x + (dir * len) / 2, y, pal.ink, undefined, 3);
      drawTag(ctx!, x, sy + sh + 40, `${label} ${fmt(P, 3)} W`, pal.ink, pal.surface);
    };
    arrow(x0 + 30, slab.Pin, 'in');
    arrow(x1 - 30, slab.Pout, 'out');
    // temperature profile
    const py0 = sy + sh + 74;
    const py1 = usable - 30;
    if (py1 - py0 < 50) return;
    const tlo = lo - 0.08 * (hi - lo || 1);
    const thi = hi + 0.08 * (hi - lo || 1);
    const Y = (T: number) => py1 - ((T - tlo) / (thi - tlo)) * (py1 - py0);
    const X = (i: number) => x0 + i * cw;
    ctx.lineWidth = 1;
    ctx.font = '500 10px Inter Variable, system-ui, sans-serif';
    const ts = niceStep((py1 - py0) / (thi - tlo), 30);
    for (let T = Math.ceil(tlo / ts) * ts; T <= thi; T += ts) {
      ctx.strokeStyle = pal.grid;
      ctx.beginPath();
      ctx.moveTo(x0, Y(T));
      ctx.lineTo(x1, Y(T));
      ctx.stroke();
      ctx.fillStyle = pal.text3;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${+T.toFixed(6)}`, x0 - 6, Y(T));
    }
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText('T / °C', x0 - 40, py0 - 8);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('distance from the hot face →', (x0 + x1) / 2, py1 + 6);
    // steady-state line
    ctx.strokeStyle = pal.text3;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(X(0), Y(params.TH));
    ctx.lineTo(X(N - 1), Y(params.TC));
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = pal.series[1];
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let i = 0; i < N; i++) {
      if (i === 0) ctx.moveTo(X(i), Y(slab.T[i]));
      else ctx.lineTo(X(i), Y(slab.T[i]));
    }
    ctx.stroke();
    ctx.lineWidth = 1;
    drawTag(ctx, X(Math.round(N * 0.7)), Y(slab.T[Math.round(N * 0.7)]) - 16, 'now', pal.series[1], pal.surface);
  }

  const ctrl: SimController = new SimController(
    {
      step: (dt) => {
        ta += dt;
        slab.step(dt * speedUp());
        if (ta >= RUN) ctrl.pause();
      },
      render: draw,
      sample: (_tt, out) => {
        out[0] = slab.t;
        out[1] = slab.Pin;
        out[2] = slab.Pout;
        out[3] = slab.Psteady;
        out[4] = slab.T[(slab.N - 1) / 2];
      },
      reset: () => {
        slab = build();
        ta = 0;
      },
    },
    { dt: 1 / 120, channels, sampleInterval: 1 / 20, autoplay: true },
  );
  const palette = usePalette(() => ctrl);
  resetOn(ctrl, () => [params.mat, params.L, params.A, params.TH, params.TC]);
  $effect(() => {
    void [params.mat, params.L, params.A, params.TH, params.TC];
    if (ctx) ctrl.play();
  });

  const rows = $derived.by(() => {
    void ctrl.renderCount;
    return [
      { label: 'real time t', value: fmt(slab.t, 3), unit: 's' },
      { label: 'in at hot face', value: fmt(slab.Pin, 3), unit: 'W', color: '--series-4' },
      { label: 'out at cold face', value: fmt(slab.Pout, 3), unit: 'W', color: '--series-1' },
      { label: 'steady state kAΔT/Δx', value: fmt(slab.Psteady, 3), unit: 'W', strong: true },
      { label: 'thermal conductivity k', value: fmt(slab.mat.k, 3), unit: 'W m⁻¹ K⁻¹' },
      { label: 'animation speed-up', value: `×${fmt(speedUp(), 2)}` },
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
  initialGraphs={['P', 'Tm']}
  {presets}
  onpreset={(id) => Object.assign(params, presets.find((p) => p.id === id)?.values ?? {})}
  stopwatch={false}
>
  {#snippet stage()}
    <SimCanvas
      {view}
      label="Thermal conduction through a slab between two heat baths"
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
      <label class="sel">
        <span>Material</span>
        <select bind:value={params.mat}>
          {#each Object.entries(CONDUCT_MATERIALS) as [k, m] (k)}
            <option value={k}>{m.name} (k = {m.k} W m⁻¹ K⁻¹)</option>
          {/each}
        </select>
      </label>
      <Slider def={sl('L')} bind:value={params.L} />
      <Slider def={sl('A')} bind:value={params.A} />
      <Slider def={sl('TH')} bind:value={params.TH} />
      <Slider def={sl('TC')} bind:value={params.TC} />
    </div>
  {/snippet}
</SimShell>

<style>
  .controls {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }
  .sel {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    font-size: var(--text-sm);
    color: var(--text-2);
  }
  select {
    min-height: 44px;
    padding: 0 var(--space-3);
    border-radius: var(--radius-s);
    border: 1px solid var(--border-strong);
    background: var(--surface);
    color: var(--text);
    font: inherit;
  }
</style>
