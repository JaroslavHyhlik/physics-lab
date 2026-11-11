<script lang="ts">
  import { onMount } from 'svelte';
  import SimShell from '../../sim/SimShell.svelte';
  import SimCanvas from '../../sim/SimCanvas.svelte';
  import Readouts from '../../sim/Readouts.svelte';
  import Slider from '../../ui/Slider.svelte';
  import Segmented from '../../ui/Segmented.svelte';
  import RecordTable from '../../sim/RecordTable.svelte';
  import { SimController } from '../../sim/controller.svelte';
  import { useParams, usePalette, redrawOn } from '../../sim/setup.svelte';
  import { View } from '../../sim/view';
  import type { SimEntry } from '../../app/registry';
  import type { NumberParamDef } from '../../sim/params.svelte';
  import type { SimInfo } from '../../sim/types';
  import { lampI, lampT, diodeI } from '../../physics/components';
  import { meterReading } from '../../physics/dc';
  import { drawXYPlot } from '../../sim/xyPlot';
  import { alpha } from '../../sim/palette';
  import { drawTag } from '../../sim/draw';
  import { fmt } from '../../core/format';

  let { entry }: { entry: SimEntry } = $props();
  const sliders: NumberParamDef[] = [
    { key: 'V', label: 'p.d. across the component', symbol: 'V', unit: 'V', min: -12, max: 12, step: 0.05 },
    { key: 'Vd', label: 'p.d. across the diode', symbol: 'V', unit: 'V', min: -1, max: 0.8, step: 0.005 },
    { key: 'R', label: 'Resistance', symbol: 'R', unit: 'Ω', min: 1, max: 20, step: 0.5 },
  ];
  const { params, sl } = useParams({ comp: 'lamp', V: 6, Vd: 0.6, R: 6 }, sliders);
  const presets = [
    { id: 'res', label: 'Resistor (ohmic)', values: { comp: 'resistor', V: 6, R: 6 } },
    { id: 'lamp', label: 'Filament lamp 12 V 24 W', values: { comp: 'lamp', V: 6 } },
    { id: 'diode', label: 'Silicon diode', values: { comp: 'diode', Vd: 0.6 } },
  ];
  const info: SimInfo = {
    about: [
      'An I–V characteristic shows how the current through a component depends on the potential difference across it. Reverse the supply to get negative values.',
      'A metal resistor at constant temperature is ohmic: I is proportional to V, so the graph is a straight line through the origin and R = V/I is constant.',
      'A filament lamp is non-ohmic. As the current rises the filament gets hotter (up to about 2700 K), its resistance increases and the graph curves towards the V axis. Its resistance when hot is about 14 times its cold resistance.',
      'A diode conducts in one direction only. Below about 0.5 V hardly any current flows; above it the current rises very steeply. In reverse only a tiny leakage current flows.',
    ],
    formulas: [
      { label: 'Resistance', tex: 'R = \\dfrac{V}{I}' },
      { label: 'Power', tex: 'P = VI = I^{2}R = \\dfrac{V^{2}}{R}' },
      { label: 'Diode (Shockley equation)', tex: 'I = I_s\\left(e^{V/nV_T} - 1\\right)', beyond: true },
    ],
    assumptions: [
      'Lamp: tungsten filament rated 12 V, 24 W at 2700 K; resistance ∝ T^1.2; all the electrical power is radiated (∝ T⁴ − T₀⁴); room temperature 293 K. Each point is the steady state reached after the filament has warmed up.',
      'Diode: I_s = 1 nA, ideality factor n = 1.5, at 300 K; reverse breakdown is not included.',
      'Ideal meters; the ammeter shows 3 significant figures, the voltmeter 0.01 V (0.001 V for the diode).',
    ],
    tryThis: [
      'Record points for the lamp from −12 V to +12 V. Is the graph symmetric? Is the lamp ohmic?',
      'Calculate R = V/I for the lamp at 1 V and at 12 V.',
      'At what p.d. does the diode start to conduct noticeably (I > 1 mA)?',
    ],
  };

  const isDiode = $derived(params.comp === 'diode');
  const Vnow = $derived(isDiode ? params.Vd : params.V);
  const Inow = $derived(params.comp === 'resistor' ? params.V / params.R : params.comp === 'lamp' ? lampI(params.V) : diodeI(params.Vd));
  const Vread = $derived(meterReading(Vnow, isDiode ? 0.001 : 0.01));
  const Iread = $derived(Inow === 0 ? 0 : Number(Inow.toPrecision(3)));
  let points: { x: number; y: number }[] = $state([]);
  let compSeen = $state(params.comp);
  $effect(() => {
    if (params.comp !== compSeen) {
      compSeen = params.comp;
      points = [];
    }
  });

  const view = new View();
  let ctx: CanvasRenderingContext2D | null = null;

  function draw() {
    if (!ctx) return;
    const pal = palette.pal;
    const W = view.width;
    const H = view.height;
    ctx.fillStyle = pal.bg;
    ctx.fillRect(0, 0, W, H);
    // component picture
    const cx = 120;
    const cy = 120;
    ctx.strokeStyle = pal.text2;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - 90, cy);
    ctx.lineTo(cx + 90, cy);
    ctx.stroke();
    if (params.comp === 'resistor') {
      ctx.fillStyle = pal.bg;
      ctx.fillRect(cx - 30, cy - 12, 60, 24);
      ctx.strokeRect(cx - 30, cy - 12, 60, 24);
    } else if (params.comp === 'lamp') {
      const T = lampT(params.V);
      const glow = Math.max(0, Math.min(1, (T - 900) / 1800));
      const warm = pal.hl.startsWith('#') ? pal.hl : '#f59e0b';
      if (glow > 0) {
        const g = ctx.createRadialGradient(cx, cy, 4, cx, cy, 60);
        g.addColorStop(0, alpha(warm, 0.9 * glow));
        g.addColorStop(1, alpha(warm, 0));
        ctx.fillStyle = g;
        ctx.fillRect(cx - 60, cy - 60, 120, 120);
      }
      ctx.fillStyle = pal.bg;
      ctx.beginPath();
      ctx.arc(cx, cy, 22, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx - 15, cy - 15);
      ctx.lineTo(cx + 15, cy + 15);
      ctx.moveTo(cx + 15, cy - 15);
      ctx.lineTo(cx - 15, cy + 15);
      ctx.stroke();
      drawTag(ctx, cx, cy + 50, `filament ${T.toFixed(0)} K`, pal.text2, pal.surface);
    } else {
      ctx.fillStyle = pal.text2;
      ctx.beginPath();
      ctx.moveTo(cx - 16, cy - 16);
      ctx.lineTo(cx - 16, cy + 16);
      ctx.lineTo(cx + 14, cy);
      ctx.closePath();
      ctx.fill();
      ctx.fillRect(cx + 14, cy - 16, 3, 32);
    }
    ctx.lineWidth = 1;
    drawTag(ctx, cx, cy - 46, `V = ${Vread.toFixed(isDiode ? 3 : 2)} V   I = ${fmt(Iread, 3)} A`, pal.ink, pal.surface);
    // graph
    const wide = W > 760;
    const gx0 = wide ? 300 : 60;
    const gx1 = wide ? W - 280 : W - 20;
    const gy0 = wide ? 50 : cy + 90;
    const gy1 = H - 40;
    if (gx1 - gx0 < 120 || gy1 - gy0 < 60) return;
    let xmin = -12;
    let xmax = 12;
    let fn: (V: number) => number;
    if (params.comp === 'resistor') fn = (V) => V / params.R;
    else if (params.comp === 'lamp') fn = lampI;
    else {
      xmin = -1;
      xmax = 0.8;
      fn = diodeI;
    }
    const Imax = Math.max(Math.abs(fn(xmax)), Math.abs(fn(xmin))) * 1.1;
    drawXYPlot(ctx, pal, {
      x0: gx0,
      y0: gy0,
      x1: gx1,
      y1: gy1,
      xmin,
      xmax,
      ymin: isDiode ? -0.1 * Imax : -Imax,
      ymax: Imax,
      xLabel: 'V / V',
      yLabel: 'I / A',
      curves: [{ fn, color: pal.series[0], dash: [2, 4], width: 1 }],
      points,
      current: { x: Vnow, y: Inow },
    });
  }

  const ctrl = new SimController({ step: () => {}, render: draw, reset: () => {} }, { dt: 1, autoplay: false });
  const palette = usePalette(() => ctrl);
  redrawOn(ctrl, () => [params.comp, params.V, params.Vd, params.R, points.length]);

  const rows = $derived([
    { label: 'voltmeter V', value: Vread.toFixed(isDiode ? 3 : 2), unit: 'V', strong: true },
    { label: 'ammeter I', value: fmt(Iread, 3), unit: 'A', strong: true },
    { label: 'R = V/I', value: Math.abs(Inow) > 1e-15 ? fmt(Vnow / Inow, 3) : '—', unit: 'Ω' },
    { label: 'power P = VI', value: fmt(Vnow * Inow, 3), unit: 'W' },
  ]);

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
      label="I–V characteristic of a resistor, filament lamp or diode"
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
        label="Component"
        bind:value={params.comp}
        options={[
          { value: 'resistor', label: 'Resistor' },
          { value: 'lamp', label: 'Filament lamp' },
          { value: 'diode', label: 'Diode' },
        ]}
      />
      {#if isDiode}<Slider def={sl('Vd')} bind:value={params.Vd} />{:else}<Slider def={sl('V')} bind:value={params.V} />{/if}
      {#if params.comp === 'resistor'}<Slider def={sl('R')} bind:value={params.R} />{/if}
      <RecordTable {points} xLabel="V / V" yLabel="I / A" onrecord={() => (points = [...points, { x: Vread, y: Iread }])} onclear={() => (points = [])} />
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
