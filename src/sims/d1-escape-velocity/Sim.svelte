<script lang="ts">
  import { onMount } from 'svelte';
  import SimShell from '../../sim/SimShell.svelte';
  import SimCanvas from '../../sim/SimCanvas.svelte';
  import Readouts from '../../sim/Readouts.svelte';
  import Slider from '../../ui/Slider.svelte';
  import { SimController } from '../../sim/controller.svelte';
  import { useParams, usePalette, resetOn } from '../../sim/setup.svelte';
  import { View } from '../../sim/view';
  import type { SimEntry } from '../../app/registry';
  import type { NumberParamDef } from '../../sim/params.svelte';
  import type { SimInfo, GraphDef } from '../../sim/types';
  import type { ChannelDef } from '../../core/recorder';
  import { Orbit, M_EARTH, R_EARTH, escapeSpeed, orbitalSpeed } from '../../physics/gravity';
  import { G } from '../../core/constants';
  import { alpha } from '../../sim/palette';
  import { drawTag } from '../../sim/draw';
  import { fmt } from '../../core/format';

  let { entry }: { entry: SimEntry } = $props();
  const sliders: NumberParamDef[] = [
    { key: 'v', label: 'Launch speed (horizontal)', symbol: 'v', unit: 'km s⁻¹', min: 1, max: 13, step: 0.05 },
    { key: 'h', label: 'Height of the mountain', symbol: 'h', unit: 'km', min: 100, max: 2000, step: 50 },
  ];
  const { params, sl } = useParams({ v: 7.5, h: 500 }, sliders);
  const presets = [
    { id: 'slow', label: 'Too slow: falls back to Earth', values: { v: 5 } },
    { id: 'circ', label: 'Circular orbit (v = √(GM/r))', values: { v: 7.61 } },
    { id: 'ellipse', label: 'Faster: elliptical orbit', values: { v: 9.5 } },
    { id: 'escape', label: 'Escape speed √(2GM/r)', values: { v: 10.77 } },
    { id: 'faster', label: 'Faster than escape', values: { v: 12.5 } },
  ];
  const GM = G * M_EARTH;
  const channels: ChannelDef[] = [
    { key: 't', label: 't', unit: 'h' },
    { key: 'r', label: 'height above the surface', unit: 'km', color: '--series-1' },
    { key: 'v', label: 'speed', unit: 'km s⁻¹', color: '--series-2' },
  ];
  const graphs: GraphDef[] = [
    { id: 'r', title: 'Height above the surface', series: ['r'] },
    { id: 'v', title: 'Speed', series: ['v'] },
  ];
  const info: SimInfo = {
    about: [
      'Newton imagined a cannon on a very high mountain. Fired slowly, the ball falls back to Earth. Faster, it lands further away. At just the right speed the ground curves away as fast as the ball falls: it is in orbit, falling for ever.',
      'For a circular orbit gravity provides exactly the centripetal force: GMm/r² = mv²/r, so v_orbital = √(GM/r). Faster than this the orbit becomes an ellipse.',
      'At the escape speed the kinetic energy equals the energy needed to reach infinity: ½mv² = GMm/r, so v_esc = √(2GM/r) = √2 × v_orbital. The total energy is then zero and the ball never returns.',
    ],
    formulas: [
      { label: 'Orbital speed', tex: 'v_\\text{orbital} = \\sqrt{\\dfrac{GM}{r}}', hl: true },
      { label: 'Escape speed', tex: 'v_\\text{esc} = \\sqrt{\\dfrac{2GM}{r}}', hl: true },
      { label: 'Gravitational potential energy', tex: 'E_p = -\\dfrac{GMm}{r}', hl: true },
    ],
    assumptions: [
      'No air resistance and no rotation of the Earth; the mountain is impossibly high so that the ball starts above the atmosphere.',
      'Earth mass 5.97 × 10²⁴ kg, radius 6.37 × 10⁶ m; G from the data booklet. Integrated with a 4th-order symplectic method.',
      'One hour of flight takes 1 s of animation; the run stops when the ball hits the ground or is far away.',
    ],
    tryThis: [
      'Find the speed for a circular orbit at this height and compare with √(GM/r).',
      'Check that the escape speed is √2 times the orbital speed.',
      'Is it easier to reach orbit from a higher mountain? Why?',
    ],
  };

  const view = new View();
  let ctx: CanvasRenderingContext2D | null = null;
  const r0 = () => R_EARTH + params.h * 1e3;
  const build = () => new Orbit(M_EARTH, 0, r0(), params.v * 1e3, 0);
  let orb = build();
  let landed = false;
  const trail: number[] = [];
  const PER_SECOND = 3600;

  function draw() {
    if (!ctx) return;
    const pal = palette.pal;
    const W = view.width;
    const usable = view.height - 76;
    ctx.fillStyle = pal.bg;
    ctx.fillRect(0, 0, W, view.height);
    const wArea = W > 760 ? W - 270 : W;
    const scale = Math.min(wArea - 40, usable - 30) / (2 * 4.2 * R_EARTH);
    const cx = wArea / 2;
    const cy = usable / 2 + 0.2 * R_EARTH * scale;
    const X = (x: number) => cx + x * scale;
    const Y = (y: number) => cy - y * scale;
    ctx.fillStyle = alpha(pal.series[0].startsWith('#') ? pal.series[0] : '#3b82f6', 0.35);
    ctx.beginPath();
    ctx.arc(cx, cy, R_EARTH * scale, 0, Math.PI * 2);
    ctx.fill();
    // mountain
    ctx.fillStyle = pal.text3;
    ctx.beginPath();
    ctx.moveTo(X(-0.12 * R_EARTH), Y(R_EARTH * 0.99));
    ctx.lineTo(X(0), Y(r0()));
    ctx.lineTo(X(0.12 * R_EARTH), Y(R_EARTH * 0.99));
    ctx.closePath();
    ctx.fill();
    // reference circles: circular orbit radius
    ctx.strokeStyle = pal.gridStrong;
    ctx.setLineDash([3, 5]);
    ctx.beginPath();
    ctx.arc(cx, cy, r0() * scale, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = pal.series[3];
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < trail.length; i += 2) {
      if (i === 0) ctx.moveTo(X(trail[i]), Y(trail[i + 1]));
      else ctx.lineTo(X(trail[i]), Y(trail[i + 1]));
    }
    ctx.stroke();
    ctx.lineWidth = 1;
    ctx.fillStyle = pal.series[3];
    ctx.beginPath();
    ctx.arc(X(orb.x[0]), Y(orb.x[1]), 6, 0, Math.PI * 2);
    ctx.fill();
    if (landed) drawTag(ctx, X(orb.x[0]), Y(orb.x[1]) - 18, 'landed', pal.text2, pal.surface);
    drawTag(ctx, cx, cy, 'Earth', pal.text2, pal.surface);
  }

  const ctrl: SimController = new SimController(
    {
      step: (dt) => {
        if (landed) return;
        const H = dt * PER_SECOND;
        const n = Math.max(1, Math.ceil(H / 5));
        for (let i = 0; i < n; i++) {
          orb.step(H / n);
          if (orb.r <= R_EARTH) {
            landed = true;
            break;
          }
        }
        if (trail.length < 40000) trail.push(orb.x[0], orb.x[1]);
        if (orb.r > 12 * R_EARTH || orb.t > 48 * 3600) ctrl.pause();
      },
      render: draw,
      sample: (_t, out) => {
        out[0] = orb.t / 3600;
        out[1] = (orb.r - R_EARTH) / 1e3;
        out[2] = orb.speed / 1e3;
      },
      reset: () => {
        orb = build();
        landed = false;
        trail.length = 0;
      },
    },
    { dt: 1 / 240, channels, sampleInterval: 1 / 30, autoplay: true },
  );
  const palette = usePalette(() => ctrl);
  resetOn(ctrl, () => [params.v, params.h]);
  $effect(() => {
    void [params.v, params.h];
    if (ctx) ctrl.play();
  });

  const rows = $derived.by(() => {
    void ctrl.renderCount;
    const vo = orbitalSpeed(GM, r0()) / 1e3;
    const ve = escapeSpeed(GM, r0()) / 1e3;
    const eps = orb.energy;
    return [
      { label: 'v_orbital = √(GM/r)', value: fmt(vo, 4), unit: 'km s⁻¹' },
      { label: 'v_esc = √(2GM/r)', value: fmt(ve, 4), unit: 'km s⁻¹' },
      { label: 'launch speed', value: fmt(params.v, 4), unit: 'km s⁻¹', strong: true },
      { label: 'total energy per kg', value: fmt(eps / 1e6, 3), unit: 'MJ kg⁻¹' },
      { label: 'result', value: landed ? 'falls back' : params.v >= ve ? 'escapes' : 'orbits' },
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
  initialGraphs={['r', 'v']}
  {presets}
  onpreset={(id) => Object.assign(params, presets.find((q) => q.id === id)?.values ?? {})}
>
  {#snippet stage()}
    <SimCanvas
      {view}
      label="Newton's cannon on a high mountain"
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
      <Slider def={sl('v')} bind:value={params.v} />
      <Slider def={sl('h')} bind:value={params.h} />
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
