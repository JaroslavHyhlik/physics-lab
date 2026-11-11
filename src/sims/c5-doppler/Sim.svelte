<script lang="ts">
  import { onMount } from 'svelte';
  import SimShell from '../../sim/SimShell.svelte';
  import SimCanvas from '../../sim/SimCanvas.svelte';
  import Readouts from '../../sim/Readouts.svelte';
  import Slider from '../../ui/Slider.svelte';
  import { SimController } from '../../sim/controller.svelte';
  import { useParams, usePalette, resetOn } from '../../sim/setup.svelte';
  import { View } from '../../sim/view';
  import type { SimEntry } from '../../app/registry';
  import type { NumberParamDef } from '../../sim/params.svelte';
  import type { SimInfo } from '../../sim/types';
  import { dopplerBoth } from '../../physics/doppler';
  import { drawWavefronts } from '../../sim/wavefronts';
  import { playTone } from '../../sim/tone';
  import { alpha } from '../../sim/palette';
  import { drawArrow, drawTag } from '../../sim/draw';
  import { fmt } from '../../core/format';

  let { entry }: { entry: SimEntry } = $props();
  const sliders: NumberParamDef[] = [
    { key: 'f', label: 'Frequency of the source', symbol: 'f', unit: 'Hz', min: 100, max: 1000, step: 10 },
    { key: 'us', label: 'Speed of the source (to the right)', symbol: 'u_s', unit: 'm s⁻¹', min: 0, max: 300, step: 1 },
    { key: 'uo', label: 'Speed of observer A (towards the source)', symbol: 'u_o', unit: 'm s⁻¹', min: 0, max: 100, step: 1 },
    { key: 'v', label: 'Speed of sound', symbol: 'v', unit: 'm s⁻¹', min: 300, max: 360, step: 1 },
  ];
  const { params, sl } = useParams({ f: 440, us: 40, uo: 0, v: 340 }, sliders);
  const presets = [
    { id: 'ambulance', label: 'Ambulance siren passing (40 m s⁻¹)', values: { f: 440, us: 40, uo: 0 } },
    { id: 'still', label: 'Source at rest', values: { f: 440, us: 0, uo: 0 } },
    { id: 'observer', label: 'Observer moving towards a still source', values: { f: 440, us: 0, uo: 40 } },
    { id: 'fast', label: 'Very fast source (250 m s⁻¹)', values: { f: 300, us: 250, uo: 0 } },
  ];
  const info: SimInfo = {
    about: [
      'A source emits sound waves of frequency f. If it moves, each new wavefront starts from a point closer to the observers in front and further from those behind. The wavefronts are squashed together in front (shorter wavelength, higher frequency heard) and stretched out behind (lower frequency).',
      'If the observer moves towards a stationary source, they meet the wavefronts more often, so they also hear a higher frequency — but for a different reason: the wavelength does not change.',
      'This is why a passing siren drops in pitch. The same effect for light gives the redshift of galaxies and is used in speed cameras and Doppler ultrasound.',
    ],
    formulas: [
      { label: 'Moving source', tex: "f' = f\\,\\dfrac{v}{v \\pm u_s}", hl: true },
      { label: 'Moving observer', tex: "f' = f\\,\\dfrac{v \\pm u_o}{v}", hl: true },
      { label: 'Light (u ≪ c)', tex: '\\dfrac{\\Delta f}{f} = \\dfrac{\\Delta\\lambda}{\\lambda} \\approx \\dfrac{v}{c}' },
    ],
    assumptions: [
      'Still air, motion along one straight line, observers on that line. In the formulas the upper sign applies when source and observer approach each other.',
      'Time is slowed down 20 times; only every few wavefronts are drawn so that they can be seen (the real wavelength is shown in the readouts).',
    ],
    tryThis: [
      'With the ambulance preset, calculate the frequency heard in front and behind and check with the readouts. Play both sounds.',
      'Compare: source moving at 40 m s⁻¹ towards a still observer, and observer moving at 40 m s⁻¹ towards a still source. Are the frequencies the same?',
      'Make the source speed approach the speed of sound. What happens to the wavefronts in front of it?',
    ],
  };

  const view = new View();
  let ctx: CanvasRenderingContext2D | null = null;
  let t = 0;
  const SLOW = 0.05;
  const XS0 = -40;
  const XA = 45;
  const XB = -45;
  const fA = () => dopplerBoth(params.f, params.v, params.uo, params.us); // source approaches A
  const fB = () => dopplerBoth(params.f, params.v, 0, -params.us); // source recedes from B

  function draw() {
    if (!ctx) return;
    const pal = palette.pal;
    const W = view.width;
    const usable = view.height - 76;
    ctx.fillStyle = pal.bg;
    ctx.fillRect(0, 0, W, view.height);
    const wArea = W > 760 ? W - 270 : W;
    const scale = (wArea - 40) / 110;
    const X = (x: number) => wArea / 2 + x * scale;
    const Y = (y: number) => usable / 2 - y * scale;
    const lam = params.v / params.f;
    const skip = Math.max(1, Math.ceil(28 / (lam * scale)));
    const xs = XS0 + params.us * t;
    drawWavefronts(ctx, X, Y, scale, t, params.f, params.v, XS0, params.us, 120, alpha(pal.series[0].startsWith('#') ? pal.series[0] : '#3b82f6', 0.55), skip);
    // source
    ctx.fillStyle = pal.series[3];
    ctx.beginPath();
    ctx.arc(X(xs), Y(0), 9, 0, Math.PI * 2);
    ctx.fill();
    if (params.us > 0) drawArrow(ctx, X(xs), Y(0) - 22, X(xs) + Math.max(20, params.us * scale * 0.15), Y(0) - 22, pal.series[3], 'u_s', 2);
    // observers
    const xa = XA - params.uo * t;
    for (const [x, name, f] of [
      [xa, 'A', fA()],
      [XB, 'B', fB()],
    ] as [number, string, number][]) {
      ctx.fillStyle = pal.ink;
      ctx.beginPath();
      ctx.arc(X(x), Y(0), 7, 0, Math.PI * 2);
      ctx.fill();
      drawTag(ctx, X(x), Y(0) + 26, `${name}: ${fmt(f, 4)} Hz`, pal.ink, pal.surface);
    }
    if (params.uo > 0) drawArrow(ctx, X(xa), Y(0) - 22, X(xa) - 30, Y(0) - 22, pal.ink, 'u_o', 2);
    drawTag(ctx, wArea / 2, usable - 14, `every ${skip === 1 ? '' : skip + 'th '}wavefront shown · time slowed 20×`, pal.text3, pal.surface);
  }

  const ctrl: SimController = new SimController(
    {
      step: (dt) => {
        t += dt * SLOW;
        if (XS0 + params.us * t > 42 || t > 2.5) {
          t = 0;
        }
      },
      render: draw,
      reset: () => {
        t = 0;
      },
    },
    { dt: 1 / 240, autoplay: true },
  );
  const palette = usePalette(() => ctrl);
  resetOn(ctrl, () => [params.f, params.us, params.uo, params.v]);

  const rows = $derived([
    { label: 'source frequency f', value: fmt(params.f, 4), unit: 'Hz' },
    { label: "A in front: f′ = f(v + u_o)/(v − u_s)", value: fmt(fA(), 4), unit: 'Hz', strong: true },
    { label: "B behind: f′ = fv/(v + u_s)", value: fmt(fB(), 4), unit: 'Hz', strong: true },
    { label: 'wavelength in front / behind', value: `${fmt((params.v - params.us) / params.f, 3)} / ${fmt((params.v + params.us) / params.f, 3)}`, unit: 'm' },
  ]);

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
      label="Wavefronts from a moving sound source and two observers"
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
      <Slider def={sl('f')} bind:value={params.f} />
      <Slider def={sl('us')} bind:value={params.us} />
      <Slider def={sl('uo')} bind:value={params.uo} />
      <Slider def={sl('v')} bind:value={params.v} />
      <div class="play">
        <button type="button" onclick={() => playTone(fA())}>Hear A (in front)</button>
        <button type="button" onclick={() => playTone(fB())}>Hear B (behind)</button>
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
  .play {
    display: flex;
    gap: var(--space-2);
  }
  .play button {
    flex: 1;
    min-height: 44px;
    border-radius: var(--radius-s);
    border: 1px solid var(--accent);
    background: var(--accent);
    color: var(--on-accent);
    font: inherit;
    font-weight: 600;
    cursor: pointer;
  }
</style>
