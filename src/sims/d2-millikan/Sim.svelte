<script lang="ts">
  import { onMount } from 'svelte';
  import SimShell from '../../sim/SimShell.svelte';
  import SimCanvas from '../../sim/SimCanvas.svelte';
  import Readouts from '../../sim/Readouts.svelte';
  import Slider from '../../ui/Slider.svelte';
  import RecordTable from '../../sim/RecordTable.svelte';
  import { SimController } from '../../sim/controller.svelte';
  import { useParams, usePalette, resetOn } from '../../sim/setup.svelte';
  import { View } from '../../sim/view';
  import { Interaction } from '../../sim/interaction';
  import type { SimEntry } from '../../app/registry';
  import type { NumberParamDef } from '../../sim/params.svelte';
  import type { SimInfo } from '../../sim/types';
  import { stepDrop, terminalVelocity, dropMassEff, type Drop } from '../../physics/millikan';
  import { Rng } from '../../core/rng';
  import { e, g } from '../../core/constants';
  import { drawArrow, drawTag } from '../../sim/draw';
  import { fmt } from '../../core/format';

  let { entry }: { entry: SimEntry } = $props();
  const sliders: NumberParamDef[] = [
    { key: 'V', label: 'Voltage between the plates', symbol: 'V', unit: 'V', min: 0, max: 3000, step: 1 },
    { key: 'd', label: 'Plate separation', symbol: 'd', unit: 'mm', min: 2, max: 10, step: 0.5 },
  ];
  const { params, sl } = useParams({ V: 0, d: 5, seed: 1 }, sliders);
  const presets = [
    { id: 'fall', label: 'No voltage: drops fall', values: { V: 0, d: 5 } },
    { id: 'new', label: 'New set of drops', values: { V: 0, seed: 2 } },
  ];
  const info: SimInfo = {
    about: [
      'Two parallel metal plates with a potential difference V between them, a distance d apart, have a uniform electric field E = V/d between them. A charged particle there feels a constant force qE.',
      'Millikan sprayed tiny oil drops between such plates. Some drops pick up extra electrons. Adjusting V until a drop hovers balances the forces: qE = mg, so q = mgd/V.',
      'Every charge he measured was a whole-number multiple of one smallest charge, e = 1.6 × 10⁻¹⁹ C: electric charge is quantised.',
      'Tap a drop to select it, adjust the voltage until it stops, then record. (The mass of each drop is found from how fast it falls with the field off.)',
    ],
    formulas: [
      { label: 'Field between parallel plates', tex: 'E = \\dfrac{V}{d}' },
      { label: 'Electric force', tex: 'F = qE' },
      { label: 'Hovering drop', tex: 'qE = mg \\;\\Rightarrow\\; q = \\dfrac{mgd}{V}', beyond: true },
      { label: 'Drag on a small sphere (Stokes)', tex: 'F_d = 6\\pi\\eta r v', beyond: true },
    ],
    assumptions: [
      'Oil density 875 kg m⁻³, air density 1.2 kg m⁻³ (buoyancy included in m), air viscosity 1.81 × 10⁻⁵ Pa s. Drop radii 0.5–1.1 μm, each with 1–6 extra electrons.',
      'The drops reach their terminal velocity within microseconds; motion is calculated exactly. Time is sped up 20 times; drops are drawn much larger than to scale.',
      'The top plate is positive, so the field points down and pushes the (negative) drops up.',
    ],
    tryThis: [
      'Find the hover voltage of three different drops and calculate their charges. Are they multiples of e?',
      'Halve the plate separation. What voltage is now needed for the same drop?',
      'Which drops need a higher voltage to hover — big or small ones?',
    ],
  };

  const N = 6;
  let drops: Drop[] = [];
  let selected = $state(0);
  let points: { x: number; y: number }[] = $state([]);
  function makeDrops() {
    const rng = new Rng(params.seed);
    drops = Array.from({ length: N }, () => ({ r: rng.uniform(0.5e-6, 1.1e-6), n: 1 + Math.floor(rng.next() * 6), y: rng.uniform(0.3, 0.95) * params.d * 1e-3, v: 0 }));
  }
  makeDrops();
  const E = () => params.V / (params.d * 1e-3);
  const SPEED = 20;

  const view = new View();
  const inter = new Interaction();
  let ctx: CanvasRenderingContext2D | null = null;
  const geo = { x0: 0, x1: 1, top: 0, bot: 1 };
  const dropX = (i: number) => geo.x0 + ((i + 0.5) / N) * (geo.x1 - geo.x0);
  const dropY = (d: Drop) => geo.bot - (d.y / (params.d * 1e-3)) * (geo.bot - geo.top);
  inter.add({
    priority: 10,
    cursor: 'pointer',
    hit: (px, py) => {
      let best = Infinity;
      drops.forEach((d, i) => (best = Math.min(best, Math.hypot(px - dropX(i), py - dropY(d)))));
      return best < 30 ? best : Infinity;
    },
    start: (px, py) => {
      let k = 0;
      let bd = Infinity;
      drops.forEach((d, i) => {
        const dd = Math.hypot(px - dropX(i), py - dropY(d));
        if (dd < bd) {
          bd = dd;
          k = i;
        }
      });
      selected = k;
    },
    move: () => {},
  });

  function draw() {
    if (!ctx) return;
    const pal = palette.pal;
    const W = view.width;
    const usable = view.height - 76;
    ctx.fillStyle = pal.bg;
    ctx.fillRect(0, 0, W, view.height);
    geo.x0 = 60;
    geo.x1 = W > 760 ? W - 300 : W - 40;
    geo.top = 50;
    geo.bot = usable - 30;
    // plates
    ctx.fillStyle = pal.series[3];
    ctx.fillRect(geo.x0 - 20, geo.top - 12, geo.x1 - geo.x0 + 40, 10);
    ctx.fillStyle = pal.series[0];
    ctx.fillRect(geo.x0 - 20, geo.bot + 2, geo.x1 - geo.x0 + 40, 10);
    drawTag(ctx, geo.x0 - 4, geo.top - 26, `+ ${params.V.toFixed(0)} V`, pal.series[3], pal.surface);
    drawTag(ctx, geo.x0 - 4, geo.bot + 26, '0 V', pal.series[0], pal.surface);
    // field lines (uniform, downward)
    if (params.V > 0) {
      ctx.strokeStyle = pal.grid;
      for (let x = geo.x0 + 20; x < geo.x1; x += 60) drawArrow(ctx, x, geo.top + 6, x, geo.bot - 6, pal.gridStrong, undefined, 1);
    }
    drops.forEach((d, i) => {
      const x = dropX(i);
      const y = dropY(d);
      const rr = 4 + (d.r / 1.1e-6) * 6;
      ctx!.fillStyle = i === selected ? pal.series[1] : pal.hl;
      ctx!.beginPath();
      ctx!.arc(x, y, rr, 0, Math.PI * 2);
      ctx!.fill();
      if (i === selected) {
        ctx!.strokeStyle = pal.ink;
        ctx!.lineWidth = 2;
        ctx!.beginPath();
        ctx!.arc(x, y, rr + 5, 0, Math.PI * 2);
        ctx!.stroke();
        ctx!.lineWidth = 1;
      }
      if (i === selected) drawTag(ctx!, x + 60, y, `r = ${(d.r * 1e6).toFixed(2)} μm`, pal.ink, pal.surface);
    });
  }

  const ctrl: SimController = new SimController(
    {
      step: (dt) => {
        const dd = params.d * 1e-3;
        for (const d of drops) {
          stepDrop(d, E(), dt * SPEED);
          // keep the drop between the plates (it sticks to a plate it reaches)
          if (d.y < 0) {
            d.y = 0;
            d.v = 0;
          }
          if (d.y > dd) {
            d.y = dd;
            d.v = 0;
          }
        }
      },
      render: draw,
      reset: () => makeDrops(),
    },
    { dt: 1 / 120, autoplay: true },
  );
  const palette = usePalette(() => ctrl);
  resetOn(ctrl, () => [params.seed, params.d]);
  inter.onChange = () => ctrl.invalidate();

  const rows = $derived.by(() => {
    void ctrl.renderCount;
    const d = drops[selected];
    const m = dropMassEff(d.r);
    const vt = terminalVelocity(d.r, d.n * e, E());
    return [
      { label: 'field E = V/d', value: fmt(E(), 3), unit: 'V m⁻¹', strong: true },
      { label: 'selected drop: mass', value: fmt(m, 3), unit: 'kg' },
      { label: 'weight mg', value: fmt(m * g, 3), unit: 'N' },
      { label: 'velocity (+ down)', value: fmt(vt * 1e6, 3), unit: 'μm s⁻¹', strong: true },
      { label: 'q = mgd/V (if hovering)', value: params.V > 0 ? fmt((m * g * params.d * 1e-3) / params.V, 3) : '—', unit: 'C' },
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
  {info}
  graphs={[]}
  {presets}
  onpreset={(id) => Object.assign(params, presets.find((q) => q.id === id)?.values ?? {})}
  stopwatch={false}
>
  {#snippet stage()}
    <SimCanvas
      {view}
      interaction={inter}
      label="Oil drops between charged parallel plates"
      onready={(c2) => {
        ctx = c2;
        ctrl.invalidate();
      }}
      onresize={() => ctrl.invalidate()}
    />
  {/snippet}
  {#snippet readouts()}<Readouts {rows} />{/snippet}
  {#snippet controls()}
    <div class="controls">
      <Slider def={sl('V')} bind:value={params.V} />
      <Slider def={sl('d')} bind:value={params.d} />
      <RecordTable
        {points}
        xLabel="drop r / μm"
        yLabel="q / e"
        onrecord={() => {
          const d = drops[selected];
          if (params.V > 0) points = [...points, { x: d.r * 1e6, y: (dropMassEff(d.r) * g * params.d * 1e-3) / params.V / e }];
        }}
        onclear={() => (points = [])}
      />
      <p class="tip">Record only when the selected drop has stopped moving.</p>
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
