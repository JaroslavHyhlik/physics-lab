<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import SimShell from '../../sim/SimShell.svelte';
  import SimCanvas from '../../sim/SimCanvas.svelte';
  import Readouts from '../../sim/Readouts.svelte';
  import Slider from '../../ui/Slider.svelte';
  import Toggle from '../../ui/Toggle.svelte';
  import { SimController } from '../../sim/controller.svelte';
  import { createParams, syncParamsToUrl } from '../../sim/params.svelte';
  import { View } from '../../sim/view';
  import { Interaction } from '../../sim/interaction';
  import { readPalette } from '../../sim/palette';
  import { theme } from '../../app/theme.svelte';
  import { router } from '../../app/router.svelte';
  import type { SimEntry } from '../../app/registry';
  import { Pendulum } from '../../physics/pendulum';
  import { pendulumPeriodExact } from '../../core/special';
  import { fmt } from '../../core/format';
  import { Ruler } from '../../tools/ruler';
  import { drawPendulum } from './render';
  import * as M from './meta';

  let { entry }: { entry: SimEntry } = $props();

  const deg = Math.PI / 180;
  const query = router.route.name === 'sim' ? router.route.query : new URLSearchParams();
  const params = createParams(M.defaults, query, M.sliders);
  const sl = (k: string) => M.sliders.find((s) => s.key === k)!;

  const modelParams = () => ({
    l: params.l,
    m: params.m,
    g: params.g,
    b: params.b,
    theta0: params.theta0 * deg,
  });
  const model = new Pendulum(modelParams());
  const view = new View();
  const inter = new Interaction();
  const ruler = new Ruler(0.2, 0, 0.2, -1);
  let ctx: CanvasRenderingContext2D | null = null;
  let pal = readPalette();
  let E0 = model.E;

  // trail ring buffer (world coordinates)
  const TRAIL = 180;
  const trail = new Float32Array(TRAIL * 2);
  let trailLen = 0;
  let trailStart = 0;
  function pushTrail() {
    const i = (trailStart + trailLen) % TRAIL;
    trail[2 * i] = model.p.l * Math.sin(model.theta);
    trail[2 * i + 1] = -model.p.l * Math.cos(model.theta);
    if (trailLen < TRAIL) trailLen++;
    else trailStart = (trailStart + 1) % TRAIL;
  }

  function fitView() {
    const L = params.l;
    const up = Math.abs(params.theta0) > 90 ? 1.2 * L : 0.25 * L;
    view.fit(-1.25 * L, 1.25 * L, -1.2 * L, up, 24, 84);
  }

  function draw() {
    if (!ctx) return;
    drawPendulum(ctx, view, model, pal, {
      ghost: params.ghost,
      vectors: params.vectors,
      trail,
      trailLen: params.trail ? trailLen : 0,
      trailStart,
      E0,
    });
    ruler.draw(ctx, view, pal);
  }

  const ctrl = new SimController(
    {
      step: (dt) => model.step(dt),
      render: draw,
      sample: (t, out) => {
        const l = model.p.l;
        out[0] = t;
        out[1] = model.theta;
        out[2] = model.thetaSmall;
        out[3] = l * model.theta;
        out[4] = l * model.omega;
        out[5] = model.aTangential;
        out[6] = model.Ek;
        out[7] = model.Ep;
        out[8] = model.E;
        pushTrail();
      },
      reset: () => {
        model.reset(modelParams());
        E0 = model.E;
        trailLen = 0;
        trailStart = 0;
        fitView();
      },
    },
    { dt: 1e-3, channels: M.channels, sampleInterval: 1 / 60, autoplay: true },
  );

  // Length or release angle → restart the swing.
  let first = true;
  $effect(() => {
    void params.l;
    void params.theta0;
    if (first) {
      first = false;
      return;
    }
    untrack(() => ctrl.reset());
  });
  // Mass, g and damping apply immediately (mid-swing).
  $effect(() => {
    model.p.m = params.m;
    model.p.g = params.g;
    model.p.b = params.b;
    untrack(() => {
      E0 = Math.max(model.E, 1e-12);
      ctrl.invalidate();
    });
  });
  $effect(() => {
    void params.ghost;
    void params.vectors;
    void params.trail;
    ctrl.invalidate();
  });
  $effect(() => syncParamsToUrl($state.snapshot(params), M.defaults));
  $effect(() => {
    void theme.version;
    pal = readPalette();
    ctrl.invalidate();
  });

  // Drag the bob to choose the release angle.
  let wasRunning = false;
  inter.add({
    priority: 10,
    cursor: 'grab',
    hit: (px, py) => {
      const x = view.sx(model.p.l * Math.sin(model.theta));
      const y = view.sy(-model.p.l * Math.cos(model.theta));
      return Math.hypot(px - x, py - y) - 14;
    },
    start: () => {
      wasRunning = ctrl.running;
      ctrl.pause();
    },
    move: (px, py) => {
      const th = Math.atan2(view.wx(px), -view.wy(py)) / deg;
      params.theta0 = Math.max(-179, Math.min(179, Math.round(th)));
    },
    end: () => {
      if (wasRunning) ctrl.play();
    },
  });
  inter.onChange = () => ctrl.invalidate();

  function applyPreset(id: string) {
    const p = M.presets.find((x) => x.id === id);
    if (p) Object.assign(params, p.values);
  }

  const rows = $derived.by(() => {
    void ctrl.renderCount;
    const T0 = 2 * Math.PI * Math.sqrt(params.l / params.g);
    const Tex = pendulumPeriodExact(params.l, params.g, Math.min(Math.abs(params.theta0), 179.9) * deg);
    const Tm = model.measuredPeriod;
    return [
      { label: 'T measured', value: Number.isFinite(Tm) ? Tm.toFixed(3) : '—', unit: 's', strong: true },
      { label: 'T = 2π√(l/g)', value: T0.toFixed(3), unit: 's' },
      { label: 'T exact', value: Tex.toFixed(3), unit: 's' },
      { label: 'θ', value: (model.theta / deg).toFixed(1), unit: '°' },
      { label: 'v', value: fmt(model.p.l * model.omega, 3), unit: 'm s⁻¹' },
      { label: 'E total', value: fmt(model.E, 3), unit: 'J', color: '--series-4' },
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
  initialGraphs={['theta', 'E']}
  presets={M.presets}
  onpreset={applyPreset}
  {ruler}
>
  {#snippet stage()}
    <SimCanvas
      {view}
      interaction={inter}
      label="Pendulum simulation"
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
  {#snippet readouts()}<Readouts rows={rows} />{/snippet}
  {#snippet controls()}
    <div class="controls">
      <Slider def={sl('l')} bind:value={params.l} />
      <Slider def={sl('theta0')} bind:value={params.theta0} />
      <Slider def={sl('m')} bind:value={params.m} />
      <Slider def={sl('g')} bind:value={params.g} />
      <Slider def={sl('b')} bind:value={params.b} />
      <div class="toggles">
        <Toggle label="Small-angle ghost" hint="SHM approximation sin θ ≈ θ" bind:checked={params.ghost} />
        <Toggle label="Velocity & acceleration vectors" hint="Not to scale" bind:checked={params.vectors} />
        <Toggle label="Trail" bind:checked={params.trail} />
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
  .toggles {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding-top: var(--space-2);
    border-top: 1px solid var(--border);
  }
</style>
