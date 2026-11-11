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
  import {
    MASS,
    MeV,
    NEUTRINO_LOSS,
    Q_HE3,
    Q_PD,
    Q_PP,
    Q_TOTAL,
    R_TOUCH,
    barrier,
    classicalTemperature,
    closestApproach,
    gamowEnergy,
    gamowPeak,
    log10FractionAbove,
    mbEnergy,
    meanKE,
    tunnelling,
  } from '../../physics/fusion';
  import { k_B, k_e, e, c, u } from '../../core/constants';
  import { L_SUN } from '../../physics/luminosity';
  import { drawXYPlot } from '../../sim/xyPlot';
  import { drawTag } from '../../sim/draw';
  import { fmt, superscript } from '../../core/format';

  let { entry }: { entry: SimEntry } = $props();
  const sliders: NumberParamDef[] = [{ key: 'T', label: 'Temperature of the gas', symbol: 'T', unit: 'K', min: 1e6, max: 1e10, step: 1e4, log: true }];
  const { params, sl } = useParams({ mode: 'barrier', T: 1.57e7 }, sliders);
  const presets = [
    { id: 'sun', label: 'Core of the Sun (15.7 million K)', values: { mode: 'barrier', T: 1.57e7 } },
    { id: 'cool', label: 'Too cool: a red dwarf’s edge (3 million K)', values: { mode: 'barrier', T: 3e6 } },
    { id: 'classical', label: 'Temperature needed without tunnelling', values: { mode: 'barrier', T: 4.6e9 } },
    { id: 'chain', label: 'The proton–proton chain', values: { mode: 'chain' } },
  ];
  const info: SimInfo = {
    about: [
      'In the core of the Sun hydrogen nuclei (protons) fuse into helium. The mass of one helium-4 atom is about 0.7 % less than the mass of four hydrogen atoms; this mass defect is released as energy, E = mc² ≈ 26.7 MeV per helium nucleus.',
      'To fuse, two protons must get close enough for the strong nuclear force to act (about 2 fm). But they repel each other electrically: the Coulomb barrier is about 0.6 MeV high. That is why fusion needs an extremely high temperature, so the nuclei move fast enough, and a high density, so collisions are frequent.',
      'Even at 15 million K the average kinetic energy is only about 2 keV, hundreds of times too small. Fusion still happens because a few protons are much faster than average (the tail of the Maxwell–Boltzmann distribution) and, beyond the IB syllabus, because quantum tunnelling lets a few through the barrier. Most reactions happen near the Gamow peak.',
    ],
    formulas: [
      { label: 'Mass–energy', tex: 'E = mc^{2}' },
      { label: 'Electric potential energy', tex: 'E_p = k\\dfrac{q_1q_2}{r}' },
      { label: 'Mean kinetic energy of particles', tex: '\\bar{E}_k = \\tfrac{3}{2}k_BT' },
      { label: 'Gamow peak (tunnelling)', tex: 'E_0 = \\left(\\tfrac{1}{4}E_G (k_BT)^{2}\\right)^{1/3}', beyond: true },
    ],
    assumptions: [
      'Nuclei touch at r = 2R₀ = 2.4 fm (R = R₀A^(1/3) with R₀ = 1.2 fm). Inside, the strong force is drawn as a simple well; its depth is illustrative.',
      'Atomic masses from AME2020; the pp-I branch only (in the Sun about 83 % of helium is made this way). Neutrinos carry away about 0.5 MeV per helium nucleus.',
      'Tunnelling probability exp(−√(E_G/E)) with the Gamow energy E_G ≈ 0.49 MeV for two protons. The three curves on the energy graph are each scaled to the same height so that their shapes can be compared.',
    ],
    tryThis: [
      'Compare the barrier height with the mean kinetic energy at the Sun’s core. How many times bigger is it?',
      'Raise the temperature until the mean kinetic energy reaches the barrier. Is that realistic for a star?',
      'Check the 26.7 MeV from the masses: 4 × 1.00782503 u − 4.00260325 u, times 931.5 MeV u⁻¹.',
    ],
  };

  const view = new View();
  let ctx: CanvasRenderingContext2D | null = null;
  const EB = barrier();

  function drawBarrier() {
    const pal = palette.pal;
    const W = view.width;
    const H = view.height;
    const wide = W > 760;
    const c2 = ctx!;
    // potential energy U(r)
    const pW = wide ? W * 0.5 : W;
    const half = wide ? H - 40 : (H - 40) / 2;
    const x0 = 60;
    const x1 = pW - 30;
    const y0 = 40;
    const y1 = y0 + half - 60;
    const rT = R_TOUCH * 1e15;
    const Ek = meanKE(params.T) / MeV;
    const { X, Y } = drawXYPlot(c2, pal, {
      x0,
      y0,
      x1,
      y1,
      xmin: 0,
      xmax: 30,
      ymin: -1,
      ymax: 1,
      xLabel: 'separation of the two protons r / fm',
      yLabel: 'potential energy / MeV',
      curves: [
        { fn: (r) => (r >= rT ? (k_e * e * e) / (r * 1e-15) / MeV : -0.9), color: pal.series[3], width: 2.5, samples: 600 },
        { fn: () => Math.min(Ek, 1), color: pal.series[0], dash: [5, 4], width: 1.5 },
      ],
    });
    drawTag(c2, X(rT) + 50, Y(EB / MeV), `barrier ${fmt(EB / MeV, 2)} MeV`, pal.series[3], pal.surface);
    drawTag(c2, X(4), Y(-0.9) - 14, 'strong force (illustrative)', pal.text2, pal.surface, '600 10px Inter Variable, system-ui, sans-serif');
    drawTag(c2, X(20), Y(Math.min(Ek, 1)) - 14, `mean kinetic energy ${fmt(Ek * 1e3, 3)} keV`, pal.series[0], pal.surface);
    const rc = closestApproach(meanKE(params.T)) * 1e15;
    drawTag(c2, X(20), Y(Math.min(Ek, 1)) + 14, `closest approach ${fmt(rc, 3)} fm`, pal.text2, pal.surface, '600 10px Inter Variable, system-ui, sans-serif');

    // energy distribution × tunnelling = Gamow peak
    const gx0 = wide ? pW + 40 : 60;
    const gx1 = W - 24;
    const gy0 = wide ? 230 : y1 + 60;
    const gy1 = H - 40;
    if (gx1 - gx0 < 110 || gy1 - gy0 < 70) return;
    const kT = k_B * params.T;
    const E0 = gamowPeak(params.T);
    const Emax = Math.max(4 * E0, 6 * kT);
    const keV = 1e3 * e;
    const EG = gamowEnergy();
    const mbMax = mbEnergy(kT / 2, params.T);
    const prod = (E: number) => Math.exp(-E / kT - Math.sqrt(EG / E));
    const prodMax = prod(E0);
    const tunMax = tunnelling(Emax, EG);
    drawXYPlot(c2, pal, {
      x0: gx0,
      y0: gy0,
      x1: gx1,
      y1: gy1,
      xmin: 0,
      xmax: Emax / keV,
      ymin: 0,
      ymax: 1.15,
      xLabel: 'kinetic energy E / keV',
      yLabel: 'each curve scaled to height 1',
      curves: [
        { fn: (x) => mbEnergy(x * keV, params.T) / mbMax, color: pal.series[0], width: 2, samples: 400 },
        { fn: (x) => tunnelling(x * keV, EG) / tunMax, color: pal.series[2], width: 2, dash: [5, 4], samples: 400 },
        { fn: (x) => prod(x * keV) / prodMax, color: pal.series[3], width: 2.5, samples: 600 },
      ],
    });
    c2.font = '600 11px Inter Variable, system-ui, sans-serif';
    c2.textAlign = 'left';
    c2.textBaseline = 'top';
    const items: [string, string][] = [
      [pal.series[0], 'Maxwell–Boltzmann: how many have energy E'],
      [pal.series[2], 'tunnelling probability (rises steeply)'],
      [pal.series[3], `product: Gamow peak at ${fmt(E0 / keV, 3)} keV`],
    ];
    items.forEach(([col, txt], i) => {
      c2.fillStyle = col;
      c2.fillText(`■ ${txt}`, gx0 + 10, gy0 + 6 + i * 16);
    });
  }

  function nucleus(x: number, y: number, Z: number, N: number, label: string) {
    const pal = palette.pal;
    const c2 = ctx!;
    const offs = [
      [0, 0],
      [8, 0],
      [4, -7],
      [4, 7],
    ];
    for (let i = 0; i < Z + N; i++) {
      const [dx, dy] = offs[i];
      c2.fillStyle = i < Z ? pal.series[3] : pal.text3;
      c2.beginPath();
      c2.arc(x + dx - (Z + N > 1 ? 4 : 0), y + dy, 6, 0, Math.PI * 2);
      c2.fill();
    }
    c2.fillStyle = pal.text2;
    c2.font = '600 11px Inter Variable, system-ui, sans-serif';
    c2.textAlign = 'center';
    c2.textBaseline = 'top';
    c2.fillText(label, x, y + 14);
  }

  function drawChain() {
    const pal = palette.pal;
    const W = view.width;
    const wide = W > 760;
    const c2 = ctx!;
    const x0 = 40;
    const w = (wide ? W - 320 : W) - x0 - 20;
    const step = w / 6;
    const rows: { y: number; parts: [number, number, string][]; prods: [number, number, string][]; extra: string; Q: number; times: string }[] = [
      { y: 70, parts: [[1, 0, '¹H'], [1, 0, '¹H']], prods: [[1, 1, '²H']], extra: '+ e⁺ + ν', Q: Q_PP, times: 'happens twice' },
      { y: 170, parts: [[1, 1, '²H'], [1, 0, '¹H']], prods: [[2, 1, '³He']], extra: '+ γ', Q: Q_PD, times: 'happens twice' },
      { y: 270, parts: [[2, 1, '³He'], [2, 1, '³He']], prods: [[2, 2, '⁴He'], [1, 0, '¹H'], [1, 0, '¹H']], extra: '', Q: Q_HE3, times: 'once' },
    ];
    for (const r of rows) {
      nucleus(x0 + 0.3 * step, r.y, ...r.parts[0]);
      c2.fillStyle = pal.text2;
      c2.font = '700 14px Inter Variable, system-ui, sans-serif';
      c2.textAlign = 'center';
      c2.textBaseline = 'middle';
      c2.fillText('+', x0 + 0.85 * step, r.y);
      nucleus(x0 + 1.4 * step, r.y, ...r.parts[1]);
      c2.fillText('→', x0 + 2.1 * step, r.y);
      r.prods.forEach((p, i) => nucleus(x0 + (2.8 + i * 0.7) * step, r.y, ...p));
      c2.font = '600 12px Inter Variable, system-ui, sans-serif';
      c2.textAlign = 'left';
      c2.fillText(r.extra, x0 + (2.8 + r.prods.length * 0.7 - 0.2) * step, r.y);
      drawTag(c2, x0 + 5 * step, r.y, `Q = ${r.Q.toFixed(2)} MeV (${r.times})`, pal.ink, pal.surface);
    }
    c2.fillStyle = pal.ink;
    c2.font = '700 14px Inter Variable, system-ui, sans-serif';
    c2.textAlign = 'left';
    c2.textBaseline = 'top';
    c2.fillText(`Total: 4 ¹H → ⁴He + 2e⁺ + 2ν, Q = 2(${Q_PP.toFixed(2)}) + 2(${Q_PD.toFixed(2)}) + ${Q_HE3.toFixed(2)} = ${Q_TOTAL.toFixed(1)} MeV`, x0, 330);
    c2.font = '500 12px Inter Variable, system-ui, sans-serif';
    c2.fillStyle = pal.text2;
    c2.fillText(`Mass defect: 4 × ${MASS.H1} u − ${MASS.He4} u = ${(4 * MASS.H1 - MASS.He4).toFixed(5)} u (${(((4 * MASS.H1 - MASS.He4) / (4 * MASS.H1)) * 100).toFixed(2)} % of the mass)`, x0, 356);
    c2.fillText('red = proton, grey = neutron; the positrons annihilate with electrons (included in Q).', x0, 378);
  }

  function draw() {
    if (!ctx) return;
    ctx.fillStyle = palette.pal.bg;
    ctx.fillRect(0, 0, view.width, view.height);
    if (params.mode === 'barrier') drawBarrier();
    else drawChain();
  }

  const ctrl = new SimController({ step: () => {}, render: draw, reset: () => {} }, { dt: 1, autoplay: false });
  const palette = usePalette(() => ctrl);
  redrawOn(ctrl, () => [params.mode, params.T]);

  const rows = $derived.by(() => {
    if (params.mode === 'chain') {
      const dm = (4 * MASS.H1 - MASS.He4) * u;
      return [
        { label: 'energy per helium nucleus', value: Q_TOTAL.toFixed(2), unit: 'MeV', strong: true },
        { label: 'of which neutrinos carry away', value: `≈ ${NEUTRINO_LOSS}`, unit: 'MeV' },
        { label: 'energy from 1 kg of hydrogen', value: fmt((Q_TOTAL * MeV) / (4 * MASS.H1 * u), 3), unit: 'J kg⁻¹' },
        { label: 'mass defect Δm', value: fmt(dm, 3), unit: 'kg' },
        { label: 'Sun: mass turned into energy, L/c²', value: fmt(L_SUN / (c * c), 3), unit: 'kg s⁻¹' },
        { label: 'Sun: hydrogen fused per second', value: fmt((L_SUN / (Q_TOTAL * MeV)) * 4 * MASS.H1 * u, 3), unit: 'kg s⁻¹' },
      ];
    }
    const Ek = meanKE(params.T);
    const lf = log10FractionAbove(EB, params.T);
    return [
      { label: 'Coulomb barrier ke²/(2R₀)', value: fmt(EB / MeV, 3), unit: 'MeV' },
      { label: 'mean kinetic energy (3/2)k_B T', value: fmt(Ek / (1e3 * e), 3), unit: 'keV', strong: true },
      { label: 'barrier ÷ mean kinetic energy', value: fmt(EB / Ek, 3) },
      { label: 'T for mean energy = barrier', value: fmt(classicalTemperature(), 3), unit: 'K' },
      { label: 'fraction of protons above the barrier', value: lf > -300 ? `10${superscript(Math.round(lf))}` : `< 10${superscript(-300)}` },
      { label: 'Gamow peak (with tunnelling)', value: fmt(gamowPeak(params.T) / (1e3 * e), 3), unit: 'keV', color: '--series-4' },
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
      label="Coulomb barrier between two protons and the proton–proton chain"
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
        label="Show"
        bind:value={params.mode}
        options={[
          { value: 'barrier', label: 'Coulomb barrier' },
          { value: 'chain', label: 'pp chain' },
        ]}
      />
      {#if params.mode === 'barrier'}<Slider def={sl('T')} bind:value={params.T} />{/if}
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
