/** Shared types for simulation screens. */

export interface FormulaDef {
  /** KaTeX source in data-booklet notation. */
  tex: string;
  label?: string;
  hl?: boolean;
  /** Not in the IB data booklet (e.g. quadratic drag). */
  beyond?: boolean;
}

export interface SimInfo {
  /** Short explanation, plain sentences (rendered as paragraphs). */
  about: string[];
  formulas: FormulaDef[];
  /** Every simplification of the model, shown in the "Model assumptions" box. */
  assumptions: string[];
  /** Optional "try this" suggestions for learning. */
  tryThis?: string[];
}

export interface GraphDef {
  id: string;
  title: string;
  /** Channel keys plotted against time. */
  series: string[];
  /** Optional fixed y-range, otherwise auto. */
  yRange?: [number, number];
}

export interface Preset<P> {
  id: string;
  label: string;
  values: Partial<P>;
}
