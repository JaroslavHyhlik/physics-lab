<script lang="ts">
  import { fmt } from '../core/format';
  let {
    points,
    xLabel,
    yLabel,
    onrecord,
    onclear,
  }: { points: { x: number; y: number }[]; xLabel: string; yLabel: string; onrecord: () => void; onclear: () => void } = $props();
</script>

<div class="rec">
  <button type="button" onclick={onrecord}>Record point</button>
  <button type="button" class="ghost" onclick={onclear} disabled={!points.length}>Clear</button>
</div>
{#if points.length}
  <table>
    <thead><tr><th>{xLabel}</th><th>{yLabel}</th></tr></thead>
    <tbody>
      {#each points as q, i (i)}<tr><td>{fmt(q.x, 4)}</td><td>{fmt(q.y, 4)}</td></tr>{/each}
    </tbody>
  </table>
{/if}

<style>
  .rec {
    display: flex;
    gap: var(--space-2);
  }
  button {
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
  button.ghost {
    background: transparent;
    color: var(--accent);
  }
  button:disabled {
    opacity: 0.5;
    cursor: default;
  }
  table {
    border-collapse: collapse;
    font-size: var(--text-sm);
    font-variant-numeric: tabular-nums;
  }
  th,
  td {
    text-align: right;
    padding: 4px 8px;
    border-bottom: 1px solid var(--border);
  }
  th {
    color: var(--text-2);
    font-weight: 600;
  }
</style>
