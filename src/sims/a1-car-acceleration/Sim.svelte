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
  import { Car, type CarParams } from '../../physics/car';
  import { fmt } from '../../core/format';
  import { Ruler } from '../../tools/ruler';
  import { vehicles } from './vehicles';
  import { drawCarScene, followCar } from './render';
  import * as M from './meta';

  let { entry }: { entry: SimEntry } = $props();

  const query = router.route.name === 'sim' ? router.route.query : new URLSearchParams();
  const params = createParams(M.defaults, query, M.sliders);
  // a vehicle given in the URL supplies the defaults for anything not set explicitly
  if (query.has('vehicle')) {
    const v = M.fromVehicle(params.vehicle);
    for (const [k, val] of Object.entries(v)) if (!query.has(k)) (params as Record<string, unknown>)[k] = val;
  }
  const sl = (k: string) => M.sliders.find((s) => s.key === k)!;
  const vehicle = $derived(vehicles.find((v) => v.id === params.vehicle) ?? vehicles[1]);

  function modelParams(): CarParams {
    const base = (vehicles.find((v) => v.id === params.vehicle) ?? vehicles[1]).params;
    return {
      ...base,
      m: params.m,
      Pmax: params.P * 1000,
      Cd: params.Cd,
      A: params.A,
      rho: params.rho,
      Crr: params.Crr,
      mu: params.mu,
      eta: params.eta,
      shiftTime: params.shiftTime,
      u: params.u,
      drag: params.drag,
      roll: params.roll,
      grip: params.grip,
    };
  }

  const car = new Car(modelParams());
  const view = new View();
  const inter = new Interaction();
  const ruler = new Ruler(0, 0.2, 4.4, 0.2);
  let ctx: CanvasRenderingContext2D | null = null;
  let pal = readPalette();
  let forceScale = 1;

  function computeForceScale() {
    let f = 0.3 * car.p.m * 9.8;
    for (const v of [0.5, 5, 15]) f = Math.max(f, car.driveForce(v));
    forceScale = f;
  }

  const truck = $derived(params.vehicle === 'truck');

  function draw() {
    if (!ctx) return;
    followCar(view, car, truck);
    drawCarScene(ctx, view, car, pal, { truck, forces: params.forces, forceScale });
    ruler.draw(ctx, view, pal);
  }

  const ctrl = new SimController(
    {
      step: (dt) => car.step(dt),
      render: draw,
      sample: (t, out) => {
        const v = car.v;
        const fd = car.driveForce(v);
        out[0] = t;
        out[1] = car.x;
        out[2] = v;
        out[3] = car.accel(v);
        out[4] = fd;
        out[5] = car.dragForce(v);
        out[6] = car.rollForce(v, fd);
        out[7] = (fd * v) / 1000;
        out[8] = car.p.powertrain === 'ideal' ? NaN : car.rpm;
        out[9] = car.p.powertrain === 'ice' ? car.gear + 1 : NaN;
      },
      reset: () => {
        car.reset(modelParams());
        computeForceScale();
        // the ruler starts under the car so it measures in the car's frame of reference
        ruler.ax = car.x - (truck ? 16.5 : 4.4);
        ruler.bx = car.x;
        ruler.ay = ruler.by = -0.6;
      },
    },
    { dt: 1e-3, channels: M.channels, sampleInterval: 1 / 30, autoplay: false },
  );

  // Changing the vehicle restarts the run.
  let first = true;
  $effect(() => {
    void params.vehicle;
    void params.u;
    if (first) {
      first = false;
      return;
    }
    untrack(() => ctrl.reset());
  });
  // Other parameters apply immediately (also mid-run).
  $effect(() => {
    const p = modelParams();
    untrack(() => {
      const { u: _u, ...rest } = p;
      Object.assign(car.p, rest);
      computeForceScale();
      ctrl.invalidate();
    });
  });
  $effect(() => {
    void params.forces;
    ctrl.invalidate();
  });
  $effect(() => syncParamsToUrl($state.snapshot(params), M.defaults));
  $effect(() => {
    void theme.version;
    pal = readPalette();
    ctrl.invalidate();
  });
  ruler.attach(view, inter);
  inter.onChange = () => ctrl.invalidate();

  function applyPreset(id: string) {
    Object.assign(params, M.fromVehicle(id));
  }

  const rows = $derived.by(() => {
    void ctrl.renderCount;
    const v = car.v;
    const fd = car.driveForce(v);
    const pt = car.p.powertrain;
    const status = car.wheelspin ? 'wheelspin (grip limit)' : car.shiftLeft > 0 ? 'shifting gear' : '';
    return [
      { label: 'speed', value: (v * 3.6).toFixed(1), unit: 'km h⁻¹', strong: true },
      { label: 'v', value: fmt(v, 3), unit: 'm s⁻¹' },
      { label: 'a', value: fmt(car.accel(v), 3), unit: 'm s⁻²' },
      { label: 'x', value: fmt(car.x, 4), unit: 'm' },
      ...(pt === 'ice'
        ? [{ label: `gear ${car.gear + 1} of ${car.p.gears.length}`, value: Math.round(car.rpm).toString(), unit: 'rpm' }]
        : pt === 'ev'
          ? [{ label: 'motor', value: Math.round(car.rpm).toString(), unit: 'rpm' }]
          : []),
      { label: 'driving force', value: fmt(fd, 3), unit: 'N', color: '--series-3' },
      { label: 'power at wheels', value: fmt((fd * v) / 1000, 3), unit: 'kW', color: '--series-5' },
      { label: '0–100 km/h', value: Number.isFinite(car.t100) ? car.t100.toFixed(2) : '—', unit: 's' },
      { label: '¼ mile (402 m)', value: Number.isFinite(car.tQuarter) ? car.tQuarter.toFixed(2) : '—', unit: 's' },
      ...(status ? [{ label: 'status', value: status }] : []),
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
  presets={vehicles.map((v) => ({ id: v.id, label: v.label }))}
  onpreset={applyPreset}
  {ruler}
>
  {#snippet stage()}
    <SimCanvas
      {view}
      interaction={inter}
      label="Car acceleration simulation"
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
      <div class="veh">
        <span class="vlabel">Vehicle</span>
        <select bind:value={params.vehicle} onchange={() => applyPreset(params.vehicle)}>
          {#each vehicles as v (v.id)}<option value={v.id}>{v.label}</option>{/each}
        </select>
        <p class="vdesc">
          {vehicle.description}{#if vehicle.params.powertrain === 'ice'}
            · {vehicle.params.gears.length} gears{/if}
        </p>
      </div>
      <Slider def={sl('m')} bind:value={params.m} />
      <Slider def={sl('P')} bind:value={params.P} />
      <Slider def={sl('u')} bind:value={params.u} />
      <div class="group">
        <Toggle label="Tyre grip limit" hint="F_f ≤ μ_s F_N on the driven wheels" bind:checked={params.grip} />
        <Slider def={sl('mu')} bind:value={params.mu} disabled={!params.grip} />
      </div>
      <div class="group">
        <Toggle label="Air resistance" hint="F = ½ρC_dAv²" bind:checked={params.drag} />
        <Slider def={sl('Cd')} bind:value={params.Cd} disabled={!params.drag} />
        <Slider def={sl('A')} bind:value={params.A} disabled={!params.drag} />
        <Slider def={sl('rho')} bind:value={params.rho} disabled={!params.drag} />
      </div>
      <div class="group">
        <Toggle label="Rolling resistance" hint="F = C_rr·mg" bind:checked={params.roll} />
        <Slider def={sl('Crr')} bind:value={params.Crr} disabled={!params.roll} />
      </div>
      <Slider def={sl('eta')} bind:value={params.eta} />
      {#if vehicle.params.powertrain === 'ice'}<Slider def={sl('shiftTime')} bind:value={params.shiftTime} />{/if}
      <div class="group">
        <Toggle label="Force arrows" hint="Lengths proportional to force" bind:checked={params.forces} />
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
  .veh {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .vlabel {
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
  }
  .vdesc {
    font-size: var(--text-xs);
    color: var(--text-3);
  }
  .group {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    padding-top: var(--space-3);
    border-top: 1px solid var(--border);
  }
</style>
