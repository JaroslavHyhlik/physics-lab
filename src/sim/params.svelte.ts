import { router } from '../app/router.svelte';

export type ParamValue = number | boolean | string;
export type ParamValues = Record<string, ParamValue>;

/** Definition of a numeric parameter shown as a slider. */
export interface NumberParamDef {
  key: string;
  label: string;
  /** Symbol in booklet notation (rendered in italics), e.g. "m". */
  symbol?: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  /** Logarithmic slider (for quantities spanning orders of magnitude). */
  log?: boolean;
  /** Decimal places shown; default derived from step. */
  decimals?: number;
  hl?: boolean;
  hint?: string;
}

/**
 * Reactive parameter object initialised from defaults and the URL query
 * (?m=1200&drag=0), clamped to valid ranges. Non-default values are written back to the
 * URL so a configured experiment can be shared as a link.
 */
export function createParams<P extends ParamValues>(
  defaults: P,
  query: URLSearchParams,
  ranges: NumberParamDef[] = [],
): P {
  const init = { ...defaults } as P;
  for (const key of Object.keys(defaults) as (keyof P & string)[]) {
    const raw = query.get(key);
    if (raw === null) continue;
    const d = defaults[key];
    if (typeof d === 'number') {
      const v = parseFloat(raw);
      if (!Number.isFinite(v)) continue;
      const r = ranges.find((x) => x.key === key);
      (init as ParamValues)[key] = r ? Math.min(r.max, Math.max(r.min, v)) : v;
    } else if (typeof d === 'boolean') {
      (init as ParamValues)[key] = raw === '1' || raw === 'true';
    } else {
      (init as ParamValues)[key] = raw;
    }
  }
  const state = $state(init);
  return state as P;
}

let urlTimer: ReturnType<typeof setTimeout> | undefined;

/** Write non-default parameter values to the URL (debounced). */
export function syncParamsToUrl<P extends ParamValues>(params: P, defaults: P): void {
  const query = new URLSearchParams();
  for (const key of Object.keys(defaults)) {
    const v = params[key];
    if (v === defaults[key]) continue;
    query.set(key, typeof v === 'boolean' ? (v ? '1' : '0') : String(typeof v === 'number' ? +v.toPrecision(8) : v));
  }
  clearTimeout(urlTimer);
  urlTimer = setTimeout(() => router.replaceQuery(query), 250);
}
