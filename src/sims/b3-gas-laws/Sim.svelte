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
  import type { SimEntry } from '../../app/registry';
  import type { NumberParamDef } from '../../sim/params.svelte';
  import type { SimInfo } from '../../sim/types';
  import { idealP, idealV, vdwP, vdwV, VDW } from '../../physics/gasLaws';
  import { alpha } from '../../sim/palette';
  import { drawTag, niceStep } from '../../sim/draw';
  import { fmt } from '../../core/format';

  let { entry }: { entry: SimEntry } = $props();
  const sliders: NumberParamDef[] = [
    { key: 'n', label: 'Amount of gas', symbol: 'n', unit: 'mol', min: 0.001, max: 0.5, step: 0.001, log: true },
    { key: 'V', label: 'Volume', symbol: 'V', unit: 'cm³', min: 5, max: 500, step: 1, log: true },
    { key: 'T', label: 'Temperature', symbol: 'T', unit: '°C', min: -100, max: 300, step: 1 },
    { key: 'p', label: 'Pressure (weights on the piston)', symbol: 'p', unit: 'kPa', min: 20, max: 10000, step: 1, log: true },
  ];
  const { params, sl } = useParams({ law: 'boyle', gas: 'ideal', n: 0.004, V: 100, T: 20, p: 100 }, sliders);
  const presets = [
    { id: 'boyle', label: "Boyle's law (constant temperature)", values: { law: 'boyle', gas: 'ideal', n: 0.004, V: 100, T: 20 } },
    { id: 'charles', label: "Charles's law (constant pressure)", values: { law: 'charles', gas: 'ideal', n: 0.004, p: 100, T: 20 } },
    { id: 'gay', label: "Gay-Lussac's law (constant volume)", values: { law: 'gay', gas: 'ideal', n: 0.004, V: 100, T: 20 } },
    { id: 'real', label: 'Real CO₂ squeezed hard (van der Waals)', values: { law: 'boyle', gas: 'CO2', n: 0.2, V: 100, T: 40 } },
  ];
  const info: SimInfo = {
    about: [
      'A fixed amount of gas is trapped in a cylinder by a piston. Three quantities describe its state: pressure p, volume V and temperature T. Keep one of them constant and the other two are linked by a simple law.',
      "Boyle's law: at constant temperature, p ∝ 1/V (pV is constant). Charles's law: at constant pressure, V ∝ T. Gay-Lussac's (pressure) law: at constant volume, p ∝ T. All three are summarised by pV/T = constant, or pV = nRT.",
      'Temperature must be absolute (kelvin). Plotted against temperature in °C, the straight lines meet zero volume or zero pressure at −273 °C: absolute zero.',
      'Real gases are close to ideal at low pressure. Squeezed hard, the attraction between molecules and their own volume matter: the van der Waals model (beyond syllabus) shows the difference.',
    ],
    formulas: [
      { label: 'Ideal gas laws', tex: '\\dfrac{pV}{T} = \\text{constant}' },
      { label: 'Equation of state', tex: 'pV = nRT = Nk_BT' },
      { label: 'Amount of substance', tex: 'n = \\dfrac{N}{N_A}' },
      { label: 'van der Waals equation', tex: '\\left(p + \\dfrac{an^{2}}{V^{2}}\\right)(V - nb) = nRT', beyond: true },
    ],
    assumptions: [
      'The gas is in equilibrium at each setting (changes are made slowly). The amount of gas n does not change (no leaks).',
      'Ideal gas: point particles with no forces between them. Real gas: van der Waals constants from the CRC Handbook (He: a = 0.00346 Pa m⁶ mol⁻², b = 2.38 × 10⁻⁵ m³ mol⁻¹; N₂: 0.137, 3.87 × 10⁻⁵; CO₂: 0.364, 4.267 × 10⁻⁵).',
      'Below 31 °C real CO₂ would condense to a liquid when squeezed; the van der Waals curve there shows an unphysical wiggle instead.',
      'R = 8.31 J K⁻¹ mol⁻¹ (data booklet).',
    ],
    tryThis: [
      "Boyle: record five points and check that p × V stays the same.",
      "Charles: extend the V–T line to V = 0. At what temperature does it cross?",
      'Compare an ideal gas and CO₂ at 0.2 mol in 100 cm³. Which has the lower pressure, and why?',
    ],
  };

  type Pt = { x: number; y: number };
  let points: Pt[] = $state([]);
  let lawSeen = $state(params.law);

  const gasModel = () => (params.gas === 'ideal' ? null : VDW[params.gas]);
  /** current state in SI */
  const st = $derived.by(() => {
    const n = params.n;
    const T = params.T + 273.15;
    const g = gasModel();
    if (params.law === 'charles') {
      const p = params.p * 1e3;
      const V = g ? vdwV(n, p, T, g) : idealV(n, p, T);
      return { p, V, T, n };
    }
    const V = params.V * 1e-6;
    const p = g ? vdwP(n, V, T, g) : idealP(n, V, T);
    return { p, V, T, n };
  });
  /** graph axes for the chosen law */
  const axes = $derived.by(() => {
    if (params.law === 'boyle') return { xl: 'V / cm³', yl: 'p / kPa', x: st.V * 1e6, y: st.p / 1e3, xmin: 0, xmax: 500, ext: false };
    if (params.law === 'charles') return { xl: 'T / °C', yl: 'V / cm³', x: params.T, y: st.V * 1e6, xmin: -300, xmax: 300, ext: true };
    return { xl: 'T / °C', yl: 'p / kPa', x: params.T, y: st.p / 1e3, xmin: -300, xmax: 300, ext: true };
  });
  $effect(() => {
    if (params.law !== lawSeen) {
      lawSeen = params.law;
      points = [];
    }
  });
  function record() {
    points = [...points, { x: axes.x, y: axes.y }];
  }

  const view = new View();
  let ctx: CanvasRenderingContext2D | null = null;

  /** y value of the law's curve at x, keeping the other variables as now */
  function curve(x: number, real: boolean): number {
    const n = params.n;
    const g = real ? gasModel() : null;
    if (params.law === 'boyle') {
      const V = x * 1e-6;
      const T = params.T + 273.15;
      return (g ? vdwP(n, V, T, g) : idealP(n, V, T)) / 1e3;
    }
    const T = x + 273.15;
    if (T <= 1) return NaN;
    if (params.law === 'charles') {
      const p = params.p * 1e3;
      return (g ? vdwV(n, p, T, g) : idealV(n, p, T)) * 1e6;
    }
    const V = params.V * 1e-6;
    return (g ? vdwP(n, V, T, g) : idealP(n, V, T)) / 1e3;
  }

  function draw() {
    if (!ctx) return;
    const pal = palette.pal;
    const W = view.width;
    const H = view.height;
    ctx.fillStyle = pal.bg;
    ctx.fillRect(0, 0, W, H);
    // cylinder
    const cw = 110;
    const chMax = Math.min(260, H - 120);
    const cx = 40;
    const cy = 60;
    const Vcm = st.V * 1e6;
    const hgt = Math.max(6, Math.min(1, Vcm / 500) * chMax);
    const top = cy + chMax - hgt;
    ctx.fillStyle = alpha(pal.series[0].startsWith('#') ? pal.series[0] : '#3b82f6', 0.12 + 0.5 * Math.min(1, st.n / st.V / 2000));
    ctx.fillRect(cx, top, cw, hgt);
    ctx.strokeStyle = pal.text2;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx, cy - 20);
    ctx.lineTo(cx, cy + chMax);
    ctx.lineTo(cx + cw, cy + chMax);
    ctx.lineTo(cx + cw, cy - 20);
    ctx.stroke();
    ctx.lineWidth = 1;
    ctx.fillStyle = pal.text2;
    ctx.fillRect(cx + 2, top - 10, cw - 4, 10);
    ctx.fillRect(cx + cw / 2 - 4, top - 40, 8, 30);
    // fixed quantity hint
    const fixed = params.law === 'boyle' ? 'T fixed' : params.law === 'charles' ? 'p fixed' : 'V fixed (piston clamped)';
    ctx.fillStyle = pal.text3;
    ctx.font = '600 11px Inter Variable, system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(fixed, cx, cy + chMax + 10);
    drawTag(ctx, cx + cw / 2, top + hgt / 2, `${fmt(Vcm, 3)} cm³`, pal.ink, pal.surface);
    // graph
    const gx0 = cx + cw + 90;
    const gx1 = W - 24;
    const gy0 = 40;
    const gy1 = H - 40;
    if (gx1 - gx0 < 120) return;
    const a = axes;
    let ymax = Math.max(a.y, ...points.map((q) => q.y));
    const xs = a.ext ? [a.xmin, a.xmax] : [5, a.xmax];
    for (let i = 0; i <= 40; i++) {
      const x = xs[0] + ((xs[1] - xs[0]) * i) / 40;
      const y = curve(x, false);
      if (Number.isFinite(y) && (a.ext || x >= 20)) ymax = Math.max(ymax, y);
    }
    ymax *= 1.1;
    const X = (x: number) => gx0 + ((x - a.xmin) / (a.xmax - a.xmin)) * (gx1 - gx0);
    const Y = (y: number) => gy1 - (y / ymax) * (gy1 - gy0);
    ctx.font = '500 10px Inter Variable, system-ui, sans-serif';
    const xs1 = niceStep((gx1 - gx0) / (a.xmax - a.xmin), 60);
    for (let x = Math.ceil(a.xmin / xs1) * xs1; x <= a.xmax; x += xs1) {
      ctx.strokeStyle = x === 0 ? pal.gridStrong : pal.grid;
      ctx.beginPath();
      ctx.moveTo(X(x), gy0);
      ctx.lineTo(X(x), gy1);
      ctx.stroke();
      ctx.fillStyle = pal.text3;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(`${+x.toPrecision(6)}`, X(x), gy1 + 4);
    }
    const ys1 = niceStep((gy1 - gy0) / ymax, 36);
    for (let y = 0; y <= ymax; y += ys1) {
      ctx.strokeStyle = y === 0 ? pal.gridStrong : pal.grid;
      ctx.beginPath();
      ctx.moveTo(gx0, Y(y));
      ctx.lineTo(gx1, Y(y));
      ctx.stroke();
      ctx.fillStyle = pal.text3;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${+y.toPrecision(6)}`, gx0 - 6, Y(y));
    }
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.fillText(a.xl, gx1, H - 4);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText(a.yl, gx0, gy0 - 6);
    // ideal curve (dashed where it is an extrapolation below the slider range)
    const plot = (real: boolean, col: string, dash: number[]) => {
      ctx!.save();
      ctx!.beginPath();
      ctx!.rect(gx0, gy0, gx1 - gx0, gy1 - gy0);
      ctx!.clip();
      ctx!.strokeStyle = col;
      ctx!.lineWidth = 2;
      ctx!.setLineDash(dash);
      ctx!.beginPath();
      let started = false;
      for (let i = 0; i <= 300; i++) {
        const x = xs[0] + ((xs[1] - xs[0]) * i) / 300;
        const y = curve(x, real);
        if (!Number.isFinite(y)) {
          started = false;
          continue;
        }
        if (!started) ctx!.moveTo(X(x), Y(y));
        else ctx!.lineTo(X(x), Y(y));
        started = true;
      }
      ctx!.stroke();
      ctx!.restore();
    };
    plot(false, pal.series[0], a.ext ? [6, 4] : []);
    if (gasModel()) plot(true, pal.series[3], []);
    if (a.ext) drawTag(ctx, X(-273), Y(0) - 14, 'absolute zero −273 °C', pal.text2, pal.surface);
    // recorded points and the current state
    ctx.fillStyle = pal.series[1];
    for (const q of points) {
      ctx.beginPath();
      ctx.arc(X(q.x), Y(q.y), 5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = pal.ink;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(X(a.x), Y(a.y), 7, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 1;
  }

  const ctrl = new SimController({ step: () => {}, render: draw, reset: () => {} }, { dt: 1, autoplay: false });
  const palette = usePalette(() => ctrl);
  redrawOn(ctrl, () => [params.law, params.gas, params.n, params.V, params.T, params.p, points.length]);

  const rows = $derived.by(() => {
    const ideal = idealP(st.n, st.V, st.T);
    return [
      { label: 'pressure p', value: fmt(st.p / 1e3, 4), unit: 'kPa', strong: true },
      { label: 'volume V', value: fmt(st.V * 1e6, 4), unit: 'cm³' },
      { label: 'temperature T', value: st.T.toFixed(1), unit: 'K' },
      { label: 'pV/T', value: fmt((st.p * st.V) / st.T, 4), unit: 'J K⁻¹' },
      { label: 'pV/(nRT)', value: ((st.p / ideal) * 1).toFixed(4), color: gasModel() ? '--series-4' : undefined },
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
  onpreset={(id) => Object.assign(params, presets.find((q) => q.id === id)?.values ?? {})}
  stopwatch={false}
  transport={false}
>
  {#snippet stage()}
    <SimCanvas
      {view}
      label="Gas in a cylinder and its gas-law graph"
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
        label="Law"
        bind:value={params.law}
        options={[
          { value: 'boyle', label: 'Boyle' },
          { value: 'charles', label: 'Charles' },
          { value: 'gay', label: 'Gay-Lussac' },
        ]}
      />
      <Segmented
        label="Gas"
        bind:value={params.gas}
        options={[
          { value: 'ideal', label: 'Ideal' },
          { value: 'He', label: 'He' },
          { value: 'N2', label: 'N₂' },
          { value: 'CO2', label: 'CO₂' },
        ]}
      />
      <Slider def={sl('n')} bind:value={params.n} />
      {#if params.law !== 'charles'}<Slider def={sl('V')} bind:value={params.V} />{:else}<Slider def={sl('p')} bind:value={params.p} />{/if}
      <Slider def={sl('T')} bind:value={params.T} />
      <div class="rec">
        <button type="button" onclick={record}>Record point</button>
        <button type="button" class="ghost" onclick={() => (points = [])} disabled={!points.length}>Clear</button>
      </div>
      {#if points.length}
        <table>
          <thead><tr><th>{axes.xl}</th><th>{axes.yl}</th></tr></thead>
          <tbody>
            {#each points as q, i (i)}<tr><td>{fmt(q.x, 4)}</td><td>{fmt(q.y, 4)}</td></tr>{/each}
          </tbody>
        </table>
      {/if}
    </div>
  {/snippet}
</SimShell>

<style>
  .controls {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }
  .rec {
    display: flex;
    gap: var(--space-2);
  }
  button {
    min-height: 44px;
    padding: 0 var(--space-4);
    border-radius: var(--radius-s);
    border: 1px solid var(--accent);
    background: var(--accent);
    color: var(--on-accent);
    font: inherit;
    font-weight: 600;
    cursor: pointer;
  }
  button.ghost {
    background: transparent;
    color: var(--accent);
  }
  button:disabled {
    opacity: 0.5;
    cursor: default;
  }
  table {
    border-collapse: collapse;
    font-size: var(--text-sm);
    font-variant-numeric: tabular-nums;
  }
  th,
  td {
    text-align: right;
    padding: 4px 8px;
    border-bottom: 1px solid var(--border);
  }
  th {
    color: var(--text-2);
    font-weight: 600;
  }
</style>
