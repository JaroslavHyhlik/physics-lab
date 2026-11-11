<script lang="ts">
  import { onMount } from 'svelte';
  import SimShell from '../../sim/SimShell.svelte';
  import SimCanvas from '../../sim/SimCanvas.svelte';
  import Readouts from '../../sim/Readouts.svelte';
  import Slider from '../../ui/Slider.svelte';
  import RecordTable from '../../sim/RecordTable.svelte';
  import { SimController } from '../../sim/controller.svelte';
  import { useParams, usePalette, redrawOn } from '../../sim/setup.svelte';
  import { View } from '../../sim/view';
  import { Interaction } from '../../sim/interaction';
  import type { SimEntry } from '../../app/registry';
  import type { NumberParamDef } from '../../sim/params.svelte';
  import type { SimInfo } from '../../sim/types';
  import { RESISTIVITY, wireResistance, linearFit, meterReading } from '../../physics/dc';
  import { drawXYPlot } from '../../sim/xyPlot';
  import { drawTag } from '../../sim/draw';
  import { fmt } from '../../core/format';

  let { entry }: { entry: SimEntry } = $props();
  const sliders: NumberParamDef[] = [
    { key: 'L', label: 'Length between the clips', symbol: 'L', unit: 'm', min: 0.05, max: 1, step: 0.01 },
    { key: 'd', label: 'Diameter of the wire', symbol: 'd', unit: 'mm', min: 0.1, max: 1.5, step: 0.01 },
  ];
  const { params, sl } = useParams({ mat: 'constantan', L: 0.5, d: 0.3 }, sliders);
  const presets = [
    { id: 'con', label: 'Constantan, 0.30 mm', values: { mat: 'constantan', d: 0.3, L: 0.5 } },
    { id: 'nic', label: 'Nichrome, 0.30 mm', values: { mat: 'nichrome', d: 0.3, L: 0.5 } },
    { id: 'cu', label: 'Copper, 0.30 mm (tiny R)', values: { mat: 'copper', d: 0.3, L: 0.5 } },
  ];
  const info: SimInfo = {
    about: [
      'The resistance of a wire depends on its length L, its cross-sectional area A and the material it is made of. A longer wire means the charges must pass more obstacles; a thicker wire gives them more room.',
      'R = ρL/A, where ρ is the resistivity, a property of the material alone (unit Ω m). Metals such as copper have tiny resistivities; alloys such as constantan and nichrome are used for resistance wire.',
      'Measure R for several lengths, plot R against L: the straight line through the origin has gradient ρ/A. With A = πd²/4 from the measured diameter, ρ = gradient × A.',
    ],
    formulas: [
      { label: 'Resistivity', tex: '\\rho = \\dfrac{RA}{L}' },
      { label: 'Resistance', tex: 'R = \\dfrac{V}{I}' },
      { label: 'Cross-sectional area of a wire', tex: 'A = \\dfrac{\\pi d^{2}}{4}', beyond: true },
    ],
    assumptions: [
      'Resistivities at 20 °C (CRC Handbook): copper 1.68 × 10⁻⁸, aluminium 2.65 × 10⁻⁸, tungsten 5.6 × 10⁻⁸, iron 9.7 × 10⁻⁸, constantan 4.9 × 10⁻⁷, nichrome 1.1 × 10⁻⁶ Ω m.',
      'The wire stays at 20 °C (small current) and has the same diameter everywhere. The ohmmeter shows 4 significant figures and the clips have no resistance.',
    ],
    tryThis: [
      'Record R for five lengths and find ρ for constantan from the gradient. Compare with the table value.',
      'Halve the diameter. By what factor does R change? Why?',
      'How long would a 0.3 mm copper wire have to be to have the same resistance as 10 cm of nichrome?',
    ],
  };

  let points: { x: number; y: number }[] = $state([]);
  let matSeen = $state(params.mat + params.d);
  $effect(() => {
    const k = params.mat + params.d;
    if (k !== matSeen) {
      matSeen = k;
      points = [];
    }
  });
  const rho = $derived(RESISTIVITY[params.mat]?.rho ?? RESISTIVITY.constantan.rho);
  const A = $derived((Math.PI * (params.d * 1e-3) ** 2) / 4);
  const R = $derived(wireResistance(rho, params.L, A));
  const Rread = $derived(meterReading(R, 10 ** (Math.floor(Math.log10(R)) - 3)));
  const fit = $derived(linearFit(points.map((p) => p.x), points.map((p) => p.y)));

  const view = new View();
  const inter = new Interaction();
  let ctx: CanvasRenderingContext2D | null = null;
  const geo = { x0: 0, x1: 1, y: 0 };
  inter.add({
    priority: 10,
    cursor: 'ew-resize',
    hit: (px, py) => (Math.abs(py - geo.y) < 40 ? Math.abs(px - (geo.x0 + params.L * (geo.x1 - geo.x0))) : Infinity),
    move: (px) => {
      params.L = Math.round(Math.max(0.05, Math.min(1, (px - geo.x0) / (geo.x1 - geo.x0))) * 100) / 100;
    },
  });

  function draw() {
    if (!ctx) return;
    const pal = palette.pal;
    const W = view.width;
    const H = view.height;
    ctx.fillStyle = pal.bg;
    ctx.fillRect(0, 0, W, H);
    // metre rule with the wire
    const x0 = 40;
    const x1 = W > 760 ? W - 300 : W - 40;
    const y = 120;
    geo.x0 = x0;
    geo.x1 = x1;
    geo.y = y;
    ctx.fillStyle = pal.surface;
    ctx.fillRect(x0 - 10, y + 10, x1 - x0 + 20, 26);
    ctx.strokeStyle = pal.text3;
    ctx.strokeRect(x0 - 10, y + 10, x1 - x0 + 20, 26);
    ctx.fillStyle = pal.text3;
    ctx.font = '500 9px Inter Variable, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (let cm = 0; cm <= 100; cm++) {
      const x = x0 + (cm / 100) * (x1 - x0);
      const h = cm % 10 === 0 ? 10 : cm % 5 === 0 ? 7 : 4;
      ctx.fillRect(x, y + 10, 1, h);
      if (cm % 10 === 0) ctx.fillText(`${cm}`, x, y + 22);
    }
    ctx.strokeStyle = pal.series[1];
    ctx.lineWidth = Math.max(1.5, params.d * 4);
    ctx.beginPath();
    ctx.moveTo(x0, y);
    ctx.lineTo(x1, y);
    ctx.stroke();
    ctx.lineWidth = 1;
    // clips and ohmmeter
    const xc = x0 + params.L * (x1 - x0);
    for (const x of [x0, xc]) {
      ctx.fillStyle = pal.text2;
      ctx.fillRect(x - 6, y - 14, 12, 20);
    }
    ctx.strokeStyle = pal.text2;
    ctx.lineWidth = 2;
    const mx = (x0 + xc) / 2;
    ctx.beginPath();
    ctx.moveTo(x0, y - 14);
    ctx.quadraticCurveTo(x0, y - 60, mx - 30, y - 70);
    ctx.moveTo(xc, y - 14);
    ctx.quadraticCurveTo(xc, y - 60, mx + 30, y - 70);
    ctx.stroke();
    ctx.lineWidth = 1;
    drawTag(ctx, mx, y - 78, `Ω-meter: ${Rread.toPrecision(4)} Ω`, pal.ink, pal.surface);
    drawTag(ctx, xc, y + 50, `L = ${params.L.toFixed(2)} m (drag the clip)`, pal.text2, pal.surface);
    // graph R against L
    const gy0 = y + 100;
    const gy1 = H - 40;
    if (gy1 - gy0 < 60) return;
    const Rmax = wireResistance(rho, 1, A) * 1.1;
    drawXYPlot(ctx, pal, {
      x0: 70,
      y0: gy0,
      x1: x1,
      y1: gy1,
      xmin: 0,
      xmax: 1,
      ymin: 0,
      ymax: Rmax,
      xLabel: 'L / m',
      yLabel: 'R / Ω',
      curves: [{ fn: (L) => wireResistance(rho, L, A), color: pal.series[0], dash: [2, 4], width: 1 }],
      points,
      current: { x: params.L, y: Rread },
      fit: points.length >= 2 ? { ...fit, color: pal.series[3] } : null,
    });
  }

  const ctrl = new SimController({ step: () => {}, render: draw, reset: () => {} }, { dt: 1, autoplay: false });
  const palette = usePalette(() => ctrl);
  redrawOn(ctrl, () => [params.mat, params.L, params.d, points.length]);
  inter.onChange = () => ctrl.invalidate();

  const rows = $derived.by(() => {
    const r: { label: string; value: string; unit?: string; color?: string; strong?: boolean }[] = [
      { label: 'resistance R', value: Rread.toPrecision(4), unit: 'Ω', strong: true },
      { label: 'area A = πd²/4', value: fmt(A, 3), unit: 'm²' },
    ];
    if (points.length >= 2) {
      r.push({ label: 'gradient ρ/A', value: fmt(fit.slope, 4), unit: 'Ω m⁻¹' });
      r.push({ label: 'ρ = gradient × A', value: fmt(fit.slope * A, 3), unit: 'Ω m', color: '--series-4', strong: true });
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
      label="Resistance wire on a metre rule with an ohmmeter and an R–L graph"
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
          {#each Object.entries(RESISTIVITY) as [k, m] (k)}
            <option value={k}>{m.name} (ρ = {fmt(m.rho, 3)} Ω m)</option>
          {/each}
        </select>
      </label>
      <Slider def={sl('L')} bind:value={params.L} />
      <Slider def={sl('d')} bind:value={params.d} />
      <RecordTable {points} xLabel="L / m" yLabel="R / Ω" onrecord={() => (points = [...points, { x: params.L, y: Rread }])} onclear={() => (points = [])} />
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
