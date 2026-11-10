<script lang="ts">
  import { onMount } from 'svelte';
  import SimShell from '../../sim/SimShell.svelte';
  import SimCanvas from '../../sim/SimCanvas.svelte';
  import Readouts from '../../sim/Readouts.svelte';
  import Slider from '../../ui/Slider.svelte';
  import Segmented from '../../ui/Segmented.svelte';
  import Formula from '../../ui/Formula.svelte';
  import { SimController } from '../../sim/controller.svelte';
  import { useParams, usePalette, redrawOn } from '../../sim/setup.svelte';
  import { View } from '../../sim/view';
  import type { SimEntry } from '../../app/registry';
  import type { NumberParamDef } from '../../sim/params.svelte';
  import type { SimInfo } from '../../sim/types';
  import { gamma, lorentzSI, velocityAdd } from '../../physics/relativity';
  import { c } from '../../core/constants';
  import { drawArrow, drawTag } from '../../sim/draw';

  let { entry }: { entry: SimEntry } = $props();
  const sliders: NumberParamDef[] = [
    { key: 'beta', label: 'Speed of frame S′', symbol: 'v/c', unit: '', min: -0.99, max: 0.99, step: 0.01 },
    { key: 'x', label: 'Event position in S', symbol: 'x', unit: 'm', min: -3000, max: 3000, step: 10 },
    { key: 't', label: 'Event time in S', symbol: 't', unit: 'μs', min: -10, max: 10, step: 0.05 },
    { key: 'v', label: 'Rocket speed (seen from Earth)', symbol: 'v/c', unit: '', min: 0, max: 0.99, step: 0.01 },
    { key: 'up', label: 'Probe speed (seen from the rocket)', symbol: 'u′/c', unit: '', min: -1, max: 1, step: 0.01 },
  ];
  const { params, sl } = useParams({ mode: 'calc', beta: 0.6, x: 900, t: 4, v: 0.8, up: 0.8 }, sliders);
  const presets = [
    { id: 'calc', label: 'Event: x = 900 m, t = 4 μs, v = 0.6c', values: { mode: 'calc', beta: 0.6, x: 900, t: 4 } },
    { id: 'sim', label: 'Simultaneous in S, not in S′', values: { mode: 'calc', beta: 0.6, x: 1500, t: 0 } },
    { id: 'add', label: '0.8c + 0.8c is not 1.6c', values: { mode: 'vel', v: 0.8, up: 0.8 } },
    { id: 'light', label: 'Light from a moving rocket', values: { mode: 'vel', v: 0.9, up: 1 } },
  ];
  const info: SimInfo = {
    about: [
      'An event is something that happens at one place at one instant, described in frame S by (x, t). An observer in frame S′, moving at velocity v along x, describes the same event by (x′, t′). For speeds close to c these are related by the Lorentz transformation, not by the Galilean one.',
      'The Lorentz transformation mixes space and time: t′ depends on x. That is why two events that happen at the same time in S, at different places, do not happen at the same time in S′.',
      'Velocities do not simply add. A probe launched at u′ from a rocket moving at v has speed u = (u′ + v)/(1 + u′v/c²) relative to the Earth. The result never exceeds c, and light (u′ = c) has speed c in every frame.',
    ],
    formulas: [
      { label: 'Lorentz transformation', tex: "x' = \\gamma(x - vt), \\qquad t' = \\gamma\\left(t - \\dfrac{vx}{c^{2}}\\right)", hl: true },
      { label: 'Intervals', tex: "\\Delta x' = \\gamma(\\Delta x - v\\Delta t), \\qquad \\Delta t' = \\gamma\\left(\\Delta t - \\dfrac{v\\Delta x}{c^{2}}\\right)", hl: true },
      { label: 'Relativistic velocity addition', tex: "u' = \\dfrac{u - v}{1 - \\dfrac{uv}{c^{2}}}", hl: true },
      { label: 'Lorentz factor', tex: '\\gamma = \\dfrac{1}{\\sqrt{1 - \\dfrac{v^{2}}{c^{2}}}}', hl: true },
      { label: 'Spacetime interval (invariant)', tex: "(ct')^{2} - x'^{2} = (ct)^{2} - x^{2}", hl: true },
    ],
    assumptions: [
      'One space dimension; S′ moves along +x at constant velocity v; the origins coincide at x = x′ = 0 when t = t′ = 0.',
      'c = 3.00 × 10⁸ m s⁻¹ (data booklet value).',
      'Velocity addition: all velocities along the same line; a negative u′ means the probe is fired backwards.',
    ],
    tryThis: [
      'Set t = 0 and x ≠ 0: is the event at t′ = 0 too? What does that mean for simultaneity?',
      'Find an event with t′ < 0 although t > 0. Is (ct)² − x² positive or negative for it?',
      'Fire the probe backwards at u′ = −v. What speed does the Earth observer measure?',
      'Set u′ = 1 (a light pulse) and change v: what happens to u?',
    ],
  };

  // ---------- calculator: numbers in TeX ----------
  function num(n: number, sig = 3): string {
    if (n === 0 || !Number.isFinite(n)) return n === 0 ? '0' : '\\infty';
    const e = Math.floor(Math.log10(Math.abs(n)));
    if (e >= -2 && e <= 3) return n.toFixed(Math.max(0, sig - 1 - e));
    let m = n / 10 ** e;
    let ee = e;
    if (Math.abs(Number(m.toFixed(sig - 1))) >= 10) {
      m /= 10;
      ee += 1;
    }
    return `${m.toFixed(sig - 1)} \\times 10^{${ee}}`;
  }
  const p = (n: number, sig = 3) => (n < 0 ? `(${num(n, sig)})` : num(n, sig));
  const steps = $derived.by(() => {
    const b = params.beta;
    const g = gamma(b);
    const x = params.x;
    const t = params.t * 1e-6;
    const [xp, tp] = lorentzSI(x, t, b * c);
    const vt = b * c * t;
    const vxc2 = (b * x) / c;
    const s2 = (c * t) ** 2 - x * x;
    const s2p = (c * tp) ** 2 - xp * xp;
    const sign = Math.abs(s2) < 1e-6 * (x * x + (c * t) ** 2) ? 'lightlike' : s2 > 0 ? 'timelike' : 'spacelike';
    return {
      xp,
      tp,
      g,
      list: [
        { what: 'Lorentz factor', tex: `\\gamma = \\dfrac{1}{\\sqrt{1 - ${p(b, 2)}^{2}}} = ${num(g, 4)}` },
        { what: 'Distance S′ has moved', tex: `vt = ${p(b, 2)} \\times ${num(c)} \\times ${p(t)} = ${num(vt)}\\ \\text{m}` },
        { what: 'Position in S′', tex: `x' = \\gamma(x - vt) = ${num(g, 4)}\\,\\bigl(${num(x)} - ${p(vt)}\\bigr) = \\mathbf{${num(xp)}\\ \\text{m}}` },
        { what: 'Time shift', tex: `\\dfrac{vx}{c^{2}} = \\dfrac{${p(b, 2)} \\times ${p(x)}}{${num(c)}} = ${num(vxc2)}\\ \\text{s}` },
        { what: 'Time in S′', tex: `t' = \\gamma\\left(t - \\dfrac{vx}{c^{2}}\\right) = ${num(g, 4)}\\,\\bigl(${num(t)} - ${p(vxc2)}\\bigr) = \\mathbf{${num(tp)}\\ \\text{s}}` },
        {
          what: `Check: the interval is the same (${sign})`,
          tex: `(ct)^{2} - x^{2} = ${num(s2)}\\ \\text{m}^{2}, \\qquad (ct')^{2} - x'^{2} = ${num(s2p)}\\ \\text{m}^{2}`,
        },
      ],
    };
  });

  // ---------- velocity addition: canvas ----------
  const view = new View();
  let ctx: CanvasRenderingContext2D | null = null;

  function drawCalc() {
    if (!ctx) return;
    const pal = palette.pal;
    const b = params.beta;
    const x = params.x;
    const ct = c * params.t * 1e-6;
    const { xp, tp, g } = steps;
    const ctp = c * tp;
    const R = 1.35 * Math.max(Math.abs(x), Math.abs(ct), Math.abs(xp), Math.abs(ctp), 300);
    view.fit(-R, R, -R, R, 18, 18);
    ctx.fillStyle = pal.bg;
    ctx.fillRect(0, 0, view.width, view.height);
    const L = (x1: number, y1: number, x2: number, y2: number) => {
      ctx!.beginPath();
      ctx!.moveTo(view.sx(x1), view.sy(y1));
      ctx!.lineTo(view.sx(x2), view.sy(y2));
      ctx!.stroke();
    };
    // light lines
    ctx.strokeStyle = pal.hl;
    ctx.setLineDash([4, 4]);
    L(-R, -R, R, R);
    L(-R, R, R, -R);
    ctx.setLineDash([]);
    // S axes
    ctx.strokeStyle = pal.text2;
    ctx.lineWidth = 1.5;
    L(-R, 0, R, 0);
    L(0, -R, 0, R);
    // S′ axes: ct′ along (β, 1), x′ along (1, β)
    ctx.strokeStyle = pal.series[1];
    L(-R * b, -R, R * b, R);
    L(-R, -R * b, R, R * b);
    ctx.lineWidth = 1;
    ctx.fillStyle = pal.text2;
    ctx.font = '600 12px Inter Variable, system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('x', view.sx(R) - 4, view.sy(0) - 6);
    ctx.textAlign = 'left';
    ctx.fillText('ct', view.sx(0) + 6, view.sy(R) + 12);
    ctx.fillStyle = pal.series[1];
    ctx.fillText('ct′', view.sx(R * b) + 6, view.sy(R) + 12);
    ctx.textAlign = 'right';
    ctx.fillText('x′', view.sx(R) - 4, view.sy(R * b) - 6);
    // reading the coordinates: lines through E parallel to the axes
    const onCtp = [g * b * ctp, g * ctp]; // S coordinates of (x′ = 0, ct′)
    const onXp = [g * xp, g * b * xp]; // S coordinates of (x′, ct′ = 0)
    ctx.setLineDash([3, 4]);
    ctx.strokeStyle = pal.text3;
    L(x, ct, x, 0);
    L(x, ct, 0, ct);
    ctx.strokeStyle = pal.series[1];
    L(x, ct, onCtp[0], onCtp[1]);
    L(x, ct, onXp[0], onXp[1]);
    ctx.setLineDash([]);
    ctx.fillStyle = pal.series[1];
    for (const q of [onCtp, onXp]) {
      ctx.beginPath();
      ctx.arc(view.sx(q[0]), view.sy(q[1]), 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = pal.series[0];
    ctx.beginPath();
    ctx.arc(view.sx(x), view.sy(ct), 7, 0, Math.PI * 2);
    ctx.fill();
    drawTag(ctx, view.sx(x), view.sy(ct) - 18, 'event', pal.series[0], pal.surface);
    drawTag(ctx, view.sx(onCtp[0]), view.sy(onCtp[1]) - 14, `ct′ = ${num2(ctp)} m`, pal.series[1], pal.surface);
    drawTag(ctx, view.sx(onXp[0]), view.sy(onXp[1]) + 16, `x′ = ${num2(xp)} m`, pal.series[1], pal.surface);
    ctx.fillStyle = pal.text3;
    ctx.font = '500 10px Inter Variable, system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('ct in metres; light lines at 45°', 8, view.height - 8);
  }
  const num2 = (n: number) => (Math.abs(n) >= 1e4 ? n.toExponential(2) : n.toFixed(0));

  function draw() {
    if (!ctx) return;
    if (params.mode === 'calc') return drawCalc();
    const pal = palette.pal;
    const W = view.width;
    const usable = view.height - 20;
    const v = params.v;
    const up = params.up;
    const u = velocityAdd(up, -v);
    const gal = up + v;
    ctx.fillStyle = pal.bg;
    ctx.fillRect(0, 0, W, view.height);
    ctx.textBaseline = 'alphabetic';
    // scene
    const sceneW = W > 700 ? W * 0.62 : W;
    const yr = usable * 0.17;
    const rx = sceneW * 0.3;
    ctx.fillStyle = pal.text2;
    ctx.beginPath();
    ctx.moveTo(rx - 50, yr - 12);
    ctx.lineTo(rx + 22, yr - 12);
    ctx.lineTo(rx + 44, yr);
    ctx.lineTo(rx + 22, yr + 12);
    ctx.lineTo(rx - 50, yr + 12);
    ctx.closePath();
    ctx.fill();
    const k = sceneW * 0.16; // px per c for arrows
    if (v > 0.005) drawArrow(ctx, rx - 10, yr + 30, rx - 10 + v * k, yr + 30, pal.series[1], 'v', 2);
    const px = rx + 80;
    ctx.fillStyle = up === 1 || up === -1 ? pal.hl : pal.series[0];
    ctx.beginPath();
    ctx.arc(px, yr, 7, 0, Math.PI * 2);
    ctx.fill();
    if (Math.abs(up) > 0.005) drawArrow(ctx, px, yr - 22, px + up * k, yr - 22, pal.series[2], 'u′', 2);
    ctx.fillStyle = pal.text3;
    ctx.font = '500 11px Inter Variable, system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(Math.abs(up) === 1 ? 'light pulse' : 'probe', px - 14, yr + 24);
    ctx.fillText('rocket', rx - 46, yr + 50);
    ctx.fillText('arrows: speeds measured in different frames (v from Earth, u′ from the rocket)', 12, usable * 0.36);
    // bars
    const bx0 = 150;
    const bx1 = W - 24;
    const lo = -1;
    const hi = 2;
    const X = (s: number) => bx0 + ((s - lo) / (hi - lo)) * (bx1 - bx0);
    const bars = [
      { label: 'rocket v', val: v, col: pal.series[1] },
      { label: 'probe u′ (in rocket)', val: up, col: pal.series[2] },
      { label: 'Galilean u′ + v', val: gal, col: pal.series[3] },
      { label: 'relativistic u', val: u, col: pal.series[0] },
    ];
    const by0 = usable * 0.42;
    const bh = Math.min(22, usable * 0.045);
    bars.forEach((b, i) => {
      const y = by0 + i * (bh + 8);
      ctx!.fillStyle = pal.text2;
      ctx!.font = '600 11px Inter Variable, system-ui, sans-serif';
      ctx!.textAlign = 'right';
      ctx!.fillText(b.label, bx0 - 8, y + bh * 0.7);
      ctx!.fillStyle = b.col;
      ctx!.fillRect(Math.min(X(0), X(b.val)), y, Math.abs(X(b.val) - X(0)), bh);
      ctx!.textAlign = b.val >= 0 ? 'left' : 'right';
      ctx!.fillStyle = pal.ink;
      ctx!.fillText(`${b.val.toFixed(3)}c`, X(b.val) + (b.val >= 0 ? 6 : -6), y + bh * 0.7);
    });
    const byEnd = by0 + 4 * (bh + 8);
    ctx.strokeStyle = pal.negative;
    ctx.setLineDash([5, 4]);
    for (const s of [1, -1]) {
      ctx.beginPath();
      ctx.moveTo(X(s), by0 - 8);
      ctx.lineTo(X(s), byEnd);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.strokeStyle = pal.gridStrong;
    ctx.beginPath();
    ctx.moveTo(X(0), by0 - 8);
    ctx.lineTo(X(0), byEnd);
    ctx.stroke();
    ctx.fillStyle = pal.negative;
    ctx.textAlign = 'center';
    ctx.fillText('c', X(1), by0 - 12);
    ctx.fillText('−c', X(-1), by0 - 12);
    // graph u(u′)
    const gy0 = byEnd + 30;
    const gy1 = usable - 30;
    if (gy1 - gy0 < 80) return;
    const gx0 = 60;
    const gx1 = Math.min(W - 24, gx0 + (gy1 - gy0) * 2.2);
    const GX = (s: number) => gx0 + ((s + 1) / 2) * (gx1 - gx0);
    const GY = (s: number) => gy1 - ((s + 1) / 3) * (gy1 - gy0);
    ctx.strokeStyle = pal.grid;
    ctx.lineWidth = 1;
    for (const s of [-1, -0.5, 0, 0.5, 1]) {
      ctx.beginPath();
      ctx.moveTo(GX(s), gy0);
      ctx.lineTo(GX(s), gy1);
      ctx.stroke();
    }
    for (const s of [-1, 0, 1, 2]) {
      ctx.beginPath();
      ctx.moveTo(gx0, GY(s));
      ctx.lineTo(gx1, GY(s));
      ctx.stroke();
    }
    ctx.fillStyle = pal.text3;
    ctx.font = '500 10px Inter Variable, system-ui, sans-serif';
    ctx.textAlign = 'right';
    for (const s of [-1, 0, 1, 2]) ctx.fillText(`${s}`, gx0 - 6, GY(s) + 3);
    ctx.textAlign = 'center';
    for (const s of [-1, -0.5, 0, 0.5, 1]) ctx.fillText(`${s}`, GX(s), gy1 + 13);
    ctx.fillText('probe speed in the rocket u′/c', (gx0 + gx1) / 2, gy1 + 26);
    ctx.save();
    ctx.translate(16, (gy0 + gy1) / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('speed from Earth u/c', 0, 0);
    ctx.restore();
    ctx.strokeStyle = pal.negative;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.moveTo(gx0, GY(1));
    ctx.lineTo(gx1, GY(1));
    ctx.stroke();
    ctx.strokeStyle = pal.series[3];
    ctx.beginPath();
    ctx.moveTo(GX(-1), GY(-1 + v));
    ctx.lineTo(GX(1), GY(1 + v));
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = pal.series[0];
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let i = 0; i <= 100; i++) {
      const s = -1 + i / 50;
      const y = velocityAdd(s, -v);
      if (i === 0) ctx.moveTo(GX(s), GY(y));
      else ctx.lineTo(GX(s), GY(y));
    }
    ctx.stroke();
    ctx.lineWidth = 1;
    ctx.fillStyle = pal.series[0];
    ctx.beginPath();
    ctx.arc(GX(up), GY(u), 6, 0, Math.PI * 2);
    ctx.fill();
    drawTag(ctx, GX(up), GY(u) - 16, `u = ${u.toFixed(3)}c`, pal.series[0], pal.surface);
  }

  const ctrl = new SimController({ step: () => {}, render: draw, reset: () => {} }, { dt: 1, autoplay: false });
  const palette = usePalette(() => ctrl);
  redrawOn(ctrl, () => [params.mode, params.v, params.up, params.beta, params.x, params.t]);

  const rows = $derived.by(() => {
    const u = velocityAdd(params.up, -params.v);
    return [
      { label: 'γ of the rocket', value: gamma(params.v).toFixed(4) },
      { label: 'Galilean u′ + v', value: (params.up + params.v).toFixed(3), unit: 'c', color: '--series-4' },
      { label: 'relativistic u', value: u.toFixed(4), unit: 'c', color: '--series-1', strong: true },
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
    <div class="split" class:calcmode={params.mode === 'calc'}>
      <div class="cv">
        <SimCanvas
          {view}
          label={params.mode === 'calc' ? 'Event on a spacetime diagram' : 'Relativistic velocity addition'}
          onready={(c2) => {
            ctx = c2;
            ctrl.invalidate();
          }}
          onresize={() => ctrl.invalidate()}
        />
      </div>
      {#if params.mode === 'calc'}
      <div class="calc" aria-live="polite">
        <p class="given">
          Event in S: <b>x = {params.x} m</b>, <b>t = {params.t} μs</b>. Frame S′ moves at <b>v = {params.beta}c</b>.
        </p>
        <ol>
          {#each steps.list as s (s.what)}
            <li>
              <span class="what">{s.what}</span>
              <Formula tex={s.tex} display />
            </li>
          {/each}
        </ol>
      </div>
      {/if}
    </div>
  {/snippet}
  {#snippet readouts()}
    {#if params.mode === 'vel'}<Readouts {rows} />{/if}
  {/snippet}
  {#snippet controls()}
    <div class="controls">
      <Segmented
        label="Tool"
        bind:value={params.mode}
        options={[
          { value: 'calc', label: 'Event calculator' },
          { value: 'vel', label: 'Adding velocities' },
        ]}
      />
      {#if params.mode === 'calc'}
        <Slider def={sl('beta')} bind:value={params.beta} />
        <Slider def={sl('x')} bind:value={params.x} />
        <Slider def={sl('t')} bind:value={params.t} />
      {:else}
        <Slider def={sl('v')} bind:value={params.v} />
        <Slider def={sl('up')} bind:value={params.up} />
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
  .split {
    position: absolute;
    inset: 0;
    display: grid;
    grid-template-columns: 1fr;
    grid-template-rows: 1fr;
  }
  .split.calcmode {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  }
  .cv {
    min-width: 0;
    min-height: 0;
  }
  @media (max-width: 760px) {
    .split.calcmode {
      grid-template-columns: 1fr;
      grid-template-rows: minmax(0, 1fr) minmax(0, 1fr);
    }
  }
  .calc {
    min-height: 0;
    overflow: auto;
    border-left: 1px solid var(--border);
    padding: var(--space-4) var(--space-4) var(--space-6);
    color: var(--text);
    font-size: var(--text-sm);
  }
  .given {
    margin: 0 0 var(--space-3);
  }
  ol {
    margin: 0;
    padding-left: var(--space-5);
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  .what {
    color: var(--text-2);
    font-size: var(--text-xs);
    font-weight: 600;
  }
  li :global(.katex) {
    font-size: 1em;
  }
  li :global(.katex-display) {
    margin: var(--space-1) 0;
    overflow-x: auto;
    overflow-y: hidden;
  }
</style>
