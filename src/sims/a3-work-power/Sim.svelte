<script lang="ts">
  import { onMount } from 'svelte';
  import SimShell from '../../sim/SimShell.svelte';
  import SimCanvas from '../../sim/SimCanvas.svelte';
  import Readouts from '../../sim/Readouts.svelte';
  import Slider from '../../ui/Slider.svelte';
  import Toggle from '../../ui/Toggle.svelte';
  import { SimController } from '../../sim/controller.svelte';
  import { useParams, usePalette, resetOn, redrawOn } from '../../sim/setup.svelte';
  import { View } from '../../sim/view';
  import type { SimEntry } from '../../app/registry';
  import { Winch, type WorkParams } from '../../physics/workPower';
  import { fmt } from '../../core/format';
  import { drawWinch } from './render';
  import * as M from './meta';

  let { entry }: { entry: SimEntry } = $props();
  const deg = Math.PI / 180;
  const { params, sl } = useParams(M.defaults, M.sliders);
  const mp = (): WorkParams => ({
    Pin: params.Pin,
    eta: params.eta,
    Fmax: params.Fmax,
    m: params.m,
    theta: params.theta * deg,
    mu: params.mu,
    g: params.g,
    L: params.L,
  });
  const w = new Winch(mp());
  const view = new View();
  let ctx: CanvasRenderingContext2D | null = null;

  const ctrl: SimController = new SimController(
    {
      step: (dt) => {
        w.step(dt);
        if ((w.atTop || !w.moves) && w.t > 1) ctrl.pause();
      },
      render: () => {
        if (ctx) drawWinch(ctx, view.width, view.height, w, palette.pal, params.sankey);
      },
      sample: (t, out) => {
        const moving = !w.atTop && w.moves;
        out[0] = t;
        out[1] = w.v;
        out[2] = moving ? w.force() : 0;
        out[3] = moving ? w.p.Pin : 0;
        out[4] = moving ? w.force() * w.v : 0;
        out[5] = w.p.m * w.p.g * Math.sin(w.p.theta) * w.v;
        out[6] = w.inputEnergy;
        out[7] = w.work;
        out[8] = w.Ep;
        out[9] = w.motorHeat + w.frictionHeat;
      },
      reset: () => w.reset(mp()),
    },
    { dt: 1e-3, channels: M.channels, sampleInterval: 1 / 30, autoplay: true },
  );
  const palette = usePalette(() => ctrl);
  resetOn(ctrl, () => [params.Pin, params.eta, params.Fmax, params.m, params.theta, params.mu, params.L, params.g]);
  $effect(() => {
    void [params.Pin, params.eta, params.Fmax, params.m, params.theta, params.mu, params.L, params.g];
    if (ctx) ctrl.play();
  });
  redrawOn(ctrl, () => [params.sankey]);

  const rows = $derived.by(() => {
    void ctrl.renderCount;
    const moving = !w.atTop && w.moves;
    const Pu = w.p.m * w.p.g * Math.sin(w.p.theta) * w.v;
    return [
      { label: 'speed v', value: fmt(w.v, 3), unit: 'm s⁻¹', strong: true },
      { label: 'final speed P_out/F', value: w.moves ? fmt(w.terminalSpeed, 3) : '—', unit: 'm s⁻¹' },
      { label: 'P = Fv', value: moving ? `${fmt(w.force(), 3)} N × ${fmt(w.v, 3)} = ${fmt(w.force() * w.v, 3)}` : '0', unit: 'W' },
      { label: 'overall efficiency now', value: moving ? `${((100 * Pu) / w.p.Pin).toFixed(1)} %` : '—' },
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
  initialGraphs={['P', 'E']}
  presets={M.presets}
  onpreset={(id) => Object.assign(params, M.presets.find((p) => p.id === id)?.values ?? {})}
>
  {#snippet stage()}
    <SimCanvas
      {view}
      label="Work, power and efficiency simulation"
      onready={(c) => {
        ctx = c;
        ctrl.invalidate();
      }}
      onresize={() => ctrl.invalidate()}
    />
  {/snippet}
  {#snippet readouts()}<Readouts {rows} />{/snippet}
  {#snippet controls()}
    <div class="controls">
      <Slider def={sl('Pin')} bind:value={params.Pin} />
      <Slider def={sl('eta')} bind:value={params.eta} />
      <Slider def={sl('Fmax')} bind:value={params.Fmax} />
      <Slider def={sl('m')} bind:value={params.m} />
      <Slider def={sl('theta')} bind:value={params.theta} />
      <Slider def={sl('mu')} bind:value={params.mu} />
      <Slider def={sl('L')} bind:value={params.L} />
      <Slider def={sl('g')} bind:value={params.g} />
      <Toggle label="Sankey diagram" bind:checked={params.sankey} />
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
