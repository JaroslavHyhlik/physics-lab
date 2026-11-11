<script lang="ts">
  import { ArrowLeft } from '@lucide/svelte';
  import qrcode from 'qrcode-generator';
  import type { Component } from 'svelte';
  import { router } from '../app/router.svelte';
  import { LAB, labTool, type LabMeta } from '../lab/tools';

  const PUBLIC = 'https://jaroslavhyhlik.github.io/physics-lab/';
  const tool = $derived(router.route.name === 'lab' ? labTool(router.route.tool) : undefined);
  const missing = $derived(router.route.name === 'lab' && router.route.tool !== null && !tool);

  // the loaded component together with the experiment it belongs to, so that while another
  // experiment's code is loading the old component is never shown with the new experiment's data
  let loaded: { id: string; comp: Component<{ meta: LabMeta }> } | null = $state(null);
  $effect(() => {
    const t = tool;
    if (!t || loaded?.id === t.id) return;
    void t.load().then((m) => {
      if (tool?.id === t.id) loaded = { id: t.id, comp: m.default };
    });
  });

  // QR code that opens the lab on a phone. On a local computer address the published site is used.
  const labUrl = (() => {
    if (typeof location === 'undefined') return `${PUBLIC}#/lab`;
    const local = /^(localhost|127\.|192\.168\.|10\.|\[::1\])/.test(location.hostname) || location.protocol !== 'https:';
    return `${local ? PUBLIC : location.origin + location.pathname}#/lab`;
  })();
  const qrSvg = (() => {
    const q = qrcode(0, 'M');
    q.addData(labUrl);
    q.make();
    return q.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
  })();

  const groups = ['Sensors', 'Experiments', 'Sound'] as const;
</script>

{#if tool}
  {#if loaded && loaded.id === tool.id}
    {#key tool.id}<loaded.comp meta={tool} />{/key}
  {:else}
    <p class="loading">Loading…</p>
  {/if}
{:else}
  <div class="page">
    <a class="back" href="#/"><ArrowLeft size={16} /> All simulations</a>
    <h1>Mobile Lab</h1>
    <p class="lead">
      Measure real physics with your phone’s sensors, straight in the browser: accelerometer, gyroscope, tilt and compass, microphone,
      GPS and a tone generator, with live graphs and CSV export.
    </p>
    {#if missing}<p class="warn" role="alert">This lab experiment does not exist. Choose one below.</p>{/if}
    <div class="qr">
      <!-- eslint-disable-next-line svelte/no-at-html-tags -->
      <div class="code" aria-hidden="true">{@html qrSvg}</div>
      <p>
        <strong>Open on your phone:</strong> scan this code with the camera. Sensors work only on the phone and only on the secure
        published page:<br /><a href={labUrl}>{labUrl}</a>
      </p>
    </div>
    {#each groups as g (g)}
      <h2>{g}</h2>
      <div class="grid">
        {#each LAB.filter((t) => t.group === g) as t (t.id)}
          <a class="card" href={`#/lab/${t.id}`}>
            <span class="title">{t.title}</span>
            <span class="blurb">{t.blurb}</span>
          </a>
        {/each}
      </div>
    {/each}
    <footer class="foot">Not affiliated with or endorsed by the International Baccalaureate Organization.</footer>
  </div>
{/if}

<style>
  .page {
    max-width: 960px;
    margin: 0 auto;
    padding: var(--space-5) var(--space-4) var(--space-7);
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }
  .back {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-weight: 600;
    min-height: 44px;
  }
  h1 {
    font-size: var(--text-2xl);
    letter-spacing: -0.03em;
  }
  h2 {
    font-size: var(--text-lg);
    margin-top: var(--space-3);
  }
  .lead {
    color: var(--text-2);
    max-width: 640px;
  }
  .warn {
    border-left: 4px solid var(--danger);
    padding: var(--space-2) var(--space-3);
    background: var(--surface-2);
  }
  .qr {
    display: flex;
    gap: var(--space-4);
    align-items: center;
    padding: var(--space-3);
    border: 1px solid var(--border);
    border-radius: var(--radius-m);
    background: var(--surface);
    font-size: var(--text-sm);
    color: var(--text-2);
  }
  .qr a {
    word-break: break-all;
  }
  .code {
    width: 132px;
    flex: none;
    background: #fff;
    border-radius: var(--radius-s);
    padding: 4px;
  }
  .code :global(svg) {
    display: block;
    width: 100%;
    height: auto;
  }
  @media (max-width: 600px) {
    .code {
      display: none;
    }
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    gap: var(--space-3);
  }
  .card {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: var(--space-3) var(--space-4);
    border: 1px solid var(--border);
    border-radius: var(--radius-m);
    background: var(--surface);
    color: var(--text);
    text-decoration: none;
    min-height: 44px;
  }
  .card:hover {
    border-color: var(--accent);
  }
  .title {
    font-weight: 700;
  }
  .blurb {
    color: var(--text-2);
    font-size: var(--text-sm);
  }
  .loading {
    padding: var(--space-6);
    text-align: center;
    color: var(--text-3);
  }
  .foot {
    font-size: var(--text-xs);
    color: var(--text-3);
    margin-top: var(--space-5);
  }
</style>
