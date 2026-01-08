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
  syncedToMain?: boolean;
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
  id: string;
  date: string;
  branchId: string;
  branchName: string;
  totalSales: number;
  totalTransactions: number;
  cashTotal: number;
  cardTotal: number;
  transferTotal: number;
  taxCollected: number;
  openingBalance: number;
  closingBalance: number;
  status: 'open' | 'closed';
  closedBy?: string;
  closedAt?: string;
  notes?: string;
  createdAt: string;
}

export interface Client {
  id: string;
  name: string;
  nif: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  country: string;
  creditLimit: number;
  currentBalance: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface StockTransfer {
  id: string;
  transferNumber: string;
  fromBranchId: string;
  fromBranchName: string;
  toBranchId: string;
  toBranchName: string;
  items: StockTransferItem[];
  status: 'pending' | 'in_transit' | 'received' | 'cancelled';
  requestedBy: string;
  requestedAt: string;
  approvedBy?: string;
  approvedAt?: string;
  receivedBy?: string;
  receivedAt?: string;
  notes?: string;
}

export interface StockTransferItem {
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  receivedQuantity?: number;
}

export interface DataExport {
  id: string;
  type: 'sales' | 'daily_report' | 'full_backup';
  branchId: string;
  branchName: string;
  dateFrom: string;
  dateTo: string;
  recordCount: number;
  exportedBy: string;
  exportedAt: string;
  fileName: string;
  status: 'pending' | 'exported' | 'imported';
}

export interface SyncPackage {
  id: string;
  branchId: string;
  branchCode: string;
  branchName: string;
  exportDate: string;
  dateRange: {
    from: string;
    to: string;
  };
  sales: Sale[];
  dailyReports: DailySummary[];
  clients?: Client[];
  stockTransfers?: StockTransfer[];
  version: string;
}

export interface Supplier {
  id: string;
  name: string;
  nif: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  country: string;
  contactPerson?: string;
  paymentTerms: 'immediate' | '15_days' | '30_days' | '60_days' | '90_days';
  isActive: boolean;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PurchaseOrder {
  id: string;
  orderNumber: string;
  supplierId: string;
  supplierName: string;
  branchId: string;
  branchName: string;
  items: PurchaseOrderItem[];
  subtotal: number;
  taxAmount: number;
  total: number;
  status: 'draft' | 'pending' | 'approved' | 'received' | 'partial' | 'cancelled';
  notes?: string;
  createdBy: string;
  createdAt: string;
  approvedBy?: string;
  approvedAt?: string;
  receivedBy?: string;
  receivedAt?: string;
  expectedDeliveryDate?: string;
}

export interface PurchaseOrderItem {
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  receivedQuantity?: number;
  unitCost: number;
  taxRate: number;
  subtotal: number;
}
