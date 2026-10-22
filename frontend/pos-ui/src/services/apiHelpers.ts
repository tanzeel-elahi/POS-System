import type { ListParams, PaginatedResponse } from '@/types';

const toCamel = (s: string) => s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
const toSnake = (s: string) => s.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);

const mapKeys = (obj: any, fn: (k: string) => string): any =>
  obj && typeof obj === 'object' && !Array.isArray(obj)
    ? Object.fromEntries(Object.entries(obj).map(([k, v]) => [fn(k), v]))
    : obj;

export const fromApi = <T,>(raw: any): T => {
  const row = mapKeys(raw, toCamel);
  return { ...row, id: String(row.id) } as T;
};

export const toApi = (data: Record<string, any>) => mapKeys(data, toSnake);

/** Builds query params. Search, paging and ordering are sent; ignored by Django if not enabled. */
export const buildParams = ({ skip = 0, take = 10, search, sortField, sortOrder }: ListParams) => ({
  search: search || undefined,
  page: Math.floor(skip / take) + 1,
  page_size: take,
  ordering: sortField ? `${sortOrder === 'desc' ? '-' : ''}${toSnake(sortField)}` : undefined,
});

/** Handles both a plain array and DRF's { count, next, previous, results }. */
export const toPaginated = <T,>(raw: any, params: ListParams): PaginatedResponse<T> => {
  const { skip = 0, take = 10, sortField, sortOrder } = params;

  if (Array.isArray(raw)) {
    let rows = raw.map((r) => fromApi<any>(r));
    if (sortField) {
      rows = [...rows].sort((a, b) => {
        const av = a[sortField], bv = b[sortField];
        const cmp = typeof av === 'number' ? av - bv : String(av ?? '').localeCompare(String(bv ?? ''));
        return sortOrder === 'desc' ? -cmp : cmp;
      });
    }
    return { data: rows.slice(skip, skip + take) as T[], total: rows.length, skip, take, hasMore: skip + take < rows.length };
  }

  return {
    data: (raw.results as any[]).map((r) => fromApi<T>(r)),
    total: raw.count,
    skip,
    take,
    hasMore: !!raw.next,
  };
};