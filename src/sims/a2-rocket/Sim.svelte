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
  import { Rocket, tsiolkovsky, type RocketParams } from '../../physics/rocket';
  import { g } from '../../core/constants';
  import { fmt } from '../../core/format';
  import { drawRocket } from './render';
  import * as M from './meta';

  let { entry }: { entry: SimEntry } = $props();
  const { params, sl } = useParams(M.defaults, M.sliders);
  const mp = (): RocketParams => ({
    dry: params.dry,
    fuel: params.fuel,
    mdot: params.mdot,
    ve: params.ve,
    Cd: params.Cd,
    d: params.d,
    rho0: 1.2,
    g0: g,
    drag: params.drag,
    gravity: params.gravity,
    variableG: params.variableG,
  });
  const rocket = new Rocket(mp());
  const view = new View();
  let ctx: CanvasRenderingContext2D | null = null;
  let span = 100;

  const ctrl: SimController = new SimController(
    {
      step: (dt) => {
        rocket.step(dt);
        if (rocket.landed || rocket.t > 3600 || (!rocket.burning && rocket.maxH < 0.01 && rocket.t > 1)) ctrl.pause();
      },
      render: () => {
        if (!ctx) return;
        // zoom out smoothly (never in) so the ground stays at the bottom
        span = Math.max(span, rocket.y[0] * 1.35, 100);
        drawRocket(ctx, view.width, view.height, rocket, palette.pal, params.forces, span);
      },
      sample: (t, out) => {
        const h = rocket.y[0];
        out[0] = t;
        out[1] = h;
        out[2] = rocket.y[1];
        out[3] = rocket.a;
        out[4] = rocket.y[2];
        out[5] = rocket.thrust();
        out[6] = rocket.y[2] * rocket.gAt(h);
        out[7] = rocket.dragForce();
        return !rocket.landed || t < rocket.t + 0.05;
      },
      reset: () => {
        rocket.reset(mp());
        span = 100;
      },
    },
    { dt: 1e-3, channels: M.channels, sampleInterval: 0.05, autoplay: true },
  );
  const palette = usePalette(() => ctrl);
  resetOn(ctrl, () => [params.dry, params.fuel, params.mdot, params.ve, params.Cd, params.d, params.drag, params.gravity, params.variableG]);
  $effect(() => {
    void [params.dry, params.fuel, params.mdot, params.ve, params.Cd, params.d, params.drag, params.gravity, params.variableG];
    if (ctx) ctrl.play();
  });
  redrawOn(ctrl, () => [params.forces]);

  const rows = $derived.by(() => {
    void ctrl.renderCount;
    const m = rocket.y[2];
    const m0 = params.dry + params.fuel;
    const W0 = m0 * g;
    const F = params.ve * params.mdot;
    return [
      { label: 'altitude', value: rocket.y[0] >= 10000 ? fmt(rocket.y[0] / 1000, 4) : fmt(rocket.y[0], 4), unit: rocket.y[0] >= 10000 ? 'km' : 'm', strong: true },
      { label: 'v', value: fmt(rocket.y[1], 4), unit: 'm s⁻¹' },
      { label: 'a', value: `${fmt(rocket.a, 3)} (${fmt(rocket.a / g, 2)} g)`, unit: 'm s⁻²' },
      { label: 'mass', value: fmt(m, 4), unit: 'kg' },
      { label: 'thrust F = v_e Δm/Δt', value: fmt(F, 3), unit: 'N', color: '--series-3' },
      { label: 'lift-off weight', value: fmt(W0, 3), unit: 'N', color: '--series-2' },
      { label: 'burn time', value: fmt(rocket.burnTime, 3), unit: 's' },
      { label: 'ideal Δv (Tsiolkovsky)', value: fmt(tsiolkovsky(params.ve, m0, params.dry), 3), unit: 'm s⁻¹' },
      ...(F < W0 && params.gravity ? [{ label: 'status', value: 'thrust < weight: no lift-off' }] : []),
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
  initialGraphs={['v', 'a']}
  presets={M.presets}
  onpreset={(id) => Object.assign(params, M.presets.find((p) => p.id === id)?.values ?? {})}
>
  {#snippet stage()}
    <SimCanvas
      {view}
      label="Rocket launch simulation"
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
      <Slider def={sl('dry')} bind:value={params.dry} />
      <Slider def={sl('fuel')} bind:value={params.fuel} />
      <Slider def={sl('mdot')} bind:value={params.mdot} />
      <Slider def={sl('ve')} bind:value={params.ve} />
      <div class="group">
        <Toggle label="Gravity" bind:checked={params.gravity} />
        <Toggle label="g decreases with height (1/r²)" bind:checked={params.variableG} />
        <Toggle label="Air resistance" hint="Air thins out with altitude" bind:checked={params.drag} />
        <Slider def={sl('Cd')} bind:value={params.Cd} disabled={!params.drag} />
        <Slider def={sl('d')} bind:value={params.d} disabled={!params.drag} />
      </div>
      <Toggle label="Force arrows" hint="Lengths ∝ force" bind:checked={params.forces} />
      <p class="tip">Tip: use 5× or 10× speed for long flights.</p>
    </div>
  {/snippet}
</SimShell>

<style>
  .controls {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }
  .group {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    padding-top: var(--space-3);
    border-top: 1px solid var(--border);
  }
  .tip {
    font-size: var(--text-xs);
    color: var(--text-3);
  }
</style>
