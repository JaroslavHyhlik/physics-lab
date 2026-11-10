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
  import { Interaction } from '../../sim/interaction';
  import type { SimEntry } from '../../app/registry';
  import { StokesFall, type StokesParams } from '../../physics/stokes';
  import { fmt } from '../../core/format';
  import { Ruler } from '../../tools/ruler';
  import { drawStokes } from './render';
  import * as M from './meta';

  let { entry }: { entry: SimEntry } = $props();
  const { params, sl } = useParams(M.defaults, M.sliders);
  const mp = (): StokesParams => ({
    r: params.r / 1000,
    rhoS: params.rhoS,
    rhoF: params.rhoF,
    eta: params.eta,
    g: params.g,
    H: params.H,
    u: params.u,
  });
  const ball = new StokesFall(mp());
  const view = new View();
  const inter = new Interaction();
  const ruler = new Ruler(0.12, 0.1, 0.12, 0.3);
  let ctx: CanvasRenderingContext2D | null = null;

  const fitView = () => {
    const H = params.H;
    view.fit(-0.6 * H, 0.6 * H, -0.04 * H, H * 1.1, 20, 76);
  };

  const ctrl: SimController = new SimController(
    {
      step: (dt) => {
        ball.step(dt);
        if (ball.stopped && ball.t > 0.05) ctrl.pause();
      },
      render: () => {
        if (!ctx) return;
        drawStokes(ctx, view, ball, palette.pal, params.forces);
        ruler.draw(ctx, view, palette.pal);
      },
      sample: (t, out) => {
        out[0] = t;
        out[1] = ball.y[0] - (ball.terminalVelocity >= 0 ? ball.p.r : ball.p.H - ball.p.r);
        out[2] = ball.y[1];
        out[3] = ball.terminalVelocity;
        out[4] = ball.a;
        out[5] = ball.weight;
        out[6] = ball.buoyancy;
        out[7] = ball.drag();
      },
      reset: () => {
        ball.reset(mp());
        fitView();
        ruler.ax = ruler.bx = 0.14 * params.H;
        ruler.ay = 0.2 * params.H;
        ruler.by = 0.6 * params.H;
      },
    },
    { dt: 1e-4, channels: M.channels, sampleInterval: 1 / 120, autoplay: true },
  );
  const palette = usePalette(() => ctrl);
  resetOn(ctrl, () => [params.r, params.rhoS, params.rhoF, params.eta, params.H, params.u, params.g]);
  $effect(() => {
    void [params.r, params.rhoS, params.rhoF, params.eta, params.H, params.u, params.g];
    if (ctx) ctrl.play();
  });
  redrawOn(ctrl, () => [params.forces]);
  ruler.attach(view, inter);
  inter.onChange = () => ctrl.invalidate();

  const fluidId = $derived(M.fluids.find((f) => f.rho === params.rhoF && f.eta === params.eta)?.id ?? '');
  const matId = $derived(M.materials.find((m) => m.rho === params.rhoS)?.id ?? '');

  const rows = $derived.by(() => {
    void ctrl.renderCount;
    const Re = (params.rhoF * Math.abs(ball.terminalVelocity) * 2 * ball.p.r) / params.eta;
    return [
      { label: 'terminal velocity v_t', value: fmt(ball.terminalVelocity, 3), unit: 'm s⁻¹', strong: true },
      { label: 'v now', value: fmt(ball.y[1], 3), unit: 'm s⁻¹' },
      { label: 'time constant τ', value: fmt(ball.tau, 3), unit: 's' },
      { label: 'Reynolds number at v_t', value: fmt(Re, 2) },
      { label: 'Stokes’ law', value: Re < 1 ? 'valid (Re < 1)' : Re < 10 ? 'approximate' : 'NOT valid (Re ≫ 1)' },
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
  initialGraphs={['v', 'F']}
  presets={M.presets}
  onpreset={(id) => Object.assign(params, M.presets.find((p) => p.id === id)?.values ?? {})}
  {ruler}
>
  {#snippet stage()}
    <SimCanvas
      {view}
      interaction={inter}
      label="Sphere falling through a fluid"
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
      <label class="sel">
        <span>Fluid</span>
        <select
          value={fluidId}
          onchange={(e) => {
            const f = M.fluids.find((x) => x.id === (e.currentTarget as HTMLSelectElement).value);
            if (f) Object.assign(params, { rhoF: f.rho, eta: f.eta });
          }}
        >
          <option value="" disabled>Custom</option>
          {#each M.fluids as f (f.id)}<option value={f.id}>{f.label}</option>{/each}
        </select>
      </label>
      <label class="sel">
        <span>Sphere material</span>
        <select
          value={matId}
          onchange={(e) => {
            const m = M.materials.find((x) => x.id === (e.currentTarget as HTMLSelectElement).value);
            if (m) params.rhoS = m.rho;
          }}
        >
          <option value="" disabled>Custom</option>
          {#each M.materials as m (m.id)}<option value={m.id}>{m.label}</option>{/each}
        </select>
      </label>
      <Slider def={sl('r')} bind:value={params.r} />
      <Slider def={sl('rhoS')} bind:value={params.rhoS} />
      <Slider def={sl('rhoF')} bind:value={params.rhoF} />
      <Slider def={sl('eta')} bind:value={params.eta} />
      <Slider def={sl('H')} bind:value={params.H} />
      <Slider def={sl('u')} bind:value={params.u} />
      <Slider def={sl('g')} bind:value={params.g} />
      <Toggle label="Force arrows" hint="Lengths ∝ force" bind:checked={params.forces} />
    </div>
  {/snippet}
</SimShell>

<style>
  .controls {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }
  .sel {
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-size: var(--text-sm);
    color: var(--text-2);
  }
  select {
    border: 1px solid var(--border-strong);
    background: var(--surface);
    border-radius: var(--radius-s);
    padding: 9px 10px;
    font-weight: 600;
    min-height: var(--touch);
    color: var(--text);
  }
</style>
