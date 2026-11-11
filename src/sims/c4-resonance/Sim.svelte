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
  import { DrivenOscillators, steadyAmplitude, phaseLag } from '../../physics/driven';
  import { g } from '../../core/constants';
  import { drawXYPlot } from '../../sim/xyPlot';
  import { drawTag } from '../../sim/draw';
  import { fmt } from '../../core/format';

  let { entry }: { entry: SimEntry } = $props();
  const sliders: NumberParamDef[] = [
    { key: 'fd', label: 'Driving frequency', symbol: 'f', unit: 'Hz', min: 0.2, max: 3, step: 0.01 },
    { key: 'b', label: 'Damping coefficient', symbol: 'b', unit: 'kg s⁻¹', min: 0.02, max: 3, step: 0.01, log: true },
    { key: 'Lb', label: 'Length of the driver pendulum', symbol: 'L', unit: 'm', min: 0.2, max: 1, step: 0.01 },
  ];
  const { params, sl } = useParams({ mode: 'single', fd: 1, b: 0.2, Lb: 0.5 }, sliders);
  const presets = [
    { id: 'below', label: 'Below resonance', values: { mode: 'single', fd: 0.6, b: 0.2 } },
    { id: 'at', label: 'At resonance (f = f₀)', values: { mode: 'single', fd: 1.13, b: 0.2 } },
    { id: 'heavy', label: 'At resonance with heavy damping', values: { mode: 'single', fd: 1.13, b: 1.5 } },
    { id: 'barton', label: "Barton's pendulums", values: { mode: 'barton', Lb: 0.5, b: 0.05 } },
  ];
  // single oscillator: m = 0.5 kg, k = 25 N/m → f₀ = 1.125 Hz
  const m = 0.5;
  const k = 25;
  const F0 = 0.5;
  const LENGTHS = [0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0];
  const channels: ChannelDef[] = [
    { key: 't', label: 't', unit: 's' },
    { key: 'x', label: 'displacement x', unit: 'cm', color: '--series-1' },
    { key: 'F', label: 'driving force (scaled)', unit: '', color: '--series-4', dash: [5, 4] },
  ];
  const graphs: GraphDef[] = [{ id: 'x', title: 'Displacement and driving force', series: ['x', 'F'] }];
  const info: SimInfo = {
    about: [
      'An oscillator left alone vibrates at its natural frequency f₀. Push it periodically with a driving frequency f and, after a while, it oscillates at the driving frequency with a steady amplitude.',
      'The amplitude is largest when the driving frequency is close to the natural frequency: resonance. The energy given by each push then adds up from one cycle to the next. Damping limits the peak and makes the resonance curve broader; with very light damping the amplitude at resonance can become huge (bridges, wine glasses).',
      'The oscillator lags behind the driver: almost in phase at low frequencies, a quarter of a cycle (π/2) behind at resonance, and almost in antiphase at high frequencies.',
      "Barton's pendulums: many pendulums of different lengths hang from one string and are driven by a heavy pendulum. Only the one with the same length — the same natural frequency — swings strongly.",
    ],
    formulas: [
      { label: 'Natural frequency (mass–spring)', tex: 'f_0 = \\dfrac{1}{2\\pi}\\sqrt{\\dfrac{k}{m}}' },
      { label: 'Natural frequency (pendulum)', tex: 'f_0 = \\dfrac{1}{2\\pi}\\sqrt{\\dfrac{g}{l}}' },
      { label: 'Steady amplitude', tex: 'A = \\dfrac{F_0/m}{\\sqrt{(\\omega_0^{2} - \\omega^{2})^{2} + (b\\omega/m)^{2}}}', beyond: true },
    ],
    assumptions: [
      'Mass 0.5 kg on a spring of 25 N m⁻¹ (f₀ = 1.13 Hz), damping force −bv, driving force F₀ cos ωt with F₀ = 0.5 N; solved with RK4.',
      "Barton's pendulums: small-angle pendulums of length 0.2–1.0 m, all driven with the same force at the driver pendulum's frequency, light damping (the driver is not slowed by them).",
      'The resonance curve shows the steady-state amplitude; the moving point shows the amplitude reached so far.',
    ],
    tryThis: [
      'Slowly change the driving frequency through f₀ and watch the amplitude and the phase lag.',
      'At resonance, increase the damping. What happens to the peak and to the width of the curve?',
      "Barton's pendulums: change the length of the driver. Which pendulum swings most?",
    ],
  };

  const view = new View();
  let ctx: CanvasRenderingContext2D | null = null;
  let osc: DrivenOscillators = buildSingle();
  let ampSeen = 0;
  let ampWindowStart = 0;
  let ampNow = 0;
  function buildSingle() {
    const o = new DrivenOscillators(new Float64Array([m]), new Float64Array([k]), new Float64Array([params.b]));
    o.F0 = F0;
    o.w = 2 * Math.PI * params.fd;
    return o;
  }
  function buildBarton() {
    const n = LENGTHS.length;
    const ms = new Float64Array(n).fill(0.1);
    const ks = Float64Array.from(LENGTHS, (L) => (0.1 * g) / L);
    const bs = new Float64Array(n).fill(params.b * 0.1);
    const o = new DrivenOscillators(ms, ks, bs);
    o.F0 = 0.002;
    o.w = Math.sqrt(g / params.Lb);
    return o;
  }

  function drawSingle(pal: typeof palette.pal, W: number, usable: number) {
    const cx = 120;
    const top = 40;
    const sc = 600; // px per m
    const x = osc.y[0];
    const drv = Math.cos(osc.w * osc.t);
    // driver bar
    ctx!.fillStyle = pal.text2;
    ctx!.fillRect(cx - 40, top + drv * 10 - 6, 80, 8);
    drawTag(ctx!, cx + 80, top + drv * 10, 'driver', pal.text3, pal.surface);
    // spring
    const eqY = top + 140;
    const my = eqY + x * sc;
    ctx!.strokeStyle = pal.text2;
    ctx!.lineWidth = 2;
    ctx!.beginPath();
    const y1 = top + drv * 10;
    for (let i = 0; i <= 20; i++) {
      const yy = y1 + ((my - 20 - y1) * i) / 20;
      const xx = cx + (i % 2 ? 10 : -10) * (i > 0 && i < 20 ? 1 : 0);
      if (i === 0) ctx!.moveTo(xx, yy);
      else ctx!.lineTo(xx, yy);
    }
    ctx!.stroke();
    ctx!.lineWidth = 1;
    ctx!.fillStyle = pal.series[0];
    ctx!.fillRect(cx - 22, my - 20, 44, 40);
    // resonance curve
    const gx0 = 260;
    const gx1 = W > 760 ? W - 280 : W - 20;
    const gy0 = 40;
    const gy1 = usable - 30;
    if (gx1 - gx0 < 120) return;
    const f0 = Math.sqrt(k / m) / (2 * Math.PI);
    const Amax = steadyAmplitude(m, k, params.b, F0, 2 * Math.PI * f0) * 100 * 1.15;
    const { X } = drawXYPlot(ctx!, pal, {
      x0: gx0,
      y0: gy0,
      x1: gx1,
      y1: gy1,
      xmin: 0,
      xmax: 3,
      ymin: 0,
      ymax: Math.max(Amax, ampNow * 100 * 1.1, 1),
      xLabel: 'driving frequency f / Hz',
      yLabel: 'steady amplitude / cm',
      curves: [{ fn: (f) => steadyAmplitude(m, k, params.b, F0, 2 * Math.PI * f) * 100, color: pal.series[0], width: 2, samples: 600 }],
      current: { x: params.fd, y: ampNow * 100 },
    });
    ctx!.strokeStyle = pal.text3;
    ctx!.setLineDash([3, 4]);
    ctx!.beginPath();
    ctx!.moveTo(X(f0), gy0);
    ctx!.lineTo(X(f0), gy1);
    ctx!.stroke();
    ctx!.setLineDash([]);
    drawTag(ctx!, X(f0), gy0 + 10, `f₀ = ${fmt(f0, 3)} Hz`, pal.text2, pal.surface);
  }

  function drawBarton(pal: typeof palette.pal, W: number, usable: number) {
    const x0 = 60;
    const x1 = W > 760 ? W - 300 : W - 30;
    const top = 40;
    const sc = Math.min(usable - 90, 320); // px per m of length
    ctx!.strokeStyle = pal.text2;
    ctx!.lineWidth = 2;
    ctx!.beginPath();
    ctx!.moveTo(x0, top);
    ctx!.lineTo(x1, top);
    ctx!.stroke();
    const n = LENGTHS.length;
    const drvTh = 0.15 * Math.cos(osc.w * osc.t);
    // driver pendulum on the left
    const dx = x0 + 20;
    const dL = params.Lb * sc;
    ctx!.lineWidth = 1.5;
    ctx!.beginPath();
    ctx!.moveTo(dx, top);
    ctx!.lineTo(dx + Math.sin(drvTh) * dL, top + Math.cos(drvTh) * dL);
    ctx!.stroke();
    ctx!.fillStyle = pal.text2;
    ctx!.beginPath();
    ctx!.arc(dx + Math.sin(drvTh) * dL, top + Math.cos(drvTh) * dL, 13, 0, Math.PI * 2);
    ctx!.fill();
    for (let i = 0; i < n; i++) {
      const px = x0 + 80 + ((x1 - x0 - 100) * i) / (n - 1);
      const L = LENGTHS[i] * sc;
      const th = Math.max(-1.2, Math.min(1.2, osc.y[2 * i] * 8)); // displayed angle (exaggerated)
      const bx = px + Math.sin(th) * L;
      const by = top + Math.cos(th) * L;
      const res = Math.abs(LENGTHS[i] - params.Lb) < 0.005;
      ctx!.strokeStyle = pal.text3;
      ctx!.beginPath();
      ctx!.moveTo(px, top);
      ctx!.lineTo(bx, by);
      ctx!.stroke();
      ctx!.fillStyle = res ? pal.series[3] : pal.series[0];
      ctx!.beginPath();
      ctx!.arc(bx, by, 8, 0, Math.PI * 2);
      ctx!.fill();
      ctx!.fillStyle = pal.text3;
      ctx!.font = '500 10px Inter Variable, system-ui, sans-serif';
      ctx!.textAlign = 'center';
      ctx!.textBaseline = 'top';
      ctx!.fillText(`${LENGTHS[i].toFixed(1)} m`, px, top + LENGTHS[i] * sc + 14);
    }
    ctx!.lineWidth = 1;
    drawTag(ctx!, dx + 10, top + dL + 30, `driver ${params.Lb.toFixed(2)} m`, pal.text2, pal.surface);
  }

  function draw() {
    if (!ctx) return;
    const pal = palette.pal;
    const W = view.width;
    const usable = view.height - 76;
    ctx.fillStyle = pal.bg;
    ctx.fillRect(0, 0, W, view.height);
    if (params.mode === 'single') drawSingle(pal, W, usable);
    else drawBarton(pal, W, usable);
  }

  const ctrl: SimController = new SimController(
    {
      step: (dt) => {
        osc.step(dt);
        if (params.mode === 'single') {
          // amplitude over the last full driving period
          ampSeen = Math.max(ampSeen, Math.abs(osc.y[0]));
          const T = (2 * Math.PI) / osc.w;
          if (osc.t - ampWindowStart >= T) {
            ampNow = ampSeen;
            ampSeen = 0;
            ampWindowStart = osc.t;
          }
        }
      },
      render: draw,
      sample: (_t, out) => {
        out[0] = osc.t;
        out[1] = (params.mode === 'single' ? osc.y[0] : osc.y[2 * LENGTHS.indexOf(Math.round(params.Lb * 10) / 10)] || 0) * 100;
        out[2] = Math.cos(osc.w * osc.t) * (params.mode === 'single' ? steadyAmplitude(m, k, params.b, F0, osc.w) * 100 : 1);
      },
      reset: () => {
        osc = params.mode === 'single' ? buildSingle() : buildBarton();
        ampSeen = 0;
        ampNow = 0;
        ampWindowStart = 0;
      },
    },
    { dt: 1 / 240, channels, sampleInterval: 1 / 30, autoplay: true },
  );
  const palette = usePalette(() => ctrl);
  resetOn(ctrl, () => [params.mode, params.b, params.Lb]);
  // the driving frequency changes live (no reset), as when turning a signal generator's knob
  $effect(() => {
    if (params.mode === 'single') osc.w = 2 * Math.PI * params.fd;
  });

  const rows = $derived.by(() => {
    void ctrl.renderCount;
    if (params.mode === 'single') {
      const w = 2 * Math.PI * params.fd;
      return [
        { label: 'natural frequency f₀', value: fmt(Math.sqrt(k / m) / (2 * Math.PI), 4), unit: 'Hz' },
        { label: 'steady amplitude (theory)', value: fmt(steadyAmplitude(m, k, params.b, F0, w) * 100, 3), unit: 'cm', strong: true },
        { label: 'amplitude now', value: fmt(ampNow * 100, 3), unit: 'cm' },
        { label: 'phase lag behind the driver', value: `${((phaseLag(m, k, params.b, w) * 180) / Math.PI).toFixed(0)}°` },
      ];
    }
    return [
      { label: 'driving frequency', value: fmt(Math.sqrt(g / params.Lb) / (2 * Math.PI), 4), unit: 'Hz' },
      { label: 'resonating pendulum', value: `${params.Lb.toFixed(2)} m` },
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
  initialGraphs={['x']}
  {presets}
  onpreset={(id) => Object.assign(params, presets.find((q) => q.id === id)?.values ?? {})}
>
  {#snippet stage()}
    <SimCanvas
      {view}
      label="Driven damped oscillator with its resonance curve, or Barton's pendulums"
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
          { value: 'single', label: 'Mass on a spring' },
          { value: 'barton', label: "Barton's pendulums" },
        ]}
      />
      {#if params.mode === 'single'}
        <Slider def={sl('fd')} bind:value={params.fd} />
      {:else}
        <Slider def={sl('Lb')} bind:value={params.Lb} />
      {/if}
      <Slider def={sl('b')} bind:value={params.b} />
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
