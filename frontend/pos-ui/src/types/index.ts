export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  skip: number;
  take: number;
  hasMore: boolean;
}

export interface ListParams {
  skip?: number;
  take?: number;
  search?: string;
  sortField?: string;
  sortOrder?: "asc" | "desc";
}

interface Audit {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export interface Product extends Audit {
  name: string;
  sku: string;
  price: number;
  stockQuantity: number;
  isActive: boolean;
}
export type ProductPayload = Pick<
  Product,
  "name" | "sku" | "price" | "stockQuantity"
>;

export interface Customer extends Audit {
  name: string;
  phone: string;
  email?: string;
  address?: string;
  isActive: boolean;
}
export type CustomerPayload = Pick<Customer, 'name' | 'phone' | 'email' | 'address'>;
export interface BillItem {
  id: string;
  product: string | null;
  name: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
}

export interface Bill {
  id: string;
  customer: string | null;
  customerName: string;
  totalAmount: number;
  createdAt: string;
  items: BillItem[];
}

export interface BillItemInput {
  productId?: string; // present for catalog items
  name?: string; // custom items only
  unitPrice?: number; // custom items only
  quantity: number;
}

export interface BillCreatePayload {
  customerId?: string;
  customerName?: string; // walk-in / new customer
  items: BillItemInput[];
}