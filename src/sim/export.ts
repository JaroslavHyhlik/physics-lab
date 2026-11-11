import { toCsv, type CsvFormat } from '../core/csv';
import type { Recorder } from '../core/recorder';

/** Download all recorded channels as a CSV file. */
export function downloadCsv(recorder: Recorder, simId: string, format: CsvFormat): void {
  const columns = recorder.channels.map((c, i) => ({
    label: c.label,
    unit: c.unit,
    data: recorder.view(i),
  }));
  const csv = toCsv(columns, format);
  // BOM so Excel detects UTF-8 (units contain ⁻¹, ², Ω …)
  const blob = new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8' });
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${simId}_${stamp}${format === 'cz' ? '_excel-cz' : ''}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

/** CSV file of all recorded channels (for the share sheet) */
export function csvFile(recorder: Recorder, name: string, format: CsvFormat = 'en'): File {
  const columns = recorder.channels.map((c, i) => ({ label: c.label, unit: c.unit, data: recorder.view(i) }));
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`;
  return new File(['\uFEFF', toCsv(columns, format)], `${name}_${stamp}.csv`, { type: 'text/csv' });
}

/** Share the CSV through the system share sheet (AirDrop, Mail, Files …) or download it. */
export async function shareCsv(recorder: Recorder, name: string): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const file = csvFile(recorder, name);
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: file.name });
      return 'shared';
    } catch (e) {
      if ((e as { name?: string })?.name === 'AbortError') return 'cancelled';
    }
  }
  downloadCsv(recorder, name, 'en');
  return 'downloaded';
}
