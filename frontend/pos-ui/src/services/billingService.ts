import client from './api';
import type { Bill, BillCreatePayload } from '@/types';

const BILLS_URL = '/bills/';

export const normalizeBill = (raw: any): Bill => ({
  id: String(raw.id),
  customer: raw.customer != null ? String(raw.customer) : null,
  customerName: raw.customer_name ?? '',
  totalAmount: Number(raw.total_amount),
  createdAt: raw.created_at,
  paymentMode: raw.payment_mode ?? 'cash',
  paymentProof: raw.payment_proof ?? null,
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
      ...(data.customerPhone ? { customer_phone: data.customerPhone } : {}),
      ...(data.customerName ? { customer_name: data.customerName } : {}),
      payment_mode: data.paymentMode,
      items: data.items.map((i) =>
        i.productId
          ? { product_id: Number(i.productId), quantity: i.quantity }
          : { name: i.name, unit_price: i.unitPrice, quantity: i.quantity },
      ),
    };
    return normalizeBill((await client.post(BILLS_URL, payload)).data);
  }

  /** Separate call after the bill exists. Don't set Content-Type — the browser adds the multipart boundary. */
  static async uploadPaymentProof(billId: string, file: File): Promise<Bill> {
    const fd = new FormData();
    fd.append('payment_proof', file);
    return normalizeBill((await client.post(`${BILLS_URL}${billId}/payment-proof/`, fd)).data);
  }

  static async getCustomerBills(customerId: string): Promise<Bill[]> {
    const res = await client.get(`/customers/${customerId}/bills/`);
    return (res.data as any[]).map(normalizeBill);
  }
}