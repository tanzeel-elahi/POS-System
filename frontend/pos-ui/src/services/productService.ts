import client from "./api";
import { buildParams, fromApi, toPaginated } from "./apiHelpers";
import { variantBody } from "./productGroupService";
import type {
  ListParams,
  PaginatedResponse,
  Product,
  ProductPayload,
  VariantInput,
} from "@/types";

// Input is already camelCase (fromApi / toPaginated ran first). Keys inside `attributes`
// are user-chosen names like "Size" and are intentionally left untouched.
const normalize = (p: any): Product => ({
  ...p,
  price: Number(p.price),
  group: p.group != null ? String(p.group) : null,
  category: p.category != null ? String(p.category) : null,
  categoryName: p.categoryName ?? null,
  qrCode: p.qrCode ?? null,
  attributes: p.attributes ?? {},
  displayName: p.displayName || p.name,
});

// Simple products only: never send attributes (400 for a simple product)
const simpleBody = (d: ProductPayload) => ({
  name: d.name.trim(),
  sku: d.sku.trim(),
  price: d.price,
  stock_quantity: d.stockQuantity,
  category: d.category ? Number(d.category) : null, // null clears
  qr_code: (d.qrCode ?? "").trim() || null, // null clears
});

export class ProductService {
  static async getProducts(
    params: ListParams = {},
  ): Promise<PaginatedResponse<Product>> {
    const res = await client.get("/products/", {
      params: {
        ...buildParams(params),
        category: params.category || undefined,
        // the backend includes subcategories by default; only send the flag to turn that off
        include_subcategories:
          params.category && params.includeSubcategories === false
            ? "false"
            : undefined,
      },
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
      const res = await client.get("/products/lookup/", {
        params: { code: code.trim() },
      });
      return normalize(fromApi(res.data));
    } catch (e: any) {
      if (e?.response?.status === 404) return null;
      throw e;
    }
  }

  static async createProduct(data: ProductPayload): Promise<Product> {
    return normalize(
      fromApi((await client.post("/products/", simpleBody(data))).data),
    );
  }

  static async updateProduct(
    id: string,
    data: ProductPayload,
  ): Promise<Product> {
    return normalize(
      fromApi((await client.patch(`/products/${id}/`, simpleBody(data))).data),
    );
  }

  /** Edit ONE variant. name/category are deliberately not sent (the API rejects changes to them). */
  static async updateVariant(id: string, data: VariantInput): Promise<Product> {
    return normalize(
      fromApi((await client.patch(`/products/${id}/`, variantBody(data))).data),
    );
  }

  static async deleteProduct(id: string): Promise<void> {
    await client.delete(`/products/${id}/`);
  }
}
