<script lang="ts" module>
  // KaTeX is loaded on first use so the home page stays light.
  let katexPromise: Promise<typeof import('katex').default> | null = null;
  function loadKatex() {
    katexPromise ??= Promise.all([import('katex'), import('katex/dist/katex.min.css')]).then(
      ([m]) => m.default,
    );
    return katexPromise;
  }
</script>

<script lang="ts">
  let { tex, display = false }: { tex: string; display?: boolean } = $props();
  let html = $state('');
  $effect(() => {
    const src = tex;
    loadKatex().then((k) => {
      html = k.renderToString(src, { displayMode: display, throwOnError: false, output: 'html' });
    });
  });
</script>

<span class="formula" class:display aria-label={tex}>
  {#if html}{@html html}{:else}<code>{tex}</code>{/if}
</span>

<style>
  .formula {
    color: var(--text);
  }
  .display {
    display: block;
    overflow-x: auto;
    overflow-y: hidden;
  }
  .formula :global(.katex) {
    font-size: 1.08em;
  }
  code {
    font-family: var(--font-mono);
    font-size: var(--text-sm);
    color: var(--text-3);
  }
</style>
