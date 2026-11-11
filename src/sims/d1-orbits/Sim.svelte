<script lang="ts">
  import { onMount } from 'svelte';
  import SimShell from '../../sim/SimShell.svelte';
  import SimCanvas from '../../sim/SimCanvas.svelte';
  import Readouts from '../../sim/Readouts.svelte';
  import Slider from '../../ui/Slider.svelte';
  import Toggle from '../../ui/Toggle.svelte';
  import RecordTable from '../../sim/RecordTable.svelte';
  import { SimController } from '../../sim/controller.svelte';
  import { useParams, usePalette, resetOn } from '../../sim/setup.svelte';
  import { View } from '../../sim/view';
  import type { SimEntry } from '../../app/registry';
  import type { NumberParamDef } from '../../sim/params.svelte';
  import type { SimInfo, GraphDef } from '../../sim/types';
  import type { ChannelDef } from '../../core/recorder';
  import { Orbit, M_SUN, M_EARTH, orbitalSpeed } from '../../physics/gravity';
  import { AU, G } from '../../core/constants';
  import { alpha } from '../../sim/palette';
  import { drawArrow, drawTag } from '../../sim/draw';
  import { fmt } from '../../core/format';

  let { entry }: { entry: SimEntry } = $props();
  const sliders: NumberParamDef[] = [
    { key: 'r0', label: 'Starting distance from the star', symbol: 'r', unit: 'AU', min: 0.3, max: 5, step: 0.05 },
    { key: 'k', label: 'Starting speed / circular-orbit speed', symbol: 'v/v_c', unit: '', min: 0.4, max: 1.38, step: 0.01 },
    { key: 'M', label: 'Mass of the star', symbol: 'M', unit: 'M☉', min: 0.5, max: 3, step: 0.05 },
  ];
  const { params, sl } = useParams({ r0: 1, k: 1.2, M: 1, areas: true }, sliders);
  const presets = [
    { id: 'earth', label: 'Earth-like circular orbit', values: { r0: 1, k: 1, M: 1 } },
    { id: 'ellipse', label: 'Ellipse (e ≈ 0.44)', values: { r0: 1, k: 1.2, M: 1 } },
    { id: 'comet', label: 'Comet-like (e ≈ 0.85)', values: { r0: 0.5, k: 1.36, M: 1 } },
    { id: 'mars', label: 'Mars distance (1.52 AU)', values: { r0: 1.52, k: 1, M: 1 } },
  ];
  const YEAR = 3.156e7;
  const PER_SECOND = YEAR / 4; // simulated seconds per animation second
  const channels: ChannelDef[] = [
    { key: 't', label: 't', unit: 'years' },
    { key: 'r', label: 'distance r', unit: 'AU', color: '--series-1' },
    { key: 'Ek', label: 'kinetic energy', unit: '10³³ J', color: '--series-2' },
    { key: 'Ep', label: 'potential energy', unit: '10³³ J', color: '--series-1' },
    { key: 'E', label: 'total energy', unit: '10³³ J', color: '--series-4' },
  ];
  const graphs: GraphDef[] = [
    { id: 'r', title: 'Distance from the star', series: ['r'] },
    { id: 'E', title: 'Energy of an Earth-mass planet', series: ['Ek', 'Ep', 'E'] },
  ];
  const info: SimInfo = {
    about: [
      'The star pulls the planet with a gravitational force F = GMm/r² directed towards the star. Launched sideways at just the right speed the planet moves in a circle; faster or slower, it moves in an ellipse with the star at one focus (Kepler’s first law).',
      'The line from the star to the planet sweeps out equal areas in equal times (Kepler’s second law): the planet moves fastest when closest to the star. This is conservation of angular momentum.',
      'The square of the period is proportional to the cube of the mean distance (semi-major axis): T² = 4π²a³/GM (Kepler’s third law). Record several orbits and check that T²/a³ stays the same.',
      'Kinetic and gravitational potential energy keep exchanging, but their sum stays constant. For a bound orbit the total energy is negative.',
    ],
    formulas: [
      { label: 'Newton’s law of gravitation', tex: 'F = G\\dfrac{m_1m_2}{r^{2}}' },
      { label: 'Gravitational field strength', tex: 'g = \\dfrac{F}{m} = \\dfrac{GM}{r^{2}}' },
      { label: 'Kepler’s third law (circular orbit)', tex: 'T^{2} = \\dfrac{4\\pi^{2}}{GM}r^{3}', beyond: true },
      { label: 'Gravitational potential energy', tex: 'E_p = -\\dfrac{Gm_1m_2}{r}', hl: true },
      { label: 'Orbital speed (circular)', tex: 'v_\\text{orbital} = \\sqrt{\\dfrac{GM}{r}}', hl: true },
    ],
    assumptions: [
      'The star is much heavier than the planet and stays fixed; no other planets. G from the data booklet; 1 AU = 1.5 × 10¹¹ m; solar mass 1.989 × 10³⁰ kg; planet mass 5.97 × 10²⁴ kg (Earth).',
      'Integrated with a 4th-order symplectic method, so the orbit does not drift. One year takes 4 s of animation.',
      'Equal-area sectors are drawn every 1/12 of the period.',
    ],
    tryThis: [
      'Ellipse preset: where is the planet fastest? Compare the shaded areas.',
      'Record orbits of different sizes and check that T²/a³ is the same for all of them.',
      'Double the mass of the star. What happens to the period of a circular orbit at 1 AU?',
      'Find the starting speed at which the orbit stops being closed. How does it compare with √2 × v_c?',
    ],
  };

  const view = new View();
  let ctx: CanvasRenderingContext2D | null = null;
  const build = () => new Orbit(params.M * M_SUN, params.r0 * AU, 0, 0, params.k * orbitalSpeed(G * params.M * M_SUN, params.r0 * AU));
  let orb = build();
  let el = orb.elements();
  const TRAIL = 1500;
  const trail = new Float64Array(2 * TRAIL);
  let trailN = 0;
  let trailHead = 0;
  let lastTrailT = 0;
  // equal-area sectors: points every T/12
  let sectorPts: number[] = [];
  let lastSector = 0;
  let points: { x: number; y: number }[] = $state([]);

  function resetState() {
    orb = build();
    el = orb.elements();
    trailN = 0;
    trailHead = 0;
    lastTrailT = 0;
    sectorPts = [orb.x[0], orb.x[1]];
    lastSector = 0;
  }
  resetState();

  function draw() {
    if (!ctx) return;
    const pal = palette.pal;
    const W = view.width;
    const usable = view.height - 76;
    ctx.fillStyle = pal.bg;
    ctx.fillRect(0, 0, W, view.height);
    const wArea = W > 760 ? W - 270 : W;
    const bound = el.e < 1 && Number.isFinite(el.a);
    const extent = bound ? el.a * (1 + el.e) : params.r0 * AU * 3;
    const scale = Math.min(wArea - 40, usable - 30) / (2.1 * extent);
    // centre of the ellipse is offset from the star by a·e (perihelion is at +x when k > 1)
    const cxw = bound ? (params.k >= 1 ? -el.a * el.e : el.a * el.e) : 0;
    const X = (x: number) => wArea / 2 + (x - cxw) * scale;
    const Y = (y: number) => usable / 2 - y * scale;
    // equal-area sectors
    if (params.areas && sectorPts.length >= 4) {
      for (let s = 0; s + 3 < sectorPts.length; s += 2) {
        const k = s / 2;
        if (k % 2) continue;
        ctx.fillStyle = alpha(pal.series[0].startsWith('#') ? pal.series[0] : '#3b82f6', 0.18);
        ctx.beginPath();
        ctx.moveTo(X(0), Y(0));
        ctx.lineTo(X(sectorPts[s]), Y(sectorPts[s + 1]));
        ctx.lineTo(X(sectorPts[s + 2]), Y(sectorPts[s + 3]));
        ctx.closePath();
        ctx.fill();
      }
    }
    // trail
    ctx.strokeStyle = pal.text3;
    ctx.beginPath();
    for (let i = 0; i < trailN; i++) {
      const k = (trailHead - trailN + i + TRAIL) % TRAIL;
      const px = X(trail[2 * k]);
      const py = Y(trail[2 * k + 1]);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
    // star and planet
    ctx.fillStyle = pal.hl;
    ctx.beginPath();
    ctx.arc(X(0), Y(0), 12, 0, Math.PI * 2);
    ctx.fill();
    const px = X(orb.x[0]);
    const py = Y(orb.x[1]);
    ctx.fillStyle = pal.series[0];
    ctx.beginPath();
    ctx.arc(px, py, 7, 0, Math.PI * 2);
    ctx.fill();
    const vs = (0.25 * extent * scale) / orbitalSpeed(orb.GM, params.r0 * AU);
    drawArrow(ctx, px, py, px + orb.v[0] * vs, py - orb.v[1] * vs, pal.series[1], 'v', 2);
    drawTag(ctx, X(0), Y(0) + 26, 'star', pal.text2, pal.surface);
    // AU scale bar
    ctx.strokeStyle = pal.text2;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(16, usable - 12);
    ctx.lineTo(16 + AU * scale, usable - 12);
    ctx.stroke();
    ctx.lineWidth = 1;
    ctx.fillStyle = pal.text2;
    ctx.font = '500 10px Inter Variable, system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText('1 AU', 16, usable - 16);
  }

  const ctrl: SimController = new SimController(
    {
      step: (dt) => {
        const H = dt * PER_SECOND;
        const T = Number.isFinite(el.T) ? el.T : YEAR;
        const hmax = (T * Math.pow(Math.max(0.05, 1 - el.e), 1.5)) / 2000;
        const n = Math.max(1, Math.ceil(H / hmax));
        for (let i = 0; i < n; i++) orb.step(H / n);
        if (orb.t - lastTrailT > T / 400) {
          trail[2 * trailHead] = orb.x[0];
          trail[2 * trailHead + 1] = orb.x[1];
          trailHead = (trailHead + 1) % TRAIL;
          trailN = Math.min(TRAIL, trailN + 1);
          lastTrailT = orb.t;
        }
        if (Number.isFinite(el.T) && orb.t - lastSector >= el.T / 12) {
          lastSector += el.T / 12;
          sectorPts.push(orb.x[0], orb.x[1]);
          if (sectorPts.length > 2 * 25) sectorPts = sectorPts.slice(sectorPts.length - 2 * 25);
        }
      },
      render: draw,
      sample: (_t, out) => {
        out[0] = orb.t / YEAR;
        out[1] = orb.r / AU;
        const Ek = 0.5 * M_EARTH * orb.speed ** 2;
        const Ep = (-orb.GM * M_EARTH) / orb.r;
        out[2] = Ek / 1e33;
        out[3] = Ep / 1e33;
        out[4] = (Ek + Ep) / 1e33;
      },
      reset: () => resetState(),
    },
    { dt: 1 / 240, channels, sampleInterval: 1 / 30, autoplay: true },
  );
  const palette = usePalette(() => ctrl);
  resetOn(ctrl, () => [params.r0, params.k, params.M]);
  $effect(() => {
    void [params.r0, params.k, params.M];
    if (ctx) ctrl.play();
  });

  const rows = $derived.by(() => {
    void ctrl.renderCount;
    const bound = el.e < 1;
    return [
      { label: 'distance r', value: fmt(orb.r / AU, 4), unit: 'AU' },
      { label: 'speed v', value: fmt(orb.speed / 1000, 4), unit: 'km s⁻¹' },
      { label: 'eccentricity e', value: el.e.toFixed(3) },
      { label: 'semi-major axis a', value: bound ? fmt(el.a / AU, 4) : '— (unbound)', unit: bound ? 'AU' : '' },
      { label: 'period T', value: bound ? fmt(el.T / YEAR, 4) : '—', unit: bound ? 'years' : '', strong: true },
      { label: 'T²/a³', value: bound ? fmt((el.T / YEAR) ** 2 / (el.a / AU) ** 3, 4) : '—', unit: 'yr² AU⁻³' },
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
  initialGraphs={['r', 'E']}
  {presets}
  onpreset={(id) => Object.assign(params, presets.find((q) => q.id === id)?.values ?? {})}
>
  {#snippet stage()}
    <SimCanvas
      {view}
      label="Planet orbiting a star with equal-area sectors"
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
      <Slider def={sl('r0')} bind:value={params.r0} />
      <Slider def={sl('k')} bind:value={params.k} />
      <Slider def={sl('M')} bind:value={params.M} />
      <Toggle label="Show equal areas in equal times" bind:checked={params.areas} />
      <RecordTable
        {points}
        xLabel="a / AU"
        yLabel="T / years"
        onrecord={() => {
          if (el.e < 1) points = [...points, { x: el.a / AU, y: el.T / YEAR }];
        }}
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
