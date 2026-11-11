<script lang="ts">
  import { onMount } from 'svelte';
  import SimShell from '../../sim/SimShell.svelte';
  import SimCanvas from '../../sim/SimCanvas.svelte';
  import Readouts from '../../sim/Readouts.svelte';
  import Segmented from '../../ui/Segmented.svelte';
  import { SimController } from '../../sim/controller.svelte';
  import { useParams, usePalette } from '../../sim/setup.svelte';
  import { View } from '../../sim/view';
  import type { SimEntry } from '../../app/registry';
  import type { SimInfo } from '../../sim/types';
  import { energyEV, radius, transition, A0 } from '../../physics/bohr';
  import { spectralRGB, rgbStr } from '../../sim/spectrumColor';
  import { drawArrow, drawTag } from '../../sim/draw';
  import { fmt } from '../../core/format';

  let { entry }: { entry: SimEntry } = $props();
  const { params } = useParams({ to: 2 }, []);
  const presets = [
    { id: 'ha', label: 'Red Balmer line: 3 → 2', values: { to: 2 } },
    { id: 'ly', label: 'Lyman α: 2 → 1', values: { to: 1 } },
  ];
  const info: SimInfo = {
    about: [
      'In Bohr’s model the electron in hydrogen can only move in certain orbits, those for which its angular momentum is a whole number of h/2π. Each orbit has a definite energy E_n = −13.6 eV/n². The energy is negative because the electron is bound: 13.6 eV is needed to free it from the ground state (n = 1).',
      'When the electron drops from a higher level to a lower one, the atom emits one photon carrying the energy difference: hf = E_upper − E_lower. To jump up, the atom must absorb a photon of exactly that energy.',
      'Jumps down to n = 1 give ultraviolet photons (Lyman series), down to n = 2 the visible Balmer lines, down to n = 3 infrared (Paschen).',
      'Choose a level below the picture: the electron jumps there and the photon appears.',
    ],
    formulas: [
      { label: 'Energy levels of hydrogen', tex: 'E = -\\dfrac{13.6}{n^{2}}\\ \\text{eV}', hl: true },
      { label: 'Quantised angular momentum', tex: 'mvr = \\dfrac{nh}{2\\pi}', hl: true },
      { label: 'Photon energy', tex: 'E = hf' },
    ],
    assumptions: [
      'Bohr’s semi-classical model: circular orbits, nucleus at rest. Orbit radii are drawn to scale (r = n²a₀) up to n = 5; the electron’s motion is slowed down enormously.',
      'Photon colours are shown only for visible wavelengths.',
    ],
    tryThis: [
      'Which jumps give visible light? Compare their wavelengths with the hydrogen spectrum.',
      'Find the jump that emits the photon with the largest energy.',
      'How much energy is needed to ionise hydrogen from n = 2?',
    ],
  };

  const view = new View();
  let ctx: CanvasRenderingContext2D | null = null;
  let level = $state(3);
  let photon: { from: number; to: number; age: number } | null = null;
  let t = 0;
  const NMAX = 6;
  const levelY = (n: number, y0: number, y1: number) => {
    // energy axis from −14 eV to +0.5 eV
    const E = energyEV(n);
    return y1 - ((E + 14) / 14.5) * (y1 - y0);
  };
  const geo = { lx0: 0, lx1: 0, y0: 0, y1: 0 };

  function jump(to: number) {
    if (to === level) return;
    photon = { from: level, to, age: 0 };
    level = to;
  }

  function draw() {
    if (!ctx) return;
    const pal = palette.pal;
    const W = view.width;
    const usable = view.height - 76;
    ctx.fillStyle = pal.bg;
    ctx.fillRect(0, 0, W, view.height);
    const wide = W > 760;
    // orbits
    const ox = wide ? W * 0.27 : W / 2;
    const oy = usable / 2;
    const scale = Math.min(wide ? W * 0.24 : W * 0.45, usable * 0.46) / radius(5);
    ctx.strokeStyle = pal.gridStrong;
    for (let n = 1; n <= 5; n++) {
      ctx.beginPath();
      ctx.arc(ox, oy, radius(n) * scale, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = pal.series[3];
    ctx.beginPath();
    ctx.arc(ox, oy, 5, 0, Math.PI * 2);
    ctx.fill();
    const n = Math.min(level, 5);
    const ang = t * (6 / (level * level * level));
    const ex = ox + Math.cos(ang) * radius(n) * scale;
    const ey = oy - Math.sin(ang) * radius(n) * scale;
    ctx.fillStyle = pal.series[0];
    ctx.beginPath();
    ctx.arc(ex, ey, 6, 0, Math.PI * 2);
    ctx.fill();
    // emitted / absorbed photon as a wavy arrow
    if (photon && photon.age < 1.6) {
      const tr = transition(Math.max(photon.from, photon.to), Math.min(photon.from, photon.to));
      const lnm = tr.lambda * 1e9;
      const col = lnm >= 380 && lnm <= 750 ? rgbStr(spectralRGB(lnm, 1, 2)) : pal.text2;
      const emit = photon.to < photon.from;
      const d0 = emit ? 0 : 1.6 - photon.age;
      const dist = (emit ? photon.age : d0) * 140;
      const px = ex + dist;
      ctx.strokeStyle = col;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      for (let k = 0; k <= 40; k++) {
        const x = px + k * 1.5;
        const y = ey - 20 + Math.sin(k * 0.6) * 6;
        if (k === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.lineWidth = 1;
      drawTag(ctx, px + 30, ey - 42, `${emit ? 'emitted' : 'absorbed'} photon ${fmt(lnm, 4)} nm`, pal.ink, pal.surface);
    }
    // energy level diagram
    const lx0 = wide ? W * 0.55 : 40;
    const lx1 = wide ? W - 290 : W - 20;
    const y0 = 30;
    const y1 = usable - 20;
    geo.lx0 = lx0;
    geo.lx1 = lx1;
    geo.y0 = y0;
    geo.y1 = y1;
    if (!wide) return;
    ctx.font = '500 11px Inter Variable, system-ui, sans-serif';
    ctx.textBaseline = 'middle';
    for (let k = 1; k <= NMAX; k++) {
      const y = levelY(k, y0, y1);
      ctx.strokeStyle = k === level ? pal.series[0] : pal.text2;
      ctx.lineWidth = k === level ? 3 : 1.5;
      ctx.beginPath();
      ctx.moveTo(lx0, y);
      ctx.lineTo(lx1, y);
      ctx.stroke();
      ctx.lineWidth = 1;
      ctx.fillStyle = pal.text2;
      ctx.textAlign = 'left';
      ctx.fillText(`n = ${k}`, lx1 + 6, y);
      ctx.textAlign = 'right';
      ctx.fillText(`${energyEV(k).toFixed(2)} eV`, lx0 - 6, y);
    }
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = pal.text3;
    ctx.beginPath();
    ctx.moveTo(lx0, levelY(1e9, y0, y1));
    ctx.lineTo(lx1, levelY(1e9, y0, y1));
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = pal.text3;
    ctx.textAlign = 'left';
    ctx.fillText('n = ∞ (0 eV)', lx1 + 6, levelY(1e9, y0, y1));
    if (photon) {
      const ya = levelY(photon.from, y0, y1);
      const yb = levelY(photon.to, y0, y1);
      drawArrow(ctx, (lx0 + lx1) / 2, ya, (lx0 + lx1) / 2, yb, pal.series[3], undefined, 2.5);
    }
  }

  const ctrl: SimController = new SimController(
    {
      step: (dt) => {
        t += dt;
        if (photon) photon.age += dt;
      },
      render: draw,
      reset: () => {
        t = 0;
        if (photon) photon.age = 0; // replay the last jump
      },
    },
    { dt: 1 / 120, autoplay: true },
  );
  const palette = usePalette(() => ctrl);
  $effect(() => {
    const to = Number(params.to);
    if (to && to !== level) jump(to);
  });

  const rows = $derived.by(() => {
    void ctrl.renderCount;
    const r: { label: string; value: string; unit?: string; strong?: boolean }[] = [
      { label: 'electron in level', value: `n = ${level}` },
      { label: 'energy E_n', value: fmt(energyEV(level), 4), unit: 'eV' },
      { label: 'orbit radius n²a₀', value: fmt(level * level * A0 * 1e9, 3), unit: 'nm' },
    ];
    if (photon) {
      const tr = transition(Math.max(photon.from, photon.to), Math.min(photon.from, photon.to));
      r.push({ label: 'photon energy ΔE', value: fmt(tr.dEeV, 4), unit: 'eV', strong: true });
      r.push({ label: 'wavelength λ = hc/ΔE', value: fmt(tr.lambda * 1e9, 4), unit: 'nm', strong: true });
      r.push({ label: 'series', value: tr.series });
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
      label="Bohr model of hydrogen with orbits and an energy-level diagram"
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
        label="Move the electron to level n ="
        bind:value={params.to}
        options={[1, 2, 3, 4, 5, 6].map((n) => ({ value: n, label: `${n}` }))}
      />
      <p class="tip">Jumping down emits a photon; jumping up needs one to be absorbed.</p>
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
