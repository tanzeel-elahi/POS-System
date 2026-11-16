import client from './api';
import type { ProductGroup, ProductGroupCreatePayload, ProductVariant, VariantInput } from '@/types';

/** Body for one variant. Used for create, add-variant and edit-variant. */
export const variantBody = (v: VariantInput) => ({
  sku: v.sku.trim(),
  price: v.price.toFixed(2),
  stock_quantity: v.stockQuantity,
  qr_code: (v.qrCode ?? '').trim() || null, // null clears
  attributes: Object.fromEntries(Object.entries(v.attributes).map(([k, val]) => [k, val.trim()])),
});

const normVariant = (v: any): ProductVariant => ({
  id: String(v.id),
  sku: v.sku,
  price: Number(v.price),
  stockQuantity: v.stock_quantity,
  qrCode: v.qr_code ?? null,
  attributes: v.attributes ?? {},
  displayName: v.display_name,
  isActive: v.is_active,
});

const normGroup = (g: any): ProductGroup => ({
  id: String(g.id),
  name: g.name,
  description: g.description ?? '',
  category: g.category != null ? String(g.category) : null,
  categoryName: g.category_name ?? null,
  attributeNames: g.attribute_names ?? [],
  variants: (g.variants ?? []).map(normVariant),
  isActive: g.is_active,
  createdAt: g.created_at,
  updatedAt: g.updated_at,
});

export class ProductGroupService {
  static async getGroup(id: string): Promise<ProductGroup> {
    return normGroup((await client.get(`/product-groups/${id}/`)).data);
  }

  static async createGroup(d: ProductGroupCreatePayload): Promise<ProductGroup> {
    const body = {
      name: d.name.trim(),
      description: (d.description ?? '').trim(),
      category: d.category ? Number(d.category) : null,
      attribute_names: d.attributeNames.map((n) => n.trim()),
      variants: d.variants.map(variantBody),
    };
    return normGroup((await client.post('/product-groups/', body)).data);
  }

  /** Name, description and category belong to the whole product and apply to every variant. */
  static async updateGroup(id: string, d: { name: string; description?: string; category?: string | null }) {
    const body = {
      name: d.name.trim(),
      description: (d.description ?? '').trim(),
      category: d.category ? Number(d.category) : null,
    };
    return normGroup((await client.patch(`/product-groups/${id}/`, body)).data);
  }

  static async deleteGroup(id: string): Promise<void> {
    await client.delete(`/product-groups/${id}/`); // deactivates the group and all its variants
  }

  static async addVariant(groupId: string, v: VariantInput): Promise<ProductVariant> {
    return normVariant((await client.post(`/product-groups/${groupId}/variants/`, variantBody(v))).data);
  }
}