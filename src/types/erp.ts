// Core ERP Types - Ready for database integration

export interface Branch {
  id: string;
  name: string;
  code: string;
  address: string;
  phone: string;
  isMain: boolean;
  createdAt: string;
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  barcode?: string;
  category: string;
  price: number;
  cost: number;
  stock: number;
  unit: string;
  taxRate: number; // IVA rate for Angola
  branchId: string;
  isActive: boolean;
  createdAt: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
  discount: number;
  subtotal: number;
}

export interface Sale {
  id: string;
  invoiceNumber: string;
  branchId: string;
  cashierId: string;
  items: SaleItem[];
  subtotal: number;
  taxAmount: number;
  discount: number;
  total: number;
  paymentMethod: 'cash' | 'card' | 'transfer' | 'mixed';
  amountPaid: number;
  change: number;
  customerNif?: string;
  customerName?: string;
  status: 'completed' | 'voided' | 'pending';
  saftHash?: string; // For AGT compliance
  createdAt: string;
  syncedAt?: string;
}

export interface SaleItem {
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  taxRate: number;
  taxAmount: number;
  subtotal: number;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'manager' | 'cashier';
  branchId: string;
  isActive: boolean;
  createdAt: string;
}

export interface DailySummary {
  date: string;
  branchId: string;
  totalSales: number;
  totalTransactions: number;
  cashTotal: number;
  cardTotal: number;
  transferTotal: number;
  taxCollected: number;
}
