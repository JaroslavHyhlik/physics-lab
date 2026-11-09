<script lang="ts">
  import { onMount } from 'svelte';
  import type { View } from './view';
  import type { Interaction } from './interaction';

  /**
   * High-DPI canvas that keeps `view.width/height` in CSS pixels and forwards pointer
   * input to the interaction manager. The owner draws via the context from `onready`.
   */
  let {
    view,
    interaction,
    onready,
    onresize,
    label,
  }: {
    view: View;
    interaction?: Interaction;
    onready: (ctx: CanvasRenderingContext2D) => void;
    onresize?: () => void;
    label: string;
  } = $props();

  let canvas: HTMLCanvasElement;

  onMount(() => {
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;
    const resize = () => {
      const r = canvas.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = Math.max(1, Math.round(r.width));
      const h = Math.max(1, Math.round(r.height));
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      view.width = w;
      view.height = h;
      onresize?.();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();
    onready(ctx);
    const detach = interaction?.attach(canvas);
    return () => {
      ro.disconnect();
      detach?.();
    };
  });
</script>

<canvas bind:this={canvas} aria-label={label}></canvas>

<style>
  canvas {
    display: block;
    width: 100%;
    height: 100%;
    touch-action: none;
    user-select: none;
    -webkit-user-select: none;
  }
</style>
