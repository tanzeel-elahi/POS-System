import client from "./api";
import { buildParams, fromApi, toPaginated } from "./apiHelpers";
import { variantBody } from "./productGroupService";
import type {
  BulkUpdateResult,
  BulkUpdateRow,
  ListParams,
  PaginatedResponse,
  Product,
  ProductPayload,
  VariantInput,
} from "@/types";

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
        stock_lte: params.stockLte ?? undefined,
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

  /** Dry run: omit batchId. Real run: pass the batchId generated when the review opened. */
  static async bulkUpdate(
    updates: BulkUpdateRow[],
    opts: { dryRun: boolean; batchId?: string },
  ): Promise<BulkUpdateResult> {
    const body = {
      dry_run: opts.dryRun,
      ...(opts.batchId ? { batch_id: opts.batchId } : {}),
      updates: updates.map((u) => ({
        id: Number(u.id),
        ...(u.price !== undefined ? { price: u.price.toFixed(2) } : {}),
        ...(u.pricePercent !== undefined
          ? { price_percent: String(u.pricePercent) }
          : {}),
        ...(u.stockQuantity !== undefined
          ? { stock_quantity: u.stockQuantity }
          : {}),
        ...(u.stockChange !== undefined ? { stock_change: u.stockChange } : {}),
      })),
    };
    const d = (await client.post("/products/bulk-update/", body)).data;
    return {
      batchId: d.batch_id ?? null,
      dryRun: !!d.dry_run,
      changed: d.changed,
      unchanged: d.unchanged,
      changes: (d.changes ?? []).map((c: any) => ({
        id: String(c.id),
        sku: c.sku,
        displayName: c.display_name,
        oldPrice: Number(c.old_price),
        newPrice: Number(c.new_price),
        oldStock: c.old_stock,
        newStock: c.new_stock,
      })),
    };
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
