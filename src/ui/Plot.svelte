<script lang="ts">
  import uPlot from 'uplot';
  import 'uplot/dist/uPlot.min.css';
  import { onMount } from 'svelte';
  import type { Recorder } from '../core/recorder';
  import { theme, cssVar } from '../app/theme.svelte';

  let {
    recorder,
    series,
    title,
    window: timeWindow = 0,
    height = 200,
  }: {
    recorder: Recorder;
    /** Channel keys to plot against time (channel 0). */
    series: string[];
    title: string;
    /** Visible time window in seconds (0 = everything). */
    window?: number;
    height?: number;
  } = $props();

  let el: HTMLDivElement;
  let plot: uPlot | null = null;
  let lastVersion = -1;
  let raf = 0;
  let lastDraw = 0;

  function build(width: number) {
    plot?.destroy();
    const idx = series.map((k) => recorder.index(k));
    const chans = idx.map((i) => recorder.channels[i]);
    const t = recorder.channels[0];
    const text = cssVar('--text-3');
    const grid = cssVar('--grid-strong');
    const font = '11px Inter Variable, system-ui, sans-serif';
    const unit = chans[0]?.unit ?? '';
    const yLabel = chans.length === 1 ? `${chans[0].label} / ${unit}` : unit ? `/ ${unit}` : '';
    const opts: uPlot.Options = {
      width,
      height,
      padding: [8, 8, 0, 0],
      scales: { x: { time: false } },
      legend: { show: true, live: true },
      cursor: { drag: { x: false, y: false }, points: { size: 6 } },
      axes: [
        {
          stroke: text,
          grid: { stroke: grid, width: 1 },
          ticks: { stroke: grid, width: 1 },
          font,
          labelFont: font,
          label: `${t.label} / ${t.unit}`,
          labelSize: 18,
          size: 34,
        },
        {
          stroke: text,
          grid: { stroke: grid, width: 1 },
          ticks: { stroke: grid, width: 1 },
          font,
          labelFont: font,
          label: yLabel,
          labelSize: 18,
          size: 52,
        },
      ],
      series: [
        { label: `${t.label} (${t.unit})`, value: (_u, v) => (v == null ? '—' : v.toFixed(2)) },
        ...chans.map((c, n) => ({
          label: c.unit ? `${c.label} (${c.unit})` : c.label,
          stroke: cssVar(c.color ?? `--series-${(n % 6) + 1}`),
          width: 2,
          dash: c.dash,
          points: { show: false },
          value: (_u: uPlot, v: number | null) => (v == null ? '—' : Number(v.toPrecision(4)).toString()),
        })),
      ],
    };
    plot = new uPlot(opts, data(), el);
    lastVersion = -1;
    update(true);
  }

  function data(): uPlot.AlignedData {
    const idx = series.map((k) => recorder.index(k));
    return [recorder.view(0), ...idx.map((i) => recorder.view(i))] as unknown as uPlot.AlignedData;
  }

  function update(force = false) {
    if (!plot) return;
    if (!force && recorder.version === lastVersion) return;
    lastVersion = recorder.version;
    plot.setData(data(), true);
    if (timeWindow > 0 && recorder.length > 1) {
      const tEnd = recorder.last(0);
      plot.setScale('x', { min: Math.max(0, tEnd - timeWindow), max: Math.max(tEnd, timeWindow) });
    }
  }

  onMount(() => {
    const ro = new ResizeObserver(() => {
      const w = Math.floor(el.clientWidth);
      if (!plot) build(w);
      else plot.setSize({ width: w, height });
    });
    ro.observe(el);
    const loop = (now: number) => {
      // redraw at most ~30 Hz
      if (now - lastDraw > 33) {
        update();
        lastDraw = now;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      ro.disconnect();
      cancelAnimationFrame(raf);
      plot?.destroy();
      plot = null;
    };
  });

  // Rebuild on theme change or when the plotted series change.
  $effect(() => {
    void theme.version;
    void series.join(',');
    void height;
    if (el && el.clientWidth) build(Math.floor(el.clientWidth));
  });
  $effect(() => {
    void timeWindow;
    update(true);
  });
</script>

<figure class="plot">
  <figcaption>{title}</figcaption>
  <div bind:this={el} class="host"></div>
</figure>

<style>
  .plot {
    margin: 0;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  figcaption {
    font-size: var(--text-xs);
    font-weight: 650;
    color: var(--text-2);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .host {
    width: 100%;
    min-width: 0;
  }
  .host :global(.u-legend) {
    font-size: 11px;
    color: var(--text-2);
    text-align: left;
    margin-top: 2px;
  }
  .host :global(.u-legend .u-marker) {
    border-radius: 2px;
  }
  .host :global(.u-legend th) {
    font-weight: 500;
  }
  .host :global(.u-legend td) {
    font-variant-numeric: tabular-nums;
  }
  .host :global(.u-axis) {
    color: var(--text-3);
  }
  .host :global(.u-cursor-x),
  .host :global(.u-cursor-y) {
    border-color: var(--text-3) !important;
  }
</style>
