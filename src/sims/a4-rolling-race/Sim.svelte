<script lang="ts">
  import { onMount } from 'svelte';
  import SimShell from '../../sim/SimShell.svelte';
  import SimCanvas from '../../sim/SimCanvas.svelte';
  import Slider from '../../ui/Slider.svelte';
  import Toggle from '../../ui/Toggle.svelte';
  import { SimController } from '../../sim/controller.svelte';
  import { useParams, usePalette, resetOn, redrawOn } from '../../sim/setup.svelte';
  import { View } from '../../sim/view';
  import type { SimEntry } from '../../app/registry';
  import { shapes, racerAt, type RollParams } from '../../physics/rolling';
  import { drawRace } from './render';
  import * as M from './meta';

  let { entry }: { entry: SimEntry } = $props();
  const deg = Math.PI / 180;
  const { params, sl } = useParams(M.defaults, M.sliders);
  const rp = (): RollParams => ({ theta: params.theta * deg, L: params.L, muS: params.muS, muD: Math.min(params.muD, params.muS), m: params.m, r: params.r, g: params.g });
  const view = new View();
  let ctx: CanvasRenderingContext2D | null = null;
  let p = rp();

  const ctrl: SimController = new SimController(
    {
      step: () => {},
      render: () => {
        if (ctx) drawRace(ctx, view.width, view.height, p, ctrl.now, palette.pal, params.energy);
        const tMax = Math.max(...shapes.map((s) => racerAt(s, p, 0).tEnd));
        if (ctrl.now > tMax + 0.5 && ctrl.running) ctrl.pause();
      },
      sample: (t, out) => {
        out[0] = t;
        shapes.forEach((s, i) => (out[i + 1] = racerAt(s, p, t).v));
      },
      reset: () => {
        p = rp();
      },
    },
    { dt: 1e-3, channels: M.channels, sampleInterval: 1 / 60, autoplay: true },
  );
  const palette = usePalette(() => ctrl);
  $effect(() => {
    if (params.muD > params.muS) params.muS = params.muD;
  });
  resetOn(ctrl, () => [params.theta, params.L, params.muS, params.muD, params.m, params.r, params.g]);
  $effect(() => {
    void [params.theta, params.L, params.muS, params.muD, params.m, params.r, params.g];
    if (ctx) ctrl.play();
  });
  redrawOn(ctrl, () => [params.energy]);

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
  initialGraphs={['v']}
  presets={M.presets}
  onpreset={(id) => Object.assign(params, M.presets.find((x) => x.id === id)?.values ?? {})}
>
  {#snippet stage()}
    <SimCanvas
      {view}
      label="Rolling race down a slope"
      onready={(c) => {
        ctx = c;
        ctrl.invalidate();
      }}
      onresize={() => ctrl.invalidate()}
    />
  {/snippet}
  {#snippet controls()}
    <div class="controls">
      <Slider def={sl('theta')} bind:value={params.theta} />
      <Slider def={sl('L')} bind:value={params.L} />
      <Slider def={sl('muS')} bind:value={params.muS} />
      <Slider def={sl('muD')} bind:value={params.muD} />
      <Slider def={sl('m')} bind:value={params.m} />
      <Slider def={sl('r')} bind:value={params.r} />
      <Slider def={sl('g')} bind:value={params.g} />
      <Toggle label="Energy split bars" hint="Translational · rotational · heat" bind:checked={params.energy} />
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
