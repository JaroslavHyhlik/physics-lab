<script lang="ts">
  import type { Snippet } from 'svelte';
  import { ArrowLeft, Ruler as RulerIcon, Timer, SunMoon, Sun, Moon, ChevronDown } from '@lucide/svelte';
  import IconButton from '../ui/IconButton.svelte';
  import Badge from '../ui/Badge.svelte';
  import Transport from './Transport.svelte';
  import GraphPanel from './GraphPanel.svelte';
  import InfoPanel from './InfoPanel.svelte';
  import Stopwatch from '../tools/Stopwatch.svelte';
  import type { SimController } from './controller.svelte';
  import type { GraphDef, SimInfo } from './types';
  import type { SimEntry } from '../app/registry';
  import type { Ruler } from '../tools/ruler';
  import { theme } from '../app/theme.svelte';
  import { media } from '../app/media.svelte';
  import { router } from '../app/router.svelte';

  let {
    entry,
    ctrl,
    info,
    graphs,
    initialGraphs,
    presets = [],
    onpreset,
    ruler,
    stopwatch = true,
    transport = true,
    shortcuts = true,
    stage,
    controls,
    readouts,
    toolbar,
  }: {
    entry: SimEntry;
    ctrl: SimController;
    info: SimInfo;
    graphs: GraphDef[];
    initialGraphs?: string[];
    presets?: { id: string; label: string }[];
    onpreset?: (id: string) => void;
    ruler?: Ruler;
    stopwatch?: boolean;
    /** Hide play/pause/step for static simulations (e.g. electrostatics). */
    transport?: boolean;
    /** Keyboard shortcuts (Space, →, R); off when the sim uses the keyboard itself. */
    shortcuts?: boolean;
    stage: Snippet;
    controls: Snippet;
    readouts?: Snippet;
    toolbar?: Snippet;
  } = $props();

  let tab = $state<'controls' | 'graphs' | 'info'>('controls');
  let showStopwatch = $state(false);
  let rulerOn = $state(false);
  let graphsOpen = $state(true);
  let presetValue = $state('');
  const perf = $derived(router.route.name === 'sim' && router.route.query.has('perf'));

  $effect(() => {
    if (ruler) {
      ruler.enabled = rulerOn;
      ctrl.invalidate();
    }
  });
  $effect(() => {
    if (!media.mobile && tab === 'graphs') tab = 'controls';
  });

  function onKey(e: KeyboardEvent) {
    if (!transport || !shortcuts) return;
    const t = e.target as HTMLElement;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA' || t.isContentEditable))
      return;
    if (e.key === ' ') {
      e.preventDefault();
      ctrl.toggle();
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      ctrl.stepFrame();
    } else if (e.key === 'r' || e.key === 'R') {
      ctrl.reset();
    }
  }
</script>

<svelte:window onkeydown={onKey} />

<div class="shell">
  <header class="bar">
    <a class="back" href="#/" aria-label="All simulations"><ArrowLeft size={18} /></a>
    <div class="title">
      <Badge kind="code" text={entry.code} />
      <h1>{entry.title}</h1>
      {#if entry.hl === 'full'}<Badge kind="hl" />{:else if entry.hl === 'part'}<Badge
          kind="hl"
          text="SL + HL"
        />{/if}
    </div>
    <div class="actions">
      {#if presets.length}
        <label class="preset">
          <span class="sr-only">Preset</span>
          <select
            bind:value={presetValue}
            onchange={() => {
              if (presetValue) onpreset?.(presetValue);
              presetValue = '';
            }}
          >
            <option value="">Presets</option>
            {#each presets as p (p.id)}<option value={p.id}>{p.label}</option>{/each}
          </select>
          <ChevronDown size={14} />
        </label>
      {/if}
      <IconButton
        icon={theme.choice === 'auto' ? SunMoon : theme.choice === 'light' ? Sun : Moon}
        label={`Theme: ${theme.choice}`}
        size={38}
        onclick={() => theme.cycle()}
      />
    </div>
  </header>

  <div class="body">
    <section class="stage-col">
      <div class="stage">
        {@render stage()}
        {#if ruler || stopwatch || toolbar}<div class="tools" role="toolbar" aria-label="Measuring tools">
          {#if ruler}<IconButton
              icon={RulerIcon}
              label="Ruler"
              active={rulerOn}
              size={38}
              onclick={() => (rulerOn = !rulerOn)}
            />{/if}
          {#if stopwatch}<IconButton
              icon={Timer}
              label="Stopwatch"
              active={showStopwatch}
              size={38}
              onclick={() => (showStopwatch = !showStopwatch)}
            />{/if}
          {@render toolbar?.()}
        </div>{/if}
        {#if showStopwatch}<div class="sw"><Stopwatch {ctrl} /></div>{/if}
        {#if readouts}<div class="readouts">{@render readouts()}</div>{/if}
        {#if perf}
          <div class="perf num">{ctrl.fps} fps · physics {ctrl.physicsMs.toFixed(2)} ms/frame</div>
        {/if}
        {#if transport}<div class="transport"><Transport {ctrl} /></div>{/if}
      </div>
      {#if !media.mobile && ctrl.recorder}
        <div class="graphs" class:closed={!graphsOpen}>
          <button class="gtoggle" type="button" onclick={() => (graphsOpen = !graphsOpen)}>
            Graphs <ChevronDown size={14} style={graphsOpen ? '' : 'transform: rotate(180deg)'} />
          </button>
          {#if graphsOpen}
            <GraphPanel recorder={ctrl.recorder} {graphs} simId={entry.id} initial={initialGraphs} />
          {/if}
        </div>
      {/if}
    </section>

    <aside class="side">
      <div class="tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'controls'} class:on={tab === 'controls'} onclick={() => (tab = 'controls')}
          >Controls</button
        >
        {#if media.mobile && ctrl.recorder}
          <button role="tab" aria-selected={tab === 'graphs'} class:on={tab === 'graphs'} onclick={() => (tab = 'graphs')}
            >Graphs</button
          >
        {/if}
        <button role="tab" aria-selected={tab === 'info'} class:on={tab === 'info'} onclick={() => (tab = 'info')}
          >Info</button
        >
      </div>
      <div class="panel" role="tabpanel">
        <!-- any change in the controls redraws the canvas, also while the simulation is paused
             (the div only listens to events bubbling up from its buttons and sliders) -->
        <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
        <div
          class="pane"
          hidden={tab !== 'controls'}
          oninput={() => queueMicrotask(() => ctrl.invalidate())}
          onchange={() => queueMicrotask(() => ctrl.invalidate())}
          onclick={() => queueMicrotask(() => ctrl.invalidate())}
        >
          {@render controls()}
        </div>
        {#if media.mobile && ctrl.recorder && tab === 'graphs'}
          <div class="pane">
            <GraphPanel
              recorder={ctrl.recorder}
              {graphs}
              simId={entry.id}
              initial={initialGraphs?.slice(0, 1)}
              max={2}
              plotHeight={170}
            />
          </div>
        {/if}
        <div class="pane" hidden={tab !== 'info'}><InfoPanel {info} /></div>
      </div>
    </aside>
  </div>
  <footer class="foot">Not affiliated with or endorsed by the International Baccalaureate Organization.</footer>
</div>

<style>
  .shell {
    height: 100dvh;
    display: flex;
    flex-direction: column;
    background: var(--bg);
  }
  .bar {
    /* iPhone: the page reaches under the status bar (viewport-fit=cover), so add its height */
    height: calc(var(--header-h) + env(safe-area-inset-top));
    flex: none;
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: 0 var(--space-3);
    padding-top: env(safe-area-inset-top);
    border-bottom: 1px solid var(--border);
    background: var(--surface);
  }
  .back {
    width: 38px;
    height: 38px;
    border-radius: 50%;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: var(--text-2);
  }
  .back:hover {
    background: var(--surface-2);
    color: var(--text);
  }
  .title {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    min-width: 0;
    flex: 1;
  }
  h1 {
    font-size: var(--text-md);
    font-weight: 650;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .actions {
    display: flex;
    align-items: center;
    gap: var(--space-1);
  }
  .preset {
    position: relative;
    display: inline-flex;
    align-items: center;
    color: var(--text-2);
  }
  .preset select {
    appearance: none;
    -webkit-appearance: none;
    border: 1px solid var(--border-strong);
    background: var(--surface);
    border-radius: var(--radius-full);
    padding: 7px 28px 7px 12px;
    font-size: var(--text-sm);
    font-weight: 550;
    max-width: 44vw;
  }
  .preset :global(svg) {
    position: absolute;
    right: 10px;
    pointer-events: none;
  }
  .body {
    flex: 1;
    min-height: 0;
    display: grid;
    grid-template-columns: minmax(0, 1fr) var(--side-w);
  }
  .stage-col {
    min-width: 0;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }
  .stage {
    position: relative;
    flex: 1;
    min-height: 0;
    background: var(--canvas-bg);
    overflow: hidden;
  }
  .tools {
    position: absolute;
    top: var(--space-3);
    left: var(--space-3);
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 4px;
    background: var(--glass);
    backdrop-filter: blur(14px);
    -webkit-backdrop-filter: blur(14px);
    border: 1px solid var(--border);
    border-radius: var(--radius-full);
    box-shadow: var(--shadow-1);
  }
  .sw {
    position: absolute;
    top: var(--space-3);
    left: 64px;
  }
  .readouts {
    position: absolute;
    top: var(--space-3);
    right: var(--space-3);
    pointer-events: none;
    max-width: min(320px, 60%);
  }
  .perf {
    position: absolute;
    bottom: 76px;
    right: var(--space-3);
    font-size: var(--text-xs);
    color: var(--text-3);
    background: var(--glass);
    padding: 3px 8px;
    border-radius: 6px;
  }
  .transport {
    position: absolute;
    bottom: var(--space-4);
    left: 50%;
    transform: translateX(-50%);
    max-width: calc(100% - 24px);
  }
  .graphs {
    flex: none;
    border-top: 1px solid var(--border);
    background: var(--surface);
    padding: var(--space-2) var(--space-4) var(--space-3);
    max-height: 46%;
    overflow: auto;
  }
  .graphs.closed {
    padding-bottom: var(--space-2);
  }
  .gtoggle {
    border: 0;
    background: none;
    font-size: var(--text-xs);
    font-weight: 650;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-3);
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 0 8px;
  }
  .side {
    min-height: 0;
    display: flex;
    flex-direction: column;
    border-left: 1px solid var(--border);
    background: var(--surface);
  }
  .tabs {
    flex: none;
    display: flex;
    gap: 2px;
    padding: var(--space-2) var(--space-3) 0;
    border-bottom: 1px solid var(--border);
  }
  .tabs button {
    border: 0;
    background: none;
    padding: 10px 12px;
    font-size: var(--text-sm);
    font-weight: 600;
    color: var(--text-3);
    border-bottom: 2px solid transparent;
    margin-bottom: -1px;
    min-height: var(--touch);
  }
  .tabs button.on {
    color: var(--text);
    border-bottom-color: var(--accent);
  }
  .panel {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    padding: var(--space-4);
    padding-bottom: calc(var(--space-6) + env(safe-area-inset-bottom));
  }
  .pane[hidden] {
    display: none;
  }
  .foot {
    display: none;
  }

  @media (max-width: 899px) {
    .body {
      display: flex;
      flex-direction: column;
    }
    .stage-col {
      flex: none;
      height: min(52dvh, 62vw + 120px);
    }
    .side {
      flex: 1;
      border-left: 0;
      border-top: 1px solid var(--border);
    }
    .tabs {
      justify-content: center;
    }
    .tabs button {
      flex: 1;
    }
    .bar {
      padding: 0 var(--space-2);
    }
    .preset select {
      max-width: 112px;
      padding-left: 10px;
    }
    .title :global(.badge.code) {
      display: none;
    }
    .transport {
      bottom: var(--space-2);
    }
  }
</style>
