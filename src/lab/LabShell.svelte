<script lang="ts">
  import type { Snippet } from 'svelte';
  import { ArrowLeft, Play, Square, Trash2, Share2, Download } from '@lucide/svelte';
  import Readouts, { type ReadoutRow } from '../sim/Readouts.svelte';
  import GraphPanel from '../sim/GraphPanel.svelte';
  import type { Recorder } from '../core/recorder';
  import type { GraphDef } from '../sim/types';
  import type { LabMeta } from './tools';
  import { shareCsv, downloadCsv } from '../sim/export';
  import { support } from './sensors';

  let {
    meta,
    running,
    ontoggle,
    onclear,
    status = '',
    hint = '',
    rows = [],
    recorder,
    graphs = [],
    initialGraphs,
    startLabel = 'Start',
    stopLabel = 'Stop',
    visual,
    controls,
  }: {
    meta: LabMeta;
    running: boolean;
    ontoggle: () => void;
    onclear?: () => void;
    /** problem the user must know about (permission refused, no sensor …) */
    status?: string;
    /** neutral information (e.g. waiting for data) */
    hint?: string;
    rows?: ReadoutRow[];
    recorder?: Recorder;
    graphs?: GraphDef[];
    initialGraphs?: string[];
    startLabel?: string;
    stopLabel?: string;
    visual?: Snippet;
    controls?: Snippet;
  } = $props();

  let shareMsg = $state('');
  // the recorder is a plain object: poll how many readings it holds so the buttons enable themselves
  let count = $state(0);
  $effect(() => {
    const r = recorder;
    if (!r) return;
    const id = setInterval(() => (count = r.length), 300);
    return () => clearInterval(id);
  });
  const insecure = typeof window !== 'undefined' && !support().secure;
  // the share sheet is offered on phones (touch screens); computers simply download the file
  const canShare = typeof window !== 'undefined' && support().share && matchMedia('(pointer: coarse)').matches;
  async function share() {
    if (!recorder || !recorder.length) return;
    const r = await shareCsv(recorder, `lab-${meta.id}`);
    shareMsg = r === 'downloaded' ? 'CSV file downloaded.' : r === 'shared' ? 'Shared.' : '';
  }
</script>

<div class="lab">
  <header class="bar">
    <a class="back" href="#/lab" aria-label="All lab experiments"><ArrowLeft size={18} /></a>
    <h1>{meta.title}</h1>
  </header>

  <div class="actions">
    <button type="button" class="go" class:stop={running} onclick={ontoggle}>
      {#if running}<Square size={18} /> {stopLabel}{:else}<Play size={18} /> {startLabel}{/if}
    </button>
    {#if onclear}<button type="button" class="ghost" onclick={onclear} aria-label="Clear the data"><Trash2 size={18} /> Clear</button>{/if}
    {#if recorder}
      <button type="button" class="ghost" onclick={() => recorder && downloadCsv(recorder, `lab-${meta.id}`, 'en')} disabled={!count} aria-label="Download the data as a CSV file"
        ><Download size={18} /> CSV</button
      >
      {#if canShare}<button type="button" class="ghost" onclick={share} disabled={!count} aria-label="Share the data (AirDrop, Mail, Files …)"><Share2 size={18} /> Share</button>{/if}
    {/if}
  </div>
  {#if insecure}<p class="msg warn" role="alert">Sensors only work on a secure page: open the published site (https://…) on your phone.</p>{/if}
  {#if status}<p class="msg warn" role="alert">{status}</p>{/if}
  {#if hint}<p class="msg">{hint}</p>{/if}
  {#if shareMsg}<p class="msg">{shareMsg}</p>{/if}

  {#if visual}<div class="visual">{@render visual()}</div>{/if}
  {#if rows.length}<div class="ro-wrap"><Readouts {rows} /></div>{/if}
  {#if controls}<div class="controls">{@render controls()}</div>{/if}
  {#if recorder && graphs.length}
    <div class="graphs"><GraphPanel {recorder} {graphs} simId={`lab-${meta.id}`} initial={initialGraphs} /></div>
  {/if}

  <section class="info">
    {#each meta.about as p, i (i)}<p>{p}</p>{/each}
    <h2>How to do it</h2>
    <ul>{#each meta.howTo as p, i (i)}<li>{p}</li>{/each}</ul>
    <h2>Limits of the measurement</h2>
    <ul>{#each meta.limits as p, i (i)}<li>{p}</li>{/each}</ul>
  </section>
  <footer class="foot">Not affiliated with or endorsed by the International Baccalaureate Organization.</footer>
</div>

<style>
  .lab {
    max-width: 900px;
    margin: 0 auto;
    padding: var(--space-3) var(--space-4) var(--space-7);
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }
  .bar {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }
  .back {
    display: grid;
    place-items: center;
    width: 44px;
    height: 44px;
    border-radius: var(--radius-s);
    color: var(--text);
  }
  h1 {
    font-size: var(--text-xl);
    letter-spacing: -0.02em;
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }
  button {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: 48px;
    padding: 0 var(--space-4);
    border-radius: var(--radius-m);
    border: 1px solid var(--accent);
    background: var(--accent);
    color: var(--on-accent);
    font: inherit;
    font-weight: 700;
    cursor: pointer;
  }
  .go {
    min-width: 130px;
    justify-content: center;
  }
  .go.stop {
    background: var(--danger);
    border-color: var(--danger);
  }
  .ghost {
    background: transparent;
    color: var(--accent);
  }
  button:disabled {
    opacity: 0.45;
    cursor: default;
  }
  .msg {
    padding: var(--space-2) var(--space-3);
    border-radius: var(--radius-s);
    background: var(--surface-2);
    color: var(--text-2);
    font-size: var(--text-sm);
  }
  .msg.warn {
    border-left: 4px solid var(--danger);
    color: var(--text);
  }
  .visual :global(canvas) {
    display: block;
    width: 100%;
    border-radius: var(--radius-m);
    background: var(--canvas-bg);
  }
  .controls {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }
  .graphs {
    border: 1px solid var(--border);
    border-radius: var(--radius-m);
    padding: var(--space-2);
  }
  .info {
    color: var(--text-2);
    font-size: var(--text-sm);
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  .info h2 {
    font-size: var(--text-md);
    color: var(--text);
    margin-top: var(--space-2);
  }
  .info ul {
    padding-left: 1.2em;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .foot {
    font-size: var(--text-xs);
    color: var(--text-3);
  }
</style>
