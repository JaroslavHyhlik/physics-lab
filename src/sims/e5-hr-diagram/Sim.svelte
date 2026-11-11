<script lang="ts">
  import { onMount } from 'svelte';
  import SimShell from '../../sim/SimShell.svelte';
  import SimCanvas from '../../sim/SimCanvas.svelte';
  import Readouts from '../../sim/Readouts.svelte';
  import Slider from '../../ui/Slider.svelte';
  import Segmented from '../../ui/Segmented.svelte';
  import Toggle from '../../ui/Toggle.svelte';
  import { SimController } from '../../sim/controller.svelte';
  import { useParams, usePalette, redrawOn } from '../../sim/setup.svelte';
  import { View } from '../../sim/view';
  import { Interaction } from '../../sim/interaction';
  import type { SimEntry } from '../../app/registry';
  import type { NumberParamDef } from '../../sim/params.svelte';
  import type { SimInfo } from '../../sim/types';
  import { NAME, LUM, CI, DIST, MAG, SPECT } from '../../data/hyg';
  import { bolometric, lumFromRT, msLuminosity, msTemperature, radiusFrom, tempFromBV } from '../../physics/hr';
  import { blackbodyRGB } from '../../physics/blackbody';
  import { parsec, lightYear } from '../../core/constants';
  import { alpha } from '../../sim/palette';
  import { drawTag } from '../../sim/draw';
  import { fmt } from '../../core/format';

  let { entry }: { entry: SimEntry } = $props();
  const sliders: NumberParamDef[] = [{ key: 'M', label: 'Mass of a main-sequence star', symbol: 'M', unit: 'M☉', min: 0.1, max: 30, step: 0.01, log: true }];
  const { params, sl } = useParams({ set: 'bright', radii: true, names: true, track: 'none', M: 1, pick: 0 }, sliders);
  const presets = [
    { id: 'bright', label: 'Stars visible to the naked eye', values: { set: 'bright', track: 'none', names: true } },
    { id: 'near', label: 'Every known star within 20 pc', values: { set: 'near', track: 'none', names: true } },
    { id: 'sun', label: 'Life of a Sun-like star (qualitative)', values: { set: 'bright', track: 'sun', M: 1 } },
    { id: 'massive', label: 'Life of a massive star (qualitative)', values: { set: 'bright', track: 'massive', M: 15 } },
  ];
  const info: SimInfo = {
    about: [
      'The Hertzsprung–Russell (HR) diagram plots the luminosity of stars against their surface temperature. Temperature increases to the left, and luminosity is on a logarithmic scale. Each dot is a real star, coloured as a black body at its temperature.',
      'Most stars lie on the main sequence, the diagonal band where stars fuse hydrogen in their cores. Along it, more massive stars are hotter and much more luminous (roughly L ∝ M^3.5).',
      'Because L = 4πR²σT⁴, stars of the same temperature but much higher luminosity must be much bigger: red giants and supergiants at the top right. White dwarfs at the bottom left are hot but tiny. The dashed lines are lines of constant radius.',
      'A star moves on the diagram as it ages. A Sun-like star leaves the main sequence, swells into a red giant, sheds its outer layers as a planetary nebula and ends as a white dwarf. A massive star becomes a red supergiant and explodes as a supernova.',
    ],
    formulas: [
      { label: 'Stefan–Boltzmann law', tex: 'L = \\sigma A T^{4} = 4\\pi R^{2}\\sigma T^{4}' },
      { label: 'Main-sequence mass–luminosity relation', tex: 'L \\propto M^{3.5}' },
      { label: 'Wien’s displacement law', tex: '\\lambda_\\max T = 2.9 \\times 10^{-3}\\ \\text{m K}' },
    ],
    assumptions: [
      'Stars from the HYG database v4.1 (CC BY-SA 4.0): all stars brighter than V = 6.0 within 500 pc, and all catalogued stars within 20 pc. Distances from Hipparcos and Gliese parallaxes.',
      'Temperature from the B−V colour (Ballesteros 2012); interstellar reddening is ignored. Luminosity from the absolute visual magnitude with a black-body bolometric correction, so very hot and very cool stars are less accurate (roughly a factor of two).',
      'The model main-sequence star uses L ∝ M^3.5 and R ∝ M^0.8 (rough fits). Evolutionary tracks are qualitative sketches, not calculations.',
    ],
    tryThis: [
      'Tap the brightest-looking stars in the sky (Sirius, Vega, Betelgeuse, Rigel). Where are they on the diagram? Use the radius lines to estimate their sizes.',
      'Switch to the stars within 20 pc. Why are most nearby stars faint red dwarfs, while most naked-eye stars are luminous?',
      'Move the mass slider. How does the position on the main sequence change? How many times more luminous is a 10 M☉ star than the Sun?',
    ],
  };

  // precomputed star data
  const n = NAME.length;
  const TT = new Float64Array(n);
  const LL = new Float64Array(n);
  const COL: string[] = [];
  const colCache = new Map<number, string>();
  for (let i = 0; i < n; i++) {
    TT[i] = tempFromBV(CI[i]);
    LL[i] = bolometric(LUM[i], TT[i]);
    const key = Math.round(Math.log10(TT[i]) * 60);
    if (!colCache.has(key)) {
      const [r, g, b] = blackbodyRGB(10 ** (key / 60));
      const m = Math.max(r, g, b) || 1;
      colCache.set(key, `rgb(${Math.round((255 * r) / m)},${Math.round((255 * g) / m)},${Math.round((255 * b) / m)})`);
    }
    COL.push(colCache.get(key)!);
  }
  const FAMOUS = new Set(['Sol', 'Sirius', 'Vega', 'Betelgeuse', 'Rigel', 'Antares', 'Arcturus', 'Aldebaran', 'Polaris', 'Deneb', 'Spica', 'Procyon', 'Capella', 'Proxima Centauri', "Barnard's Star", 'Altair', 'Canopus', 'Sirius B', 'Procyon B', 'Mira', 'Regulus']);
  // a star needs a positive luminosity to be placed on the logarithmic axis
  const inSet = (i: number) => LL[i] > 0 && (params.set === 'near' ? DIST[i] <= 20 : MAG[i] <= 6.0 || NAME[i] === 'Sol' || FAMOUS.has(NAME[i]));
  const sun = NAME.indexOf('Sol');
  if (params.pick === 0 && sun >= 0) params.pick = sun;

  const LT_MIN = 3.38; // log10 T at the right edge (2400 K)
  const LT_MAX = 4.7; // left edge (50 000 K)
  const LL_MIN = -5;
  const LL_MAX = 6.5;

  const view = new View();
  const inter = new Interaction();
  let ctx: CanvasRenderingContext2D | null = null;
  let geo = { x0: 0, x1: 1, y0: 0, y1: 1 };
  const X = (T: number) => geo.x0 + ((LT_MAX - Math.log10(T)) / (LT_MAX - LT_MIN)) * (geo.x1 - geo.x0);
  const Y = (L: number) => geo.y1 - ((Math.log10(L) - LL_MIN) / (LL_MAX - LL_MIN)) * (geo.y1 - geo.y0);
  inter.add({
    priority: 10,
    cursor: 'pointer',
    hit: (px, py) => (px >= geo.x0 && px <= geo.x1 && py >= geo.y0 && py <= geo.y1 ? 0 : Infinity),
    start: (px, py) => {
      let bd = Infinity;
      let b = -1;
      for (let i = 0; i < n; i++) {
        if (!inSet(i)) continue;
        const d = Math.hypot(X(TT[i]) - px, Y(LL[i]) - py);
        if (d < bd) {
          bd = d;
          b = i;
        }
      }
      if (b >= 0 && bd < 30) params.pick = b;
    },
    move: () => {},
  });

  const TRACKS: Record<string, { pts: [number, number][]; label: string }> = {
    sun: {
      pts: [
        [5772, 1],
        [5000, 3],
        [4500, 30],
        [3500, 2500],
        [5000, 50],
        [3300, 4000],
        [40000, 4000],
        [60000, 300],
        [30000, 0.3],
        [12000, 0.003],
      ],
      label: 'main sequence → red giant → planetary nebula → white dwarf',
    },
    massive: {
      pts: [
        [30000, 2e4],
        [25000, 3.5e4],
        [12000, 5e4],
        [6000, 6e4],
        [3600, 7e4],
      ],
      label: 'main sequence → red supergiant → supernova',
    },
  };

  function draw() {
    if (!ctx) return;
    const pal = palette.pal;
    const W = view.width;
    const H = view.height;
    ctx.fillStyle = pal.bg;
    ctx.fillRect(0, 0, W, H);
    const wide = W > 760;
    geo = { x0: 60, x1: wide ? W - 340 : W - 14, y0: 20, y1: H - 50 };
    const { x0, x1, y0, y1 } = geo;
    ctx.fillStyle = pal.dark ? alpha('#000000', 0.25) : alpha('#0b1020', 0.92);
    ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    // grid and axes
    ctx.font = '500 10px Inter Variable, system-ui, sans-serif';
    ctx.strokeStyle = alpha('#ffffff', 0.08);
    ctx.fillStyle = pal.text3;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (const T of [40000, 20000, 10000, 7000, 5000, 4000, 3000]) {
      ctx.beginPath();
      ctx.moveTo(X(T), y0);
      ctx.lineTo(X(T), y1);
      ctx.stroke();
      ctx.fillText(String(T), X(T), y1 + 4);
    }
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let k = LL_MIN; k <= 6; k++) {
      ctx.beginPath();
      ctx.moveTo(x0, Y(10 ** k));
      ctx.lineTo(x1, Y(10 ** k));
      ctx.stroke();
      ctx.fillText(k === 0 ? '1' : `10${k < 0 ? '⁻' : ''}${'⁰¹²³⁴⁵⁶⁷⁸⁹'[Math.abs(k)]}`, x0 - 6, Y(10 ** k));
    }
    ctx.fillStyle = pal.text2;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.fillText('← hotter     surface temperature T / K', x1, y1 + 18);
    ctx.save();
    ctx.translate(14, (y0 + y1) / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.fillText('luminosity L / L☉', 0, 0);
    ctx.restore();
    ctx.save();
    ctx.beginPath();
    ctx.rect(x0, y0, x1 - x0, y1 - y0);
    ctx.clip();
    // constant-radius lines
    if (params.radii) {
      ctx.setLineDash([4, 5]);
      ctx.strokeStyle = alpha('#9fb4ff', 0.45);
      ctx.fillStyle = alpha('#c9d4ff', 0.8);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      for (const R of [0.001, 0.01, 0.1, 1, 10, 100, 1000]) {
        ctx.beginPath();
        ctx.moveTo(X(50000), Y(lumFromRT(R, 50000)));
        ctx.lineTo(X(2400), Y(lumFromRT(R, 2400)));
        ctx.stroke();
        const Tl = 3400;
        const yl = Y(lumFromRT(R, Tl));
        if (yl > y0 + 10 && yl < y1 - 4) ctx.fillText(`${R} R☉`, X(Tl) - 34, yl - 2);
      }
      ctx.setLineDash([]);
    }
    // stars
    for (let i = 0; i < n; i++) {
      if (!inSet(i)) continue;
      ctx.fillStyle = COL[i];
      const s = MAG[i] < 1 ? 3.2 : MAG[i] < 3 ? 2.4 : 1.6;
      ctx.beginPath();
      ctx.arc(X(TT[i]), Y(LL[i]), s, 0, Math.PI * 2);
      ctx.fill();
    }
    if (params.names) {
      ctx.font = '600 10px Inter Variable, system-ui, sans-serif';
      ctx.fillStyle = '#e8ecff';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      for (let i = 0; i < n; i++) if (FAMOUS.has(NAME[i]) && inSet(i)) ctx.fillText(NAME[i] === 'Sol' ? 'Sun' : NAME[i], X(TT[i]) + 6, Y(LL[i]));
    }
    // region labels
    ctx.font = 'italic 600 12px Inter Variable, system-ui, sans-serif';
    ctx.fillStyle = alpha('#ffffff', 0.45);
    ctx.textAlign = 'center';
    ctx.fillText('main sequence', X(9000), Y(4));
    ctx.fillText('red giants', X(4300), Y(300));
    ctx.fillText('supergiants', X(8000), Y(2e5));
    ctx.fillText('white dwarfs', X(14000), Y(2e-3));
    // evolutionary track
    const tr = TRACKS[params.track];
    if (tr) {
      ctx.strokeStyle = pal.hl;
      ctx.lineWidth = 2.5;
      ctx.setLineDash([7, 5]);
      ctx.beginPath();
      tr.pts.forEach(([T, L], i) => (i ? ctx!.lineTo(X(T), Y(L)) : ctx!.moveTo(X(T), Y(L))));
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.lineWidth = 1;
      const [Te, Le] = tr.pts[tr.pts.length - 1];
      drawTag(ctx, X(Te), Y(Le) - 16, params.track === 'massive' ? 'supernova!' : 'white dwarf cools', pal.hl, pal.surface);
    }
    // model main-sequence star
    const Tm = msTemperature(params.M);
    const Lm = msLuminosity(params.M);
    ctx.strokeStyle = pal.accent;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(X(Tm), Y(Lm), 8, 0, Math.PI * 2);
    ctx.stroke();
    // picked star
    if (params.pick >= 0 && params.pick < n) {
      ctx.strokeStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(X(TT[params.pick]), Y(LL[params.pick]), 6, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.lineWidth = 1;
    ctx.restore();
    if (tr) {
      ctx.fillStyle = pal.text2;
      ctx.font = '500 11px Inter Variable, system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(`qualitative track: ${tr.label}`, x0, y1 + 32);
    }
  }

  const ctrl = new SimController({ step: () => {}, render: draw, reset: () => {} }, { dt: 1, autoplay: false });
  const palette = usePalette(() => ctrl);
  redrawOn(ctrl, () => [params.set, params.radii, params.names, params.track, params.M, params.pick]);
  inter.onChange = () => ctrl.invalidate();

  const rows = $derived.by(() => {
    const i = params.pick;
    const r: { label: string; value: string; unit?: string; color?: string; strong?: boolean }[] = [];
    if (i >= 0 && i < n) {
      const T = TT[i];
      const L = LL[i];
      r.push(
        { label: 'star', value: NAME[i] === 'Sol' ? 'Sun' : NAME[i] || `unnamed (${SPECT[i] || '?'})`, strong: true },
        { label: 'spectral type, B−V', value: `${SPECT[i] || '—'}, ${CI[i].toFixed(2)}` },
        { label: 'temperature T', value: fmt(T, 3), unit: 'K' },
        { label: 'luminosity L', value: fmt(L, 3), unit: 'L☉' },
        { label: 'radius R = √L (T☉/T)²', value: fmt(radiusFrom(L, T), 3), unit: 'R☉' },
        { label: 'distance', value: NAME[i] === 'Sol' ? '1 AU' : `${fmt(DIST[i], 3)} pc = ${fmt((DIST[i] * parsec) / lightYear, 3)} ly` },
      );
    }
    r.push(
      { label: `model star ${fmt(params.M, 3)} M☉: L ≈ M^3.5`, value: fmt(msLuminosity(params.M), 3), unit: 'L☉', color: '--accent' },
      { label: 'its surface temperature', value: fmt(msTemperature(params.M), 3), unit: 'K' },
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
      interaction={inter}
      label="Hertzsprung–Russell diagram of real stars; tap a star to see its data"
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
        label="Stars"
        bind:value={params.set}
        options={[
          { value: 'bright', label: 'Naked-eye stars' },
          { value: 'near', label: 'Within 20 pc' },
        ]}
      />
      <Segmented
        label="Life track (qualitative)"
        bind:value={params.track}
        options={[
          { value: 'none', label: 'None' },
          { value: 'sun', label: 'Sun-like' },
          { value: 'massive', label: 'Massive' },
        ]}
      />
      <Slider def={sl('M')} bind:value={params.M} />
      <Toggle label="Lines of constant radius" bind:checked={params.radii} />
      <Toggle label="Names of well-known stars" bind:checked={params.names} />
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
