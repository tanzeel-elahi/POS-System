import client from './api';
import { buildParams, fromApi, toPaginated } from './apiHelpers';
import { cnicDigits } from '@/utils/format';
import type { Customer, CustomerDetail, CustomerPayload, ListParams, PaginatedResponse } from '@/types';

const text = (v?: string | null) => (v ?? '').trim(); // "" clears
const nullable = (v?: string | null) => (v ?? '').trim() || null; // null clears
const decimal = (v?: number | null) => (v == null ? null : v.toFixed(2));

const buildBody = (d: CustomerPayload) => ({
  name: d.name.trim(),
  phone: d.phone.trim(),
  email: nullable(d.email),
  address: nullable(d.address),
  alternate_phone: text(d.alternatePhone),
  city: text(d.city),
  occupation: text(d.occupation),
  employer: text(d.employer),
  notes: text(d.notes),
  monthly_salary: decimal(d.monthlySalary),
  credit_limit: decimal(d.creditLimit),
  cnic: cnicDigits(d.cnic) || null,
  manager: d.manager ? Number(d.manager) : null,
});

const normalizeDetail = (raw: any): CustomerDetail => {
  const base = fromApi<CustomerDetail>(raw);
  return {
    ...base,
    manager: raw.manager != null ? String(raw.manager) : null,
    managerName: raw.manager_name ?? null,
    monthlySalary: raw.monthly_salary != null ? Number(raw.monthly_salary) : null,
    creditLimit: raw.credit_limit != null ? Number(raw.credit_limit) : null,
    cnic: raw.cnic ?? null,
  };
};

export class CustomerService {
  static async getCustomers(params: ListParams = {}): Promise<PaginatedResponse<Customer>> {
    const res = await client.get('/customers/', { params: buildParams(params) });
    return toPaginated<Customer>(res.data, params);
  }

  /** Full record, including sensitive fields. Don't log or keep it around longer than needed. */
  static async getCustomer(id: string): Promise<CustomerDetail> {
    return normalizeDetail((await client.get(`/customers/${id}/`)).data);
  }

  static async lookupByPhone(phone: string): Promise<Customer | null> {
    try {
      const res = await client.get('/customers/lookup/', { params: { phone } });
      return fromApi<Customer>(res.data);
    } catch (e: any) {
      if (e?.response?.status === 404) return null;
      throw e;
    }
  }

  static async createCustomer(data: CustomerPayload): Promise<CustomerDetail> {
    return normalizeDetail((await client.post('/customers/', buildBody(data))).data);
  }

  static async updateCustomer(id: string, data: CustomerPayload): Promise<CustomerDetail> {
    return normalizeDetail((await client.patch(`/customers/${id}/`, buildBody(data))).data);
  }

  static async deleteCustomer(id: string): Promise<void> {
    await client.delete(`/customers/${id}/`);
  }
}