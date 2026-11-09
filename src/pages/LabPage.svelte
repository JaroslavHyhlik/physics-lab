<script lang="ts">
  import { ArrowLeft } from '@lucide/svelte';
  import Badge from '../ui/Badge.svelte';
</script>

<div class="msg">
  <a class="back" href="#/"><ArrowLeft size={16} /> All simulations</a>
  <Badge kind="soon" />
  <h1>Mobile Lab</h1>
  <p>
    Measure real physics with your phone's sensors — accelerometer, gyroscope, compass, microphone and GPS — with
    live graphs, CSV export and comparison with the simulations.
  </p>
</div>

<style>
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
  p {
    color: var(--text-2);
  }
</style>
