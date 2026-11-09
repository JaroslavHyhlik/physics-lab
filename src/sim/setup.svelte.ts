/**
 * Shared wiring for simulation screens. Call these at the top level of a Sim.svelte script
 * (they create effects, so they must run during component initialisation).
 */
import { untrack } from 'svelte';
import { router } from '../app/router.svelte';
import { theme } from '../app/theme.svelte';
import { createParams, syncParamsToUrl, type NumberParamDef, type ParamValues } from './params.svelte';
import { readPalette, type Palette } from './palette';
import type { SimController } from './controller.svelte';

/** Parameters from defaults + URL, kept in sync with the URL. */
export function useParams<P extends ParamValues>(defaults: P, sliders: NumberParamDef[]) {
  const query = router.route.name === 'sim' ? router.route.query : new URLSearchParams();
  const params = createParams(defaults, query, sliders);
  $effect(() => syncParamsToUrl($state.snapshot(params) as P, defaults));
  const sl = (key: string): NumberParamDef => {
    const d = sliders.find((s) => s.key === key);
    if (!d) throw new Error(`No slider ${key}`);
    return d;
  };
  return { params, sl, query };
}

/** Current theme palette for canvas drawing; redraws on theme change. */
export function usePalette(ctrl: () => SimController | undefined) {
  const box = { pal: readPalette() as Palette };
  $effect(() => {
    void theme.version;
    box.pal = readPalette();
    untrack(() => ctrl()?.invalidate());
  });
  return box;
}

/** Reset the simulation whenever the values read by `deps` change (not on the first run). */
export function resetOn(ctrl: SimController, deps: () => unknown) {
  let first = true;
  $effect(() => {
    deps();
    if (first) {
      first = false;
      return;
    }
    untrack(() => ctrl.reset());
  });
}

/** Redraw whenever the values read by `deps` change. */
export function redrawOn(ctrl: SimController, deps: () => unknown) {
  $effect(() => {
    deps();
    untrack(() => ctrl.invalidate());
  });
}
