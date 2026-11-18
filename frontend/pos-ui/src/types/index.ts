export type PaymentMode = "cash" | "credit" | "online";

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
  category?: string;
  includeSubcategories?: boolean;
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
  group: string | null; // null = simple product
  category: string | null;
  categoryName: string | null;
  qrCode: string | null;
  attributes: Record<string, string>; // {} for simple products
  displayName: string; // e.g. "Water Bottle (800ml, Red, Plastic)"
}

// Simple products only. Variants never send name/category on edit.
export interface ProductPayload {
  name: string;
  sku: string;
  price: number;
  stockQuantity: number;
  category?: string | null;
  qrCode?: string | null;
}

export interface Category {
  id: string;
  name: string;
  parent: string | null;
  path: string[]; // ["Clothing", "Men", "Shirts"]
}

export interface CategoryNode {
  id: string;
  name: string;
  parent: string | null;
  children: CategoryNode[];
}

export interface Customer extends Audit {
  name: string;
  phone: string;
  email?: string | null;
  address?: string | null;
  city?: string | null;
  isActive: boolean;
}
export interface CustomerDetail extends Customer {
  alternatePhone: string;
  occupation: string;
  employer: string;
  notes: string;
  monthlySalary: number | null;
  creditLimit: number | null;
  cnic: string | null; // 13 digits, no dashes — format for display
  manager: string | null;
  managerName: string | null;
}

export interface CustomerPayload {
  name: string;
  phone: string;
  email?: string | null;
  address?: string | null;
  city?: string;
  alternatePhone?: string;
  occupation?: string;
  employer?: string;
  notes?: string;
  monthlySalary?: number | null;
  creditLimit?: number | null;
  cnic?: string | null;
  manager?: string | null;
}
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
  paymentMode: PaymentMode;
  paymentProof: string | null;
}

export interface BillItemInput {
  productId?: string; // present for catalog items
  name?: string; // custom items only
  unitPrice?: number; // custom items only
  quantity: number;
}

export interface BillCreatePayload {
  customerPhone?: string; // omit for walk-in
  customerName?: string;
  paymentMode: PaymentMode;
  items: BillItemInput[];
}

export interface CreditEntry {
  id: string;
  entryType: "sale" | "repayment";
  amount: number;
  bill: string | null;
  note: string;
  createdAt: string;
}

export interface CreditSummary {
  balance: number;
  entries: CreditEntry[];
}

export interface StatementEntry {
  id: string;
  createdAt: string;
  entryType: "sale" | "repayment";
  bill: string | null;
  note: string;
  amount: number;
  runningBalance: number;
}

export interface CreditStatement {
  customer: { id: string; name: string; phone: string };
  period: { startDate: string | null; endDate: string | null };
  openingBalance: number;
  totalCharges: number;
  totalPayments: number;
  closingBalance: number;
  entries: StatementEntry[];
}

export interface VariantInput {
  sku: string;
  price: number;
  stockQuantity: number;
  qrCode?: string | null;
  attributes: Record<string, string>; // complete object, one value per attribute
}

export interface ProductVariant {
  id: string;
  sku: string;
  price: number;
  stockQuantity: number;
  qrCode: string | null;
  attributes: Record<string, string>;
  displayName: string;
  isActive: boolean;
}

export interface ProductGroup extends Audit {
  name: string;
  description: string;
  category: string | null;
  categoryName: string | null;
  attributeNames: string[]; // use this for column order
  variants: ProductVariant[];
  isActive: boolean;
}

export interface ProductGroupCreatePayload {
  name: string;
  description?: string;
  category?: string | null;
  attributeNames: string[];
  variants: VariantInput[];
}
