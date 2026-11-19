import { getApiError } from '@/utils/apiError';
import type { BulkUpdateRow, Product } from '@/types';

export interface PriceEdit {
  kind: 'set' | 'percent';
  value: number | null;
}
export interface StockEdit {
  kind: 'change' | 'set';
  value: number | null;
}
export interface RowEdit {
  price?: PriceEdit;
  stock?: StockEdit;
}
export type Edits = Record<string, RowEdit>;

// An entry can exist with an empty value (e.g. the user only picked ± or =), so "edited" means a real value.
export const priceActive = (e?: RowEdit) => e?.price?.value != null;
export const stockActive = (e?: RowEdit) =>
  e?.stock?.value != null && !(e.stock.kind === 'change' && e.stock.value === 0);
export const isEdited = (e?: RowEdit) => priceActive(e) || stockActive(e);

/** Approximate: the server does the real rounding, the dry run shows the truth. */
export const previewPrice = (current: number, e?: RowEdit): number | null => {
  const p = e?.price;
  if (!p || p.value == null) return null;
  return p.kind === 'set' ? p.value : Math.round(current * (1 + p.value / 100) * 100) / 100;
};

export const previewStock = (current: number, e?: RowEdit): number | null => {
  const s = e?.stock;
  if (!s || !stockActive(e) || s.value == null) return null;
  return s.kind === 'change' ? current + s.value : s.value;
};

export const rowProblems = (p: Product, e?: RowEdit): string[] => {
  const out: string[] = [];
  const price = e?.price;
  if (price && price.value != null) {
    if (price.kind === 'set' && price.value <= 0) out.push('Price must be above 0');
    if (price.kind === 'percent' && (price.value < -99.99 || price.value > 1000)) {
      out.push('Percent must be between -99.99 and 1000');
    }
  }
  const stock = e?.stock;
  if (stock && stockActive(e) && stock.value != null) {
    if (!Number.isInteger(stock.value)) out.push('Stock must be a whole number');
    else if (stock.kind === 'change' && p.stockQuantity + stock.value < 0) {
      out.push(`Stock cannot go below zero (it would be ${p.stockQuantity + stock.value})`);
    } else if (stock.kind === 'set' && stock.value < 0) out.push('Stock cannot be negative');
  }
  return out;
};

/** Only the rows the user actually edited; each pair (price / stock) sends exactly one field. */
export const buildUpdates = (edits: Edits): BulkUpdateRow[] => {
  const rows: BulkUpdateRow[] = [];
  Object.entries(edits).forEach(([id, e]) => {
    const row: BulkUpdateRow = { id };
    if (priceActive(e) && e.price && e.price.value != null) {
      if (e.price.kind === 'set') row.price = e.price.value;
      else row.pricePercent = e.price.value;
    }
    if (stockActive(e) && e.stock && e.stock.value != null) {
      if (e.stock.kind === 'change') row.stockChange = e.stock.value;
      else row.stockQuantity = e.stock.value;
    }
    if (Object.keys(row).length > 1) rows.push(row);
  });
  return rows;
};

/* ---------------- request id ---------------- */

// randomUUID only exists in secure contexts (https or localhost)
export const newBatchId = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
      });

/* ---------------- error parsing ---------------- */

export interface BulkErrorInfo {
  general?: string;
  rows: { index: number; id?: string; messages: string[] }[];
}

const flat = (v: unknown): string[] =>
  typeof v === 'string' ? [v] : Array.isArray(v) ? v.flatMap(flat) : v && typeof v === 'object' ? Object.values(v).flatMap(flat) : [];

export const parseBulkErrors = (e: any, updates: BulkUpdateRow[]): BulkErrorInfo => {
  const data = e?.response?.data;
  const rows: BulkErrorInfo['rows'] = [];
  let general: string | undefined;

  if (data && typeof data === 'object') {
    if (Array.isArray(data.errors)) {
      // { detail, errors: [{ index, id, messages }] }  (rows that fail the rules)
      data.errors.forEach((x: any) =>
        rows.push({
          index: x.index,
          id: x.id != null ? String(x.id) : updates[x.index]?.id,
          messages: Array.isArray(x.messages) ? x.messages.map(String) : flat(x.messages),
        }),
      );
      if (typeof data.detail === 'string') general = data.detail;
    } else if (Array.isArray(data.updates)) {
      // DRF per-index format: { updates: [{}, { price: ["..."] }] } or a plain string list
      data.updates.forEach((u: unknown, i: number) => {
        let messages: string[] = [];
        if (typeof u === 'string') messages = [u];
        else if (u && typeof u === 'object') {
          messages = Object.entries(u).flatMap(([k, v]) =>
            flat(v).map((m) => (k === 'non_field_errors' ? m : `${k.replace(/_/g, ' ')}: ${m}`)),
          );
        }
        if (messages.length) rows.push({ index: i, id: updates[i]?.id, messages });
      });
    } else if (typeof data.detail === 'string') {
      general = data.detail;
    }
  }

  if (!general && rows.length === 0) general = getApiError(e, 'Request failed');
  return { general, rows };
};