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
  import { cellCircuit, linearFit, meterReading } from '../../physics/dc';
  import { drawXYPlot } from '../../sim/xyPlot';
  import { drawTag } from '../../sim/draw';
  import { fmt } from '../../core/format';

  let { entry }: { entry: SimEntry } = $props();
  const sliders: NumberParamDef[] = [
    { key: 'emf', label: 'emf of the cell', symbol: 'ε', unit: 'V', min: 1, max: 13, step: 0.05 },
    { key: 'r', label: 'Internal resistance', symbol: 'r', unit: 'Ω', min: 0, max: 5, step: 0.01 },
    { key: 'R', label: 'Load resistance (rheostat)', symbol: 'R', unit: 'Ω', min: 0.1, max: 100, step: 0.1, log: true },
  ];
  const { params, sl } = useParams({ emf: 4.5, r: 1.2, R: 5, graph: 'VI' }, sliders);
  const presets = [
    { id: 'lab', label: 'Lab battery: 4.5 V, 1.2 Ω', values: { emf: 4.5, r: 1.2, R: 5 } },
    { id: 'aa', label: 'AA cell: 1.5 V, 0.3 Ω', values: { emf: 1.5, r: 0.3, R: 2 } },
    { id: 'nine', label: '9 V battery: 1.5 Ω', values: { emf: 9, r: 1.5, R: 10 } },
    { id: 'match', label: 'Maximum power: R = r', values: { emf: 4.5, r: 1.2, R: 1.2, graph: 'PR' } },
  ];
  const info: SimInfo = {
    about: [
      'A real cell is an ideal source of emf ε in series with a small internal resistance r. The emf is the energy the cell gives each coulomb of charge; part of it is used up inside the cell.',
      'With a current I the terminal potential difference is V = ε − Ir: the bigger the current, the more voltage is “lost” inside the cell.',
      'Change the load, record V and I each time, and plot V against I. The points lie on a straight line: the intercept on the V axis is ε and the gradient is −r.',
      'The power delivered to the load, I²R, is largest when the load resistance equals the internal resistance (R = r).',
    ],
    formulas: [
      { label: 'emf and internal resistance', tex: '\\varepsilon = I(R + r)' },
      { label: 'Terminal potential difference', tex: 'V = \\varepsilon - Ir' },
      { label: 'Power', tex: 'P = VI = I^{2}R = \\dfrac{V^{2}}{R}' },
      { label: 'Maximum power transfer', tex: 'R = r \\Rightarrow P_\\max = \\dfrac{\\varepsilon^{2}}{4r}', beyond: true },
    ],
    assumptions: [
      'ε and r are constant (a real cell’s emf falls slowly as it runs down, and r changes with temperature).',
      'Ideal meters: the ammeter has no resistance and the voltmeter takes no current. The meters show 0.01 V and 0.001 A resolution.',
      'Connecting wires have no resistance.',
    ],
    tryThis: [
      'Record at least five (I, V) points. Use the fit to find ε and r and compare with the sliders.',
      'What does the voltmeter read when R is very large (open circuit)? And what current flows when R → 0 (short circuit)?',
      'Switch to the power graph and find the load resistance that gives the most power.',
    ],
  };

  let points: { x: number; y: number }[] = $state([]);
  const c = $derived(cellCircuit(params.emf, params.r, params.R));
  const Iread = $derived(meterReading(c.I, 0.001));
  const Vread = $derived(meterReading(c.V, 0.01));
  const fit = $derived(linearFit(points.map((p) => p.x), points.map((p) => p.y)));
  function record() {
    points = [...points, params.graph === 'VI' ? { x: Iread, y: Vread } : { x: params.R, y: Vread * Iread }];
  }
  let graphSeen = $state(params.graph);
  $effect(() => {
    if (params.graph !== graphSeen) {
      graphSeen = params.graph;
      points = [];
    }
  });

  const view = new View();
  let ctx: CanvasRenderingContext2D | null = null;

  function meter(cx: number, cy: number, letter: string, reading: string, pal: typeof palette.pal) {
    ctx!.fillStyle = pal.surface;
    ctx!.strokeStyle = pal.text2;
    ctx!.lineWidth = 2;
    ctx!.beginPath();
    ctx!.arc(cx, cy, 16, 0, Math.PI * 2);
    ctx!.fill();
    ctx!.stroke();
    ctx!.fillStyle = pal.ink;
    ctx!.font = '700 13px Inter Variable, system-ui, sans-serif';
    ctx!.textAlign = 'center';
    ctx!.textBaseline = 'middle';
    ctx!.fillText(letter, cx, cy);
    drawTag(ctx!, cx, cy - 32, reading, pal.ink, pal.surface);
  }

  function draw() {
    if (!ctx) return;
    const pal = palette.pal;
    const W = view.width;
    const H = view.height;
    ctx.fillStyle = pal.bg;
    ctx.fillRect(0, 0, W, H);
    // circuit
    const x0 = 110;
    const x1 = Math.max(x0 + 160, Math.min(340, W * 0.38));
    const y0 = 70;
    const y1 = Math.min(270, H * 0.55);
    ctx.strokeStyle = pal.text2;
    ctx.lineWidth = 2;
    ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
    // cell (with r) on the left side
    const cy = (y0 + y1) / 2;
    ctx.fillStyle = pal.bg;
    ctx.fillRect(x0 - 24, cy - 50, 48, 100);
    ctx.setLineDash([3, 3]);
    ctx.strokeStyle = pal.text3;
    ctx.strokeRect(x0 - 24, cy - 50, 48, 100);
    ctx.setLineDash([]);
    ctx.strokeStyle = pal.text2;
    ctx.beginPath();
    ctx.moveTo(x0, cy - 50);
    ctx.lineTo(x0, cy - 34);
    ctx.moveTo(x0 - 16, cy - 34);
    ctx.lineTo(x0 + 16, cy - 34);
    ctx.moveTo(x0 - 8, cy - 26);
    ctx.lineTo(x0 + 8, cy - 26);
    ctx.moveTo(x0, cy - 26);
    ctx.lineTo(x0, cy - 4);
    ctx.stroke();
    ctx.strokeRect(x0 - 7, cy - 4, 14, 30);
    ctx.beginPath();
    ctx.moveTo(x0, cy + 26);
    ctx.lineTo(x0, cy + 50);
    ctx.stroke();
    ctx.fillStyle = pal.text2;
    ctx.font = '600 11px Inter Variable, system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`ε = ${params.emf.toFixed(2)} V`, x0 + 30, cy - 30);
    ctx.fillText(`r = ${params.r.toFixed(2)} Ω`, x0 + 30, cy + 11);
    // load resistor on the right side (rheostat arrow)
    ctx.fillStyle = pal.bg;
    ctx.fillRect(x1 - 10, cy - 30, 20, 60);
    ctx.strokeRect(x1 - 10, cy - 30, 20, 60);
    ctx.beginPath();
    ctx.moveTo(x1 - 24, cy + 34);
    ctx.lineTo(x1 + 24, cy - 34);
    ctx.stroke();
    ctx.fillStyle = pal.text2;
    ctx.textAlign = 'right';
    ctx.fillText(`R = ${fmt(params.R, 3)} Ω`, x1 - 16, cy);
    // ammeter in series (top wire), voltmeter across the cell terminals (outside)
    meter((x0 + x1) / 2, y0, 'A', `${Iread.toFixed(3)} A`, pal);
    ctx.strokeStyle = pal.text2;
    ctx.lineWidth = 2;
    const xv = x0 - 70;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(xv, y0);
    ctx.lineTo(xv, y1);
    ctx.lineTo(x0, y1);
    ctx.stroke();
    ctx.lineWidth = 1;
    meter(xv, cy, 'V', `${Vread.toFixed(2)} V`, pal);
    // current direction (conventional)
    ctx.fillStyle = pal.text3;
    ctx.font = '500 10px Inter Variable, system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(`power in the load I²R = ${fmt(c.Pload, 3)} W`, xv, y1 + 16);
    ctx.fillText(`power wasted in the cell I²r = ${fmt(c.Plost, 3)} W`, xv, y1 + 32);
    // graph
    const gx0 = Math.max(x1 + 90, W * 0.45);
    const gx1 = W - 24;
    const gy0 = W > 760 ? 200 : y1 + 70;
    const gy1 = H - 40;
    if (gx1 - gx0 < 100 || gy1 - gy0 < 60) return;
    const blue = pal.series[0];
    if (params.graph === 'VI') {
      const Imax = params.emf / Math.max(params.r, 0.05);
      const xmax = Math.min(Imax, Math.max(c.I * 1.6, (params.emf / (params.r + 0.1)) * 1.05));
      drawXYPlot(ctx, pal, {
        x0: gx0,
        y0: gy0,
        x1: gx1,
        y1: gy1,
        xmin: 0,
        xmax,
        ymin: 0,
        ymax: params.emf * 1.1,
        xLabel: 'I / A',
        yLabel: 'V / V',
        curves: [{ fn: (I) => params.emf - I * params.r, color: blue, dash: [2, 4], width: 1 }],
        points,
        current: { x: Iread, y: Vread },
        fit: points.length >= 2 ? { ...fit, color: pal.series[3] } : null,
      });
    } else {
      const Rmax = Math.max(20, 6 * params.r);
      const Pmax = (params.emf * params.emf) / (4 * Math.max(params.r, 0.05));
      drawXYPlot(ctx, pal, {
        x0: gx0,
        y0: gy0,
        x1: gx1,
        y1: gy1,
        xmin: 0,
        xmax: Rmax,
        ymin: 0,
        ymax: Math.min(Pmax * 1.15, Math.max(...[c.Pload * 1.3, ...points.map((p) => p.y * 1.2), 0.01])),
        xLabel: 'R / Ω',
        yLabel: 'P in the load / W',
        curves: [{ fn: (R) => cellCircuit(params.emf, params.r, R).Pload, color: blue, dash: [2, 4], width: 1 }],
        points,
        current: { x: params.R, y: c.Pload },
      });
    }
  }

  const ctrl = new SimController({ step: () => {}, render: draw, reset: () => {} }, { dt: 1, autoplay: false });
  const palette = usePalette(() => ctrl);
  redrawOn(ctrl, () => [params.emf, params.r, params.R, params.graph, points.length]);

  const rows = $derived.by(() => {
    const r: { label: string; value: string; unit?: string; color?: string; strong?: boolean }[] = [
      { label: 'ammeter I', value: Iread.toFixed(3), unit: 'A', strong: true },
      { label: 'voltmeter V', value: Vread.toFixed(2), unit: 'V', strong: true },
      { label: 'lost volts Ir', value: (c.I * params.r).toFixed(3), unit: 'V' },
    ];
    if (params.graph === 'VI' && points.length >= 2)
      r.push(
        { label: 'from the fit: ε = intercept', value: fit.intercept.toFixed(3), unit: 'V', color: '--series-4' },
        { label: 'from the fit: r = −gradient', value: (-fit.slope).toFixed(3), unit: 'Ω', color: '--series-4' },
      );
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
      label="Cell with internal resistance, rheostat, ammeter and voltmeter"
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
      <Slider def={sl('emf')} bind:value={params.emf} />
      <Slider def={sl('r')} bind:value={params.r} />
      <Slider def={sl('R')} bind:value={params.R} />
      <Segmented
        label="Graph"
        bind:value={params.graph}
        options={[
          { value: 'VI', label: 'V against I' },
          { value: 'PR', label: 'Power against R' },
        ]}
      />
      <RecordTable
        {points}
        xLabel={params.graph === 'VI' ? 'I / A' : 'R / Ω'}
        yLabel={params.graph === 'VI' ? 'V / V' : 'P / W'}
        onrecord={record}
        onclear={() => (points = [])}
      />
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
