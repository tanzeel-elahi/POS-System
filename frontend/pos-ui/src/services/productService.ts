import client from './api';
import { buildParams, fromApi, toApi, toPaginated } from './apiHelpers';
import type { ListParams, PaginatedResponse, Product, ProductPayload } from '@/types';

const normalize = (p: Product): Product => ({ ...p, price: Number(p.price) });

export class ProductService {
  static async getProducts(params: ListParams = {}): Promise<PaginatedResponse<Product>> {
    const res = await client.get('/products/', { params: buildParams(params) });
    const page = toPaginated<Product>(res.data, params);
    return { ...page, data: page.data.map(normalize) };
  }

  static async getProduct(id: string): Promise<Product> {
    return normalize(fromApi<Product>((await client.get(`/products/${id}/`)).data));
  }

  static async createProduct(data: ProductPayload): Promise<Product> {
    return normalize(fromApi<Product>((await client.post('/products/', toApi(data))).data));
  }

  static async updateProduct(id: string, data: Partial<ProductPayload>): Promise<Product> {
    return normalize(fromApi<Product>((await client.patch(`/products/${id}/`, toApi(data))).data));
  }

  static async deleteProduct(id: string): Promise<void> {
    await client.delete(`/products/${id}/`);
  }
}