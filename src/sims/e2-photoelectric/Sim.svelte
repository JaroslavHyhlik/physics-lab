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
  import {
    METALS,
    PhotoTube,
    QUANTUM_EFFICIENCY,
    kMax,
    photocurrent,
    photonEnergy,
    photonRate,
    saturationCurrent,
    stoppingVoltage,
    thresholdFrequency,
    thresholdWavelength,
  } from '../../physics/photoelectric';
  import { linearFit } from '../../physics/dc';
  import { h, c, e, m_e } from '../../core/constants';
  import { Rng } from '../../core/rng';
  import { spectralRGB } from '../../sim/spectrumColor';
  import { drawXYPlot } from '../../sim/xyPlot';
  import { alpha } from '../../sim/palette';
  import { drawTag } from '../../sim/draw';
  import { fmt } from '../../core/format';

  let { entry }: { entry: SimEntry } = $props();
  const sliders: NumberParamDef[] = [
    { key: 'lambda', label: 'Wavelength of the light', symbol: 'λ', unit: 'nm', min: 150, max: 750, step: 1 },
    { key: 'P', label: 'Light power on the cathode (intensity)', symbol: 'P', unit: 'µW', min: 0, max: 100, step: 1 },
    { key: 'V', label: 'Anode potential (relative to the cathode)', symbol: 'V', unit: 'V', min: -8, max: 8, step: 0.01 },
  ];
  const { params, sl } = useParams({ metal: 'Sodium', lambda: 420, P: 50, V: 0, graph: 'IV' }, sliders);
  const presets = [
    { id: 'blue', label: 'Blue light on sodium', values: { metal: 'Sodium', lambda: 420, P: 50, V: 0, graph: 'IV' } },
    { id: 'red', label: 'Bright red light: no electrons at all', values: { metal: 'Sodium', lambda: 650, P: 100, V: 0, graph: 'IV' } },
    { id: 'stop', label: 'Find the stopping voltage', values: { metal: 'Potassium', lambda: 400, P: 60, V: -0.5, graph: 'IV' } },
    { id: 'zinc', label: 'Zinc needs ultraviolet', values: { metal: 'Zinc', lambda: 250, P: 50, V: 0, graph: 'IV' } },
    { id: 'planck', label: 'Measure Planck’s constant (E_k,max against f)', values: { metal: 'Calcium', lambda: 300, P: 50, V: 0, graph: 'Kf' } },
  ];
  const info: SimInfo = {
    about: [
      'Light falls on a clean metal plate (the cathode) in a vacuum tube. Each photon carries energy E = hf. An electron that absorbs a photon uses at least the work function Φ to escape from the metal; the rest is its kinetic energy, so the fastest electrons have E_k,max = hf − Φ.',
      'Below the threshold frequency f₀ = Φ/h no electrons are emitted, however bright the light. Brighter light means more photons per second, so more electrons and a larger current, but not faster electrons. The wave model of light cannot explain this; the photon model can.',
      'Make the anode negative and the electrons have to climb a potential hill. Only those with E_k > e|V| reach it. At the stopping voltage V_s even the fastest are turned back and the current drops to zero: eV_s = E_k,max.',
      'Plot E_k,max = eV_s against f for several wavelengths: a straight line with gradient h (Planck’s constant) and intercept −Φ. Every metal gives a parallel line.',
    ],
    formulas: [
      { label: 'Photon energy', tex: 'E = hf = \\dfrac{hc}{\\lambda}' },
      { label: 'Photoelectric equation', tex: 'E_\\text{max} = hf - \\Phi', hl: true },
      { label: 'Stopping voltage', tex: 'eV_s = E_\\text{max}', hl: true },
      { label: 'Threshold frequency', tex: 'f_0 = \\dfrac{\\Phi}{h}', hl: true },
    ],
    assumptions: [
      'Work functions are typical values for clean surfaces (CRC Handbook); real surfaces vary by a few tenths of an eV.',
      `A fixed fraction ${QUANTUM_EFFICIENCY} of the photons frees an electron (quantum efficiency), whatever the wavelength.`,
      'Electrons leave the cathode straight towards the anode with kinetic energies spread evenly between 0 and E_k,max. So the current falls linearly to zero at the stopping voltage. Real tubes give a more rounded curve, and with a positive anode the current rises to saturation gradually instead of at once.',
      'Plates 4 cm apart in a vacuum with a uniform field; no contact potential, no current from the anode. The motion of the electrons is slowed down about 25 million times, and each dot stands for many electrons. Ultraviolet light (λ < 380 nm) is invisible; it is drawn in grey-violet.',
    ],
    tryThis: [
      'Turn the red light on sodium up to full power. Are any electrons emitted? Now make the wavelength shorter until they appear: that is the threshold.',
      'Make the anode negative and find the voltage at which the current just becomes zero. Compare with the stopping voltage in the readouts.',
      'Double the power. What happens to the current? And to the stopping voltage?',
      'Switch to the E_k,max–f graph and record points for five wavelengths. Find h from the gradient and Φ from the intercept.',
    ],
  };

  const SYMBOL: Record<string, string> = { Caesium: 'Cs', Potassium: 'K', Sodium: 'Na', Calcium: 'Ca', Zinc: 'Zn', Copper: 'Cu', Platinum: 'Pt' };
  let points: { x: number; y: number }[] = $state([]);
  const phi = $derived(METALS[params.metal]);
  const lam = $derived(params.lambda * 1e-9);
  const Pw = $derived(params.P * 1e-6);
  const K = $derived(kMax(lam, phi));
  const Vs = $derived(stoppingVoltage(lam, phi));
  const Is = $derived(saturationCurrent(Pw, lam, phi));
  const I = $derived(photocurrent(params.V, Pw, lam, phi));
  const fit = $derived(linearFit(points.map((p) => p.x), points.map((p) => p.y)));
  function record() {
    if (K <= 0) return;
    points = [...points, { x: c / lam / 1e14, y: Math.round(Vs * 100) / 100 }];
  }

  // electrons in the tube (the motion is slowed down SLOW times)
  const SLOW = 2.5e7;
  const tube = new PhotoTube(0.04, 900);
  const age = new Float64Array(tube.max);
  const rng = new Rng(11);
  let spawnAcc = 0;

  const view = new View();
  let ctx: CanvasRenderingContext2D | null = null;

  function lightColor(pal: typeof palette.pal, a: number): string {
    if (params.lambda < 380) return alpha(pal.dark ? '#b9a6e0' : '#7a68a6', a);
    const [r, g, b] = spectralRGB(params.lambda, 1, 2);
    return `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},${a})`;
  }

  function draw() {
    if (!ctx) return;
    const pal = palette.pal;
    const W = view.width;
    const H = view.height;
    const usable = H - 76;
    ctx.fillStyle = pal.bg;
    ctx.fillRect(0, 0, W, H);
    const wide = W > 760;
    const tubeW = wide ? Math.min(W * 0.5, 520) : W;
    const tx = tubeW / 2;
    const ty = wide ? Math.max(170, usable * 0.42) : Math.min(170, usable * 0.3);
    const half = Math.max(70, Math.min(140, tubeW / 2 - 60));
    const xC = tx - half;
    const xA = tx + half;
    const ph = 110;
    // glass envelope
    ctx.strokeStyle = pal.text3;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(xC - 30, ty - ph / 2 - 24, xA - xC + 60, ph + 48, 40);
    ctx.stroke();
    // light beam from the lamp to the cathode
    const lx = xC + 40;
    const ly = ty - ph / 2 - 70;
    if (params.P > 0) {
      ctx.fillStyle = lightColor(pal, 0.08 + 0.35 * (params.P / 100));
      ctx.beginPath();
      ctx.moveTo(lx - 10, ly);
      ctx.lineTo(lx + 10, ly);
      ctx.lineTo(xC + 4, ty + ph / 2 - 10);
      ctx.lineTo(xC + 4, ty - ph / 2 + 10);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = lightColor(pal, params.P > 0 ? 1 : 0.25);
    ctx.beginPath();
    ctx.arc(lx, ly, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = pal.text2;
    ctx.font = '500 11px Inter Variable, system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${params.lambda} nm${params.lambda < 380 ? ' (ultraviolet)' : params.lambda > 700 ? ' (infrared edge)' : ''}`, lx + 20, ly);
    // plates
    ctx.fillStyle = pal.text2;
    ctx.fillRect(xC - 6, ty - ph / 2, 6, ph);
    ctx.fillRect(xA, ty - ph / 2, 6, ph);
    ctx.font = '500 10px Inter Variable, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(`cathode (${params.metal})`, xC - 3, ty + ph / 2 + 4);
    ctx.fillText('anode', xA + 3, ty + ph / 2 + 4);
    // electrons
    ctx.fillStyle = pal.series[0];
    for (let i = 0; i < tube.max; i++) {
      if (!tube.alive[i]) continue;
      const x = xC + (tube.x[i] / tube.d) * (xA - xC);
      ctx.beginPath();
      ctx.arc(x, ty + tube.tag[i] * (ph / 2 - 8), 3, 0, Math.PI * 2);
      ctx.fill();
    }
    // circuit: cathode → ammeter → variable supply → anode
    const yW = ty + ph / 2 + 60;
    ctx.strokeStyle = pal.text2;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(xC - 3, ty + ph / 2);
    ctx.lineTo(xC - 3, ty + ph / 2 + 24);
    ctx.moveTo(xC - 3, ty + ph / 2 + 24);
    ctx.lineTo(xC - 3, yW);
    ctx.lineTo(xA + 3, yW);
    ctx.lineTo(xA + 3, ty + ph / 2 + 18);
    ctx.stroke();
    // ammeter
    const amx = xC + (xA - xC) * 0.28;
    ctx.fillStyle = pal.surface;
    ctx.beginPath();
    ctx.arc(amx, yW, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = pal.ink;
    ctx.font = '700 12px Inter Variable, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('A', amx, yW);
    drawTag(ctx, amx, yW + 30, `I = ${(I * 1e9).toFixed(2)} nA`, pal.ink, pal.surface);
    // supply (cell symbol; the long plate is +)
    const bx = xC + (xA - xC) * 0.68;
    ctx.fillStyle = pal.bg;
    ctx.fillRect(bx - 8, yW - 3, 16, 6);
    ctx.strokeStyle = pal.text2;
    const longLeft = params.V < 0; // anode negative → + terminal towards the cathode side
    ctx.beginPath();
    ctx.moveTo(bx + (longLeft ? -5 : 5), yW - 16);
    ctx.lineTo(bx + (longLeft ? -5 : 5), yW + 16);
    ctx.stroke();
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(bx + (longLeft ? 5 : -5), yW - 8);
    ctx.lineTo(bx + (longLeft ? 5 : -5), yW + 8);
    ctx.stroke();
    ctx.lineWidth = 1;
    drawTag(ctx, bx, yW + 30, `V = ${params.V >= 0 ? '+' : '−'}${Math.abs(params.V).toFixed(2)} V`, pal.ink, pal.surface);
    if (K <= 0 && params.P > 0)
      drawTag(ctx, tx, ty - ph / 2 - 8, 'no electrons: f below the threshold f₀', pal.negative, pal.surface);
    else if (K > 0 && params.V < 0 && I === 0) drawTag(ctx, tx, ty - ph / 2 - 8, 'all electrons turned back: I = 0', pal.text2, pal.surface);

    // graph
    const gx0 = wide ? tubeW + 50 : 56;
    const gx1 = W - 24;
    const gy0 = wide ? 230 : yW + 70;
    const gy1 = usable - 30;
    if (gx1 - gx0 < 110 || gy1 - gy0 < 70) return;
    if (params.graph === 'IV') {
      const vmin = -Math.max(2, Math.ceil(Vs + 1));
      const ymax = Math.max(1, Is * 1e9 * 1.25);
      drawXYPlot(ctx, pal, {
        x0: gx0,
        y0: gy0,
        x1: gx1,
        y1: gy1,
        xmin: vmin,
        xmax: 4,
        ymin: 0,
        ymax,
        xLabel: 'V / V',
        yLabel: 'I / nA',
        curves: [{ fn: (v) => photocurrent(v, Pw, lam, phi) * 1e9, color: pal.series[0], width: 2 }],
        current: { x: params.V, y: I * 1e9 },
      });
    } else {
      const ymin = -6;
      const curves = Object.entries(METALS).map(([name, p]) => ({
        fn: (f: number) => (h * f * 1e14) / e - p,
        color: name === params.metal ? pal.series[3] : alpha(pal.text3.startsWith('#') ? pal.text3 : '#888888', 0.45),
        dash: name === params.metal ? undefined : [3, 4],
        width: name === params.metal ? 2 : 1,
      }));
      const { X, Y } = drawXYPlot(ctx, pal, {
        x0: gx0,
        y0: gy0,
        x1: gx1,
        y1: gy1,
        xmin: 0,
        xmax: 21,
        ymin,
        ymax: 7,
        xLabel: 'f / 10¹⁴ Hz',
        yLabel: 'E_k,max / eV',
        curves,
        points,
        current: K > 0 ? { x: c / lam / 1e14, y: K / e } : null,
        fit: points.length >= 2 ? { ...fit, color: pal.series[1] } : null,
      });
      const f0 = thresholdFrequency(phi) / 1e14;
      drawTag(ctx, X(f0), Y(0) - 14, `f₀ = ${f0.toFixed(2)}`, pal.series[3], pal.surface, '600 10px Inter Variable, system-ui, sans-serif');
    }
  }

  const ctrl: SimController = new SimController(
    {
      step: (dt) => {
        const dtp = dt / SLOW;
        tube.step(dtp, params.V);
        for (let i = 0; i < tube.max; i++) {
          if (!tube.alive[i]) continue;
          age[i] += dt;
          if (age[i] > 10) tube.alive[i] = 0; // nearly at rest on the cathode: stop drawing it
        }
        // emitted electrons per second → dots per second (each dot stands for 2 × 10⁹ electrons)
        const rate = K > 0 ? Math.min(220, (QUANTUM_EFFICIENCY * photonRate(Pw, lam)) / 2e9) : 0;
        spawnAcc += rate * dt;
        while (spawnAcc >= 1) {
          spawnAcc -= 1;
          const k = tube.emit(K * rng.next(), rng.uniform(-1, 1));
          if (k >= 0) age[k] = 0;
        }
      },
      render: draw,
      reset: () => {
        tube.clear();
        spawnAcc = 0;
      },
    },
    { dt: 1 / 240, autoplay: true },
  );
  const palette = usePalette(() => ctrl);
  redrawOn(ctrl, () => [params.metal, params.lambda, params.P, params.V, params.graph, points.length]);

  const rows = $derived.by(() => {
    const vmax = Math.sqrt((2 * K) / m_e);
    const r: { label: string; value: string; unit?: string; color?: string; strong?: boolean }[] = [
      { label: 'photon energy hf', value: fmt(photonEnergy(lam) / e, 3), unit: 'eV' },
      { label: 'work function Φ', value: fmt(phi, 3), unit: 'eV' },
      { label: 'E_k,max = hf − Φ', value: K > 0 ? fmt(K / e, 3) : '0 (no emission)', unit: K > 0 ? 'eV' : undefined, strong: true },
      { label: 'stopping voltage V_s', value: Vs.toFixed(2), unit: 'V' },
      { label: 'threshold f₀ = Φ/h', value: fmt(thresholdFrequency(phi), 3), unit: 'Hz' },
      { label: 'threshold λ₀ = hc/Φ', value: fmt(thresholdWavelength(phi) * 1e9, 3), unit: 'nm' },
      { label: 'fastest electron', value: fmt(vmax, 3), unit: 'm s⁻¹' },
      { label: 'photocurrent I', value: (I * 1e9).toFixed(2), unit: 'nA', color: '--series-1' },
    ];
    if (params.graph === 'Kf' && points.length >= 2)
      r.push(
        { label: 'from the fit: h = gradient', value: fmt((fit.slope * e) / 1e14, 3), unit: 'J s', color: '--series-2' },
        { label: 'from the fit: Φ = −intercept', value: fmt(-fit.intercept, 3), unit: 'eV', color: '--series-2' },
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
>
  {#snippet stage()}
    <SimCanvas
      {view}
      label="Photocell: light on a metal cathode, electrons flying to the anode, ammeter and variable supply"
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
      <Segmented label="Cathode metal" small bind:value={params.metal} options={Object.keys(METALS).map((k) => ({ value: k, label: SYMBOL[k] }))} />
      <Slider def={sl('lambda')} bind:value={params.lambda} />
      <Slider def={sl('P')} bind:value={params.P} />
      <Slider def={sl('V')} bind:value={params.V} />
      <Segmented
        label="Graph"
        bind:value={params.graph}
        options={[
          { value: 'IV', label: 'I against V' },
          { value: 'Kf', label: 'E_k,max against f' },
        ]}
      />
      {#if params.graph === 'Kf'}
        <RecordTable {points} xLabel="f / 10¹⁴ Hz" yLabel="E_k,max / eV" onrecord={record} onclear={() => (points = [])} />
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
