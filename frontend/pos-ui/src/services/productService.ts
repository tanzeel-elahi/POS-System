import client from './api';
import { buildParams, fromApi, toPaginated } from './apiHelpers';
import type { ListParams, PaginatedResponse, Product, ProductPayload } from '@/types';

// Input is already camelCase (fromApi / toPaginated ran first)
const normalize = (p: any): Product => ({
  ...p,
  price: Number(p.price), // DRF sends decimals as strings
  category: p.category != null ? String(p.category) : null,
  categoryName: p.categoryName ?? null,
  qrCode: p.qrCode ?? null,
  size: p.size ?? '',
  variant: p.variant ?? '',
  displayName: p.displayName || p.name,
});

const buildBody = (d: ProductPayload) => ({
  name: d.name.trim(),
  sku: d.sku.trim(),
  price: d.price,
  stock_quantity: d.stockQuantity,
  category: d.category ? Number(d.category) : null, // null clears
  qr_code: (d.qrCode ?? '').trim() || null, // null clears
  size: (d.size ?? '').trim(), // "" clears
  variant: (d.variant ?? '').trim(), // "" clears
});

export class ProductService {
  static async getProducts(params: ListParams = {}): Promise<PaginatedResponse<Product>> {
    const res = await client.get('/products/', {
      params: { ...buildParams(params), category: params.category || undefined },
    });
    const page = toPaginated<any>(res.data, params);
    return { ...page, data: page.data.map(normalize) };
  }

  static async getProduct(id: string): Promise<Product> {
    return normalize(fromApi((await client.get(`/products/${id}/`)).data));
  }

  /** Find a product by scanned value (matches qr_code, then sku). Returns null on 404. */
  static async lookupByCode(code: string): Promise<Product | null> {
    try {
      const res = await client.get('/products/lookup/', { params: { code: code.trim() } });
      return normalize(fromApi(res.data));
    } catch (e: any) {
      if (e?.response?.status === 404) return null;
      throw e;
    }
  }

  static async createProduct(data: ProductPayload): Promise<Product> {
    return normalize(fromApi((await client.post('/products/', buildBody(data))).data));
  }

  static async updateProduct(id: string, data: ProductPayload): Promise<Product> {
    return normalize(fromApi((await client.patch(`/products/${id}/`, buildBody(data))).data));
  }

  static async deleteProduct(id: string): Promise<void> {
    await client.delete(`/products/${id}/`);
  }
}