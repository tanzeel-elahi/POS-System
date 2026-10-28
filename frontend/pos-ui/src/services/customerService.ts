import client from "./api";
import { buildParams, fromApi, toApi, toPaginated } from "./apiHelpers";
import type {
  Customer,
  CustomerPayload,
  ListParams,
  PaginatedResponse,
} from "@/types";

export class CustomerService {
  static async getCustomers(
    params: ListParams = {},
  ): Promise<PaginatedResponse<Customer>> {
    const res = await client.get("/customers/", {
      params: buildParams(params),
    });
    return toPaginated<Customer>(res.data, params);
  }

  static async getCustomer(id: string): Promise<Customer> {
    return fromApi<Customer>((await client.get(`/customers/${id}/`)).data);
  }

  static async createCustomer(data: CustomerPayload): Promise<Customer> {
    return fromApi<Customer>(
      (await client.post("/customers/", toApi(data))).data,
    );
  }

  static async updateCustomer(
    id: string,
    data: Partial<CustomerPayload>,
  ): Promise<Customer> {
    return fromApi<Customer>(
      (await client.patch(`/customers/${id}/`, toApi(data))).data,
    );
  }

  static async deleteCustomer(id: string): Promise<void> {
    await client.delete(`/customers/${id}/`);
  }

  static async lookupByPhone(phone: string): Promise<Customer | null> {
    try {
      const res = await client.get("/customers/lookup/", { params: { phone } });
      return fromApi<Customer>(res.data);
    } catch (e: any) {
      if (e?.response?.status === 404) return null;
      throw e;
    }
  }
}
