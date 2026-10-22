import type { ListParams, PaginatedResponse } from '@/types';

const delay = (ms = 300) => new Promise((r) => setTimeout(r, ms));
const uid = () => Math.random().toString(36).slice(2, 10);

type Base = { id: string; createdAt: string; updatedAt: string };

/** In-memory CRUD that mimics the server shape: { data, total, skip, take, hasMore } */
export function createMockStore<T extends Base>(seed: T[], searchKeys: (keyof T)[]) {
  let rows = [...seed];

  return {
    async list(params: ListParams = {}): Promise<PaginatedResponse<T>> {
      await delay();
      const { skip = 0, take = 10, search, sortField, sortOrder = 'asc' } = params;
      let result = rows;
      if (search) {
        const q = search.toLowerCase();
        result = result.filter((r) => searchKeys.some((k) => String(r[k] ?? '').toLowerCase().includes(q)));
      }
      if (sortField) {
        result = [...result].sort((a: any, b: any) => {
          const av = a[sortField],
            bv = b[sortField];
          const cmp = typeof av === 'number' ? av - bv : String(av ?? '').localeCompare(String(bv ?? ''));
          return sortOrder === 'asc' ? cmp : -cmp;
        });
      }
      const total = result.length;
      return { data: result.slice(skip, skip + take), total, skip, take, hasMore: skip + take < total };
    },
    async get(id: string): Promise<T> {
      await delay(150);
      const row = rows.find((r) => r.id === id);
      if (!row) throw new Error('Not found');
      return row;
    },
    async create(payload: Omit<T, keyof Base>): Promise<T> {
      await delay();
      const now = new Date().toISOString();
      const row = { ...payload, id: uid(), createdAt: now, updatedAt: now } as unknown as T;
      rows = [row, ...rows];
      return row;
    },
    async update(id: string, payload: Partial<Omit<T, keyof Base>>): Promise<T> {
      await delay();
      const idx = rows.findIndex((r) => r.id === id);
      if (idx < 0) throw new Error('Not found');
      rows[idx] = { ...rows[idx], ...payload, updatedAt: new Date().toISOString() };
      return rows[idx];
    },
    async remove(id: string): Promise<void> {
      await delay();
      rows = rows.filter((r) => r.id !== id);
    },
  };
}
