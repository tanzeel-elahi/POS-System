import client from './api';
import type { Category, CategoryNode } from '@/types';

const str = (v: unknown) => (v != null ? String(v) : null);

const normCategory = (r: any): Category => ({
  id: String(r.id),
  name: r.name,
  parent: str(r.parent),
  path: r.path ?? [r.name],
});

const normNode = (r: any): CategoryNode => ({
  id: String(r.id),
  name: r.name,
  parent: str(r.parent),
  children: (r.children ?? []).map(normNode),
});

export class CategoryService {
  /** Flat list in tree order (parents before children). */
  static async getCategories(): Promise<Category[]> {
    const res = await client.get('/categories/');
    const rows = Array.isArray(res.data) ? res.data : (res.data.results ?? []);
    return rows.map(normCategory);
  }

  static async getTree(): Promise<CategoryNode[]> {
    const res = await client.get('/categories/tree/');
    return (res.data as any[]).map(normNode);
  }

  static async createCategory(name: string, parent?: string | null): Promise<Category> {
    const body: Record<string, unknown> = { name: name.trim() };
    if (parent) body.parent = Number(parent); // leave it out for a top-level category
    return normCategory((await client.post('/categories/', body)).data);
  }

  /** Rename, move, or both. `parent: null` makes it top-level. */
  static async updateCategory(id: string, patch: { name?: string; parent?: string | null }): Promise<Category> {
    const body: Record<string, unknown> = {};
    if (patch.name !== undefined) body.name = patch.name.trim();
    if (patch.parent !== undefined) body.parent = patch.parent ? Number(patch.parent) : null;
    return normCategory((await client.patch(`/categories/${id}/`, body)).data);
  }

  static async deleteCategory(id: string): Promise<void> {
    await client.delete(`/categories/${id}/`);
  }
}