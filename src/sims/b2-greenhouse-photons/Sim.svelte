<script lang="ts">
  import { onMount } from 'svelte';
  import SimShell from '../../sim/SimShell.svelte';
  import SimCanvas from '../../sim/SimCanvas.svelte';
  import Readouts from '../../sim/Readouts.svelte';
  import Slider from '../../ui/Slider.svelte';
  import { SimController } from '../../sim/controller.svelte';
  import { useParams, usePalette } from '../../sim/setup.svelte';
  import { View } from '../../sim/view';
  import type { SimEntry } from '../../app/registry';
  import type { NumberParamDef } from '../../sim/params.svelte';
  import type { SimInfo, GraphDef } from '../../sim/types';
  import type { ChannelDef } from '../../core/recorder';
  import { GreenhouseBox, MAX_PHOTONS, W_PER_RATE } from '../../physics/greenhousePhotons';
  import { alpha } from '../../sim/palette';
  import { drawTag } from '../../sim/draw';
  import { fmt } from '../../core/format';

  let { entry }: { entry: SimEntry } = $props();
  const sliders: NumberParamDef[] = [
    { key: 'n', label: 'Greenhouse gas molecules', symbol: 'N', unit: '', min: 0, max: 80, step: 1 },
    { key: 'a', label: 'Albedo', symbol: 'α', unit: '', min: 0, max: 0.9, step: 0.01 },
  ];
  const { params, sl } = useParams({ n: 30, a: 0.3 }, sliders);
  const presets = [
    { id: 'none', label: 'No greenhouse gases', values: { n: 0, a: 0.3 } },
    { id: 'some', label: 'Some greenhouse gases', values: { n: 30, a: 0.3 } },
    { id: 'more', label: 'More greenhouse gases', values: { n: 70, a: 0.3 } },
    { id: 'ice', label: 'Bright, icy surface', values: { n: 30, a: 0.6 } },
  ];
  const channels: ChannelDef[] = [
    { key: 't', label: 't', unit: 's' },
    { key: 'T', label: 'ground temperature', unit: 'K', color: '--series-4' },
    { key: 'in', label: 'sunlight in at the top', unit: 'W m⁻²', color: '--series-3' },
    { key: 'out', label: 'reflected + infrared out at the top', unit: 'W m⁻²', color: '--series-1' },
  ];
  const graphs: GraphDef[] = [
    { id: 'T', title: 'Ground temperature', series: ['T'] },
    { id: 'P', title: 'Top of the atmosphere (10 s average)', series: ['in', 'out'] },
  ];
  const info: SimInfo = {
    about: [
      'Yellow arrows are packets of sunlight (mostly visible light). Some are reflected by the bright surface (albedo); the rest are absorbed and warm the ground.',
      'The warm ground radiates infrared (red arrows). The hotter it is, the more it emits (σT⁴).',
      'Greenhouse gas molecules such as CO₂, H₂O and CH₄ let visible light pass but absorb infrared. Each excited molecule soon emits the energy again in a random direction — about half of it back towards the ground.',
      'With more greenhouse molecules less infrared escapes at first, so the ground gains energy and warms up until it emits enough for the outgoing power at the top to equal the incoming power again. The new balance is at a higher temperature.',
    ],
    formulas: [
      { label: 'Power emitted by the ground', tex: 'P = \\sigma A T^{4}' },
      { label: 'Albedo', tex: '\\alpha = \\dfrac{\\text{total scattered power}}{\\text{total incident power}}' },
      { label: 'Balance at the top (steady state)', tex: 'P_\\text{in} = P_\\text{reflected} + P_\\text{infrared out}', beyond: true },
    ],
    assumptions: [
      'A qualitative model: each arrow is a packet with the same energy. Real infrared photons carry less energy than visible ones, and real molecules number about 10²⁵ per m³.',
      'Incoming sunlight stands for S/4 = 340 W m⁻² averaged over the planet. The ground radiates as a black body; its temperature is the one that gives its emission rate through σT⁴.',
      'Molecules absorb every infrared packet that comes close while they are not already excited, and re-emit after a short random delay in a random direction. Clouds and convection are left out.',
      'The run starts from the balance without greenhouse gases (about 255 K). Distances, speeds and times are not to scale; the ground heats up much faster than a real planet. Random processes use a seeded random-number generator.',
    ],
    tryThis: [
      'Start with no greenhouse gases: what temperature does the ground settle at? (Compare with 255 K.)',
      'Add molecules while it runs. Watch the outgoing power at the top first drop, then recover as the ground warms.',
      'Where do the red arrows that come back down to the ground come from?',
    ],
  };

  const view = new View();
  let ctx: CanvasRenderingContext2D | null = null;
  const fresh = () => {
    const b = new GreenhouseBox(params.a, params.n);
    b.warmUp(20);
    return b;
  };
  let box = fresh();
  // 10 s moving averages of the power at the top
  let rateIn = 340 / W_PER_RATE; // packets per second
  let rateOut = 340 / W_PER_RATE;
  let lastIn = 0;
  let lastOut = 0;
  $effect(() => {
    box.albedo = params.a;
    box.setMolecules(params.n);
  });

  function draw() {
    if (!ctx) return;
    const pal = palette.pal;
    const W = view.width;
    const usable = view.height - 76;
    ctx.fillStyle = pal.bg;
    ctx.fillRect(0, 0, W, view.height);
    const x0 = 16;
    const x1 = W > 760 ? W - 270 : W - 16;
    const y0 = 40;
    const y1 = usable - 30;
    const X = (x: number) => x0 + x * (x1 - x0);
    const Y = (y: number) => y1 - y * (y1 - y0);
    // layers
    ctx.fillStyle = alpha(pal.series[0].startsWith('#') ? pal.series[0] : '#3b82f6', 0.07);
    ctx.fillRect(X(0), Y(0.78), x1 - x0, Y(0.12) - Y(0.78));
    ctx.fillStyle = pal.text3;
    ctx.font = '600 11px Inter Variable, system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText('SPACE', X(0) + 6, Y(1) - 4);
    ctx.fillText('ATMOSPHERE', X(0) + 6, Y(0.78) + 16);
    ctx.strokeStyle = pal.gridStrong;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(X(0), Y(1));
    ctx.lineTo(X(1), Y(1));
    ctx.stroke();
    ctx.setLineDash([]);
    // ground coloured by temperature
    const hot = pal.series[3].startsWith('#') ? pal.series[3] : '#e11d48';
    ctx.fillStyle = pal.text3;
    ctx.fillRect(X(0), Y(0), x1 - x0, 26);
    ctx.fillStyle = alpha(hot, Math.max(0, Math.min(0.9, (box.T - 230) / 120)));
    ctx.fillRect(X(0), Y(0), x1 - x0, 26);
    drawTag(ctx, (x0 + x1) / 2, Y(0) + 13, `ground ${box.T.toFixed(0)} K`, pal.ink, pal.surface);
    // molecules
    const mol = pal.series[4];
    for (let m = 0; m < box.nMol; m++) {
      const ex = box.excited[m] > 0;
      ctx.fillStyle = ex ? hot : mol;
      ctx.beginPath();
      ctx.arc(X(box.mx[m]), Y(box.my[m]), ex ? 6 : 4.5, 0, Math.PI * 2);
      ctx.fill();
    }
    // photons as short streaks
    const sun = pal.hl;
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    for (let i = 0; i < MAX_PHOTONS; i++) {
      if (!box.alive[i]) continue;
      const n = Math.hypot(box.dx[i], box.dy[i]);
      const ux = box.dx[i] / n;
      const uy = box.dy[i] / n;
      const px = X(box.px[i]);
      const py = Y(box.py[i]);
      ctx.strokeStyle = box.kind[i] === 0 ? sun : hot;
      ctx.beginPath();
      ctx.moveTo(px - ux * 12, py + uy * 12);
      ctx.lineTo(px, py);
      ctx.stroke();
    }
    ctx.lineCap = 'butt';
    ctx.lineWidth = 1;
    // legend
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = '500 11px Inter Variable, system-ui, sans-serif';
    const lx = W > 760 ? x1 + 24 : x0 + 8;
    const ly = W > 760 ? 180 : y0 - 22;
    const items: [string, string][] = [
      [sun, 'sunlight (visible)'],
      [hot, 'infrared'],
      [mol, 'greenhouse molecule'],
    ];
    items.forEach(([col, text], i) => {
      const yy = W > 760 ? ly + i * 20 : ly;
      const xx = W > 760 ? lx : lx + i * 120;
      ctx!.fillStyle = col;
      ctx!.fillRect(xx, yy - 2, 14, 4);
      ctx!.fillStyle = pal.text2;
      ctx!.fillText(text, xx + 20, yy);
    });
  }

  const ctrl: SimController = new SimController(
    {
      step: (dt) => {
        box.step(dt);
        const k = dt / 10;
        rateIn += ((box.sunIn - lastIn) / dt - rateIn) * k;
        const out = box.reflectedOut + box.irOut;
        rateOut += ((out - lastOut) / dt - rateOut) * k;
        lastIn = box.sunIn;
        lastOut = out;
      },
      render: draw,
      sample: (t, out) => {
        out[0] = t;
        out[1] = box.T;
        out[2] = rateIn * W_PER_RATE;
        out[3] = rateOut * W_PER_RATE;
      },
      reset: () => {
        box = fresh();
        rateIn = 340 / W_PER_RATE;
        rateOut = 340 / W_PER_RATE;
        lastIn = 0;
        lastOut = 0;
      },
    },
    { dt: 1 / 120, channels, sampleInterval: 0.25, autoplay: true },
  );
  const palette = usePalette(() => ctrl);

  const rows = $derived.by(() => {
    void ctrl.renderCount;
    return [
      { label: 'ground temperature', value: box.T.toFixed(0), unit: 'K', color: '--series-4', strong: true },
      { label: 'in at the top (10 s avg)', value: fmt(rateIn * W_PER_RATE, 3), unit: 'W m⁻²' },
      { label: 'out at the top (10 s avg)', value: fmt(rateOut * W_PER_RATE, 3), unit: 'W m⁻²' },
      { label: 'infrared caught by molecules', value: `${box.absorbedByMolecules}` },
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
  {graphs}
  initialGraphs={['T', 'P']}
  {presets}
  onpreset={(id) => Object.assign(params, presets.find((p) => p.id === id)?.values ?? {})}
  stopwatch={false}
>
  {#snippet stage()}
    <SimCanvas
      {view}
      label="Photons of sunlight and infrared meeting greenhouse gas molecules"
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
      <Slider def={sl('n')} bind:value={params.n} />
      <Slider def={sl('a')} bind:value={params.a} />
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
