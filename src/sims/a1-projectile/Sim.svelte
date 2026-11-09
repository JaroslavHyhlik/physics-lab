<script lang="ts">
  import { onMount } from 'svelte';
  import { Target } from '@lucide/svelte';
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
  import { Projectile, vacuumResults, optimumAngle, type ProjectileParams } from '../../physics/projectile';
  import { fmt } from '../../core/format';
  import { Ruler } from '../../tools/ruler';
  import { drawProjectile, Path } from './render';
  import * as M from './meta';

  let { entry }: { entry: SimEntry } = $props();
  const deg = Math.PI / 180;
  const { params, sl } = useParams(M.defaults, M.sliders);

  const modelParams = (): ProjectileParams => ({
    u: params.u,
    angle: params.angle * deg,
    h0: params.h0,
    m: params.m,
    d: params.d,
    Cd: params.Cd,
    rho: params.rho,
    g: params.g,
  });
  const pr = new Projectile(modelParams());
  const paths = { vac: new Path(), air: new Path() };
  const view = new View();
  const inter = new Interaction();
  const ruler = new Ruler(0, 0, 10, 0);
  let ctx: CanvasRenderingContext2D | null = null;
  let dotEvery = 6;

  function fitView() {
    const p = modelParams();
    const v = vacuumResults(p.u, p.angle, p.h0, p.g);
    const R = Math.max(v.range, 1);
    const H = Math.max(v.maxHeight, p.h0, 0.5);
    view.fit(-0.1 * R - 0.05 * H, R * 1.06, -0.08 * Math.max(R, H) * 0.4, H * 1.18, 28, 88);
    dotEvery = v.T > 4 ? 30 : 6;
    ruler.ax = 0;
    ruler.bx = Number(R.toPrecision(2));
    ruler.ay = ruler.by = -0.02 * R;
  }

  const ctrl: SimController = new SimController(
    {
      step: (dt) => {
        pr.step(dt);
        if (pr.done) ctrl.pause();
      },
      render: () => {
        if (!ctx) return;
        drawProjectile(ctx, view, pr, paths, palette.pal, {
          showVacuum: params.vacuum,
          showAir: params.air,
          components: params.components,
          dots: params.dots,
          dotEvery,
        });
        ruler.draw(ctx, view, palette.pal);
      },
      sample: (t, out) => {
        if (pr.done && paths.vac.n + paths.air.n > 0 && t > Math.max(pr.vacuum.tLand, pr.air.tLand) + 0.1)
          return false;
        const v = pr.vacuum.s;
        const a = pr.air.s;
        const acc = [0, 0];
        pr.air.accel(a, pr.p.g, acc);
        out[0] = t;
        out[1] = v[0];
        out[2] = a[0];
        out[3] = v[1];
        out[4] = a[1];
        out[5] = v[2];
        out[6] = a[2];
        out[7] = v[3];
        out[8] = a[3];
        out[9] = pr.air.landed ? 0 : acc[0];
        out[10] = pr.air.landed ? 0 : acc[1];
        out[11] = pr.vacuum.landed ? 0 : -pr.p.g;
        if (!pr.vacuum.landed) paths.vac.push(v[0], v[1]);
        if (!pr.air.landed) paths.air.push(a[0], a[1]);
      },
      reset: () => {
        pr.reset(modelParams());
        paths.vac.clear();
        paths.air.clear();
        fitView();
      },
    },
    { dt: 1e-3, channels: M.channels, sampleInterval: 1 / 60, autoplay: true },
  );
  const palette = usePalette(() => ctrl);

  // any physical parameter → relaunch
  resetOn(ctrl, () => [params.u, params.angle, params.h0, params.m, params.d, params.Cd, params.rho, params.g]);
  $effect(() => {
    void [params.u, params.angle, params.h0, params.m, params.d, params.Cd, params.rho, params.g];
    if (ctx) ctrl.play();
  });
  redrawOn(ctrl, () => [params.vacuum, params.air, params.components, params.dots]);
  ruler.attach(view, inter);
  inter.onChange = () => ctrl.invalidate();

  let finding = $state(false);
  function bestAngle() {
    finding = true;
    // let the button show its busy state before the (short) computation
    setTimeout(() => {
      params.angle = Math.round((optimumAngle(modelParams()) / deg) * 10) / 10;
      finding = false;
    }, 20);
  }

  const rows = $derived.by(() => {
    void ctrl.renderCount;
    const v = pr.vacuum;
    const a = pr.air;
    const f = (x: number, ok: boolean) => (ok && Number.isFinite(x) ? fmt(x, 3) : '—');
    const pair = (a1: string, a2: string) => `${a1} / ${a2}`;
    return [
      { label: 'vacuum / air', value: '' },
      { label: 'range R', value: pair(f(v.s[0], v.landed), f(a.s[0], a.landed)), unit: 'm', strong: true },
      {
        label: 'max height H',
        value: pair(f(v.maxHeight, Number.isFinite(v.tMax) || v.landed), f(a.maxHeight, Number.isFinite(a.tMax) || a.landed)),
        unit: 'm',
      },
      { label: 'time of flight', value: pair(f(v.tLand, v.landed), f(a.tLand, a.landed)), unit: 's' },
      { label: 'terminal speed', value: params.rho > 0 ? fmt(pr.terminalSpeed, 3) : '∞', unit: 'm s⁻¹' },
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
  initialGraphs={['y', 'vy']}
  presets={M.presets}
  onpreset={(id) => Object.assign(params, M.presets.find((p) => p.id === id)?.values ?? {})}
  {ruler}
>
  {#snippet stage()}
    <SimCanvas
      {view}
      interaction={inter}
      label="Projectile motion simulation"
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
      <Slider def={sl('u')} bind:value={params.u} />
      <Slider def={sl('angle')} bind:value={params.angle} />
      <button type="button" class="best" onclick={bestAngle} disabled={finding || params.rho === 0}>
        <Target size={15} />
        {finding ? 'Searching…' : 'Best angle for the longest range (with air)'}
      </button>
      <Slider def={sl('h0')} bind:value={params.h0} />
      <Slider def={sl('g')} bind:value={params.g} />
      <div class="group">
        <h3>Air resistance</h3>
        <Slider def={sl('rho')} bind:value={params.rho} />
        <Slider def={sl('m')} bind:value={params.m} />
        <Slider def={sl('d')} bind:value={params.d} />
        <Slider def={sl('Cd')} bind:value={params.Cd} />
      </div>
      <div class="group">
        <Toggle label="Vacuum path (dashed)" color="var(--series-5)" bind:checked={params.vacuum} />
        <Toggle label="Path with air resistance" color="var(--series-1)" bind:checked={params.air} />
        <Toggle label="Velocity components" hint="vₓ and v_y arrows" bind:checked={params.components} />
        <Toggle label="Position dots" hint="Equal time intervals" bind:checked={params.dots} />
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
  .group {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    padding-top: var(--space-3);
    border-top: 1px solid var(--border);
  }
  h3 {
    font-size: var(--text-xs);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-3);
  }
  .best {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    border: 1px solid var(--border-strong);
    background: var(--surface);
    border-radius: var(--radius-s);
    padding: 8px 12px;
    font-size: var(--text-sm);
    font-weight: 600;
    min-height: 40px;
    color: var(--accent);
  }
  .best:disabled {
    opacity: 0.5;
  }
</style>
