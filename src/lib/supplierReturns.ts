// Supplier Returns Types and Storage
import { PurchaseOrder, PurchaseOrderItem } from '@/types/erp';

export interface SupplierReturn {
  id: string;
  returnNumber: string;
  branchId: string;
  branchName: string;
  // Original Purchase Order
  purchaseOrderId: string;
  purchaseOrderNumber: string;
  supplierId: string;
  supplierName: string;
  // Return details
  reason: 'damaged' | 'wrong_item' | 'quality' | 'overstock' | 'other';
  reasonDescription: string;
  items: SupplierReturnItem[];
  // Totals
  subtotal: number;
  taxAmount: number;
  total: number;
  // Status
  status: 'pending' | 'approved' | 'shipped' | 'completed' | 'cancelled';
  // Tracking
  createdBy: string;
  createdAt: string;
  approvedBy?: string;
  approvedAt?: string;
  shippedAt?: string;
  completedAt?: string;
  notes?: string;
}

export interface SupplierReturnItem {
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  unitCost: number;
  taxRate: number;
  taxAmount: number;
  subtotal: number;
  reason?: string;
}

const STORAGE_KEY = 'kwanzaerp_supplier_returns';

function getItem<T>(key: string, defaultValue: T): T {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch {
    return defaultValue;
  }
}

function setItem<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value));
}

export function getSupplierReturns(branchId?: string): SupplierReturn[] {
  const returns = getItem<SupplierReturn[]>(STORAGE_KEY, []);
  return branchId ? returns.filter(r => r.branchId === branchId) : returns;
}

export function saveSupplierReturn(returnDoc: SupplierReturn): void {
  const returns = getSupplierReturns();
  const index = returns.findIndex(r => r.id === returnDoc.id);
  if (index >= 0) {
    returns[index] = returnDoc;
  } else {
    returns.push(returnDoc);
  }
  setItem(STORAGE_KEY, returns);
}

export function generateSupplierReturnNumber(branchCode: string): string {
  const returns = getSupplierReturns();
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const count = returns.filter(r => 
    r.returnNumber.startsWith(`DF ${branchCode}/${today}`)
  ).length + 1;
  return `DF ${branchCode}/${today}/${count.toString().padStart(4, '0')}`; // DF = Devolução a Fornecedor
}
