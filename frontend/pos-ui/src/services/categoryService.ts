import client from './api';
import type { Category } from '@/types';

const norm = (r: any): Category => ({ id: String(r.id), name: r.name });

export class CategoryService {
  static async getCategories(): Promise<Category[]> {
    const res = await client.get('/categories/');
    const rows = Array.isArray(res.data) ? res.data : (res.data.results ?? []);
    return rows.map(norm);
  }

  static async createCategory(name: string): Promise<Category> {
    return norm((await client.post('/categories/', { name: name.trim() })).data);
  }

  static async renameCategory(id: string, name: string): Promise<Category> {
    return norm((await client.patch(`/categories/${id}/`, { name: name.trim() })).data);
  }

  static async deleteCategory(id: string): Promise<void> {
    await client.delete(`/categories/${id}/`);
  }
}