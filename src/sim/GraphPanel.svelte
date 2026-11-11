<script lang="ts">
  import { untrack } from 'svelte';
  import { Download } from '@lucide/svelte';
  import Plot from '../ui/Plot.svelte';
  import Segmented from '../ui/Segmented.svelte';
  import type { Recorder } from '../core/recorder';
  import type { GraphDef } from './types';
  import { downloadCsv } from './export';

  let {
    recorder,
    graphs,
    simId,
    initial,
    max = 2,
    plotHeight = 190,
  }: {
    recorder: Recorder;
    graphs: GraphDef[];
    simId: string;
    initial?: string[];
    max?: number;
    plotHeight?: number;
  } = $props();

  let selected = $state<string[]>(untrack(() => initial ?? graphs.slice(0, 2).map((g) => g.id)));
  let timeWindow = $state(0);
  let menu = $state(false);

  function toggle(id: string) {
    if (selected.includes(id)) {
      if (selected.length > 1) selected = selected.filter((x) => x !== id);
    } else {
      selected = [...selected, id].slice(-max);
    }
  }
  const shown = $derived(graphs.filter((g) => selected.includes(g.id)));
  // graphs can change with a sim mode: fall back to the first graph if none of the chosen ones exist
  $effect(() => {
    const ids = graphs.map((g) => g.id);
    if (!untrack(() => selected).some((id) => ids.includes(id))) selected = ids.slice(0, 1);
  });
</script>

<div class="panel">
  <div class="bar">
    <div class="chips" role="group" aria-label="Choose graphs">
      {#each graphs as g (g.id)}
        <button
          type="button"
          class="chip"
          class:on={selected.includes(g.id)}
          aria-pressed={selected.includes(g.id)}
          onclick={() => toggle(g.id)}>{g.title}</button
        >
      {/each}
    </div>
    <div class="right">
      <Segmented
        small
        bind:value={timeWindow}
        options={[
          { value: 10, label: '10 s' },
          { value: 30, label: '30 s' },
          { value: 0, label: 'All' },
        ]}
      />
      <div class="export">
        <button type="button" class="exp" onclick={() => (menu = !menu)} aria-expanded={menu}>
          <Download size={15} /> CSV
        </button>
        {#if menu}
          <div class="menu" role="menu">
            <button
              role="menuitem"
              onclick={() => {
                downloadCsv(recorder, simId, 'en');
                menu = false;
              }}>CSV (comma, decimal point)</button
            >
            <button
              role="menuitem"
              onclick={() => {
                downloadCsv(recorder, simId, 'cz');
                menu = false;
              }}>CSV for Czech Excel (; and ,)</button
            >
          </div>
        {/if}
      </div>
    </div>
  </div>
  <div class="plots">
    {#each shown as g (g.id)}
      <Plot {recorder} series={g.series} title={g.title} window={timeWindow} height={plotHeight} />
    {/each}
  </div>
</div>

<style>
  .panel {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    min-width: 0;
  }
  .bar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
  }
  .chips {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }
  .chip {
    border: 1px solid var(--border-strong);
    background: transparent;
    color: var(--text-2);
    border-radius: var(--radius-full);
    padding: 4px 11px;
    font-size: var(--text-xs);
    font-weight: 600;
    min-height: 28px;
  }
  .chip.on {
    background: var(--accent-soft);
    border-color: transparent;
    color: var(--accent);
  }
  .right {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }
  .export {
    position: relative;
  }
  .exp {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    border: 1px solid var(--border-strong);
    background: var(--surface);
    border-radius: var(--radius-s);
    padding: 5px 10px;
    font-size: var(--text-xs);
    font-weight: 600;
    color: var(--text-2);
    min-height: 30px;
  }
  .menu {
    position: absolute;
    right: 0;
    /* opens downwards: the graph panel scrolls (overflow: auto) and would clip a menu that opens upwards */
    top: calc(100% + 6px);
    z-index: 20;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-m);
    box-shadow: var(--shadow-2);
    padding: 4px;
    display: flex;
    flex-direction: column;
    min-width: 230px;
  }
  .menu button {
    border: 0;
    background: none;
    text-align: left;
    padding: 9px 10px;
    border-radius: 8px;
    font-size: var(--text-sm);
  }
  .menu button:hover {
    background: var(--surface-2);
  }
  .plots {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
    gap: var(--space-4);
  }
</style>
