<script lang="ts">
  import { onMount } from 'svelte';
  import SimShell from '../../sim/SimShell.svelte';
  import SimCanvas from '../../sim/SimCanvas.svelte';
  import Readouts from '../../sim/Readouts.svelte';
  import Slider from '../../ui/Slider.svelte';
  import { SimController } from '../../sim/controller.svelte';
  import { useParams, usePalette, redrawOn } from '../../sim/setup.svelte';
  import { View } from '../../sim/view';
  import type { SimEntry } from '../../app/registry';
  import type { NumberParamDef } from '../../sim/params.svelte';
  import type { SimInfo } from '../../sim/types';
  import { STARS, apparentOffset, PC_IN_AU } from '../../physics/parallax';
  import { parsec, lightYear } from '../../core/constants';
  import { Rng } from '../../core/rng';
  import { drawTag } from '../../sim/draw';
  import { fmt } from '../../core/format';

  let { entry }: { entry: SimEntry } = $props();
  const sliders: NumberParamDef[] = [
    { key: 'd', label: 'Distance to the star', symbol: 'd', unit: 'pc', min: 1, max: 200, step: 0.01, log: true },
    { key: 'beta', label: 'Angle of the star above the plane of the Earth’s orbit', symbol: 'β', unit: '°', min: -90, max: 90, step: 1 },
  ];
  const { params, sl } = useParams({ d: 1 / STARS['Proxima Centauri'].p, beta: STARS['Proxima Centauri'].beta }, sliders);
  const presets = Object.entries(STARS).map(([name, s]) => ({
    id: name,
    label: `${name} (p = ${s.p}″)`,
    values: { d: Math.round((1 / s.p) * 100) / 100, beta: Math.round(s.beta) },
  }));
  const info: SimInfo = {
    about: [
      'Hold a finger in front of your face and close each eye in turn: the finger seems to jump against the background. Astronomers do the same with the Earth’s orbit. Photographs taken six months apart show a nearby star shifted against the very distant background stars.',
      'The parallax angle p is half of the total shift, the angle that the radius of the Earth’s orbit (1 AU) makes at the star. Because p is tiny, d = 1 AU / p (p in radians).',
      'The parsec is defined so that a star with a parallax of 1 arcsecond is 1 parsec away: d (pc) = 1/p (″). 1 pc ≈ 3.26 light-years. Even the nearest star, Proxima Centauri, has p < 1″, so the method works only for stars up to a few hundred (from space: thousands of) parsecs away.',
    ],
    formulas: [
      { label: 'Parallax distance', tex: 'd\\,(\\text{parsec}) = \\dfrac{1}{p\\,(\\text{arc-second})}' },
      { label: 'Units', tex: '1\\ \\text{pc} = 3.26\\ \\text{ly}' },
    ],
    assumptions: [
      'Circular Earth orbit of 1 AU; the star’s own motion through space (proper motion) is ignored; the background stars are infinitely far away. Exact geometry (no small-angle approximation).',
      'Parallaxes from Gaia DR3 / Hipparcos, rounded; ecliptic latitudes approximate.',
      'The orbit picture is not to scale (the star would be hundreds of thousands of orbit radii away). The telescope view is to scale in arcseconds. One year takes 12 s of animation.',
    ],
    tryThis: [
      'Take a photo now and another half a year later. Half of the shift is p. Calculate d = 1/p.',
      'Make the star 10 times further away. What happens to the shift?',
      'Set the angle to 90° (star above the Earth’s orbit). What shape does the star trace? And at 0°?',
    ],
  };

  let t = 0; // years
  let photos: { t: number; e: number; n: number }[] = $state([]);
  const pTrue = $derived(1 / params.d);
  const beta = $derived((params.beta * Math.PI) / 180);
  function photo() {
    const [e, n] = apparentOffset(t, params.d, beta);
    photos = [...photos, { t, e, n }];
  }
  const pMeasured = $derived.by(() => {
    let m = 0;
    for (let i = 0; i < photos.length; i++)
      for (let j = i + 1; j < photos.length; j++) m = Math.max(m, Math.hypot(photos[i].e - photos[j].e, photos[i].n - photos[j].n));
    return m / 2;
  });
  $effect(() => {
    void [params.d, params.beta];
    photos = [];
  });

  const bg: [number, number, number][] = [];
  {
    const r = new Rng(17);
    for (let i = 0; i < 26; i++) bg.push([r.uniform(-1, 1), r.uniform(-1, 1), r.uniform(0.6, 2)]);
  }
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

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
    // left: orbit seen from above (not to scale)
    const ow = wide ? Math.min(W * 0.34, 340) : W;
    const oh = wide ? usable : Math.min(usable * 0.45, 280);
    const R = Math.min(ow * 0.3, oh * 0.22);
    const cx = ow / 2;
    const cy = oh - R - 40;
    const starY = 40;
    ctx.strokeStyle = pal.gridStrong;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = pal.hl;
    ctx.beginPath();
    ctx.arc(cx, cy, 8, 0, Math.PI * 2);
    ctx.fill();
    // Earth: the star lies straight "up" (towards ecliptic longitude 0 drawn upwards)
    const ang = 2 * Math.PI * t;
    const ex = cx + R * Math.sin(ang);
    const ey = cy - R * Math.cos(ang);
    ctx.fillStyle = pal.series[0];
    ctx.beginPath();
    ctx.arc(ex, ey, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = pal.ink;
    ctx.beginPath();
    ctx.arc(cx, starY, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = pal.series[0];
    ctx.beginPath();
    ctx.moveTo(ex, ey);
    ctx.lineTo(cx, starY);
    ctx.stroke();
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = pal.text3;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx, starY);
    ctx.stroke();
    ctx.setLineDash([]);
    drawTag(ctx, cx, starY - 18, 'nearby star', pal.ink, pal.surface);
    ctx.strokeStyle = pal.text3;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx - R, cy);
    ctx.stroke();
    drawTag(ctx, cx - R / 2, cy + 14, '1 AU', pal.text2, pal.surface);
    drawTag(ctx, ex, ey + 18, `Earth, ${MONTHS[Math.floor((((t % 1) + 1) % 1) * 12)]}`, pal.series[0], pal.surface);
    ctx.fillStyle = pal.text3;
    ctx.font = '500 10px Inter Variable, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(`not to scale: the star is ${fmt(params.d * PC_IN_AU, 3)} AU away`, cx, oh - 18);

    // right: telescope view in arcseconds (to scale)
    const tx0 = wide ? ow + 30 : 20;
    const ty0 = wide ? 210 : oh + 30;
    const size = Math.min(W - 20 - tx0, usable - ty0 - 20);
    if (size < 120) return;
    const F = 1.5 * pTrue; // half-width of the field [″]
    const k = size / (2 * F);
    const fx = tx0 + size / 2;
    const fy = ty0 + size / 2;
    ctx.fillStyle = pal.dark ? '#05070d' : '#0d1222';
    ctx.fillRect(tx0, ty0, size, size);
    ctx.fillStyle = '#c9d4ff';
    for (const [x, y, r] of bg) {
      ctx.beginPath();
      ctx.arc(fx + x * size * 0.48, fy + y * size * 0.48, r, 0, Math.PI * 2);
      ctx.fill();
    }
    // track of the star over the year
    ctx.strokeStyle = 'rgba(255,220,120,0.35)';
    ctx.setLineDash([3, 4]);
    ctx.beginPath();
    for (let i = 0; i <= 120; i++) {
      const [e, n] = apparentOffset(i / 120, params.d, beta);
      const X = fx - e * k; // east is to the left on the sky
      const Y = fy - n * k;
      if (i === 0) ctx.moveTo(X, Y);
      else ctx.lineTo(X, Y);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    for (const ph of photos) {
      ctx.strokeStyle = '#7dd3fc';
      ctx.beginPath();
      ctx.arc(fx - ph.e * k, fy - ph.n * k, 7, 0, Math.PI * 2);
      ctx.stroke();
    }
    const [e, n] = apparentOffset(t, params.d, beta);
    ctx.fillStyle = '#ffe08a';
    ctx.beginPath();
    ctx.arc(fx - e * k, fy - n * k, 4.5, 0, Math.PI * 2);
    ctx.fill();
    // scale bar
    const bar = Math.pow(10, Math.floor(Math.log10(F)));
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(tx0 + 12, ty0 + size - 14);
    ctx.lineTo(tx0 + 12 + bar * k, ty0 + size - 14);
    ctx.stroke();
    ctx.lineWidth = 1;
    ctx.fillStyle = '#e5e7eb';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText(`${bar}″`, tx0 + 12, ty0 + size - 18);
    ctx.fillStyle = pal.text2;
    ctx.fillText('telescope view (to scale, in arcseconds); circles = your photos', tx0, ty0 - 6);
  }

  const ctrl: SimController = new SimController(
    {
      step: (dt) => {
        t += dt / 12;
      },
      render: draw,
      reset: () => {
        t = 0;
      },
    },
    { dt: 1 / 60, autoplay: true },
  );
  const palette = usePalette(() => ctrl);
  redrawOn(ctrl, () => [params.d, params.beta, photos.length]);

  const rows = $derived.by(() => {
    const out: { label: string; value: string; unit?: string; color?: string; strong?: boolean }[] = [
      { label: 'parallax p = 1/d', value: fmt(pTrue, 3), unit: '″' },
      { label: 'distance d', value: fmt(params.d, 3), unit: 'pc', strong: true },
      { label: 'in light-years (1 pc = 3.26 ly)', value: fmt((params.d * parsec) / lightYear, 3), unit: 'ly' },
      { label: 'in metres', value: fmt(params.d * parsec, 3), unit: 'm' },
      { label: 'photos taken', value: String(photos.length) },
    ];
    if (photos.length >= 2)
      out.push(
        { label: 'measured p = half the largest shift', value: fmt(pMeasured, 3), unit: '″', color: '--series-2' },
        { label: 'so d = 1/p', value: fmt(1 / pMeasured, 3), unit: 'pc', color: '--series-2' },
      );
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
      label="Earth orbiting the Sun and a telescope view of a nearby star shifting against background stars"
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
      <Slider def={sl('d')} bind:value={params.d} />
      <Slider def={sl('beta')} bind:value={params.beta} />
      <div class="row">
        <button type="button" onclick={photo}>Take photo</button>
        <button type="button" class="ghost" onclick={() => (photos = [])} disabled={!photos.length}>Clear photos</button>
      </div>
    </div>
  {/snippet}
</SimShell>

<style>
  .controls {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }
  .row {
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
</style>
