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
  import { Interaction } from '../../sim/interaction';
  import type { SimEntry } from '../../app/registry';
  import type { NumberParamDef } from '../../sim/params.svelte';
  import type { SimInfo } from '../../sim/types';
  import { RippleTank } from '../../physics/ripple';
  import { drawTag } from '../../sim/draw';
  import { fmt } from '../../core/format';

  let { entry }: { entry: SimEntry } = $props();
  const sliders: NumberParamDef[] = [
    { key: 'f', label: 'Frequency', symbol: 'f', unit: 'Hz', min: 3, max: 12, step: 0.1 },
    { key: 'd', label: 'Separation of the sources / slits', symbol: 'd', unit: 'cm', min: 2, max: 12, step: 0.5 },
    { key: 'gap', label: 'Width of the gap', symbol: 'b', unit: 'cm', min: 1, max: 12, step: 0.5 },
    { key: 'depth', label: 'Speed in the shallow region / speed in deep water', symbol: 'v_2/v_1', unit: '', min: 0.4, max: 1, step: 0.05 },
  ];
  const { params, sl } = useParams({ setup: 'two', view: 'wave', f: 6, d: 6, gap: 3, depth: 0.6 }, sliders);
  const presets = [
    { id: 'one', label: 'One point source', values: { setup: 'one', f: 6 } },
    { id: 'two', label: 'Two sources: interference', values: { setup: 'two', f: 6, d: 6 } },
    { id: 'gap', label: 'Diffraction through a gap', values: { setup: 'gap', f: 6, gap: 3 } },
    { id: 'wide', label: 'Wide gap: little diffraction', values: { setup: 'gap', f: 8, gap: 10 } },
    { id: 'slits', label: 'Double slit', values: { setup: 'slits', f: 7, d: 6, gap: 1.5 } },
    { id: 'refr', label: 'Refraction into shallow water', values: { setup: 'refr', f: 6, depth: 0.6 } },
  ];
  const info: SimInfo = {
    about: [
      'Water waves in a shallow tank show all wave phenomena at once. Every point on a wavefront acts as a source of new wavelets (Huygens’ principle).',
      'Diffraction: waves spread out after passing through a gap. The spreading is most noticeable when the gap is about the size of the wavelength.',
      'Interference: where waves from two coherent sources meet crest to crest (path difference nλ) they add up; where crest meets trough (path difference (n + ½)λ) they cancel. Switch to “average intensity” to see the pattern of lines of maxima and minima.',
      'Refraction: waves slow down in shallow water. Their frequency stays the same, so the wavelength gets shorter and wavefronts arriving at an angle change direction.',
    ],
    formulas: [
      { label: 'Wave speed', tex: 'v = f\\lambda' },
      { label: 'Constructive interference', tex: '\\text{path difference} = n\\lambda' },
      { label: 'Destructive interference', tex: '\\text{path difference} = \\left(n + \\tfrac{1}{2}\\right)\\lambda' },
      { label: 'Refraction', tex: '\\dfrac{\\sin\\theta_1}{\\sin\\theta_2} = \\dfrac{v_1}{v_2}' },
    ],
    assumptions: [
      'Linear 2D wave equation on a 2 mm grid (finite differences); wave speed 0.25 m s⁻¹ in deep water; the edges absorb the waves (no reflections from the tank walls).',
      'The shallow region is modelled only by a lower wave speed; its edge is a gentle slope about 4 cm wide. Sources oscillate in phase and do not reflect waves.',
      'The colours show the height of the water surface (exaggerated); “average intensity” shows the mean of (height)² over the last couple of periods.',
    ],
    tryThis: [
      'Two sources: tap a bright line of the average-intensity pattern and read the path difference. Is it a whole number of wavelengths?',
      'Gap: make the gap smaller than the wavelength, then larger. When does the wave spread most?',
      'Refraction: measure the wavelength in the deep and shallow water. Is f the same in both?',
    ],
  };

  const TW = 0.4;
  const TH = 0.3;
  const C = 0.25;
  const view = new View();
  const inter = new Interaction();
  let ctx: CanvasRenderingContext2D | null = null;
  let tank = build();
  let probe: { x: number; y: number } | null = $state(null);
  let img: ImageData | null = null;
  let gain = 1e-6;
  let off: HTMLCanvasElement | null = null;

  function build(): RippleTank {
    const t = new RippleTank(TW, TH, 0.002, C);
    t.f = params.f;
    const d = params.d / 100;
    const gap = params.gap / 100;
    switch (params.setup) {
      case 'one':
        t.sources = [{ kind: 'point', x: 0.12, y: TH / 2, phase: 0 }];
        break;
      case 'two':
        t.sources = [
          { kind: 'point', x: 0.08, y: TH / 2 - d / 2, phase: 0 },
          { kind: 'point', x: 0.08, y: TH / 2 + d / 2, phase: 0 },
        ];
        break;
      case 'gap':
        t.sources = [{ kind: 'line', x: 0.05, y: 0, phase: 0 }];
        t.setBarrier(0.14, [[TH / 2, gap]]);
        break;
      case 'slits':
        t.sources = [{ kind: 'line', x: 0.05, y: 0, phase: 0 }];
        t.setBarrier(0.14, [
          [TH / 2 - d / 2, gap],
          [TH / 2 + d / 2, gap],
        ]);
        break;
      default:
        t.sources = [{ kind: 'line', x: 0.05, y: 0, phase: 0 }];
        // shallow region with its edge at 30° to the wavefronts; the depth changes over a short
        // ramp (about one wavelength) as on a sloping bottom, which keeps reflections small
        t.setSpeedFn((x, y) => {
          const dist = (x - 0.17 - Math.tan(Math.PI / 6) * (y - TH / 2)) * Math.cos(Math.PI / 6);
          const w = 0.04;
          const s = Math.max(0, Math.min(1, dist / w + 0.5));
          const sm = s * s * (3 - 2 * s);
          return C * (1 - (1 - params.depth) * sm);
        });
    }
    return t;
  }

  const geo = { ox: 0, oy: 0, s: 1 };
  const toWorld = (px: number, py: number) => ({ x: (px - geo.ox) / geo.s, y: (py - geo.oy) / geo.s });
  inter.add({
    priority: 10,
    cursor: 'grab',
    hit: (px, py) => {
      if (params.setup !== 'one' && params.setup !== 'two') return Infinity;
      let best = Infinity;
      for (const s of tank.sources) best = Math.min(best, Math.hypot(px - (geo.ox + s.x * geo.s), py - (geo.oy + s.y * geo.s)));
      return best < 30 ? best / 3 : Infinity;
    },
    move: (px, py) => {
      const w = toWorld(px, py);
      let k = 0;
      let bd = Infinity;
      tank.sources.forEach((s, i) => {
        const dd = Math.hypot(s.x - w.x, s.y - w.y);
        if (dd < bd) {
          bd = dd;
          k = i;
        }
      });
      tank.sources[k].x = Math.max(0.05, Math.min(TW - 0.05, w.x));
      tank.sources[k].y = Math.max(0.05, Math.min(TH - 0.05, w.y));
    },
  });
  inter.add({
    priority: 1,
    cursor: 'crosshair',
    hit: (px, py) => {
      const w = toWorld(px, py);
      return w.x > 0 && w.x < TW && w.y > 0 && w.y < TH ? 0 : Infinity;
    },
    start: (px, py) => {
      probe = toWorld(px, py);
    },
    move: (px, py) => {
      probe = toWorld(px, py);
    },
  });

  const hexRgb = (c: string, fb: [number, number, number]): [number, number, number] => {
    if (!c.startsWith('#') || c.length < 7) return fb;
    return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
  };

  function draw() {
    if (!ctx) return;
    const pal = palette.pal;
    const W = view.width;
    const usable = view.height - 76;
    ctx.fillStyle = pal.bg;
    ctx.fillRect(0, 0, W, view.height);
    const wArea = W > 760 ? W - 270 : W;
    geo.s = Math.min((wArea - 20) / TW, (usable - 20) / TH);
    geo.ox = (wArea - TW * geo.s) / 2;
    geo.oy = (usable - TH * geo.s) / 2;
    const { nx, ny } = tank;
    if (!img || img.width !== nx) {
      img = new ImageData(nx, ny);
      off = document.createElement('canvas');
      off.width = nx;
      off.height = ny;
    }
    const bg = hexRgb(pal.bg, [248, 250, 252]);
    const hi = hexRgb(pal.series[0], [59, 130, 246]);
    const lo = hexRgb(pal.ink, [30, 41, 59]);
    const wc = hexRgb(pal.text2, [90, 90, 90]);
    const data = img.data;
    const showAvg = params.view === 'avg';
    // automatic display gain (the sources are soft, so the absolute height is arbitrary)
    let umax = 1e-9;
    for (let k = 0; k < tank.u.length; k++) if (!tank.damp[k]) umax = Math.max(umax, Math.abs(tank.u[k]));
    gain = Math.max(gain * 0.97, umax);
    let amax = 1e-9;
    if (showAvg) for (let k = 0; k < tank.avg.length; k++) if (!tank.damp[k] && tank.avg[k] > amax) amax = tank.avg[k];
    for (let k = 0; k < nx * ny; k++) {
      let r: number;
      let g: number;
      let b: number;
      if (tank.wall[k]) {
        [r, g, b] = wc;
      } else if (showAvg) {
        const v = Math.min(1, Math.sqrt(tank.avg[k] / amax));
        r = bg[0] + (hi[0] - bg[0]) * v;
        g = bg[1] + (hi[1] - bg[1]) * v;
        b = bg[2] + (hi[2] - bg[2]) * v;
      } else {
        const v = Math.max(-1, Math.min(1, (tank.u[k] / gain) * 1.2));
        const tgt = v > 0 ? hi : lo;
        const a = Math.abs(v);
        r = bg[0] + (tgt[0] - bg[0]) * a;
        g = bg[1] + (tgt[1] - bg[1]) * a;
        b = bg[2] + (tgt[2] - bg[2]) * a;
        if (tank.c2[k] < C * C * 0.999) {
          r *= 0.93;
          g *= 0.97;
        }
      }
      data[4 * k] = r;
      data[4 * k + 1] = g;
      data[4 * k + 2] = b;
      data[4 * k + 3] = 255;
    }
    off!.getContext('2d')!.putImageData(img, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(off!, geo.ox, geo.oy, TW * geo.s, TH * geo.s);
    ctx.strokeStyle = pal.gridStrong;
    ctx.strokeRect(geo.ox, geo.oy, TW * geo.s, TH * geo.s);
    // sources
    ctx.fillStyle = pal.series[3];
    for (const s of tank.sources) {
      if (s.kind === 'point') {
        ctx.beginPath();
        ctx.arc(geo.ox + s.x * geo.s, geo.oy + s.y * geo.s, 6, 0, Math.PI * 2);
        ctx.fill();
      } else ctx.fillRect(geo.ox + s.x * geo.s - 2, geo.oy, 4, TH * geo.s);
    }
    // scale bar: one wavelength in deep water
    const lam = C / params.f;
    ctx.strokeStyle = pal.text2;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(geo.ox + 10, geo.oy + TH * geo.s + 12);
    ctx.lineTo(geo.ox + 10 + lam * geo.s, geo.oy + TH * geo.s + 12);
    ctx.stroke();
    ctx.lineWidth = 1;
    ctx.fillStyle = pal.text2;
    ctx.font = '500 10px Inter Variable, system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`λ = ${fmt(lam * 100, 3)} cm`, geo.ox + 16 + lam * geo.s, geo.oy + TH * geo.s + 12);
    if (probe) {
      ctx.strokeStyle = pal.ink;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(geo.ox + probe.x * geo.s, geo.oy + probe.y * geo.s, 6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.lineWidth = 1;
      const pts = params.setup === 'slits' ? [{ x: 0.14, y: TH / 2 - params.d / 200 }, { x: 0.14, y: TH / 2 + params.d / 200 }] : tank.sources.filter((s) => s.kind === 'point');
      if (pts.length === 2) {
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = pal.text2;
        for (const p of pts) {
          ctx.beginPath();
          ctx.moveTo(geo.ox + p.x * geo.s, geo.oy + p.y * geo.s);
          ctx.lineTo(geo.ox + probe.x * geo.s, geo.oy + probe.y * geo.s);
          ctx.stroke();
        }
        ctx.setLineDash([]);
        drawTag(ctx, geo.ox + probe.x * geo.s, geo.oy + probe.y * geo.s - 18, 'P', pal.ink, pal.surface);
      }
    }
  }

  const ctrl: SimController = new SimController(
    {
      step: () => tank.step(),
      render: draw,
      reset: () => {
        tank = build();
        gain = 1e-6;
      },
    },
    { dt: (0.5 * 0.002) / C, maxSubsteps: 60, autoplay: true },
  );
  const palette = usePalette(() => ctrl);
  inter.onChange = () => ctrl.invalidate();
  resetOn(ctrl, () => [params.setup, params.d, params.gap, params.depth]);
  $effect(() => {
    tank.f = params.f;
  });

  const rows = $derived.by(() => {
    const lam = C / params.f;
    const r: { label: string; value: string; unit?: string; strong?: boolean }[] = [
      { label: 'wave speed (deep)', value: fmt(C, 3), unit: 'm s⁻¹' },
      { label: 'wavelength λ = v/f', value: fmt(lam * 100, 3), unit: 'cm', strong: true },
    ];
    if (params.setup === 'refr') r.push({ label: 'λ in shallow water', value: fmt(lam * params.depth * 100, 3), unit: 'cm' });
    if (params.setup === 'gap') r.push({ label: 'gap / wavelength', value: fmt(params.gap / 100 / lam, 3) });
    if (probe) {
      const pts = params.setup === 'slits' ? [{ x: 0.14, y: TH / 2 - params.d / 200 }, { x: 0.14, y: TH / 2 + params.d / 200 }] : params.setup === 'two' ? tank.sources : [];
      if (pts.length === 2) {
        const d1 = Math.hypot(probe.x - pts[0].x, probe.y - pts[0].y);
        const d2 = Math.hypot(probe.x - pts[1].x, probe.y - pts[1].y);
        r.push({ label: 'path difference |S₁P − S₂P|', value: fmt(Math.abs(d1 - d2) * 100, 3), unit: 'cm' });
        r.push({ label: '… in wavelengths', value: fmt(Math.abs(d1 - d2) / lam, 3), unit: 'λ', strong: true });
      }
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
>
  {#snippet stage()}
    <SimCanvas
      {view}
      interaction={inter}
      label="Ripple tank showing water waves from above"
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
      <Segmented
        label="Set-up"
        bind:value={params.setup}
        options={[
          { value: 'one', label: 'One' },
          { value: 'two', label: 'Two' },
          { value: 'gap', label: 'Gap' },
          { value: 'slits', label: 'Slits' },
          { value: 'refr', label: 'Shallow' },
        ]}
      />
      <Segmented
        label="Show"
        bind:value={params.view}
        options={[
          { value: 'wave', label: 'Water surface' },
          { value: 'avg', label: 'Average intensity' },
        ]}
      />
      <Slider def={sl('f')} bind:value={params.f} />
      {#if params.setup === 'two' || params.setup === 'slits'}<Slider def={sl('d')} bind:value={params.d} />{/if}
      {#if params.setup === 'gap' || params.setup === 'slits'}<Slider def={sl('gap')} bind:value={params.gap} />{/if}
      {#if params.setup === 'refr'}<Slider def={sl('depth')} bind:value={params.depth} />{/if}
      <p class="tip">Tap the water to place the probe P; drag point sources to move them.</p>
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
