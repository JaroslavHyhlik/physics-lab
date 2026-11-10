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
  import { SpringLauncher } from '../../physics/springLauncher';
  import { fmt } from '../../core/format';
  import { Ruler } from '../../tools/ruler';
  import { drawLauncher } from './render';
  import * as M from './meta';

  let { entry }: { entry: SimEntry } = $props();
  const { params, sl } = useParams(M.defaults, M.sliders);
  const mp = () => ({ k: params.k, dx: params.dx, m: params.m, g: params.g });
  const s = new SpringLauncher(mp());
  const view = new View();
  const inter = new Interaction();
  const ruler = new Ruler(0.2, 0, 0.2, 1);
  let ctx: CanvasRenderingContext2D | null = null;

  const fitView = () => {
    const top = Math.max(s.predictedRise - s.p.dx, 0.2) * 1.15;
    const bottom = -Math.max(0.15, s.p.dx * 2) - 0.05;
    const half = (top - bottom) * 0.45;
    view.fit(-half, half, bottom, top, 24, 80);
    ruler.ax = ruler.bx = half * 0.4;
    ruler.ay = 0;
    ruler.by = Number((s.predictedRise - s.p.dx).toPrecision(2));
  };

  const ctrl: SimController = new SimController(
    {
      step: (dt) => s.step(dt),
      render: () => {
        if (!ctx) return;
        drawLauncher(ctx, view, s, palette.pal, params.bars);
        ruler.draw(ctx, view, palette.pal);
      },
      sample: (t, out) => {
        out[0] = t;
        out[1] = s.y;
        out[2] = s.vel;
        out[3] = s.a;
        out[4] = s.EH;
        out[5] = s.Ek;
        out[6] = s.Ep;
        out[7] = s.EH + s.Ek + s.Ep;
        out[8] = s.springForce;
      },
      reset: () => {
        s.reset(mp());
        fitView();
      },
    },
    { dt: 1e-3, channels: M.channels, sampleInterval: 1 / 240, autoplay: true, frameStep: 0.005 },
  );
  const palette = usePalette(() => ctrl);
  resetOn(ctrl, () => [params.k, params.dx, params.m, params.g]);
  redrawOn(ctrl, () => [params.bars]);
  ruler.attach(view, inter);
  inter.onChange = () => ctrl.invalidate();

  const rows = $derived.by(() => {
    void ctrl.renderCount;
    const vL = Math.sqrt(Math.max(0, (params.k * params.dx ** 2) / params.m - 2 * params.g * params.dx));
    return [
      { label: 'stored E_H = ½kΔx²', value: fmt(0.5 * params.k * params.dx ** 2, 3), unit: 'J', strong: true },
      { label: 'launch speed', value: s.launches ? fmt(vL, 3) : '—', unit: 'm s⁻¹' },
      { label: 'predicted rise H', value: s.launches ? fmt(s.predictedRise, 3) : '—', unit: 'm' },
      { label: 'measured rise', value: fmt(s.maxY + params.dx, 3), unit: 'm' },
      { label: 'max spring force kΔx', value: fmt(params.k * params.dx, 3), unit: 'N' },
      ...(!s.launches ? [{ label: 'status', value: 'too weak: kΔx < 2mg' }] : []),
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
  initialGraphs={['E', 'y']}
  presets={M.presets}
  onpreset={(id) => Object.assign(params, M.presets.find((p) => p.id === id)?.values ?? {})}
  {ruler}
>
  {#snippet stage()}
    <SimCanvas
      {view}
      interaction={inter}
      label="Spring launcher simulation"
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
      <Slider def={sl('k')} bind:value={params.k} />
      <Slider def={sl('dx')} bind:value={params.dx} />
      <Slider def={sl('m')} bind:value={params.m} />
      <Slider def={sl('g')} bind:value={params.g} />
      <Toggle label="Energy bars" bind:checked={params.bars} />
      <p class="tip">Tip: watch the launch at 0.1× — the spring pushes for only a few milliseconds.</p>
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
