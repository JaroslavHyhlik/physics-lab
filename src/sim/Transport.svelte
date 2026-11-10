<script lang="ts">
  import { Play, Pause, StepForward, RotateCcw } from '@lucide/svelte';
  import IconButton from '../ui/IconButton.svelte';
  import { SPEEDS, type SimController } from './controller.svelte';

  let { ctrl }: { ctrl: SimController } = $props();
</script>

<div class="transport" role="toolbar" aria-label="Simulation controls">
  <IconButton
    icon={ctrl.running ? Pause : Play}
    label={ctrl.running ? 'Pause (Space)' : 'Play (Space)'}
    primary
    size={44}
    onclick={() => ctrl.toggle()}
  />
  <IconButton icon={StepForward} label="Step one frame (→)" size={40} onclick={() => ctrl.stepFrame()} />
  <IconButton icon={RotateCcw} label="Reset (R)" size={40} onclick={() => ctrl.reset()} />
  <span class="sep" aria-hidden="true"></span>
  <label class="speed">
    <span class="sr-only">Speed</span>
    <select bind:value={ctrl.speed} aria-label="Simulation speed">
      {#each SPEEDS as s (s)}<option value={s}>{s}×</option>{/each}
    </select>
  </label>
  <span class="time num" aria-live="off"><i>t</i> = {ctrl.time.toFixed(2)} s</span>
  {#if ctrl.speed < 1}<span class="slow">slow motion</span>{:else if ctrl.speed > 1}<span class="slow">fast forward</span>{/if}
</div>

<style>
  .transport {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 5px 12px 5px 5px;
    background: var(--glass);
    backdrop-filter: blur(14px) saturate(1.4);
    -webkit-backdrop-filter: blur(14px) saturate(1.4);
    border: 1px solid var(--border);
    border-radius: var(--radius-full);
    box-shadow: var(--shadow-2);
  }
  .sep {
    width: 1px;
    height: 22px;
    background: var(--border-strong);
    margin: 0 4px;
  }
  select {
    border: 0;
    background: var(--surface-2);
    border-radius: var(--radius-full);
    padding: 6px 10px;
    font-size: var(--text-sm);
    font-weight: 600;
    min-height: 32px;
    font-variant-numeric: tabular-nums;
  }
  .time {
    font-size: var(--text-sm);
    font-weight: 600;
    min-width: 6.2em;
    text-align: right;
    color: var(--text);
  }
  .time i {
    font-family: 'Times New Roman', Georgia, serif;
    font-size: 1.05em;
  }
  .slow {
    font-size: var(--text-xs);
    color: var(--hl);
    font-weight: 600;
  }
  @media (max-width: 420px) {
    .slow {
      display: none;
    }
    .time {
      min-width: 5.4em;
    }
  }
</style>
