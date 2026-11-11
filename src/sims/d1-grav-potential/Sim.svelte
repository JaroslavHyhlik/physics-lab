<script lang="ts">
  import { onMount } from 'svelte';
  import SimShell from '../../sim/SimShell.svelte';
  import SimCanvas from '../../sim/SimCanvas.svelte';
  import Readouts from '../../sim/Readouts.svelte';
  import Slider from '../../ui/Slider.svelte';
  import Toggle from '../../ui/Toggle.svelte';
  import { SimController } from '../../sim/controller.svelte';
  import { useParams, usePalette, redrawOn } from '../../sim/setup.svelte';
  import { View } from '../../sim/view';
  import { Interaction } from '../../sim/interaction';
  import type { SimEntry } from '../../app/registry';
  import type { NumberParamDef } from '../../sim/params.svelte';
  import type { SimInfo } from '../../sim/types';
  import { gField, gPotential, neutralPoint, type Mass } from '../../physics/gravField';
  import { contours } from '../../physics/charges';
  import { alpha } from '../../sim/palette';
  import { drawArrow, drawTag } from '../../sim/draw';
  import { fmt } from '../../core/format';

  let { entry }: { entry: SimEntry } = $props();
  const sliders: NumberParamDef[] = [{ key: 'M2', label: 'Mass of the second body', symbol: 'M_2', unit: 'Earth masses', min: 0.0123, max: 2, step: 0.0001, log: true }];
  const { params, sl } = useParams({ setup: 'em', M2: 0.0123, arrows: true, map: true }, sliders);
  const ME = 5.97e24;
  const D = 3.84e8;
  const presets = [
    { id: 'one', label: 'One planet (Earth)', values: { setup: 'one' } },
    { id: 'em', label: 'Earth and Moon: neutral point', values: { setup: 'em', M2: 0.0123 } },
    { id: 'twin', label: 'Two equal masses', values: { setup: 'em', M2: 1 } },
  ];
  const info: SimInfo = {
    about: [
      'Every mass creates a gravitational field around it: a mass m placed there feels a force mg towards it. The field strength g = GM/r² falls off with the square of the distance. Fields of several masses add as vectors (superposition).',
      'The gravitational potential V_g = −GM/r is the work done per kilogram to bring a mass from infinity to that point. It is negative everywhere and lowest close to the masses (the dark wells in the map).',
      'Equipotentials join points of equal potential. The field is always perpendicular to them and points “downhill”, towards lower potential: g = −ΔV_g/Δr. Where equipotentials are close together the field is strong.',
      'Between the Earth and the Moon there is a point where their pulls cancel (g = 0), about 90 % of the way to the Moon.',
    ],
    formulas: [
      { label: 'Field strength', tex: 'g = \\dfrac{F}{m} = \\dfrac{GM}{r^{2}}' },
      { label: 'Gravitational potential', tex: 'V_g = -\\dfrac{GM}{r}', hl: true },
      { label: 'Field and potential gradient', tex: 'g = -\\dfrac{\\Delta V_g}{\\Delta r}', hl: true },
      { label: 'Work to move a mass', tex: 'W = m\\Delta V_g', hl: true },
    ],
    assumptions: [
      'Point masses (spheres) at rest; the Moon’s mass is 0.0123 Earth masses and its distance 3.84 × 10⁸ m (NASA fact sheets).',
      'Arrows show the direction of g; their length grows with the logarithm of g (not to scale). The bodies are drawn much larger than to scale.',
    ],
    tryThis: [
      'Drag the probe along the line from the Earth to the Moon and find where g = 0. Compare with r₁/r₂ = √(M₁/M₂).',
      'Is the potential zero at the neutral point? Why not?',
      'Move the probe along an equipotential: does the potential change? Is any work done?',
    ],
  };

  let masses: Mass[] = $state([]);
  let probe = $state({ x: 2.2e8, y: 0.6e8 });
  function setup() {
    masses = params.setup === 'one' ? [{ x: 1.9e8, y: 0, M: ME }] : [{ x: 0, y: 0, M: ME }, { x: D, y: 0, M: params.M2 * ME }];
  }
  setup();
  $effect(() => {
    void [params.setup, params.M2];
    setup();
  });

  const view = new View();
  const inter = new Interaction();
  let ctx: CanvasRenderingContext2D | null = null;
  const fitView = () => view.fit(-0.6e8, 4.4e8, -1.6e8, 1.6e8, 16, 16);
  inter.add({
    priority: 10,
    cursor: 'grab',
    hit: (px, py) => {
      const d = Math.hypot(px - view.sx(probe.x), py - view.sy(probe.y));
      return d < 30 ? d / 2 : Infinity;
    },
    move: (px, py) => {
      probe = { x: view.wx(px), y: view.wy(py) };
    },
  });
  inter.add({
    priority: 5,
    cursor: 'grab',
    hit: (px, py) => {
      let b = Infinity;
      for (const m of masses) b = Math.min(b, Math.hypot(px - view.sx(m.x), py - view.sy(m.y)));
      return b < 30 ? b : Infinity;
    },
    move: (px, py) => {
      let k = 0;
      let bd = Infinity;
      masses.forEach((m, i) => {
        const d = Math.hypot(px - view.sx(m.x), py - view.sy(m.y));
        if (d < bd) {
          bd = d;
          k = i;
        }
      });
      masses[k] = { ...masses[k], x: view.wx(px), y: view.wy(py) };
    },
  });

  const hexRgb = (c: string, fb: [number, number, number]): [number, number, number] =>
    c.startsWith('#') && c.length >= 7 ? [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)] : fb;

  function draw() {
    if (!ctx) return;
    const pal = palette.pal;
    const W = view.width;
    const H = view.height;
    ctx.fillStyle = pal.bg;
    ctx.fillRect(0, 0, W, H);
    const b = { x0: view.wx(0), x1: view.wx(W), y0: view.wy(H), y1: view.wy(0) };
    const nx = 160;
    const ny = Math.max(40, Math.round((nx * H) / W));
    const grid = new Float64Array(nx * ny);
    let vmin = Infinity;
    for (let j = 0; j < ny; j++)
      for (let i = 0; i < nx; i++) {
        const x = b.x0 + ((b.x1 - b.x0) * i) / (nx - 1);
        const y = b.y1 - ((b.y1 - b.y0) * j) / (ny - 1);
        const v = gPotential(masses, x, y);
        grid[j * nx + i] = v;
        if (Number.isFinite(v)) vmin = Math.min(vmin, v);
      }
    // reference scale: potential of the Earth at 3 × 10⁷ m
    const vref = (6.67e-11 * ME) / 3e7;
    if (params.map) {
      const img = ctx.createImageData(nx, ny);
      const deep = hexRgb(pal.series[0], [59, 130, 246]);
      const bg = hexRgb(pal.bg, [248, 250, 252]);
      for (let k = 0; k < nx * ny; k++) {
        const f = Math.min(1, Math.sqrt(-grid[k] / vref));
        img.data[4 * k] = bg[0] + (deep[0] - bg[0]) * f;
        img.data[4 * k + 1] = bg[1] + (deep[1] - bg[1]) * f;
        img.data[4 * k + 2] = bg[2] + (deep[2] - bg[2]) * f;
        img.data[4 * k + 3] = 255;
      }
      const off = document.createElement('canvas');
      off.width = nx;
      off.height = ny;
      off.getContext('2d')!.putImageData(img, 0, 0);
      ctx.drawImage(off, 0, 0, W, H);
    }
    // equipotentials
    const levels: number[] = [];
    for (let k = 1; k <= 14; k++) levels.push((-vref * k) / 6);
    const seg = contours(grid, nx, ny, b, levels, undefined, masses.map((m) => ({ x: m.x, y: m.y })));
    ctx.strokeStyle = alpha(pal.ink.startsWith('#') ? pal.ink : '#111111', 0.35);
    ctx.beginPath();
    for (let i = 0; i < seg.length; i += 4) {
      ctx.moveTo(view.sx(seg[i]), view.sy(seg[i + 1]));
      ctx.lineTo(view.sx(seg[i + 2]), view.sy(seg[i + 3]));
    }
    ctx.stroke();
    // field arrows (direction exact, length ∝ log g)
    if (params.arrows) {
      const step = 46;
      for (let py = step / 2; py < H; py += step)
        for (let px = step / 2; px < W; px += step) {
          const [gx, gy] = gField(masses, view.wx(px), view.wy(py));
          const gm = Math.hypot(gx, gy);
          if (!(gm > 0)) continue;
          const len = Math.max(4, Math.min(20, 6 + 4 * Math.log10(gm / 1e-3)));
          drawArrow(ctx, px, py, px + (gx / gm) * len, py - (gy / gm) * len, pal.text2, undefined, 1.2);
        }
    }
    // masses
    masses.forEach((m, i) => {
      ctx!.fillStyle = i === 0 ? pal.series[0] : pal.text2;
      ctx!.beginPath();
      ctx!.arc(view.sx(m.x), view.sy(m.y), i === 0 ? 14 : 6 + 8 * Math.cbrt(m.M / ME), 0, Math.PI * 2);
      ctx!.fill();
      drawTag(ctx!, view.sx(m.x), view.sy(m.y) + 28, i === 0 ? 'Earth' : params.M2 < 0.02 ? 'Moon' : `${fmt(m.M / ME, 3)} M_E`, pal.ink, pal.surface);
    });
    // neutral point (two masses)
    if (masses.length === 2) {
      const [a, c] = masses;
      const d = Math.hypot(c.x - a.x, c.y - a.y);
      const r1 = neutralPoint(a.M, c.M, d);
      const nx2 = a.x + ((c.x - a.x) * r1) / d;
      const ny2 = a.y + ((c.y - a.y) * r1) / d;
      ctx.strokeStyle = pal.series[3];
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(view.sx(nx2) - 6, view.sy(ny2) - 6);
      ctx.lineTo(view.sx(nx2) + 6, view.sy(ny2) + 6);
      ctx.moveTo(view.sx(nx2) + 6, view.sy(ny2) - 6);
      ctx.lineTo(view.sx(nx2) - 6, view.sy(ny2) + 6);
      ctx.stroke();
      ctx.lineWidth = 1;
      drawTag(ctx, view.sx(nx2), view.sy(ny2) - 18, 'g = 0', pal.series[3], pal.surface);
    }
    // probe
    const [gx, gy] = gField(masses, probe.x, probe.y);
    const gm = Math.hypot(gx, gy);
    ctx.fillStyle = pal.series[1];
    ctx.beginPath();
    ctx.arc(view.sx(probe.x), view.sy(probe.y), 8, 0, Math.PI * 2);
    ctx.fill();
    if (gm > 0) drawArrow(ctx, view.sx(probe.x), view.sy(probe.y), view.sx(probe.x) + (gx / gm) * 36, view.sy(probe.y) - (gy / gm) * 36, pal.series[1], 'g', 2.5);
  }

  const ctrl = new SimController({ step: () => {}, render: draw, reset: () => {} }, { dt: 1, autoplay: false });
  const palette = usePalette(() => ctrl);
  redrawOn(ctrl, () => [params.arrows, params.map, masses.map((m) => [m.x, m.y, m.M]), probe.x, probe.y]);
  inter.onChange = () => ctrl.invalidate();

  const rows = $derived.by(() => {
    const [gx, gy] = gField(masses, probe.x, probe.y);
    const r: { label: string; value: string; unit?: string; strong?: boolean }[] = [
      { label: 'probe: field strength g', value: fmt(Math.hypot(gx, gy), 3), unit: 'N kg⁻¹', strong: true },
      { label: 'probe: potential V_g', value: fmt(gPotential(masses, probe.x, probe.y), 3), unit: 'J kg⁻¹', strong: true },
      { label: 'distance from the Earth', value: fmt(Math.hypot(probe.x - masses[0].x, probe.y - masses[0].y), 3), unit: 'm' },
    ];
    if (masses.length === 2) {
      const d = Math.hypot(masses[1].x - masses[0].x, masses[1].y - masses[0].y);
      r.push({ label: 'neutral point from the Earth', value: fmt(neutralPoint(masses[0].M, masses[1].M, d), 3), unit: 'm' });
    }
    return r;
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
  transport={false}
>
  {#snippet stage()}
    <SimCanvas
      {view}
      interaction={inter}
      label="Gravitational field and potential map with a movable probe"
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
      {#if params.setup !== 'one'}<Slider def={sl('M2')} bind:value={params.M2} />{/if}
      <Toggle label="Field arrows" bind:checked={params.arrows} />
      <Toggle label="Potential map" hint="darker = lower (more negative) potential" bind:checked={params.map} />
      <p class="tip">Drag the probe (orange) and the bodies.</p>
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
