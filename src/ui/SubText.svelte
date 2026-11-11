<script lang="ts" module>
  // "μ_s F_N" or "E_k,max": the letters (and ",letters") after "_" become a subscript
  const RE = /_([A-Za-z0-9]+(?:,[A-Za-z0-9]+)*)/;
</script>

<script lang="ts">
  let { text }: { text: string } = $props();
  const parts = $derived(text.split(RE));
</script>

{#each parts as part, i (i)}{#if i % 2}<sub>{part}</sub>{:else}{part}{/if}{/each}
