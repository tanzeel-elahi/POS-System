import client from './api';
import type { CreditEntry, CreditSummary } from '@/types';

const normalizeEntry = (e: any): CreditEntry => ({
  id: String(e.id),
  entryType: e.entry_type,
  amount: Number(e.amount),
  bill: e.bill != null ? String(e.bill) : null,
  note: e.note ?? '',
  createdAt: e.created_at,
});

export class CreditService {
  static async getCredit(customerId: string): Promise<CreditSummary> {
    const res = await client.get(`/customers/${customerId}/credit/`);
    return { balance: Number(res.data.balance), entries: (res.data.entries ?? []).map(normalizeEntry) };
  }

  static async recordRepayment(customerId: string, data: { amount: number; note?: string }) {
    const res = await client.post(`/customers/${customerId}/credit/payments/`, {
      amount: data.amount.toFixed(2),
      note: data.note ?? '',
    });
    return { balance: Number(res.data.balance), entry: normalizeEntry(res.data.entry) };
  }
}