/**
 * Records time series for live graphs and CSV export. Each channel is a contiguous
 * Float64Array, so graphs can use zero-copy views. When full, the oldest half is dropped.
 */
export interface ChannelDef {
  key: string;
  label: string;
  /** Unit in IB style, e.g. "m s⁻²". Empty string for dimensionless. */
  unit: string;
  /** Optional colour token name used by graphs (e.g. "--series-1"). */
  color?: string;
}

export class Recorder {
  readonly channels: ChannelDef[];
  private data: Float64Array[];
  private len = 0;
  private cap: number;
  /** Increments whenever data changes (graphs use it to skip redundant redraws). */
  version = 0;

  constructor(channels: ChannelDef[], capacity = 20000) {
    this.channels = channels;
    this.cap = capacity;
    this.data = channels.map(() => new Float64Array(capacity));
  }

  get length(): number {
    return this.len;
  }

  index(key: string): number {
    const i = this.channels.findIndex((c) => c.key === key);
    if (i < 0) throw new Error(`Unknown channel ${key}`);
    return i;
  }

  /** Append one sample; values in channel order. */
  push(values: ArrayLike<number>): void {
    if (this.len === this.cap) {
      const half = this.cap >> 1;
      for (const d of this.data) d.copyWithin(0, half);
      this.len -= half;
    }
    for (let i = 0; i < this.data.length; i++) this.data[i][this.len] = values[i];
    this.len++;
    this.version++;
  }

  /** Zero-copy view of a channel's recorded data. */
  view(i: number): Float64Array {
    return this.data[i].subarray(0, this.len);
  }

  last(i: number): number {
    return this.len > 0 ? this.data[i][this.len - 1] : NaN;
  }

  clear(): void {
    this.len = 0;
    this.version++;
  }
}
