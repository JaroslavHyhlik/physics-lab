<script lang="ts">
  import { onMount } from 'svelte';
  import SimShell from '../../sim/SimShell.svelte';
  import SimCanvas from '../../sim/SimCanvas.svelte';
  import Readouts from '../../sim/Readouts.svelte';
  import Slider from '../../ui/Slider.svelte';
  import RecordTable from '../../sim/RecordTable.svelte';
  import { SimController } from '../../sim/controller.svelte';
  import { useParams, usePalette, redrawOn } from '../../sim/setup.svelte';
  import { View } from '../../sim/view';
  import type { SimEntry } from '../../app/registry';
  import type { NumberParamDef } from '../../sim/params.svelte';
  import type { SimInfo } from '../../sim/types';
  import { COMPTON_WAVELENGTH, scatter } from '../../physics/compton';
  import { linearFit } from '../../physics/dc';
  import { c, e, m_e } from '../../core/constants';
  import { drawXYPlot } from '../../sim/xyPlot';
  import { drawArrow, drawTag } from '../../sim/draw';
  import { fmt } from '../../core/format';

  let { entry }: { entry: SimEntry } = $props();
  const sliders: NumberParamDef[] = [
    { key: 'lambda', label: 'Wavelength of the incoming photon', symbol: 'λ', unit: 'pm', min: 1, max: 100, step: 0.1, log: true },
    { key: 'theta', label: 'Scattering angle', symbol: 'θ', unit: '°', min: 0, max: 180, step: 1 },
  ];
  const { params, sl } = useParams({ lambda: 71, theta: 90 }, sliders);
  const presets = [
    { id: 'xray', label: 'X-rays (molybdenum Kα, 71 pm), as Compton used', values: { lambda: 71, theta: 90 } },
    { id: 'back', label: 'Back-scattering (θ = 180°): largest shift', values: { lambda: 71, theta: 180 } },
    { id: 'gamma', label: 'Gamma rays from caesium-137 (662 keV)', values: { lambda: 1.87, theta: 90 } },
    { id: 'small', label: 'Small angle: hardly any change', values: { lambda: 71, theta: 20 } },
  ];
  const info: SimInfo = {
    about: [
      'A photon collides with a free electron. Like a collision between two balls, energy and momentum are both conserved: the electron recoils and takes some energy, so the scattered photon has less energy and therefore a longer wavelength.',
      'The change in wavelength depends only on the scattering angle: Δλ = h/(m_e c)(1 − cos θ). It is zero straight ahead and largest (twice h/(m_e c) ≈ 4.85 pm) when the photon bounces straight back.',
      'Because h/(m_e c) is only 2.43 pm, the effect is noticeable only for X-rays and gamma rays. Compton’s 1923 measurement with X-rays showed that photons carry momentum p = h/λ.',
    ],
    formulas: [
      { label: 'Compton shift', tex: '\\lambda_f - \\lambda_i = \\Delta\\lambda = \\dfrac{h}{m_e c}(1 - \\cos\\theta)', hl: true },
      { label: 'Photon momentum', tex: 'p = \\dfrac{h}{\\lambda}', hl: true },
      { label: 'Photon energy', tex: 'E = hf = \\dfrac{hc}{\\lambda}' },
    ],
    assumptions: [
      'The electron is free and at rest before the collision (outer electrons in a light target are nearly so).',
      'The electron is treated relativistically; the formula for Δλ is then exact.',
      'In the animation the wavelengths are drawn to scale relative to each other, but enormously magnified; the speeds and the size of the electron are not to scale. The momentum triangle is to scale.',
    ],
    tryThis: [
      'Record Δλ for several angles and plot it against (1 − cos θ). Use the gradient to find Planck’s constant.',
      'Compare 71 pm X-rays with 1.87 pm gamma rays at the same angle. Which one loses a bigger fraction of its energy?',
      'Where does the electron go when the photon bounces straight back?',
    ],
  };

  const th = $derived((params.theta * Math.PI) / 180);
  const r = $derived(scatter(params.lambda * 1e-12, th));

  let points: { x: number; y: number }[] = $state([]);
  const fit = $derived(linearFit(points.map((p) => p.x), points.map((p) => p.y)));
  function record() {
    points = [...points, { x: Math.round((1 - Math.cos(th)) * 1000) / 1000, y: Math.round(r.dLambda * 1e15) / 1e3 }];
  }

  const view = new View();
  let ctx: CanvasRenderingContext2D | null = null;
  let t = 0;
  const PERIOD = 3.2;
  const HIT = 1.2; // time at which the photon reaches the electron

  /** wavy photon from (x1,y1) towards (x2,y2), drawn only along [s0,s1] of the path, wavelength wl px */
  function wave(x1: number, y1: number, x2: number, y2: number, s0: number, s1: number, wl: number, color: string) {
    const c2 = ctx!;
    const L = Math.hypot(x2 - x1, y2 - y1);
    const ux = (x2 - x1) / L;
    const uy = (y2 - y1) / L;
    const a = 7;
    c2.strokeStyle = color;
    c2.lineWidth = 2;
    c2.beginPath();
    const n = Math.max(2, Math.ceil(((s1 - s0) * L) / 2));
    for (let i = 0; i <= n; i++) {
      const s = (s0 + ((s1 - s0) * i) / n) * L;
      const env = Math.sin((Math.PI * i) / n); // packet envelope
      const off = a * env * Math.sin((2 * Math.PI * s) / wl);
      const x = x1 + ux * s - uy * off;
      const y = y1 + uy * s + ux * off;
      if (i === 0) c2.moveTo(x, y);
      else c2.lineTo(x, y);
    }
    c2.stroke();
    c2.lineWidth = 1;
  }

  function draw() {
    if (!ctx) return;
    const pal = palette.pal;
    const W = view.width;
    const H = view.height;
    const usable = H - 76;
    ctx.fillStyle = pal.bg;
    ctx.fillRect(0, 0, W, H);
    const wide = W > 760;
    const areaW = wide ? Math.min(W * 0.55, 560) : W;
    const cx = areaW * 0.55;
    const cy = wide ? usable * 0.32 : Math.min(150, usable * 0.28);
    const R = Math.min(areaW * 0.42, 210, cy + 40);
    // scattering scene
    const wl1 = 26; // px for the incoming wavelength; the scattered one is to the same scale
    const wl2 = (wl1 * r.lambda2) / (params.lambda * 1e-12);
    const tt = t % PERIOD;
    const blue = pal.series[0];
    const red = pal.series[3];
    ctx.strokeStyle = pal.grid;
    ctx.setLineDash([4, 5]);
    ctx.beginPath();
    ctx.moveTo(cx - R, cy);
    ctx.lineTo(cx + R, cy);
    ctx.stroke();
    ctx.setLineDash([]);
    const ox = cx + R * Math.cos(th);
    const oy = cy - R * Math.sin(th);
    const ex = cx + R * 0.8 * Math.cos(r.phi);
    const ey = cy + R * 0.8 * Math.sin(r.phi);
    if (tt < HIT) {
      const f = tt / HIT;
      wave(cx - R, cy, cx, cy, Math.max(0, f - 0.35), f, wl1, blue);
    } else {
      const f = Math.min(1, (tt - HIT) / (PERIOD - HIT - 0.3));
      wave(cx, cy, ox, oy, Math.max(0, f - 0.35), f, wl2, red);
    }
    // electron
    const fe = tt < HIT ? 0 : Math.min(1, (tt - HIT) / (PERIOD - HIT - 0.3));
    ctx.fillStyle = pal.series[2];
    ctx.beginPath();
    ctx.arc(cx + (ex - cx) * fe, cy + (ey - cy) * fe, 7, 0, Math.PI * 2);
    ctx.fill();
    // direction guides
    ctx.strokeStyle = pal.gridStrong;
    ctx.setLineDash([3, 4]);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(ox, oy);
    ctx.moveTo(cx, cy);
    ctx.lineTo(ex, ey);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = pal.text3;
    ctx.beginPath();
    ctx.arc(cx, cy, 34, -th, 0);
    ctx.stroke();
    drawTag(ctx, cx + 52 * Math.cos(th / 2), cy - 52 * Math.sin(th / 2), `θ = ${params.theta}°`, pal.text2, pal.surface);
    drawTag(ctx, cx - R + 50, cy - 24, `λ = ${fmt(params.lambda, 3)} pm`, blue, pal.surface);
    drawTag(ctx, ox, oy - 18, `λ' = ${fmt(r.lambda2 * 1e12, 4)} pm`, red, pal.surface);
    if (r.pe > 0) drawTag(ctx, ex, ey + 18, `electron, φ = ${fmt((r.phi * 180) / Math.PI, 3)}°`, pal.series[2], pal.surface);

    // momentum triangle (to scale): p = p' + p_e
    const ty0 = cy + R * 0.95 + 40;
    const triH = usable - ty0 - 20;
    if (triH > 70) {
      // p from A to B, p′ from A at angle θ to Q, and p_e from Q to B (p = p′ + p_e)
      const p1 = 1 / (params.lambda * 1e-12);
      const p2 = 1 / r.lambda2;
      const k = Math.min((areaW - 80) / (p1 + p2), (triH - 20) / Math.max(p2, 0.2 * p1));
      const Ax = 40 + p2 * k;
      const Ay = ty0 + 14 + p2 * k * Math.sin(th);
      const Bx = Ax + p1 * k;
      const Qx = Ax + p2 * k * Math.cos(th);
      const Qy = Ay - p2 * k * Math.sin(th);
      ctx.fillStyle = pal.text2;
      ctx.font = '500 10px Inter Variable, system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      ctx.fillText('momentum (to scale): p = p′ + p_e', 30, ty0);
      drawArrow(ctx, Ax, Ay, Bx, Ay, blue, undefined, 2);
      drawArrow(ctx, Ax, Ay, Qx, Qy, red, undefined, 2);
      drawArrow(ctx, Qx, Qy, Bx, Ay, pal.series[2], undefined, 2);
      const sm = '600 11px Inter Variable, system-ui, sans-serif';
      drawTag(ctx, (Ax + Bx) / 2, Ay + 16, 'p = h/λ', blue, pal.surface, sm);
      drawTag(ctx, (Ax + Qx) / 2 - 30, (Ay + Qy) / 2, "p′ = h/λ′", red, pal.surface, sm);
      drawTag(ctx, (Qx + Bx) / 2 + 26, (Qy + Ay) / 2 - 12, 'p_e', pal.series[2], pal.surface, sm);
    }

    // graph Δλ against (1 − cos θ)
    const gx0 = wide ? areaW + 50 : 56;
    const gx1 = W - 24;
    const gy0 = wide ? 230 : usable + 1e9;
    const gy1 = usable - 30;
    if (gx1 - gx0 < 110 || gy1 - gy0 < 70) return;
    drawXYPlot(ctx, pal, {
      x0: gx0,
      y0: gy0,
      x1: gx1,
      y1: gy1,
      xmin: 0,
      xmax: 2,
      ymin: 0,
      ymax: 5.5,
      xLabel: '1 − cos θ',
      yLabel: 'Δλ / pm',
      curves: [{ fn: (x) => COMPTON_WAVELENGTH * 1e12 * x, color: pal.text3, dash: [3, 4], width: 1 }],
      points,
      current: { x: 1 - Math.cos(th), y: r.dLambda * 1e12 },
      fit: points.length >= 2 ? { ...fit, color: pal.series[1] } : null,
    });
  }

  const ctrl: SimController = new SimController(
    {
      step: (dt) => {
        t += dt;
      },
      render: draw,
      reset: () => {
        t = 0;
      },
    },
    { dt: 1 / 120, autoplay: true },
  );
  const palette = usePalette(() => ctrl);
  redrawOn(ctrl, () => [params.lambda, params.theta, points.length]);

  const rows = $derived.by(() => {
    const keV = (E: number) => fmt(E / e / 1e3, 4);
    const out: { label: string; value: string; unit?: string; color?: string; strong?: boolean }[] = [
      { label: 'shift Δλ = h/(m_e c)(1 − cos θ)', value: fmt(r.dLambda * 1e12, 4), unit: 'pm', strong: true },
      { label: "scattered λ'", value: fmt(r.lambda2 * 1e12, 4), unit: 'pm', color: '--series-4' },
      { label: 'photon energy before', value: keV(r.E1), unit: 'keV', color: '--series-1' },
      { label: 'photon energy after', value: keV(r.E2), unit: 'keV' },
      { label: 'electron kinetic energy', value: keV(r.K), unit: 'keV', color: '--series-3' },
      { label: 'electron speed', value: fmt(r.v / c, 3), unit: 'c' },
    ];
    if (points.length >= 2)
      out.push(
        { label: 'from the fit: h/(m_e c) = gradient', value: fmt(fit.slope, 3), unit: 'pm', color: '--series-2' },
        { label: 'so h = gradient × m_e c', value: fmt(fit.slope * 1e-12 * m_e * c, 3), unit: 'J s', color: '--series-2' },
      );
    return out;
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
      label="A photon scattering off an electron, with the momentum triangle and a graph of the wavelength shift"
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
      <Slider def={sl('lambda')} bind:value={params.lambda} />
      <Slider def={sl('theta')} bind:value={params.theta} />
      <RecordTable {points} xLabel="1 − cos θ" yLabel="Δλ / pm" onrecord={record} onclear={() => (points = [])} />
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
