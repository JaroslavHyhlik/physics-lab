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
  import type { SimEntry } from '../../app/registry';
  import type { NumberParamDef } from '../../sim/params.svelte';
  import type { SimInfo } from '../../sim/types';
  import { ISOTOPES, DIE_P, decayConstant, diceLambda, diceLifetimes, expectedN, expectedDice, lifetimes } from '../../physics/decay';
  import { linearFit } from '../../physics/dc';
  import { Rng } from '../../core/rng';
  import { drawXYPlot } from '../../sim/xyPlot';
  import { alpha } from '../../sim/palette';
  import { fmt } from '../../core/format';

  let { entry }: { entry: SimEntry } = $props();
  const sliders: NumberParamDef[] = [{ key: 'N0', label: 'Number of nuclei at the start', symbol: 'N_0', unit: '', min: 10, max: 2500, step: 10 }];
  const { params, sl } = useParams({ iso: 'I-131', N0: 400 }, sliders);
  const presets = [
    { id: 'iodine', label: 'Iodine-131 (medical tracer), 400 nuclei', values: { iso: 'I-131', N0: 400 } },
    { id: 'few', label: 'Only 20 nuclei: very random', values: { iso: 'I-131', N0: 20 } },
    { id: 'many', label: '2500 nuclei: a smooth curve', values: { iso: 'Ba-137m', N0: 2500 } },
    { id: 'dice', label: 'Dice model: a six means "decayed"', values: { iso: 'dice', N0: 100 } },
    { id: 'carbon', label: 'Carbon-14 (radiocarbon dating)', values: { iso: 'C-14', N0: 1000 } },
  ];
  const info: SimInfo = {
    about: [
      'Radioactive decay is random: there is no way to tell which nucleus will decay next or when. Every undecayed nucleus has the same chance of decaying in the next second, however long it has already existed.',
      'So the number that decay in a short time is proportional to the number still there. The number of undecayed nuclei falls by the same fraction in equal times: it halves every half-life T½. With few nuclei the curve is ragged; with many it becomes smooth.',
      'HL: the probability of decay per unit time is the decay constant λ. The activity is A = λN and N = N₀e^(−λt), so ln N = ln N₀ − λt is a straight line with gradient −λ, and T½ = ln 2/λ.',
      'Dice model: throw a set of dice and remove every six. Each die has a 1 in 6 chance per throw, just as each nucleus has a fixed chance per second.',
    ],
    formulas: [
      { label: 'Exponential decay', tex: 'N = N_0e^{-\\lambda t}', hl: true },
      { label: 'Activity', tex: 'A = \\lambda N = \\lambda N_0e^{-\\lambda t}', hl: true },
      { label: 'Half-life', tex: 'T_{1/2} = \\dfrac{\\ln 2}{\\lambda}', hl: true },
      { label: 'After n half-lives', tex: 'N = \\dfrac{N_0}{2^{n}}' },
    ],
    assumptions: [
      'Each nucleus decays independently with a constant probability per unit time. Its moment of decay is drawn at random when the run starts (seeded random numbers), so the result does not depend on the frame rate.',
      'Half-lives from NUBASE2020, rounded. The daughter nuclei are assumed stable and are not counted.',
      'Time is speeded up so that one half-life takes about 2.5 s of animation (dice: one throw every 0.5 s).',
    ],
    tryThis: [
      'Read the half-life from the N–t graph: when has N fallen to N₀/2? Then from N₀/2 to N₀/4?',
      'Press “New random run” several times with 20 nuclei, then with 2500. Which runs agree better with the curve?',
      'HL: use the ln N–t fit to find λ, then T½ = ln 2/λ.',
      'Dice: how many throws does it take, on average, for half the dice to go?',
    ],
  };

  const isDice = $derived(params.iso === 'dice');
  const iso = $derived(isDice ? null : ISOTOPES[params.iso]);
  /** decay constant in display units (per unit / per throw) */
  const lam = $derived(isDice ? diceLambda() : decayConstant(iso!.half));
  const unit = $derived(isDice ? 'throws' : iso!.unit);
  const half = $derived(Math.LN2 / lam);

  const MAXN = 2500;
  const life = new Float64Array(MAXN);
  let seed = 1;
  let t = 0;
  let N = $state(400);
  let tHalf = $state(NaN);
  // current run and up to 6 earlier runs (faint)
  let runT: number[] = [];
  let runN: number[] = [];
  let ghosts: { t: number[]; n: number[] }[] = [];
  let lastSample = -1;

  function newLifetimes() {
    const rng = new Rng(seed);
    if (isDice) diceLifetimes(rng, params.N0, DIE_P, life);
    else lifetimes(rng, params.N0, lam, life);
  }
  function countLeft(): number {
    let n = 0;
    for (let i = 0; i < params.N0; i++) if (life[i] > t) n++;
    return n;
  }
  function restart() {
    t = 0;
    runT = [0];
    runN = [params.N0];
    lastSample = 0;
    N = params.N0;
    tHalf = NaN;
  }

  const view = new View();
  let ctx: CanvasRenderingContext2D | null = null;
  const sampleStep = () => (isDice ? 1 : half / 40);

  function draw() {
    if (!ctx) return;
    const pal = palette.pal;
    const W = view.width;
    const H = view.height;
    const usable = H - 76;
    ctx.fillStyle = pal.bg;
    ctx.fillRect(0, 0, W, H);
    const wide = W > 760;
    const gridW = wide ? Math.min(W * 0.45, 460) : W - 32;
    const gridH = wide ? usable - 60 : Math.min(usable * 0.45, 260);
    const n0 = params.N0;
    const cols = Math.ceil(Math.sqrt((n0 * gridW) / gridH));
    const rows = Math.ceil(n0 / cols);
    const cell = Math.min(gridW / cols, gridH / rows);
    const gx = 16 + (gridW - cell * cols) / 2;
    const gy = 30;
    const s = Math.max(1, cell * (isDice ? 0.8 : 0.72));
    const parent = pal.series[0];
    const daughter = alpha(pal.text3.startsWith('#') ? pal.text3 : '#888888', 0.35);
    const flashWin = isDice ? 1 : half * 0.06;
    for (let i = 0; i < n0; i++) {
      const x = gx + (i % cols) * cell + (cell - s) / 2;
      const y = gy + Math.floor(i / cols) * cell + (cell - s) / 2;
      const alive = life[i] > t;
      ctx.fillStyle = alive ? parent : t - life[i] < flashWin ? pal.hl : daughter;
      if (isDice || cell > 7) {
        ctx.beginPath();
        if (isDice) ctx.roundRect(x, y, s, s, s * 0.2);
        else ctx.arc(x + s / 2, y + s / 2, s / 2, 0, Math.PI * 2);
        ctx.fill();
        if (isDice && s > 14 && !alive) {
          ctx.fillStyle = pal.surface;
          ctx.font = `700 ${Math.round(s * 0.55)}px Inter Variable, system-ui, sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('6', x + s / 2, y + s / 2 + 1);
        }
      } else ctx.fillRect(x, y, s, s);
    }
    ctx.fillStyle = pal.text2;
    ctx.font = '500 11px Inter Variable, system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText(isDice ? 'dice still in play (blue); removed sixes (grey)' : `undecayed ${iso!.name} nuclei (blue); decayed (grey, flash = just decayed)`, 16, gy - 8);

    // graphs
    const px0 = wide ? gridW + 70 : 56;
    const px1 = W - 24;
    let py0 = wide ? 220 : gy + gridH + 40;
    const py1 = usable - 30;
    if (px1 - px0 < 110 || py1 - py0 < 70) return;
    const two = py1 - py0 > 300;
    const mid = two ? (py0 + py1) / 2 : py1;
    const tmax = Math.max(5 * half, t * 1.05);
    const theory = (x: number) => (isDice ? expectedDice(params.N0, x) : expectedN(params.N0, lam, x));
    const ghostCol = alpha(pal.series[0].startsWith('#') ? pal.series[0] : '#3b82f6', 0.25);
    const st = sampleStep();
    const runCurve = (ts: number[], ns: number[], f: (n: number) => number, col: string) => ({
      fn: (x: number) => {
        // step function through the run's samples
        // samples are evenly spaced (sampleStep), so the index is direct
        if (x > ts[ts.length - 1]) return NaN;
        const k = Math.min(ns.length - 1, Math.floor(x / st + 1e-9));
        return f(ns[k]);
      },
      color: col,
      width: 2,
      samples: 500,
    });
    const id = (n: number) => n;
    const ln = (n: number) => (n > 0 ? Math.log(n) : NaN);
    drawXYPlot(ctx, pal, {
      x0: px0,
      y0: py0,
      x1: px1,
      y1: mid - (two ? 40 : 0),
      xmin: 0,
      xmax: tmax,
      ymin: 0,
      ymax: params.N0 * 1.05,
      xLabel: `t / ${unit}`,
      yLabel: 'N (undecayed)',
      curves: [
        ...ghosts.map((g) => runCurve(g.t, g.n, id, ghostCol)),
        { fn: theory, color: pal.series[3], dash: [5, 4], width: 1.5, samples: isDice ? 600 : 300 },
        runCurve(runT, runN, id, parent),
      ],
    });
    if (two) {
      py0 = mid;
      const fitPts = fitData();
      drawXYPlot(ctx, pal, {
        x0: px0,
        y0: py0,
        x1: px1,
        y1: py1,
        xmin: 0,
        xmax: tmax,
        ymin: Math.max(0, Math.floor(Math.log(params.N0) - lam * tmax) - 1),
        ymax: Math.log(params.N0) + 0.5,
        xLabel: `t / ${unit}`,
        yLabel: 'ln N   (HL: gradient = −λ)',
        curves: [
          ...ghosts.map((g) => runCurve(g.t, g.n, ln, ghostCol)),
          { fn: (x) => Math.log(theory(x)), color: pal.series[3], dash: [5, 4], width: 1.5, samples: isDice ? 600 : 300 },
          runCurve(runT, runN, ln, parent),
        ],
        fit: fitPts.fit.n >= 3 ? { slope: fitPts.fit.slope, intercept: fitPts.fit.intercept, color: pal.series[1] } : null,
      });
    }
  }

  /** straight-line fit of ln N against t for the current run (points with N ≥ 5, where the scatter is moderate) */
  function fitData() {
    const xs: number[] = [];
    const ys: number[] = [];
    for (let k = 0; k < runT.length; k++)
      if (runN[k] >= 5) {
        xs.push(runT[k]);
        ys.push(Math.log(runN[k]));
      }
    return { fit: linearFit(xs, ys) };
  }

  const ctrl: SimController = new SimController(
    {
      step: (dt) => {
        // one half-life ≈ 2.5 s of animation; dice: 2 throws per second
        t += isDice ? dt * 2 : (dt * half) / 2.5;
        const st = sampleStep();
        while (lastSample + st <= t) {
          lastSample += st;
          const n = (() => {
            let c = 0;
            for (let i = 0; i < params.N0; i++) if (life[i] > lastSample) c++;
            return c;
          })();
          runT.push(lastSample);
          runN.push(n);
          if (Number.isNaN(tHalf) && n <= params.N0 / 2) tHalf = lastSample;
        }
        N = countLeft();
        if (N === 0 || t > 12 * half) ctrl.pause();
      },
      render: draw,
      reset: () => {
        newLifetimes();
        restart();
      },
    },
    { dt: 1 / 120, autoplay: true },
  );
  const palette = usePalette(() => ctrl);
  resetOn(ctrl, () => {
    void [params.iso, params.N0];
    ghosts = [];
    seed = 1;
    return [params.iso, params.N0];
  });

  function newRun() {
    if (runT.length > 1) ghosts = [...ghosts.slice(-5), { t: runT, n: runN }];
    seed++;
    newLifetimes();
    restart();
    ctrl.play();
    ctrl.invalidate();
  }

  const rows = $derived.by(() => {
    void ctrl.renderCount;
    const f = fitData().fit;
    const r: { label: string; value: string; unit?: string; color?: string; strong?: boolean }[] = [
      { label: 'undecayed N', value: String(N), strong: true, color: '--series-1' },
      { label: `expected N₀e^(−λt)`, value: fmt(isDice ? expectedDice(params.N0, t) : expectedN(params.N0, lam, t), 3) },
      { label: isDice ? '“half-life” ln 2/λ' : 'half-life T½', value: fmt(half, 3), unit },
      { label: 'measured: N fell to N₀/2 at', value: Number.isNaN(tHalf) ? '—' : fmt(tHalf, 3), unit: Number.isNaN(tHalf) ? undefined : unit },
      { label: 'decay constant λ = ln 2/T½', value: fmt(lam, 3), unit: isDice ? 'per throw' : `${unit}⁻¹` },
    ];
    if (!isDice) r.push({ label: 'activity A = λN', value: fmt((lam / iso!.sec) * N, 3), unit: 'Bq' });
    if (f.n >= 3) r.push({ label: 'HL fit of ln N: λ = −gradient', value: fmt(-f.slope, 3), unit: isDice ? 'per throw' : `${unit}⁻¹`, color: '--series-2' });
    return r;
  });

  onMount(() => {
    newLifetimes();
    restart();
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
      label="Grid of radioactive nuclei decaying at random, with graphs of N and ln N against time"
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
        label="Nuclide"
        small
        bind:value={params.iso}
        options={[...Object.keys(ISOTOPES).map((k) => ({ value: k, label: k })), { value: 'dice', label: 'Dice' }]}
      />
      <Slider def={sl('N0')} bind:value={params.N0} />
      <button type="button" class="run" onclick={newRun}>New random run</button>
    </div>
  {/snippet}
</SimShell>

<style>
  .controls {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }
  .run {
    min-height: 44px;
    padding: 0 var(--space-4);
    border-radius: var(--radius-s);
    border: 1px solid var(--accent);
    background: var(--accent);
    color: var(--on-accent);
    font: inherit;
    font-weight: 600;
    cursor: pointer;
  }
</style>
