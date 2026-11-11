<script lang="ts">
  import { onMount } from 'svelte';
  import SimShell from '../../sim/SimShell.svelte';
  import SimCanvas from '../../sim/SimCanvas.svelte';
  import Readouts from '../../sim/Readouts.svelte';
  import Slider from '../../ui/Slider.svelte';
  import Toggle from '../../ui/Toggle.svelte';
  import { SimController } from '../../sim/controller.svelte';
  import { useParams, usePalette, resetOn } from '../../sim/setup.svelte';
  import { View } from '../../sim/view';
  import { Interaction } from '../../sim/interaction';
  import type { SimEntry } from '../../app/registry';
  import type { NumberParamDef } from '../../sim/params.svelte';
  import type { SimInfo, GraphDef } from '../../sim/types';
  import type { ChannelDef } from '../../core/recorder';
  import { NBody, figureEight } from '../../physics/nbody';
  import { AU, G } from '../../core/constants';
  import { drawArrow, drawTag } from '../../sim/draw';
  import { fmt } from '../../core/format';

  let { entry }: { entry: SimEntry } = $props();
  const sliders: NumberParamDef[] = [{ key: 'm', label: 'Mass of a new body', symbol: 'm', unit: 'M☉', min: 0.001, max: 2, step: 0.001, log: true }];
  const { params, sl } = useParams({ preset: 'eight', m: 0.01, trails: true }, sliders);
  const MS = 1.989e30;
  const YEAR = 3.156e7;
  const presets = [
    { id: 'eight', label: 'Figure-eight (three equal stars)', values: { preset: 'eight' } },
    { id: 'binary', label: 'Binary star', values: { preset: 'binary' } },
    { id: 'planets', label: 'Star with three planets', values: { preset: 'planets' } },
    { id: 'empty', label: 'Empty: build your own', values: { preset: 'empty' } },
  ];
  const channels: ChannelDef[] = [
    { key: 't', label: 't', unit: 'years' },
    { key: 'dE', label: 'relative change of total energy', unit: '10⁻⁹', color: '--series-4' },
  ];
  const graphs: GraphDef[] = [{ id: 'dE', title: 'Energy conservation check', series: ['dE'] }];
  const info: SimInfo = {
    about: [
      'Every body attracts every other body with F = Gm₁m₂/r². With two bodies the motion is a pair of ellipses round their common centre of mass; with three or more it is usually chaotic — tiny changes in the start grow into completely different paths.',
      'Some special three-body orbits are periodic, such as the figure-eight, where three equal stars chase each other along the same curve.',
      'Total momentum and total energy stay constant. When bodies collide they merge: momentum is conserved, but kinetic energy is lost (an inelastic collision).',
      'Build your own system: drag on empty space to launch a new body (the drag sets its velocity).',
    ],
    formulas: [
      { label: 'Newton’s law of gravitation', tex: 'F = G\\dfrac{m_1m_2}{r^{2}}' },
      { label: 'Gravitational potential energy', tex: 'E_p = -\\dfrac{Gm_1m_2}{r}', hl: true },
      { label: 'Total momentum (conserved)', tex: '\\sum m\\vec{v} = \\text{constant}' },
    ],
    assumptions: [
      'Point masses in a plane; Newtonian gravity; bodies merge when their (drawn) spheres touch.',
      '4th-order symplectic integration with a step that shortens during close encounters. One year takes 2 s of animation.',
      'Figure-eight initial conditions: C. Moore (1993), A. Chenciner & R. Montgomery (2000).',
    ],
    tryThis: [
      'Binary star: where is the centre of mass? Does it move?',
      'Add a small body to the figure-eight. Does the orbit survive?',
      'Launch a planet round the star at different speeds and compare the orbits.',
    ],
  };

  const view = new View();
  const inter = new Interaction();
  let ctx: CanvasRenderingContext2D | null = null;
  let sim = new NBody();
  let E0 = 0;
  const TRAIL = 600;
  let trails: Float32Array[] = [];
  let trailLen = 0;
  let trailHead = 0;
  let drag: { x0: number; y0: number; x1: number; y1: number } | null = $state(null);

  function load() {
    sim = new NBody();
    const vc = (M: number, r: number) => Math.sqrt((G * M) / r);
    if (params.preset === 'eight') figureEight(AU, MS).bodies.forEach((b) => sim.add(b));
    else if (params.preset === 'binary') {
      const d = AU;
      const M = MS;
      const v = 0.5 * vc(2 * M, d);
      sim.add({ x: -d / 2, y: 0, vx: 0, vy: -v, m: M, r: 0.02 * AU });
      sim.add({ x: d / 2, y: 0, vx: 0, vy: v, m: M, r: 0.02 * AU });
    } else if (params.preset === 'planets') {
      sim.add({ x: 0, y: 0, vx: 0, vy: 0, m: MS, r: 0.03 * AU });
      for (const [r, m] of [[0.6, 3e-6], [1.0, 3e-6], [1.6, 1e-3]] as [number, number][]) sim.add({ x: r * AU, y: 0, vx: 0, vy: vc(MS, r * AU), m: m * MS, r: 0.01 * AU });
    }
    E0 = sim.energy;
    trails = sim.bodies.map(() => new Float32Array(2 * TRAIL));
    trailLen = 0;
    trailHead = 0;
  }
  load();

  const fitView = () => view.fit(-2 * AU, 2 * AU, -1.4 * AU, 1.4 * AU, 16, 16);
  inter.add({
    priority: 1,
    cursor: 'crosshair',
    hit: () => 0,
    start: (px, py) => {
      drag = { x0: px, y0: py, x1: px, y1: py };
    },
    move: (px, py) => {
      if (drag) drag = { ...drag, x1: px, y1: py };
    },
    end: () => {
      if (!drag) return;
      const x = view.wx(drag.x0);
      const y = view.wy(drag.y0);
      // drag length → velocity: 100 px ≈ 30 km/s
      const vx = ((drag.x1 - drag.x0) / 100) * 3e4;
      const vy = (-(drag.y1 - drag.y0) / 100) * 3e4;
      const m = params.m * MS;
      sim.add({ x, y, vx, vy, m, r: 0.012 * AU * Math.cbrt(m / (0.01 * MS)) });
      trails.push(new Float32Array(2 * TRAIL));
      E0 = sim.energy;
      drag = null;
      ctrl.invalidate();
    },
  });

  function draw() {
    if (!ctx) return;
    const pal = palette.pal;
    const W = view.width;
    const H = view.height;
    ctx.fillStyle = pal.bg;
    ctx.fillRect(0, 0, W, H);
    const cols = [pal.series[0], pal.series[1], pal.series[2], pal.series[3], pal.series[4], pal.series[5]];
    if (params.trails && trails.length === sim.bodies.length) {
      trails.forEach((tr, i) => {
        ctx!.strokeStyle = cols[i % cols.length];
        ctx!.globalAlpha = 0.5;
        ctx!.beginPath();
        for (let k = 0; k < trailLen; k++) {
          const idx = (trailHead - trailLen + k + TRAIL) % TRAIL;
          const px = view.sx(tr[2 * idx]);
          const py = view.sy(tr[2 * idx + 1]);
          if (k === 0) ctx!.moveTo(px, py);
          else ctx!.lineTo(px, py);
        }
        ctx!.stroke();
        ctx!.globalAlpha = 1;
      });
    }
    sim.bodies.forEach((b, i) => {
      ctx!.fillStyle = cols[i % cols.length];
      ctx!.beginPath();
      ctx!.arc(view.sx(b.x), view.sy(b.y), Math.max(3, b.r * view.scale), 0, Math.PI * 2);
      ctx!.fill();
    });
    // centre of mass
    let M = 0;
    let cx = 0;
    let cy = 0;
    for (const b of sim.bodies) {
      M += b.m;
      cx += b.m * b.x;
      cy += b.m * b.y;
    }
    if (M > 0) {
      ctx.strokeStyle = pal.text2;
      const X = view.sx(cx / M);
      const Y = view.sy(cy / M);
      ctx.beginPath();
      ctx.moveTo(X - 6, Y);
      ctx.lineTo(X + 6, Y);
      ctx.moveTo(X, Y - 6);
      ctx.lineTo(X, Y + 6);
      ctx.stroke();
      drawTag(ctx, X + 30, Y + 12, 'centre of mass', pal.text3, pal.surface);
    }
    if (drag) drawArrow(ctx, drag.x0, drag.y0, drag.x1, drag.y1, pal.ink, 'v', 2);
    ctx.fillStyle = pal.text3;
    ctx.font = '500 10px Inter Variable, system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText(`1 AU = ${Math.round(AU * view.scale)} px · bodies not to scale`, 10, H - 70);
  }

  const ctrl: SimController = new SimController(
    {
      step: (dt) => {
        if (!sim.bodies.length) return;
        const before = sim.bodies.length;
        sim.advance(dt * YEAR * 0.5);
        if (sim.bodies.length !== before) {
          trails = sim.bodies.map(() => new Float32Array(2 * TRAIL));
          trailLen = 0;
          trailHead = 0;
          E0 = sim.energy;
        }
        sim.bodies.forEach((b, i) => {
          trails[i][2 * trailHead] = b.x;
          trails[i][2 * trailHead + 1] = b.y;
        });
        trailHead = (trailHead + 1) % TRAIL;
        trailLen = Math.min(TRAIL, trailLen + 1);
      },
      render: draw,
      sample: (_t, out) => {
        out[0] = sim.t / YEAR;
        out[1] = E0 !== 0 ? ((sim.energy - E0) / Math.abs(E0)) * 1e9 : 0;
      },
      reset: () => load(),
    },
    { dt: 1 / 120, channels, sampleInterval: 1 / 15, autoplay: true },
  );
  const palette = usePalette(() => ctrl);
  resetOn(ctrl, () => [params.preset]);
  inter.onChange = () => ctrl.invalidate();

  const rows = $derived.by(() => {
    void ctrl.renderCount;
    const [px, py] = sim.momentum;
    return [
      { label: 'bodies', value: `${sim.bodies.length}` },
      { label: 'time', value: fmt(sim.t / YEAR, 3), unit: 'years' },
      { label: 'total energy', value: fmt(sim.energy, 4), unit: 'J' },
      { label: 'total momentum', value: fmt(Math.hypot(px, py), 3), unit: 'kg m s⁻¹' },
      { label: 'merges', value: `${sim.merges}` },
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
  initialGraphs={['dE']}
  {presets}
  onpreset={(id) => Object.assign(params, presets.find((q) => q.id === id)?.values ?? {})}
  stopwatch={false}
  shortcuts={false}
>
  {#snippet stage()}
    <SimCanvas
      {view}
      interaction={inter}
      label="N-body gravity sandbox"
      onready={(c2) => {
        ctx = c2;
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
      <Slider def={sl('m')} bind:value={params.m} />
      <Toggle label="Trails" bind:checked={params.trails} />
      <p class="tip">Drag on empty space to launch a body: the arrow sets its velocity.</p>
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
