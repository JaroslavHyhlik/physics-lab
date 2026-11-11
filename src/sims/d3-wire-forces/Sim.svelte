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
  import type { SimEntry } from '../../app/registry';
  import type { NumberParamDef } from '../../sim/params.svelte';
  import type { SimInfo } from '../../sim/types';
  import { wireForce, parallelForcePerLength } from '../../physics/wireForce';
  import { alpha } from '../../sim/palette';
  import { drawArrow, drawTag } from '../../sim/draw';
  import { fmt } from '../../core/format';

  let { entry }: { entry: SimEntry } = $props();
  const sliders: NumberParamDef[] = [
    { key: 'B', label: 'Magnetic flux density', symbol: 'B', unit: 'T', min: 0.01, max: 1, step: 0.01 },
    { key: 'I', label: 'Current in the wire', symbol: 'I', unit: 'A', min: -10, max: 10, step: 0.1 },
    { key: 'L', label: 'Length of wire in the field', symbol: 'L', unit: 'm', min: 0.02, max: 0.2, step: 0.005 },
    { key: 'th', label: 'Angle between wire and field', symbol: 'θ', unit: '°', min: 0, max: 180, step: 1 },
    { key: 'I1', label: 'Current in wire 1', symbol: 'I_1', unit: 'A', min: -50, max: 50, step: 1 },
    { key: 'I2', label: 'Current in wire 2', symbol: 'I_2', unit: 'A', min: -50, max: 50, step: 1 },
    { key: 'r', label: 'Separation', symbol: 'r', unit: 'cm', min: 0.5, max: 10, step: 0.1 },
  ];
  const { params, sl } = useParams({ mode: 'motor', B: 0.2, I: 5, L: 0.1, th: 90, I1: 20, I2: 20, r: 2 }, sliders);
  const presets = [
    { id: 'motor', label: 'Motor effect: wire across a field', values: { mode: 'motor', th: 90, I: 5, B: 0.2 } },
    { id: 'parallel', label: 'Wire along the field: no force', values: { mode: 'motor', th: 0 } },
    { id: 'same', label: 'Parallel currents attract', values: { mode: 'wires', I1: 20, I2: 20 } },
    { id: 'opp', label: 'Opposite currents repel', values: { mode: 'wires', I1: 20, I2: -20 } },
  ];
  const info: SimInfo = {
    about: [
      'A current-carrying wire in a magnetic field feels a force (the motor effect): F = BIL sin θ, where θ is the angle between the wire and the field. The force is at right angles to both the wire and the field (Fleming’s left-hand rule: First finger = Field, seCond finger = Current, thuMb = Motion).',
      'There is no force when the wire is parallel to the field, and the largest force when it is perpendicular.',
      'Two parallel wires each sit in the other’s magnetic field, so they push or pull each other: currents in the same direction attract, opposite currents repel. The forces are equal and opposite (Newton’s third law): F/L = μ₀I₁I₂/(2πr). This was once used to define the ampere.',
    ],
    formulas: [
      { label: 'Force on a conductor', tex: 'F = BIL\\sin\\theta' },
      { label: 'Force between parallel wires', tex: '\\dfrac{F}{L} = \\mu_0\\dfrac{I_1I_2}{2\\pi r}' },
    ],
    assumptions: [
      'Uniform field between the poles; straight wires; the wires in the second experiment are long compared with their separation.',
      'Symbols: • current or force out of the screen, × into the screen. μ₀ from the data booklet.',
    ],
    tryThis: [
      'Turn the wire from 0° to 90°. How does the force change? Plot F against sin θ in your head.',
      'Reverse the current. What happens to the force?',
      'Two wires: halve the separation. By what factor does the force change?',
    ],
  };

  const view = new View();
  let ctx: CanvasRenderingContext2D | null = null;
  const rad = (d: number) => (d * Math.PI) / 180;

  function sym(x: number, y: number, out: boolean, r: number, col: string) {
    const pal = palette.pal;
    ctx!.fillStyle = pal.surface;
    ctx!.strokeStyle = col;
    ctx!.lineWidth = 2;
    ctx!.beginPath();
    ctx!.arc(x, y, r, 0, Math.PI * 2);
    ctx!.fill();
    ctx!.stroke();
    if (out) {
      ctx!.fillStyle = col;
      ctx!.beginPath();
      ctx!.arc(x, y, r * 0.3, 0, Math.PI * 2);
      ctx!.fill();
    } else {
      ctx!.beginPath();
      ctx!.moveTo(x - r * 0.55, y - r * 0.55);
      ctx!.lineTo(x + r * 0.55, y + r * 0.55);
      ctx!.moveTo(x + r * 0.55, y - r * 0.55);
      ctx!.lineTo(x - r * 0.55, y + r * 0.55);
      ctx!.stroke();
    }
    ctx!.lineWidth = 1;
  }

  function drawMotor(W: number, H: number) {
    const pal = palette.pal;
    const wArea = W > 760 ? W - 270 : W;
    const cx = wArea / 2;
    const cy = H / 2;
    const gap = Math.min(wArea * 0.6, 420);
    // poles
    ctx!.fillStyle = pal.series[3];
    ctx!.fillRect(cx - gap / 2 - 70, cy - 110, 70, 220);
    ctx!.fillStyle = pal.series[0];
    ctx!.fillRect(cx + gap / 2, cy - 110, 70, 220);
    ctx!.fillStyle = pal.surface;
    ctx!.font = '700 22px Inter Variable, system-ui, sans-serif';
    ctx!.textAlign = 'center';
    ctx!.textBaseline = 'middle';
    ctx!.fillText('N', cx - gap / 2 - 35, cy);
    ctx!.fillText('S', cx + gap / 2 + 35, cy);
    // field lines
    for (let y = cy - 90; y <= cy + 90; y += 30) drawArrow(ctx!, cx - gap / 2 + 6, y, cx + gap / 2 - 6, y, alpha(pal.text3.startsWith('#') ? pal.text3 : '#888888', 0.7), undefined, 1);
    drawTag(ctx!, cx, cy - 125, `B = ${fmt(params.B, 2)} T`, pal.text2, pal.surface);
    // wire at angle θ to the field (in the screen plane)
    const th = rad(params.th);
    const len = (params.L / 0.2) * Math.min(gap, 300);
    const dx = Math.cos(th) * len * 0.5;
    const dy = -Math.sin(th) * len * 0.5;
    ctx!.strokeStyle = pal.hl;
    ctx!.lineWidth = 6;
    ctx!.beginPath();
    ctx!.moveTo(cx - dx, cy - dy);
    ctx!.lineTo(cx + dx, cy + dy);
    ctx!.stroke();
    ctx!.lineWidth = 1;
    const s = Math.sign(params.I) || 1;
    drawArrow(ctx!, cx - dx * 0.4 * s, cy - dy * 0.4 * s, cx + dx * 0.4 * s, cy + dy * 0.4 * s, pal.ink, 'I', 2);
    // force out of / into the screen
    const F = wireForce(params.I, params.L, [Math.cos(th), Math.sin(th), 0], [params.B, 0, 0]);
    if (Math.abs(F[2]) > 1e-9) {
      sym(cx, cy + 60, F[2] > 0, 16, pal.series[2]);
      drawTag(ctx!, cx, cy + 92, `force ${fmt(Math.abs(F[2]), 3)} N ${F[2] > 0 ? 'out of' : 'into'} the screen`, pal.series[2], pal.surface);
    } else drawTag(ctx!, cx, cy + 60, 'no force (wire along the field)', pal.text2, pal.surface);
    drawTag(ctx!, cx + dx + 14, cy + dy - 18, `θ = ${params.th.toFixed(0)}°`, pal.text2, pal.surface);
  }

  function drawWires(W: number, H: number) {
    const pal = palette.pal;
    const wArea = W > 760 ? W - 270 : W;
    const cx = wArea / 2;
    const cy = H / 2;
    const sep = 110 + (params.r / 10) * wArea * 0.45;
    const x1 = cx - sep / 2;
    const x2 = cx + sep / 2;
    // field circles around each wire
    for (const [x, I] of [
      [x1, params.I1],
      [x2, params.I2],
    ] as [number, number][]) {
      if (I === 0) continue;
      ctx!.strokeStyle = alpha(pal.series[0].startsWith('#') ? pal.series[0] : '#3b82f6', 0.35);
      for (const rr of [30, 55, 85]) {
        ctx!.beginPath();
        ctx!.arc(x, cy, rr, 0, Math.PI * 2);
        ctx!.stroke();
        // direction arrow at the top of the circle: anticlockwise for current out of the screen
        const dir = I > 0 ? -1 : 1;
        drawArrow(ctx!, x - dir * 4, cy - rr, x + dir * 4, cy - rr, alpha(pal.series[0].startsWith('#') ? pal.series[0] : '#3b82f6', 0.7), undefined, 1);
      }
    }
    sym(x1, cy, params.I1 >= 0, 14, pal.ink);
    sym(x2, cy, params.I2 >= 0, 14, pal.ink);
    drawTag(ctx!, x1, cy + 110, `I₁ = ${params.I1} A`, pal.text2, pal.surface);
    drawTag(ctx!, x2, cy + 110, `I₂ = ${params.I2} A`, pal.text2, pal.surface);
    const f = parallelForcePerLength(params.I1, params.I2, params.r / 100);
    if (Math.abs(f) > 0) {
      const len = Math.min(sep / 2 - 22, 80, 20 + 25 * Math.log10(1 + Math.abs(f) * 1e4));
      const dir = Math.sign(f); // on wire 2 along +x
      drawArrow(ctx!, x2 + dir * 16, cy, x2 + dir * (16 + len), cy, pal.series[3], 'F', 3);
      drawArrow(ctx!, x1 - dir * 16, cy, x1 - dir * (16 + len), cy, pal.series[3], 'F', 3);
      drawTag(ctx!, cx, cy - 120, f < 0 ? 'attract' : 'repel', pal.series[3], pal.surface);
    }
  }

  function draw() {
    if (!ctx) return;
    const pal = palette.pal;
    const W = view.width;
    const H = view.height;
    ctx.fillStyle = pal.bg;
    ctx.fillRect(0, 0, W, H);
    if (params.mode === 'motor') drawMotor(W, H);
    else drawWires(W, H);
  }

  const ctrl = new SimController({ step: () => {}, render: draw, reset: () => {} }, { dt: 1, autoplay: false });
  const palette = usePalette(() => ctrl);
  redrawOn(ctrl, () => [params.mode, params.B, params.I, params.L, params.th, params.I1, params.I2, params.r]);

  const rows = $derived.by(() => {
    if (params.mode === 'motor') {
      const F = Math.abs(params.B * params.I * params.L * Math.sin(rad(params.th)));
      return [
        { label: 'F = BIL sin θ', value: fmt(F, 4), unit: 'N', strong: true },
        { label: 'sin θ', value: Math.sin(rad(params.th)).toFixed(3) },
      ];
    }
    const f = parallelForcePerLength(params.I1, params.I2, params.r / 100);
    return [
      { label: 'F/L = μ₀I₁I₂/(2πr)', value: fmt(Math.abs(f), 4), unit: 'N m⁻¹', strong: true },
      { label: 'force on 1 m of each wire', value: fmt(Math.abs(f), 4), unit: 'N' },
      { label: 'the wires', value: f < 0 ? 'attract' : f > 0 ? 'repel' : 'no force' },
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
      label="Force on a current-carrying wire in a magnetic field, and between two parallel wires"
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
        label="Experiment"
        bind:value={params.mode}
        options={[
          { value: 'motor', label: 'Wire in a field' },
          { value: 'wires', label: 'Two wires' },
        ]}
      />
      {#if params.mode === 'motor'}
        <Slider def={sl('B')} bind:value={params.B} />
        <Slider def={sl('I')} bind:value={params.I} />
        <Slider def={sl('L')} bind:value={params.L} />
        <Slider def={sl('th')} bind:value={params.th} />
      {:else}
        <Slider def={sl('I1')} bind:value={params.I1} />
        <Slider def={sl('I2')} bind:value={params.I2} />
        <Slider def={sl('r')} bind:value={params.r} />
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
</style>
