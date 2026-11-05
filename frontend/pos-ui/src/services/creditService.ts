import client from "./api";
import type { CreditEntry, CreditStatement, CreditSummary } from "@/types";

const normalizeEntry = (e: any): CreditEntry => ({
  id: String(e.id),
  entryType: e.entry_type,
  amount: Number(e.amount),
  bill: e.bill != null ? String(e.bill) : null,
  note: e.note ?? "",
  createdAt: e.created_at,
});

export class CreditService {
  static async getCredit(customerId: string): Promise<CreditSummary> {
    const res = await client.get(`/customers/${customerId}/credit/`);
    return {
      balance: Number(res.data.balance),
      entries: (res.data.entries ?? []).map(normalizeEntry),
    };
  }

  static async recordRepayment(
    customerId: string,
    data: { amount: number; note?: string },
  ) {
    const res = await client.post(`/customers/${customerId}/credit/payments/`, {
      amount: data.amount.toFixed(2),
      note: data.note ?? "",
    });
    return {
      balance: Number(res.data.balance),
      entry: normalizeEntry(res.data.entry),
    };
  }

  static async getStatement(
    customerId: string,
    range: { startDate?: string; endDate?: string } = {},
  ): Promise<CreditStatement> {
    const res = await client.get(`/customers/${customerId}/credit/statement/`, {
      params: { start_date: range.startDate, end_date: range.endDate }, // undefined values are not sent
    });
    const d = res.data;
    return {
      customer: {
        id: String(d.customer.id),
        name: d.customer.name,
        phone: d.customer.phone,
      },
      period: {
        startDate: d.period?.start_date ?? null,
        endDate: d.period?.end_date ?? null,
      },
      openingBalance: Number(d.opening_balance),
      totalCharges: Number(d.total_charges),
      totalPayments: Number(d.total_payments),
      closingBalance: Number(d.closing_balance),
      entries: (d.entries ?? []).map((e: any) => ({
        id: String(e.id),
        createdAt: e.created_at,
        entryType: e.entry_type,
        bill: e.bill != null ? String(e.bill) : null,
        note: e.note ?? "",
        amount: Number(e.amount),
        runningBalance: Number(e.running_balance),
      })),
    };
  }
}
