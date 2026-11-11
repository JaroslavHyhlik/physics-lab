<script lang="ts">
  import { onMount } from 'svelte';
  import SimShell from '../../sim/SimShell.svelte';
  import SimCanvas from '../../sim/SimCanvas.svelte';
  import Readouts from '../../sim/Readouts.svelte';
  import Slider from '../../ui/Slider.svelte';
  import Segmented from '../../ui/Segmented.svelte';
  import { SimController } from '../../sim/controller.svelte';
  import { useParams, usePalette, redrawOn } from '../../sim/setup.svelte';
  import { View } from '../../sim/view';
  import { Interaction } from '../../sim/interaction';
  import type { SimEntry } from '../../app/registry';
  import type { NumberParamDef } from '../../sim/params.svelte';
  import type { SimInfo } from '../../sim/types';
  import { refract, criticalAngle, fresnelR, acceptanceAngle } from '../../physics/optics';
  import { alpha } from '../../sim/palette';
  import { drawTag } from '../../sim/draw';
  import { fmt } from '../../core/format';

  let { entry }: { entry: SimEntry } = $props();
  const sliders: NumberParamDef[] = [
    { key: 'th', label: 'Angle of incidence', symbol: 'θ_1', unit: '°', min: 0, max: 89, step: 0.5 },
    { key: 'n1', label: 'Refractive index of medium 1 (top)', symbol: 'n_1', unit: '', min: 1, max: 2.5, step: 0.01 },
    { key: 'n2', label: 'Refractive index of medium 2 (bottom)', symbol: 'n_2', unit: '', min: 1, max: 2.5, step: 0.01 },
    { key: 'nc', label: 'Core refractive index', symbol: 'n_core', unit: '', min: 1.3, max: 1.7, step: 0.01 },
    { key: 'ncl', label: 'Cladding refractive index', symbol: 'n_clad', unit: '', min: 1.0, max: 1.69, step: 0.01 },
  ];
  const { params, sl } = useParams({ mode: 'boundary', th: 40, n1: 1, n2: 1.5, nc: 1.5, ncl: 1.4 }, sliders);
  const presets = [
    { id: 'ag', label: 'Air → glass', values: { mode: 'boundary', n1: 1, n2: 1.5, th: 40 } },
    { id: 'ga', label: 'Glass → air (critical angle 41.8°)', values: { mode: 'boundary', n1: 1.5, n2: 1, th: 35 } },
    { id: 'tir', label: 'Total internal reflection', values: { mode: 'boundary', n1: 1.5, n2: 1, th: 50 } },
    { id: 'wa', label: 'Water → air', values: { mode: 'boundary', n1: 1.33, n2: 1, th: 30 } },
    { id: 'fibre', label: 'Optical fibre', values: { mode: 'fibre', th: 20, nc: 1.5, ncl: 1.4 } },
  ];
  const info: SimInfo = {
    about: [
      'When light meets a boundary between two media, part of it is reflected (angle of reflection = angle of incidence) and part is refracted: it changes direction because its speed changes. Angles are measured from the normal.',
      "Snell's law: n₁ sin θ₁ = n₂ sin θ₂. The refractive index n = c/v tells how much slower light travels in the medium. Going into a denser medium (larger n) the ray bends towards the normal; going out it bends away.",
      'From a denser to a less dense medium, at the critical angle the refracted ray grazes along the boundary (θ₂ = 90°): sin θ_c = n₂/n₁. Beyond it no light gets out — total internal reflection. Optical fibres guide light this way, bouncing it along a glass core surrounded by cladding of lower index.',
    ],
    formulas: [
      { label: "Snell's law", tex: '\\dfrac{n_1}{n_2} = \\dfrac{\\sin\\theta_2}{\\sin\\theta_1} = \\dfrac{v_2}{v_1}' },
      { label: 'Critical angle', tex: '\\sin\\theta_c = \\dfrac{n_2}{n_1}', beyond: true },
      { label: 'Acceptance angle of a fibre (from air)', tex: '\\sin\\theta_a = \\sqrt{n_\\text{core}^{2} - n_\\text{clad}^{2}}', beyond: true },
    ],
    assumptions: [
      'Ray model of light; flat, smooth boundaries; one wavelength (no dispersion).',
      'The brightness of the reflected and refracted rays follows the Fresnel equations for unpolarised light (beyond syllabus).',
      'Typical refractive indices: air 1.00, water 1.33, glass 1.50, diamond 2.42.',
    ],
    tryThis: [
      'Glass → air: increase θ₁ slowly. At what angle does the refracted ray disappear? Check with sin θ_c = n₂/n₁.',
      'Why does the reflected ray get brighter as θ₁ approaches the critical angle?',
      'Optical fibre: what is the largest angle at which light can enter and still be guided?',
    ],
  };

  const view = new View();
  const inter = new Interaction();
  let ctx: CanvasRenderingContext2D | null = null;
  const rad = (d: number) => (d * Math.PI) / 180;
  const deg = (r: number) => (r * 180) / Math.PI;
  const geo = { cx: 0, cy: 0, R: 100 };
  inter.add({
    priority: 10,
    cursor: 'grab',
    hit: (px, py) => {
      if (params.mode !== 'boundary') return Infinity;
      const a = rad(params.th);
      const sx = geo.cx - Math.sin(a) * geo.R;
      const sy = geo.cy - Math.cos(a) * geo.R;
      const d = Math.hypot(px - sx, py - sy);
      return d < 40 ? d / 3 : Infinity;
    },
    move: (px, py) => {
      const a = Math.atan2(geo.cx - px, geo.cy - py);
      params.th = Math.round(Math.max(0, Math.min(89, deg(a))) * 2) / 2;
    },
  });

  function ray(x1: number, y1: number, x2: number, y2: number, strength: number, col: string) {
    if (strength < 0.003) return;
    const c = ctx!;
    c.strokeStyle = alpha(col.startsWith('#') ? col : '#e11d48', Math.max(0.15, Math.min(1, Math.sqrt(strength))));
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(x1, y1);
    c.lineTo(x2, y2);
    c.stroke();
    // arrow head in the middle
    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2;
    const a = Math.atan2(y2 - y1, x2 - x1);
    c.beginPath();
    c.moveTo(mx + Math.cos(a) * 7, my + Math.sin(a) * 7);
    c.lineTo(mx + Math.cos(a + 2.5) * 7, my + Math.sin(a + 2.5) * 7);
    c.lineTo(mx + Math.cos(a - 2.5) * 7, my + Math.sin(a - 2.5) * 7);
    c.closePath();
    c.fillStyle = c.strokeStyle;
    c.fill();
    c.lineWidth = 1;
  }

  function angleArc(cx: number, cy: number, r: number, from: number, to: number, label: string, col: string) {
    const c = ctx!;
    c.strokeStyle = col;
    c.beginPath();
    c.arc(cx, cy, r, Math.min(from, to), Math.max(from, to));
    c.stroke();
    const mid = (from + to) / 2;
    drawTag(c, cx + Math.cos(mid) * (r + 18), cy + Math.sin(mid) * (r + 18), label, col, palette.pal.surface);
  }

  function drawBoundary(W: number, H: number) {
    const pal = palette.pal;
    const cx = (W > 760 ? W - 260 : W) / 2;
    const cy = H / 2;
    const R = Math.min(cx - 30, H / 2 - 30);
    geo.cx = cx;
    geo.cy = cy;
    geo.R = R;
    const tint = (n: number) => alpha(pal.series[0].startsWith('#') ? pal.series[0] : '#3b82f6', Math.min(0.35, (n - 1) * 0.25));
    ctx!.fillStyle = tint(params.n1);
    ctx!.fillRect(0, 0, W, cy);
    ctx!.fillStyle = tint(params.n2);
    ctx!.fillRect(0, cy, W, H - cy);
    ctx!.strokeStyle = pal.text2;
    ctx!.beginPath();
    ctx!.moveTo(0, cy);
    ctx!.lineTo(W, cy);
    ctx!.stroke();
    ctx!.setLineDash([5, 5]);
    ctx!.strokeStyle = pal.gridStrong;
    ctx!.beginPath();
    ctx!.moveTo(cx, cy - R);
    ctx!.lineTo(cx, cy + R);
    ctx!.stroke();
    ctx!.setLineDash([]);
    drawTag(ctx!, 70, 24, `n₁ = ${params.n1.toFixed(2)}`, pal.ink, pal.surface);
    drawTag(ctx!, 70, H - 24, `n₂ = ${params.n2.toFixed(2)}`, pal.ink, pal.surface);
    const t1 = rad(params.th);
    const sx = cx - Math.sin(t1) * R;
    const sy = cy - Math.cos(t1) * R;
    const Rf = fresnelR(params.n1, params.n2, t1);
    const col = pal.series[3];
    ray(sx, sy, cx, cy, 1, col);
    ray(cx, cy, cx + Math.sin(t1) * R, cy - Math.cos(t1) * R, Rf, col);
    const t2 = refract(params.n1, params.n2, t1);
    if (t2 !== null) ray(cx, cy, cx + Math.sin(t2) * R, cy + Math.cos(t2) * R, 1 - Rf, col);
    // source handle
    ctx!.fillStyle = pal.text2;
    ctx!.beginPath();
    ctx!.arc(sx, sy, 9, 0, Math.PI * 2);
    ctx!.fill();
    // angle arcs (canvas angles: up = −π/2)
    angleArc(cx, cy, 50, -Math.PI / 2 - t1, -Math.PI / 2, `θ₁ = ${params.th.toFixed(1)}°`, pal.text2);
    if (t2 !== null) angleArc(cx, cy, 60, Math.PI / 2 - t2, Math.PI / 2, `θ₂ = ${deg(t2).toFixed(1)}°`, pal.text2);
    else drawTag(ctx!, cx, cy + 40, 'total internal reflection', pal.negative, pal.surface);
    drawTag(ctx!, cx + Math.sin(t1) * R * 0.75, cy - Math.cos(t1) * R * 0.75 - 16, `reflected ${(100 * Rf).toFixed(0)} %`, pal.text2, pal.surface);
  }

  function drawFibre(W: number, H: number) {
    const pal = palette.pal;
    const x0 = 120;
    const x1 = W > 760 ? W - 270 : W - 20;
    const cy = H / 2;
    const half = Math.min(60, H * 0.15);
    const clad = half + 22;
    ctx!.fillStyle = alpha(pal.series[0].startsWith('#') ? pal.series[0] : '#3b82f6', 0.12);
    ctx!.fillRect(x0, cy - clad, x1 - x0, 2 * clad);
    ctx!.fillStyle = alpha(pal.series[0].startsWith('#') ? pal.series[0] : '#3b82f6', 0.28);
    ctx!.fillRect(x0, cy - half, x1 - x0, 2 * half);
    drawTag(ctx!, x0 + 60, cy - clad - 14, `cladding n = ${params.ncl.toFixed(2)}`, pal.text2, pal.surface);
    drawTag(ctx!, x0 + 60, cy, `core n = ${params.nc.toFixed(2)}`, pal.text2, pal.surface);
    const t0 = rad(params.th);
    const col = pal.series[3];
    // incoming ray from air hits the core end face at its centre
    const L = 90;
    ray(x0 - Math.cos(t0) * L, cy + Math.sin(t0) * L, x0, cy, 1, col);
    const tin = refract(1, params.nc, t0)!; // angle to the axis inside the core
    const wallAngle = Math.PI / 2 - tin; // angle of incidence at the core wall
    const tc = criticalAngle(params.nc, params.ncl);
    const guided = tc !== null && wallAngle > tc;
    let x = x0;
    let y = cy;
    let dir = -1; // going up first (towards smaller y) since the ray came from below
    let power = 1 - fresnelR(1, params.nc, t0);
    for (let k = 0; k < 200 && x < x1; k++) {
      const dx = (half - dir * (y - cy)) / Math.tan(tin);
      const nx = Math.min(x1, x + (Number.isFinite(dx) ? dx : x1));
      const ny = nx === x1 ? y + (dir * (x1 - x) * Math.tan(tin)) : cy + dir * half;
      ray(x, y, nx, ny, power, col);
      if (nx >= x1) break;
      if (!guided) {
        const tout = refract(params.nc, params.ncl, wallAngle);
        const R = fresnelR(params.nc, params.ncl, wallAngle);
        if (tout !== null) ray(nx, ny, nx + Math.sin(tout) * 40, ny + dir * Math.cos(tout) * 40, power * (1 - R), col);
        power *= R;
      }
      x = nx;
      y = ny;
      dir = -dir;
    }
    drawTag(ctx!, (x0 + x1) / 2, cy + clad + 30, guided ? 'guided by total internal reflection' : 'light leaks out at every bounce', guided ? pal.series[2] : pal.series[3], pal.surface);
  }

  function draw() {
    if (!ctx) return;
    const pal = palette.pal;
    const W = view.width;
    const H = view.height;
    ctx.fillStyle = pal.bg;
    ctx.fillRect(0, 0, W, H);
    if (params.mode === 'boundary') drawBoundary(W, H);
    else drawFibre(W, H);
  }

  const ctrl = new SimController({ step: () => {}, render: draw, reset: () => {} }, { dt: 1, autoplay: false });
  const palette = usePalette(() => ctrl);
  redrawOn(ctrl, () => [params.mode, params.th, params.n1, params.n2, params.nc, params.ncl]);
  inter.onChange = () => ctrl.invalidate();

  const rows = $derived.by(() => {
    if (params.mode === 'boundary') {
      const t2 = refract(params.n1, params.n2, rad(params.th));
      const c = criticalAngle(params.n1, params.n2);
      return [
        { label: 'θ₂', value: t2 === null ? 'none (TIR)' : `${deg(t2).toFixed(2)}°`, strong: true },
        { label: 'n₁ sin θ₁', value: (params.n1 * Math.sin(rad(params.th))).toFixed(4) },
        { label: 'n₂ sin θ₂', value: t2 === null ? '—' : (params.n2 * Math.sin(t2)).toFixed(4) },
        { label: 'critical angle', value: c === null ? 'none (n₁ < n₂)' : `${deg(c).toFixed(2)}°` },
        { label: 'speed ratio v₂/v₁ = n₁/n₂', value: (params.n1 / params.n2).toFixed(4) },
      ];
    }
    const c = criticalAngle(params.nc, params.ncl);
    return [
      { label: 'critical angle at the wall', value: c === null ? '—' : `${deg(c).toFixed(2)}°` },
      { label: 'acceptance angle (from air)', value: `${deg(acceptanceAngle(1, params.nc, params.ncl)).toFixed(2)}°`, strong: true },
      { label: 'angle at the wall now', value: `${(90 - deg(refract(1, params.nc, rad(params.th))!)).toFixed(2)}°` },
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
  transport={false}
>
  {#snippet stage()}
    <SimCanvas
      {view}
      interaction={inter}
      label="Light ray reflected and refracted at a boundary, or guided in an optical fibre"
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
        bind:value={params.mode}
        options={[
          { value: 'boundary', label: 'Boundary' },
          { value: 'fibre', label: 'Optical fibre' },
        ]}
      />
      <Slider def={sl('th')} bind:value={params.th} />
      {#if params.mode === 'boundary'}
        <Slider def={sl('n1')} bind:value={params.n1} />
        <Slider def={sl('n2')} bind:value={params.n2} />
        <p class="tip">Drag the light source round the circle.</p>
      {:else}
        <Slider def={sl('nc')} bind:value={params.nc} />
        <Slider def={sl('ncl')} bind:value={params.ncl} />
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
