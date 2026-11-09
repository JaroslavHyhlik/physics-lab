<script lang="ts">
  import { ArrowLeft } from '@lucide/svelte';
  import { findSim, isReady, subtopics } from '../app/registry';
  import Badge from '../ui/Badge.svelte';

  let { id }: { id: string } = $props();
  const entry = $derived(findSim(id));
</script>

{#if entry && isReady(entry)}
  {#key entry.id}
    {#await entry.load!()}
      <div class="loading" aria-busy="true"><div class="spinner"></div></div>
    {:then mod}
      <mod.default {entry} />
    {:catch err}
      <div class="msg">
        <h1>Could not load this simulation</h1>
        <p>{String(err)}</p>
        <a href="#/">Back to all simulations</a>
      </div>
    {/await}
  {/key}
{:else}
  <div class="msg">
    <a class="back" href="#/"><ArrowLeft size={16} /> All simulations</a>
    {#if entry}
      <Badge kind="code" text={entry.code} />
      <h1>{entry.title}</h1>
      <p>{entry.blurb}</p>
      <p class="muted">
        Part of {entry.code} {subtopics.find((s) => s.code === entry.code)?.title}. This simulation is planned and coming
        soon.
      </p>
    {:else}
      <h1>Simulation not found</h1>
      <p class="muted">There is no simulation called “{id}”.</p>
    {/if}
  </div>
{/if}

<style>
  .loading {
    height: 100dvh;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .spinner {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    border: 3px solid var(--surface-3);
    border-top-color: var(--accent);
    animation: spin 0.8s linear infinite;
  }
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
  .msg {
    max-width: 640px;
    margin: 0 auto;
    padding: var(--space-7) var(--space-4);
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    align-items: flex-start;
  }
  .back {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-weight: 600;
    margin-bottom: var(--space-4);
  }
  h1 {
    font-size: var(--text-2xl);
    letter-spacing: -0.03em;
  }
  .muted {
    color: var(--text-3);
  }
</style>
