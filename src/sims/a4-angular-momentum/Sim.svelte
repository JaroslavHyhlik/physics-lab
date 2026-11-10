<script lang="ts">
  import { onMount } from 'svelte';
  import SimShell from '../../sim/SimShell.svelte';
  import SimCanvas from '../../sim/SimCanvas.svelte';
  import Readouts from '../../sim/Readouts.svelte';
  import Slider from '../../ui/Slider.svelte';
  import Segmented from '../../ui/Segmented.svelte';
  import { SimController } from '../../sim/controller.svelte';
  import { useParams, usePalette, resetOn } from '../../sim/setup.svelte';
  import { View } from '../../sim/view';
  import type { SimEntry } from '../../app/registry';
  import { Spinner, Discs, MerryGoRound } from '../../physics/angularMomentum';
  import { fmt } from '../../core/format';
  import { drawSpinner, drawDiscs, drawMgr } from './render';
  import * as M from './meta';

  let { entry }: { entry: SimEntry } = $props();
  const { params, sl } = useParams(M.defaults, M.sliders);
  let spinner = new Spinner({ I0: params.I0, m: params.sm, omega0: params.w0, r0: 0.9 });
  let discs = new Discs({ I1: params.I1, I2: params.I2, omega1: params.dw1, tau: params.tau, tDrop: 1 });
  let mgr = new MerryGoRound({ Ip: params.Ip, m: params.pm, R: params.R, u: params.u });
  const view = new View();
  let ctx: CanvasRenderingContext2D | null = null;

  const ctrl: SimController = new SimController(
    {
      step: (dt) => {
        if (params.mode === 'spinner') spinner.step(dt);
        else if (params.mode === 'discs') discs.step(dt);
        else mgr.step(dt);
      },
      render: () => {
        if (!ctx) return;
        if (params.mode === 'spinner') drawSpinner(ctx, view.width, view.height, spinner, palette.pal);
        else if (params.mode === 'discs') drawDiscs(ctx, view.width, view.height, discs, palette.pal);
        else drawMgr(ctx, view.width, view.height, mgr, palette.pal);
      },
      sample: (t, out) => {
        out[0] = t;
        if (params.mode === 'spinner') {
          out[1] = spinner.omega;
          out[2] = NaN;
          out[3] = spinner.p.I0 * spinner.omega;
          out[4] = 2 * spinner.p.m * spinner.r ** 2 * spinner.omega;
          out[5] = spinner.L;
          out[6] = spinner.Ek;
        } else if (params.mode === 'discs') {
          out[1] = discs.w1;
          out[2] = discs.w2;
          out[3] = discs.p.I1 * discs.w1;
          out[4] = discs.p.I2 * discs.w2;
          out[5] = discs.L;
          out[6] = discs.Ek;
        } else {
          const { Ip, m, R } = mgr.p;
          out[1] = mgr.omegaP;
          out[2] = mgr.omegaPerson;
          out[3] = Ip * mgr.omegaP;
          out[4] = m * R * R * mgr.omegaPerson;
          out[5] = mgr.L;
          out[6] = 0.5 * Ip * mgr.omegaP ** 2 + 0.5 * m * (R * mgr.omegaPerson) ** 2;
        }
      },
      reset: () => {
        spinner = new Spinner({ I0: params.I0, m: params.sm, omega0: params.w0, r0: 0.9 });
        spinner.r = params.r;
        discs = new Discs({ I1: params.I1, I2: params.I2, omega1: params.dw1, tau: params.tau, tDrop: 1 });
        mgr = new MerryGoRound({ Ip: params.Ip, m: params.pm, R: params.R, u: params.u });
      },
    },
    { dt: 1e-3, channels: M.channels, sampleInterval: 1 / 60, autoplay: true },
  );
  const palette = usePalette(() => ctrl);
  resetOn(ctrl, () => [params.mode, params.I0, params.sm, params.w0, params.I1, params.I2, params.dw1, params.tau, params.Ip, params.pm, params.R, params.u]);
  // the arm radius changes live (that is the point)
  $effect(() => {
    spinner.r = params.r;
    ctrl.invalidate();
  });

  const rows = $derived.by(() => {
    void ctrl.renderCount;
    if (params.mode === 'spinner')
      return [
        { label: 'L = Iω (constant)', value: fmt(spinner.L, 4), unit: 'kg m² s⁻¹', strong: true },
        { label: 'I = I₀ + 2mr²', value: fmt(spinner.I, 3), unit: 'kg m²' },
        { label: 'ω', value: fmt(spinner.omega, 3), unit: 'rad s⁻¹' },
        { label: 'E_k = L²/2I', value: fmt(spinner.Ek, 3), unit: 'J' },
      ];
    if (params.mode === 'discs')
      return [
        { label: 'total L', value: fmt(discs.L, 4), unit: 'kg m² s⁻¹', strong: true },
        { label: 'ω₁ / ω₂', value: `${fmt(discs.w1, 3)} / ${fmt(discs.w2, 3)}`, unit: 'rad s⁻¹' },
        { label: 'final ω = I₁ω₁/(I₁+I₂)', value: fmt(discs.finalOmega, 3), unit: 'rad s⁻¹' },
        { label: 'E_k', value: fmt(discs.Ek, 3), unit: 'J' },
      ];
    return [
      { label: 'total L', value: fmt(Math.abs(mgr.L) < 1e-12 ? 0 : mgr.L, 3), unit: 'kg m² s⁻¹', strong: true },
      { label: 'platform ω', value: fmt(mgr.omegaP, 3), unit: 'rad s⁻¹' },
      { label: 'person ω (ground)', value: fmt(mgr.omegaPerson, 3), unit: 'rad s⁻¹' },
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
  initialGraphs={['L', 'w']}
  presets={M.presets}
  onpreset={(id) => Object.assign(params, M.presets.find((x) => x.id === id)?.values ?? {})}
>
  {#snippet stage()}
    <SimCanvas
      {view}
      label="Conservation of angular momentum"
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
      <Segmented
        label="Situation"
        bind:value={params.mode}
        options={[
          { value: 'spinner', label: 'Spinning chair' },
          { value: 'discs', label: 'Two discs' },
          { value: 'mgr', label: 'Merry-go-round' },
        ]}
      />
      {#if params.mode === 'spinner'}
        <Slider def={sl('r')} bind:value={params.r} />
        <Slider def={sl('w0')} bind:value={params.w0} />
        <Slider def={sl('I0')} bind:value={params.I0} />
        <Slider def={sl('sm')} bind:value={params.sm} />
        <p class="tip">Move the arm radius while it spins: the graphs show L staying constant.</p>
      {:else if params.mode === 'discs'}
        <Slider def={sl('I1')} bind:value={params.I1} />
        <Slider def={sl('I2')} bind:value={params.I2} />
        <Slider def={sl('dw1')} bind:value={params.dw1} />
        <Slider def={sl('tau')} bind:value={params.tau} />
      {:else}
        <Slider def={sl('u')} bind:value={params.u} />
        <Slider def={sl('Ip')} bind:value={params.Ip} />
        <Slider def={sl('pm')} bind:value={params.pm} />
        <Slider def={sl('R')} bind:value={params.R} />
      {/if}
    </div>
  {/snippet}
</SimShell>

<style>
  .controls {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }
  .tip {
    font-size: var(--text-xs);
    color: var(--text-3);
  }
</style>
