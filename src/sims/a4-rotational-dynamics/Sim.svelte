<script lang="ts">
  import { onMount } from 'svelte';
  import SimShell from '../../sim/SimShell.svelte';
  import SimCanvas from '../../sim/SimCanvas.svelte';
  import Readouts from '../../sim/Readouts.svelte';
  import Slider from '../../ui/Slider.svelte';
  import { SimController } from '../../sim/controller.svelte';
  import { useParams, usePalette, resetOn } from '../../sim/setup.svelte';
  import { View } from '../../sim/view';
  import { Interaction } from '../../sim/interaction';
  import type { SimEntry } from '../../app/registry';
  import { Flywheel } from '../../physics/flywheel';
  import { alpha } from '../../sim/palette';
  import { drawArrow } from '../../sim/draw';
  import { fmt } from '../../core/format';
  import { Ruler } from '../../tools/ruler';
  import * as M from './meta';

  let { entry }: { entry: SimEntry } = $props();
  const { params, sl } = useParams(M.defaults, M.sliders);
  const fw = new Flywheel({ ...params });
  const view = new View();
  const inter = new Interaction();
  const ruler = new Ruler(0.35, 0, 0.35, -1);
  let ctx: CanvasRenderingContext2D | null = null;

  // world: wheel centre at (0, 0.25); the mass hangs from x = r_draw at the axle edge
  const WHEEL_R = 0.22; // drawn size [m]
  const fitView = () => view.fit(-0.7, 0.9, -params.h - 0.35, 0.55, 20, 80);

  function draw() {
    if (!ctx) return;
    const pal = palette.pal;
    ctx.fillStyle = pal.bg;
    ctx.fillRect(0, 0, view.width, view.height);
    const cx = view.sx(0);
    const cy = view.sy(0.25);
    const R = WHEEL_R * view.scale;
    const ra = Math.max(4, Math.min(R * 0.5, (params.r / 0.1) * R * 0.5));
    // support
    ctx.fillStyle = pal.text3;
    ctx.fillRect(cx - 4, view.sy(0.55), 8, cy - view.sy(0.55));
    // wheel
    ctx.fillStyle = alpha(pal.series[0].startsWith('#') ? pal.series[0] : '#4361ee', 0.3);
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = pal.series[0];
    ctx.lineWidth = 2;
    for (let i = 0; i < 6; i++) {
      const a = -fw.theta + (i * Math.PI) / 3;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + R * Math.cos(a), cy + R * Math.sin(a));
      ctx.stroke();
    }
    ctx.fillStyle = pal.ink;
    ctx.beginPath();
    ctx.arc(cx, cy, ra, 0, Math.PI * 2);
    ctx.fill();
    // floor
    const floorY = view.sy(-params.h - 0.05);
    ctx.fillStyle = pal.grid;
    ctx.fillRect(0, floorY, view.width, view.height - floorY);
    // string and mass
    const sx = cx + ra;
    const my = view.sy(0.25 - 0.1 - fw.y);
    if (!fw.landed) {
      ctx.strokeStyle = pal.text2;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(sx, cy);
      ctx.lineTo(sx, my);
      ctx.stroke();
    }
    const box = Math.max(16, 14 + 8 * Math.cbrt(params.m));
    ctx.fillStyle = pal.series[1];
    ctx.fillRect(sx - box / 2, Math.min(my, floorY - box), box, box);
    if (!fw.landed) {
      const k = 60 / (params.m * params.g);
      drawArrow(ctx, sx + box / 2 + 12, my + box / 2, sx + box / 2 + 12, my + box / 2 - fw.tension * k, pal.series[2], 'T', 2);
      drawArrow(ctx, sx + box / 2 + 12, my + box / 2, sx + box / 2 + 12, my + box / 2 + params.m * params.g * k, pal.series[3], 'mg', 2);
    }
    ruler.draw(ctx, view, pal);
  }

  const ctrl: SimController = new SimController(
    {
      step: (dt) => {
        fw.step(dt);
        if (fw.landed && fw.omega === 0 && fw.t > 0.5) ctrl.pause();
        if (!fw.moves && fw.t > 1) ctrl.pause();
      },
      render: draw,
      sample: (t, out) => {
        out[0] = t;
        out[1] = fw.v;
        out[2] = fw.omega;
        out[3] = fw.tension;
        out[4] = fw.EpLost;
        out[5] = fw.EkMass;
        out[6] = fw.EkRot;
        out[7] = fw.heat;
      },
      reset: () => {
        fw.reset({ ...params });
        fitView();
        ruler.ax = ruler.bx = 0.45;
        ruler.ay = 0.15;
        ruler.by = 0.15 - params.h;
      },
    },
    { dt: 1e-3, channels: M.channels, sampleInterval: 1 / 60, autoplay: true },
  );
  const palette = usePalette(() => ctrl);
  resetOn(ctrl, () => [params.I, params.r, params.m, params.h, params.tauF, params.g]);
  $effect(() => {
    void [params.I, params.r, params.m, params.h, params.tauF, params.g];
    if (ctx) ctrl.play();
  });
  ruler.attach(view, inter);
  inter.onChange = () => ctrl.invalidate();

  const rows = $derived.by(() => {
    void ctrl.renderCount;
    return [
      { label: 'a of the mass', value: fmt(fw.aFall, 3), unit: 'm s⁻²', strong: true },
      { label: 'α of the wheel', value: fmt(fw.alpha, 3), unit: 'rad s⁻²' },
      { label: 'tension T', value: fmt(fw.tension, 3), unit: 'N' },
      { label: 'predicted fall time √(2h/a)', value: fw.moves ? fmt(Math.sqrt((2 * params.h) / fw.aFall), 3) : '—', unit: 's' },
      { label: 'ω', value: fmt(fw.omega, 3), unit: 'rad s⁻¹' },
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
  info={M.info}
  graphs={M.graphs}
  initialGraphs={['w', 'E']}
  presets={M.presets}
  onpreset={(id) => Object.assign(params, M.presets.find((x) => x.id === id)?.values ?? {})}
  {ruler}
>
  {#snippet stage()}
    <SimCanvas
      {view}
      interaction={inter}
      label="Flywheel with a falling mass"
      onready={(c) => {
        ctx = c;
        fitView();
        ctrl.invalidate();
      }}
      onresize={() => {
        fitView();
        ctrl.invalidate();
      }}
    />
  {/snippet}
  {#snippet readouts()}<Readouts {rows} />{/snippet}
  {#snippet controls()}
    <div class="controls">
      <Slider def={sl('I')} bind:value={params.I} />
      <Slider def={sl('r')} bind:value={params.r} />
      <Slider def={sl('m')} bind:value={params.m} />
      <Slider def={sl('h')} bind:value={params.h} />
      <Slider def={sl('tauF')} bind:value={params.tauF} />
      <Slider def={sl('g')} bind:value={params.g} />
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
