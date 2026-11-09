<script lang="ts">
  import { router } from './app/router.svelte';
  import Home from './pages/Home.svelte';
  import SimPage from './pages/SimPage.svelte';
  import LabPage from './pages/LabPage.svelte';

  $effect(() => {
    const r = router.route;
    document.title =
      r.name === 'home' ? 'Physics Lab' : r.name === 'lab' ? 'Mobile Lab · Physics Lab' : 'Physics Lab';
    if (r.name === 'home') window.scrollTo(0, 0);
  });
</script>

{#if router.route.name === 'home'}
  <Home />
{:else if router.route.name === 'sim'}
  <SimPage id={router.route.id} />
{:else if router.route.name === 'lab'}
  <LabPage />
{:else}
  <Home />
{/if}
