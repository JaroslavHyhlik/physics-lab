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
    ACTIVITY,
    BACKGROUND,
    GAMMA_MU_RHO,
    RHO,
    alphaRangeAir,
    countRate,
    poisson,
    transmission,
    type Absorber,
    type Source,
  } from '../../physics/penetration';
  import { Rng } from '../../core/rng';
  import { drawXYPlot } from '../../sim/xyPlot';
  import { alpha } from '../../sim/palette';
  import { drawTag } from '../../sim/draw';
  import { fmt } from '../../core/format';

  let { entry }: { entry: SimEntry } = $props();
  const sliders: NumberParamDef[] = [
    { key: 'x', label: 'Absorber thickness', symbol: 'x', unit: 'mm', min: 0, max: 30, step: 0.1 },
    { key: 'd', label: 'Distance from source to detector', symbol: 'd', unit: 'cm', min: 1, max: 40, step: 0.5 },
  ];
  const { params, sl } = useParams({ src: 'beta', abs: 'al', x: 1, d: 5, bg: true, graph: 'x' }, sliders);
  const presets = [
    { id: 'alpha', label: 'α: stopped by paper', values: { src: 'alpha', abs: 'paper', x: 0, d: 2, graph: 'x' } },
    { id: 'alpharange', label: 'α: range in air (move the detector)', values: { src: 'alpha', abs: 'none', x: 0, d: 2, graph: 'd' } },
    { id: 'beta', label: 'β: aluminium absorbs it', values: { src: 'beta', abs: 'al', x: 1, d: 5, graph: 'x' } },
    { id: 'gamma', label: 'γ: lead halves it every centimetre', values: { src: 'gamma', abs: 'pb', x: 10, d: 5, graph: 'x' } },
    { id: 'square', label: 'γ: inverse square law', values: { src: 'gamma', abs: 'none', x: 0, d: 10, graph: 'd' } },
  ];
  const info: SimInfo = {
    about: [
      'Alpha particles are heavy and doubly charged. They ionise strongly, so they lose their energy fast: a few centimetres of air or a sheet of paper stops them.',
      'Beta particles (fast electrons) ionise less and travel further: tens of centimetres of air. A few millimetres of aluminium stops them. Because they come out with a range of energies, the count falls gradually as the absorber gets thicker.',
      'Gamma rays are photons. They ionise weakly and are never completely stopped, only reduced: each extra half-value thickness halves the intensity. Several centimetres of lead are needed. In air they spread out, so the count rate falls as 1/d² (inverse square law).',
      'A Geiger–Müller tube counts the particles that enter it. There is always a background count from rocks, building materials and cosmic rays, which must be subtracted. Counts are random, so a count N has an uncertainty of about √N.',
    ],
    formulas: [
      { label: 'Intensity of γ from a point source', tex: 'I \\propto \\dfrac{1}{d^{2}}', beyond: true },
      { label: 'Absorption of γ (half-value thickness x½)', tex: 'I = I_0e^{-\\mu x},\\quad x_{1/2} = \\dfrac{\\ln 2}{\\mu}', beyond: true },
      { label: 'Uncertainty of a count', tex: '\\Delta N \\approx \\sqrt{N}', beyond: true },
    ],
    assumptions: [
      `Sealed sources of ${ACTIVITY / 1e3} kBq: americium-241 (α, 5.49 MeV; its weak γ is ignored), strontium-90 with yttrium-90 (β, end-point energies 0.546 and 2.28 MeV), cobalt-60 (two γ of 1.17 and 1.33 MeV per decay).`,
      'α range in air from Geiger’s rule R = 0.318 E^1.5 cm. β absorption approximately exponential up to the maximum range (Katz–Penfold empirical formulas). γ: narrow-beam attenuation with NIST XCOM coefficients at 1.25 MeV (lead 0.059, aluminium 0.055 cm² g⁻¹).',
      'GM tube: window radius 0.7 cm on the axis of a point source; it counts 90 % of α and β but only 1 % of γ that reach it; dead time 100 µs; background 0.4 counts per second.',
      'The flying particles are only a sample to show what happens; their number, speed and size are not to scale. Counts arrive at random (Poisson statistics, seeded random numbers) in real time.',
    ],
    tryThis: [
      'With no source effect (α behind paper), what does the counter read? That is the background.',
      'β: record the count rate for 0, 0.5, 1, 2, 3, 4 and 5 mm of aluminium. Where does it reach the background?',
      'γ: find the thickness of lead that halves the count rate (subtract the background first).',
      'γ, no absorber: double the distance. By what factor does the corrected count rate fall?',
    ],
  };

  const src = $derived(params.src as Source);
  const abs = $derived(params.abs as Absorber);
  const expected = $derived(countRate(src, abs, params.x, params.d, params.bg));

  // counting: counts in 0.1 s bins, rate over the last 10 s
  const BINS = 100;
  const bins = new Uint32Array(BINS);
  let binT = 0;
  let bi = 0;
  let total = $state(0);
  let tCount = $state(0);
  const rng = new Rng(4);
  const lastRate = () => {
    let s = 0;
    for (let i = 0; i < BINS; i++) s += bins[i];
    const span = Math.min(10, tCount);
    return { n: s, span, rate: span > 0 ? s / span : 0 };
  };

  // visual particles: x [cm from source], y offset, stop position [cm], kind
  const MAXP = 120;
  const px = new Float64Array(MAXP);
  const py = new Float64Array(MAXP);
  const pstop = new Float64Array(MAXP);
  const palive = new Uint8Array(MAXP);
  let pacc = 0;
  let flash = 0;

  let points: { x: number; y: number }[] = $state([]);
  function record() {
    const r = lastRate();
    if (r.span <= 0) return;
    const v = Math.round(r.rate * 100) / 100;
    points = [...points, { x: params.graph === 'x' ? params.x : params.d, y: v }];
  }
  let seen = $state(`${params.src}|${params.abs}|${params.graph}`);
  $effect(() => {
    const k = `${params.src}|${params.abs}|${params.graph}`;
    if (k !== seen) {
      seen = k;
      points = [];
    }
  });

  const absX = () => Math.max(0.3, params.d - 0.3 - (abs === 'paper' ? 0.01 : params.x / 10)); // absorber front face [cm]
  const absW = () => (abs === 'none' ? 0 : abs === 'paper' ? 0.01 : params.x / 10);

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
    const sceneW = wide ? W - 320 : W;
    const sy = wide ? 120 : 90;
    const sx0 = 50;
    const k = Math.min(90, (sceneW - sx0 - 120) / (params.d + 1.5)); // px per cm
    const X = (cm: number) => sx0 + cm * k;
    // source
    ctx.fillStyle = pal.text2;
    ctx.fillRect(sx0 - 22, sy - 14, 22, 28);
    ctx.fillStyle = pal.hl;
    ctx.beginPath();
    ctx.arc(sx0, sy, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = pal.text2;
    ctx.font = '500 10px Inter Variable, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(src === 'alpha' ? 'Am-241 (α)' : src === 'beta' ? 'Sr-90 (β)' : 'Co-60 (γ)', sx0 - 10, sy + 20);
    // absorber
    if (abs !== 'none' && (abs === 'paper' || params.x > 0)) {
      const col = abs === 'paper' ? (pal.dark ? '#e8e2cf' : '#d9d1b8') : abs === 'al' ? (pal.dark ? '#9aa4b1' : '#b8c0ca') : pal.dark ? '#5b6170' : '#6b7280';
      const xa = X(absX());
      const wa = Math.max(abs === 'paper' ? 2 : 3, absW() * k);
      ctx.fillStyle = col;
      ctx.fillRect(xa, sy - 45, wa, 90);
      ctx.fillStyle = pal.text2;
      ctx.fillText(abs === 'paper' ? 'paper' : `${params.x.toFixed(1)} mm ${abs === 'al' ? 'aluminium' : 'lead'}`, xa + wa / 2, sy + 50);
    }
    // particles
    const colour = src === 'alpha' ? pal.series[3] : src === 'beta' ? pal.series[0] : pal.series[2];
    ctx.strokeStyle = colour;
    ctx.fillStyle = colour;
    ctx.lineWidth = 1.5;
    for (let i = 0; i < MAXP; i++) {
      if (!palive[i]) continue;
      const x = X(Math.min(px[i], pstop[i]));
      const y = sy + py[i] * 10;
      if (src === 'gamma') {
        ctx.beginPath();
        for (let s = 0; s <= 16; s++) {
          const xx = x - 16 + s;
          const yy = y + 3 * Math.sin(s * 0.8 + px[i] * 6);
          if (s === 0) ctx.moveTo(xx, yy);
          else ctx.lineTo(xx, yy);
        }
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.arc(x, y, src === 'alpha' ? 4 : 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.lineWidth = 1;
    // GM tube
    const gx = X(params.d);
    ctx.fillStyle = pal.surface;
    ctx.strokeStyle = pal.text2;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(gx, sy - 14, 90, 28, [2, 10, 10, 2]);
    ctx.fill();
    ctx.stroke();
    ctx.lineWidth = 1;
    ctx.fillStyle = flash > 0 ? pal.hl : pal.text3;
    ctx.fillRect(gx - 2, sy - 9, 4, 18);
    ctx.fillStyle = pal.text2;
    ctx.fillText('GM tube', gx + 45, sy + 20);
    const r = lastRate();
    drawTag(ctx, gx + 45, sy - 34, `${total} counts · ${fmt(r.rate, 3)} s⁻¹`, pal.ink, pal.surface);
    // distance marker
    ctx.strokeStyle = pal.gridStrong;
    ctx.beginPath();
    ctx.moveTo(sx0, sy + 64);
    ctx.lineTo(gx, sy + 64);
    ctx.stroke();
    ctx.fillStyle = pal.text3;
    ctx.fillText(`d = ${params.d.toFixed(1)} cm`, (sx0 + gx) / 2, sy + 68);
    if (src === 'alpha' && abs === 'none') {
      const xr = X(alphaRangeAir());
      ctx.strokeStyle = alpha(pal.series[3].startsWith('#') ? pal.series[3] : '#e11d48', 0.5);
      ctx.setLineDash([3, 4]);
      ctx.beginPath();
      ctx.moveTo(xr, sy - 50);
      ctx.lineTo(xr, sy + 50);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = pal.series[3];
      ctx.textBaseline = 'bottom';
      ctx.fillText('range of α in air', xr, sy - 52);
    }

    // graph
    const gx0 = 60;
    const gx1 = wide ? W - 330 : W - 20;
    const gy0 = sy + 110;
    const gy1 = usable - 30;
    if (gx1 - gx0 < 110 || gy1 - gy0 < 70) return;
    const byX = params.graph === 'x';
    const xmax = byX ? (src === 'gamma' ? 30 : src === 'beta' ? 6 : 1) : 40;
    const f = (v: number) => (byX ? countRate(src, abs, v, params.d, params.bg) : countRate(src, abs, params.x, v, params.bg));
    let ymax = 1;
    for (let i = 0; i <= 60; i++) ymax = Math.max(ymax, f(byX ? (i / 60) * xmax : 1 + (i / 60) * 39));
    for (const p of points) ymax = Math.max(ymax, p.y);
    drawXYPlot(ctx, pal, {
      x0: gx0,
      y0: gy0,
      x1: gx1,
      y1: gy1,
      xmin: byX ? 0 : 0,
      xmax,
      ymin: 0,
      ymax: ymax * 1.1,
      xLabel: byX ? `${abs === 'pb' ? 'lead' : abs === 'al' ? 'aluminium' : 'absorber'} thickness x / mm` : 'distance d / cm',
      yLabel: `count rate / s⁻¹${params.bg ? ' (incl. background)' : ''}`,
      curves: [{ fn: (v) => (byX ? f(v) : v >= 1 ? f(v) : NaN), color: alpha(pal.text3.startsWith('#') ? pal.text3 : '#888888', 0.8), dash: [4, 4], width: 1.5, samples: 400 }],
      points,
      current: { x: byX ? params.x : params.d, y: r.rate },
    });
  }

  const ctrl: SimController = new SimController(
    {
      step: (dt) => {
        tCount += dt;
        const n = poisson(rng, expected * dt);
        if (n > 0) flash = 0.06;
        else flash = Math.max(0, flash - dt);
        total += n;
        binT += dt;
        if (binT >= 0.1) {
          binT -= 0.1;
          bi = (bi + 1) % BINS;
          bins[bi] = 0;
        }
        bins[bi] += n;
        // visual sample of particles heading for the window
        pacc += 25 * dt;
        while (pacc >= 1) {
          pacc -= 1;
          for (let i = 0; i < MAXP; i++)
            if (!palive[i]) {
              palive[i] = 1;
              px[i] = 0;
              py[i] = rng.uniform(-1, 1);
              // where it stops: in the absorber (if it does not get through) or at the end of its range in air
              const Tabs = transmission(src, abs, params.x, 0) / Math.max(1e-12, transmission(src, 'none', 0, 0));
              let stop = Infinity;
              if (rng.next() > Tabs) stop = absX() + rng.next() * absW();
              if (src === 'alpha') stop = Math.min(stop, alphaRangeAir() + rng.uniform(-0.15, 0.15));
              pstop[i] = stop;
              break;
            }
        }
        const speed = src === 'alpha' ? 6 : src === 'beta' ? 14 : 20; // cm per second of animation (not to scale)
        for (let i = 0; i < MAXP; i++) {
          if (!palive[i]) continue;
          px[i] += speed * dt;
          if (px[i] > params.d || px[i] > pstop[i] + 3) palive[i] = 0;
        }
      },
      render: draw,
      reset: () => {
        bins.fill(0);
        binT = 0;
        bi = 0;
        total = 0;
        tCount = 0;
        palive.fill(0);
        pacc = 0;
      },
    },
    { dt: 1 / 120, autoplay: true },
  );
  const palette = usePalette(() => ctrl);
  resetOn(ctrl, () => [params.src, params.abs, params.x, params.d, params.bg]);
  redrawOn(ctrl, () => [points.length, params.graph]);
  $effect(() => {
    void [params.src, params.abs, params.x, params.d, params.bg];
    if (ctx) ctrl.play();
  });

  const rows = $derived.by(() => {
    void ctrl.renderCount;
    const r = lastRate();
    const out: { label: string; value: string; unit?: string; color?: string; strong?: boolean }[] = [
      { label: 'total count N', value: String(total) },
      { label: 'counting time', value: tCount.toFixed(1), unit: 's' },
      { label: `count rate (last ${r.span < 10 ? r.span.toFixed(1) : '10'} s)`, value: `${fmt(r.rate, 3)} ± ${fmt(Math.sqrt(Math.max(1, r.n)) / Math.max(r.span, 1e-9), 2)}`, unit: 's⁻¹', strong: true },
      { label: 'expected count rate', value: fmt(expected, 3), unit: 's⁻¹' },
      { label: 'background', value: params.bg ? fmt(BACKGROUND, 2) : 'off', unit: params.bg ? 's⁻¹' : undefined },
    ];
    if (src === 'gamma') {
      const mu = abs === 'pb' || abs === 'al' ? GAMMA_MU_RHO[abs] * RHO[abs] : NaN;
      if (Number.isFinite(mu)) out.push({ label: `half-value thickness of ${abs === 'pb' ? 'lead' : 'aluminium'}`, value: fmt((Math.LN2 / mu) * 10, 3), unit: 'mm' });
    }
    if (src === 'alpha') out.push({ label: 'range of α in air', value: fmt(alphaRangeAir(), 2), unit: 'cm' });
    return out;
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
      label="Radioactive source, absorber and Geiger–Müller counter with a graph of the count rate"
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
        label="Source"
        bind:value={params.src}
        options={[
          { value: 'alpha', label: 'α' },
          { value: 'beta', label: 'β' },
          { value: 'gamma', label: 'γ' },
        ]}
      />
      <Segmented
        label="Absorber"
        small
        bind:value={params.abs}
        options={[
          { value: 'none', label: 'None' },
          { value: 'paper', label: 'Paper' },
          { value: 'al', label: 'Aluminium' },
          { value: 'pb', label: 'Lead' },
        ]}
      />
      {#if params.abs === 'al' || params.abs === 'pb'}<Slider def={sl('x')} bind:value={params.x} />{/if}
      <Slider def={sl('d')} bind:value={params.d} />
      <Toggle label="Background radiation" bind:checked={params.bg} />
      <Segmented
        label="Graph"
        bind:value={params.graph}
        options={[
          { value: 'x', label: 'Rate against thickness' },
          { value: 'd', label: 'Rate against distance' },
        ]}
      />
      <RecordTable
        {points}
        xLabel={params.graph === 'x' ? 'x / mm' : 'd / cm'}
        yLabel="rate / s⁻¹"
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
