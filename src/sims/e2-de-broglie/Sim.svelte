<script lang="ts">
  import { onMount } from 'svelte';
  import SimShell from '../../sim/SimShell.svelte';
  import SimCanvas from '../../sim/SimCanvas.svelte';
  import Readouts from '../../sim/Readouts.svelte';
  import Slider from '../../ui/Slider.svelte';
  import Segmented from '../../ui/Segmented.svelte';
  import Toggle from '../../ui/Toggle.svelte';
  import RecordTable from '../../sim/RecordTable.svelte';
  import { SimController } from '../../sim/controller.svelte';
  import { useParams, usePalette, resetOn, redrawOn } from '../../sim/setup.svelte';
  import { View } from '../../sim/view';
  import type { SimEntry } from '../../app/registry';
  import type { NumberParamDef } from '../../sim/params.svelte';
  import type { SimInfo } from '../../sim/types';
  import {
    GRAPHITE_D,
    braggAngle,
    fringeSpacing,
    momentum,
    ringRadius,
    sampleHit,
    slitIntensity,
    wavelength,
    wavelengthRelativistic,
  } from '../../physics/deBroglie';
  import { linearFit } from '../../physics/dc';
  import { h, e, m_e } from '../../core/constants';
  import { Rng } from '../../core/rng';
  import { drawXYPlot } from '../../sim/xyPlot';
  import { alpha } from '../../sim/palette';
  import { drawTag } from '../../sim/draw';
  import { fmt } from '../../core/format';

  let { entry }: { entry: SimEntry } = $props();
  const sliders: NumberParamDef[] = [
    { key: 'V', label: 'Accelerating voltage', symbol: 'V', unit: 'V', min: 50, max: 5000, step: 10, log: true },
    { key: 'd', label: 'Slit separation', symbol: 'd', unit: 'nm', min: 100, max: 1000, step: 1 },
    { key: 'a', label: 'Slit width', symbol: 'a', unit: 'nm', min: 20, max: 200, step: 1 },
    { key: 'rate', label: 'Electrons per second', symbol: '', unit: 's⁻¹', min: 1, max: 300, step: 1, log: true },
  ];
  const { params, sl } = useParams({ mode: 'rings', V: 3000, d: 272, a: 62, rate: 40, one: false }, sliders);
  const presets = [
    { id: 'tube', label: 'Electron diffraction tube at 3 kV', values: { mode: 'rings', V: 3000 } },
    { id: 'low', label: 'Lower voltage: longer λ, bigger rings', values: { mode: 'rings', V: 1500 } },
    { id: 'slits', label: 'Double slit, one electron at a time', values: { mode: 'slits', V: 600, d: 272, a: 62, rate: 40, one: false } },
    { id: 'fast', label: 'Double slit: build the pattern quickly', values: { mode: 'slits', V: 600, d: 272, a: 62, rate: 300, one: false } },
    { id: 'one', label: 'One slit closed: no interference', values: { mode: 'slits', V: 600, d: 272, a: 62, rate: 300, one: true } },
  ];
  const L_TUBE = 0.135; // graphite to screen [m]
  const R_SCREEN = 0.065; // radius of the visible screen [m]
  const L_SLIT = 1; // slits to detector [m]
  const Y_SLIT = 1.5e-3; // half-width of the detector [m]

  const info: SimInfo = {
    about: [
      'De Broglie proposed that every particle has a wavelength λ = h/p. An electron accelerated through a voltage V gains kinetic energy eV, so p = √(2m_e eV) and λ = h/√(2m_e eV). At a few kilovolts this is about 0.02 nm, similar to the spacing of atoms in a crystal.',
      'Electron diffraction tube: a beam of electrons passes through a thin layer of graphite. The many tiny crystals point in all directions, so each set of atomic planes diffracts the electrons into a cone and a bright ring appears on the screen. Higher voltage → shorter wavelength → smaller rings. Particles that diffract must behave as waves.',
      'Double slit: electrons are sent one at a time. Each one arrives at a single point, like a particle. But after many have arrived they form interference fringes, like a wave passing through both slits. Close one slit and the fringes disappear.',
      'Even a tennis ball has a de Broglie wavelength, but at 58 g and 30 m s⁻¹ it is about 4 × 10⁻³⁴ m: far too small to observe.',
    ],
    formulas: [
      { label: 'de Broglie wavelength', tex: '\\lambda = \\dfrac{h}{p}', hl: true },
      { label: 'Electron accelerated through V', tex: 'p = \\sqrt{2m_e eV}', beyond: true },
      { label: 'Bragg condition (first order)', tex: '2d\\sin\\theta = \\lambda', beyond: true },
      { label: 'Fringe spacing', tex: 's = \\dfrac{\\lambda D}{d}' },
    ],
    assumptions: [
      'Non-relativistic momentum p = √(2m_e eV); at 5 kV the true wavelength is about 0.24 % shorter.',
      'Diffraction tube: graphite plane spacings 0.213 nm and 0.123 nm (the two bright rings of school tubes); a flat screen 13.5 cm from the graphite (real tubes have a curved screen). Only first-order rings are shown; ring brightness and width are illustrative.',
      'Double slit: far-field (Fraunhofer) pattern of two slits of width a, detector 1 m behind them. Each electron lands at a random point drawn from the wave intensity (seeded random numbers). The default slits (62 nm wide, 272 nm apart, 600 eV electrons) are like those used in a 2013 single-electron experiment.',
    ],
    tryThis: [
      'Record the radius of the inner ring at several voltages and plot it against 1/√V. Is it a straight line through the origin? Use the gradient to find the graphite spacing.',
      'Double slit: watch the first 20 electrons. Can you see the fringes yet? Wait for a few thousand.',
      'Close one slit. What happens to the fringes? What does this say about which slit the electron went through?',
      'Halve the slit separation. What happens to the fringe spacing?',
    ],
  };

  const lam = $derived(wavelength(params.V));
  const rIn = $derived(ringRadius(GRAPHITE_D[0], lam, L_TUBE));
  const rOut = $derived(ringRadius(GRAPHITE_D[1], lam, L_TUBE));

  // recorded points: x = 1/√V [V^-1/2], y = inner-ring radius [mm]
  let points: { x: number; y: number }[] = $state([]);
  const fit = $derived(linearFit(points.map((p) => p.x), points.map((p) => p.y)));
  function record() {
    if (!(rIn < R_SCREEN)) return;
    points = [...points, { x: 1 / Math.sqrt(params.V), y: Math.round(rIn * 1e4) / 10 }];
  }

  // double-slit detector hits
  const MAXHITS = 40000;
  const hitY = new Float32Array(MAXHITS);
  const hitJ = new Float32Array(MAXHITS);
  const NBINS = 300;
  const bins = new Uint32Array(NBINS);
  let nHits = $state(0);
  let acc = 0;
  const rng = new Rng(5);

  const view = new View();
  let ctx: CanvasRenderingContext2D | null = null;

  function drawRings() {
    const pal = palette.pal;
    const W = view.width;
    const usable = view.height - 76;
    const wide = W > 760;
    const areaW = wide ? Math.min(W * 0.5, 520) : W;
    const cx = areaW / 2;
    const Rpx = Math.max(60, Math.min(areaW / 2 - 30, (wide ? usable : usable * 0.55) / 2 - 30));
    const cy = Rpx + 36;
    const k = Rpx / R_SCREEN; // px per m on the screen
    const c = ctx!;
    c.fillStyle = pal.dark ? '#0b1410' : '#1a2420';
    c.beginPath();
    c.arc(cx, cy, Rpx, 0, Math.PI * 2);
    c.fill();
    const green = pal.dark ? '#7dffb0' : '#6ef0a2';
    c.save();
    c.beginPath();
    c.arc(cx, cy, Rpx, 0, Math.PI * 2);
    c.clip();
    for (const r of [rIn, rOut]) {
      if (!(r < R_SCREEN * 1.2)) continue;
      for (const [w, a] of [
        [14, 0.12],
        [7, 0.3],
        [2.5, 0.9],
      ] as const) {
        c.strokeStyle = alpha(green, a);
        c.lineWidth = w;
        c.beginPath();
        c.arc(cx, cy, r * k, 0, Math.PI * 2);
        c.stroke();
      }
    }
    const g = c.createRadialGradient(cx, cy, 0, cx, cy, 16);
    g.addColorStop(0, alpha(green, 1));
    g.addColorStop(1, alpha(green, 0));
    c.fillStyle = g;
    c.beginPath();
    c.arc(cx, cy, 16, 0, Math.PI * 2);
    c.fill();
    c.restore();
    c.lineWidth = 1;
    c.strokeStyle = pal.text3;
    c.beginPath();
    c.arc(cx, cy, Rpx, 0, Math.PI * 2);
    c.stroke();
    // scale bar 10 mm
    c.strokeStyle = pal.text2;
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(cx - 0.005 * k, cy + Rpx + 16);
    c.lineTo(cx + 0.005 * k, cy + Rpx + 16);
    c.stroke();
    c.lineWidth = 1;
    c.fillStyle = pal.text2;
    c.font = '500 10px Inter Variable, system-ui, sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'top';
    c.fillText('10 mm', cx, cy + Rpx + 20);
    c.textBaseline = 'bottom';
    c.fillText('screen of the diffraction tube (graphite 13.5 cm away)', cx, cy - Rpx - 8);
    if (!(rIn < R_SCREEN)) drawTag(c, cx, cy + 40, 'rings too large for the screen: raise V', pal.negative, pal.surface);

    // graph r against 1/√V
    const gx0 = wide ? areaW + 50 : 56;
    const gx1 = W - 24;
    const gy0 = wide ? 230 : cy + Rpx + 70;
    const gy1 = usable - 30;
    if (gx1 - gx0 < 110 || gy1 - gy0 < 70) return;
    drawXYPlot(c, pal, {
      x0: gx0,
      y0: gy0,
      x1: gx1,
      y1: gy1,
      xmin: 0,
      xmax: 0.06,
      ymin: 0,
      ymax: 60,
      xLabel: '1/√V / V^−½',
      yLabel: 'inner ring radius r / mm',
      curves: [{ fn: (x) => ringRadius(GRAPHITE_D[0], h / Math.sqrt(2 * m_e * e / (x * x)), L_TUBE) * 1e3, color: alpha(pal.text3.startsWith('#') ? pal.text3 : '#888888', 0.6), dash: [3, 4], width: 1 }],
      points,
      current: rIn < R_SCREEN ? { x: 1 / Math.sqrt(params.V), y: rIn * 1e3 } : null,
      fit: points.length >= 2 ? { ...fit, color: pal.series[3] } : null,
    });
  }

  /** intensity averaged over one histogram bin centred at y, so the curve compares fairly with the bars */
  function binAverage(y: number, w: number): number {
    let sum = 0;
    for (let i = 0; i < 8; i++) sum += slitIntensity(y + ((i + 0.5) / 8 - 0.5) * w, lam, params.d * 1e-9, params.a * 1e-9, L_SLIT, !params.one);
    return sum / 8;
  }

  function drawSlits() {
    const pal = palette.pal;
    const W = view.width;
    const usable = view.height - 76;
    const wide = W > 760;
    const c = ctx!;
    const x0 = 30;
    const x1 = wide ? W - 330 : W - 20;
    const sy0 = wide ? 60 : 40;
    const sh = Math.min(150, usable * 0.3);
    const X = (y: number) => x0 + ((y + Y_SLIT) / (2 * Y_SLIT)) * (x1 - x0);
    c.fillStyle = pal.dark ? '#0b1410' : '#1a2420';
    c.fillRect(x0, sy0, x1 - x0, sh);
    c.fillStyle = pal.dark ? '#9dffc4' : '#7dffb0';
    const n = Math.min(nHits, MAXHITS);
    for (let i = 0; i < n; i++) c.fillRect(X(hitY[i]) - 1, sy0 + 4 + hitJ[i] * (sh - 8) - 1, 2, 2);
    c.fillStyle = pal.text2;
    c.font = '500 10px Inter Variable, system-ui, sans-serif';
    c.textAlign = 'left';
    c.textBaseline = 'bottom';
    c.fillText(`detector screen, 1 m behind the slits (${(2 * Y_SLIT * 1e3).toFixed(0)} mm wide)`, x0, sy0 - 6);
    // histogram with the predicted pattern
    const hy0 = sy0 + sh + 40;
    const hy1 = usable - 30;
    if (hy1 - hy0 < 60) return;
    let maxB = 1;
    for (let b = 0; b < NBINS; b++) maxB = Math.max(maxB, bins[b]);
    // expected counts per bin: N × (I in the bin)/(total I)
    let tot = 0;
    const M = 600;
    for (let i = 0; i < M; i++) tot += slitIntensity(-Y_SLIT + ((i + 0.5) * 2 * Y_SLIT) / M, lam, params.d * 1e-9, params.a * 1e-9, L_SLIT, !params.one);
    const binW = (2 * Y_SLIT) / NBINS;
    const scale = n > 0 ? (n * binW) / ((tot * 2 * Y_SLIT) / M) : 0;
    const ymax = Math.max(maxB, scale * 1.0) * 1.15 || 1;
    const { X: PX, Y: PY } = drawXYPlot(c, pal, {
      x0: x0 + 26,
      y0: hy0,
      x1,
      y1: hy1,
      xmin: -Y_SLIT * 1e3,
      xmax: Y_SLIT * 1e3,
      ymin: 0,
      ymax,
      xLabel: 'position on the screen / mm',
      yLabel: 'electrons per bin (line: expected from the wave intensity)',
      curves: n > 0 ? [{ fn: (ymm) => scale * binAverage(ymm * 1e-3, binW), color: pal.series[3], width: 1.5, samples: 900 }] : [],
    });
    c.fillStyle = alpha(pal.series[0].startsWith('#') ? pal.series[0] : '#3b82f6', 0.55);
    for (let b = 0; b < NBINS; b++) {
      if (!bins[b]) continue;
      const ya = -Y_SLIT * 1e3 + (b * binW) * 1e3;
      c.fillRect(PX(ya), PY(bins[b]), PX(ya + binW * 1e3) - PX(ya) - 0.5, PY(0) - PY(bins[b]));
    }
  }

  function draw() {
    if (!ctx) return;
    const pal = palette.pal;
    ctx.fillStyle = pal.bg;
    ctx.fillRect(0, 0, view.width, view.height);
    if (params.mode === 'rings') drawRings();
    else drawSlits();
  }

  const ctrl: SimController = new SimController(
    {
      step: (dt) => {
        if (params.mode !== 'slits' || nHits >= MAXHITS) return;
        acc += params.rate * dt;
        let added = 0;
        while (acc >= 1 && nHits + added < MAXHITS) {
          acc -= 1;
          const y = sampleHit(rng, lam, params.d * 1e-9, params.a * 1e-9, L_SLIT, Y_SLIT, !params.one);
          const i = nHits + added;
          hitY[i] = y;
          hitJ[i] = rng.next();
          const b = Math.min(NBINS - 1, Math.max(0, Math.floor(((y + Y_SLIT) / (2 * Y_SLIT)) * NBINS)));
          bins[b]++;
          added++;
        }
        if (added) nHits += added;
      },
      render: draw,
      reset: () => {
        nHits = 0;
        acc = 0;
        bins.fill(0);
      },
    },
    { dt: 1 / 120, autoplay: true },
  );
  const palette = usePalette(() => ctrl);
  resetOn(ctrl, () => [params.mode, params.V, params.d, params.a, params.one]);
  redrawOn(ctrl, () => [points.length]);

  const rows = $derived.by(() => {
    const p = momentum(params.V);
    const r: { label: string; value: string; unit?: string; color?: string; strong?: boolean }[] = [
      { label: 'momentum p = √(2m_e eV)', value: fmt(p, 3), unit: 'kg m s⁻¹' },
      { label: 'de Broglie λ = h/p', value: fmt(lam * 1e12, 3), unit: 'pm', strong: true },
      { label: 'relativistic λ (for comparison)', value: fmt(wavelengthRelativistic(params.V) * 1e12, 3), unit: 'pm' },
      { label: 'electron speed', value: fmt(p / m_e, 3), unit: 'm s⁻¹' },
    ];
    if (params.mode === 'rings') {
      const ring = (x: number) => (x < R_SCREEN ? fmt(x * 1e3, 3) : 'off the screen');
      r.push(
        { label: 'Bragg angle θ (d = 0.213 nm)', value: fmt((braggAngle(GRAPHITE_D[0], lam) * 180) / Math.PI, 3), unit: '°' },
        { label: 'inner ring radius', value: ring(rIn), unit: rIn < R_SCREEN ? 'mm' : undefined, color: '--series-3' },
        { label: 'outer ring radius', value: ring(rOut), unit: rOut < R_SCREEN ? 'mm' : undefined },
      );
      if (points.length >= 2)
        r.push({
          label: 'from the fit: d = Lh/(gradient·√(2m_e e))',
          value: fmt(((L_TUBE * h) / ((fit.slope * 1e-3) * Math.sqrt(2 * m_e * e))) * 1e9, 3),
          unit: 'nm',
          color: '--series-4',
        });
    } else {
      r.push(
        { label: 'fringe spacing λD/d', value: fmt(fringeSpacing(lam, params.d * 1e-9, L_SLIT) * 1e3, 3), unit: 'mm' },
        { label: 'electrons detected', value: String(nHits), strong: true },
      );
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
>
  {#snippet stage()}
    <SimCanvas
      {view}
      label="Electron diffraction: rings on the screen of a graphite tube, or single electrons building a double-slit pattern"
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
        label="Experiment"
        bind:value={params.mode}
        options={[
          { value: 'rings', label: 'Graphite rings' },
          { value: 'slits', label: 'Double slit' },
        ]}
      />
      <Slider def={sl('V')} bind:value={params.V} />
      {#if params.mode === 'rings'}
        <RecordTable {points} xLabel="1/√V / V^−½" yLabel="r / mm" onrecord={record} onclear={() => (points = [])} />
      {:else}
        <Slider def={sl('d')} bind:value={params.d} />
        <Slider def={sl('a')} bind:value={params.a} />
        <Slider def={sl('rate')} bind:value={params.rate} />
        <Toggle label="Close one slit" bind:checked={params.one} />
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
</style>
