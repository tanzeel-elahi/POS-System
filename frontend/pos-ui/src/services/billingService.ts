import client from './api';
import type { Bill, BillCreatePayload } from '@/types';

const BILLS_URL = '/bills/'; // adjust if your urls.py differs

const normalizeBill = (raw: any): Bill => ({
  id: String(raw.id),
  customer: raw.customer != null ? String(raw.customer) : null,
  customerName: raw.customer_name ?? '',
  totalAmount: Number(raw.total_amount),
  createdAt: raw.created_at,
  items: (raw.items ?? []).map((i: any) => ({
    id: String(i.id),
    product: i.product != null ? String(i.product) : null,
    name: i.name,
    unitPrice: Number(i.unit_price),
    quantity: i.quantity,
    lineTotal: Number(i.line_total),
  })),
});

export class BillingService {
  static async createBill(data: BillCreatePayload): Promise<Bill> {
    const payload = {
      customer_id: data.customerId ? Number(data.customerId) : null,
      customer_name: data.customerName ?? '',
      items: data.items.map((i) =>
        i.productId
          ? { product_id: Number(i.productId), quantity: i.quantity }
          : { name: i.name, unit_price: i.unitPrice, quantity: i.quantity },
      ),
    };
    const res = await client.post(BILLS_URL, payload);
    return normalizeBill(res.data);
  }
}