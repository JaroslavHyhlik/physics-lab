<script lang="ts">
  import { Play, Square, RotateCcw, Flag } from '@lucide/svelte';
  import type { SimController } from '../sim/controller.svelte';

  /** Stopwatch measuring SIMULATED time (correct even in slow motion). */
  let { ctrl }: { ctrl: SimController } = $props();

  let startT = $state<number | null>(null);
  let acc = $state(0);
  let laps = $state<number[]>([]);
  const reading = $derived(acc + (startT !== null ? Math.max(0, ctrl.time - startT) : 0));

  function startStop() {
    if (startT === null) startT = ctrl.now;
    else {
      acc += ctrl.now - startT;
      startT = null;
    }
  }
  function lap() {
    if (startT !== null) laps = [...laps.slice(-4), acc + ctrl.now - startT];
  }
  function reset() {
    startT = null;
    acc = 0;
    laps = [];
  }
  // A simulation reset invalidates the measurement.
  $effect(() => {
    if (ctrl.time === 0 && startT !== null && startT > 0) reset();
  });
</script>

<div class="sw" role="group" aria-label="Stopwatch">
  <div class="read num">{reading.toFixed(3)} <span>s</span></div>
  <div class="btns">
    <button type="button" onclick={startStop} aria-label={startT === null ? 'Start' : 'Stop'}>
      {#if startT === null}<Play size={14} />{:else}<Square size={14} />{/if}
    </button>
    <button type="button" onclick={lap} aria-label="Lap" disabled={startT === null}><Flag size={14} /></button>
    <button type="button" onclick={reset} aria-label="Reset stopwatch"><RotateCcw size={14} /></button>
  </div>
  {#if laps.length}
    <ol class="laps num">
      {#each laps as l, i (i)}<li>{l.toFixed(3)} s</li>{/each}
    </ol>
  {/if}
  <p class="note">simulated time</p>
</div>

<style>
  .sw {
    background: var(--glass);
    backdrop-filter: blur(14px);
    -webkit-backdrop-filter: blur(14px);
    border: 1px solid var(--border);
    border-radius: var(--radius-m);
    box-shadow: var(--shadow-2);
    padding: 8px 10px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 150px;
  }
  .read {
    font-size: 1.35rem;
    font-weight: 650;
    letter-spacing: -0.01em;
  }
  .read span {
    font-size: var(--text-sm);
    color: var(--text-3);
  }
  .btns {
    display: flex;
    gap: 4px;
  }
  .btns button {
    width: 36px;
    height: 32px;
    border: 0;
    border-radius: 8px;
    background: var(--surface-2);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: var(--text);
  }
  .btns button:disabled {
    opacity: 0.4;
  }
  .laps {
    margin: 0;
    padding-left: 1.4em;
    font-size: var(--text-xs);
    color: var(--text-2);
  }
  .note {
    font-size: 10px;
    color: var(--text-3);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
</style>
