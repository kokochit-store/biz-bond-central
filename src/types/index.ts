export interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  cost: number;
  stock: number;
  reorderLevel: number;
  badge?: string;
  barcode?: string;
  vendorId?: string;
  location?: string;
  imageUrl?: string;
  description?: string;
}

export interface Customer {
  id: string;
  name: string;
  phone?: string;
  note?: string;
}

export interface Vendor {
  id: string;
  name: string;
  phone?: string;
  note?: string;
}

export interface PurchaseLine {
  itemName: string;
  orderedQty: number;
  receivedQty: number;
  cost: number;
}

export interface PurchaseOrder {
  id: string;
  vendorName: string;
  status: 'ordered' | 'partial' | 'received';
  orderDate: string;
  expectedDate?: string;
  lines: PurchaseLine[];
  note?: string;
}

export interface LedgerEntry {
  id: string;
  type: 'receivable' | 'payable';
  name: string;
  vendorId?: string;
  amount: number;
  dueDate?: string;
  note?: string;
}

export interface CartItem {
  product: Product;
  qty: number;
}

export interface InvoiceLine {
  productId: string;
  productName: string;
  qty: number;
  price: number;
  cost: number;
}

export interface Invoice {
  id: string;
  date: string;
  customerName: string;
  phoneNumber?: string;
  saleType: 'cash' | 'credit';
  paidAmount: number;
  lines: InvoiceLine[];
  total: number;
  totalCost: number;
  note?: string;
}

export interface StoreSettings {
  storeName: string;
  storeNote: string;
  heroImageUrl?: string;
  logoImageUrl?: string;
}

export type ViewName = 'overview' | 'shop' | 'invoices' | 'admin';
