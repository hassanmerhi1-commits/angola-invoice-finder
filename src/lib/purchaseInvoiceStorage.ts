/**
 * Purchase Invoice (Fatura de Compra) Storage
 * Handles CRUD, stock updates, journal entries, and price updates
 */

import { Product } from '@/types/erp';
import { getAllProducts, saveProduct, updateProductStock, saveStockMovement, getSuppliers, saveSupplier } from '@/lib/storage';

const STORAGE_KEY = 'kwanzaerp_purchase_invoices';

export interface PurchaseInvoiceLine {
  id: string;
  productId: string;
  productCode: string;
  description: string;
  quantity: number;
  packaging: number; // embalagem
  unitPrice: number;
  discountPct: number;
  discountPct2: number;
  totalQty: number; // quantity * packaging
  total: number;
  ivaRate: number;
  ivaAmount: number;
  totalWithIva: number;
  warehouseId: string;
  warehouseName: string;
  currentStock: number;
  unit: string;
  barcode?: string;
}

export interface PurchaseInvoiceJournalLine {
  id: string;
  accountCode: string;
  accountName: string;
  currency: string;
  note: string;
  debit: number;
  credit: number;
}

export interface PurchaseInvoice {
  id: string;
  invoiceNumber: string;
  // Supplier
  supplierAccountCode: string;
  supplierName: string;
  supplierNif?: string;
  supplierPhone?: string;
  supplierBalance: number;
  // Header
  ref?: string;
  supplierInvoiceNo?: string; // Supplier's own invoice number
  contact?: string;
  department?: string;
  ref2?: string;
  date: string;
  paymentDate: string;
  project?: string;
  currency: string;
  warehouseId: string;
  warehouseName: string;
  priceType: 'last_price' | 'average_price' | 'manual';
  address?: string;
  // Accounting codes
  purchaseAccountCode: string; // Conta de Fatura (e.g. 2121001)
  ivaAccountCode: string;     // IVA Conta (e.g. 3456001)
  transactionType: string;    // ALL
  currencyRate: number;       // Moeda Valor
  taxRate2: number;           // Taxa 2
  orderNo?: string;
  surchargePercent: number;   // Sobrecusto%
  // Options
  changePrice: boolean;
  isPending: boolean;
  extraNote?: string;
  // Lines
  lines: PurchaseInvoiceLine[];
  // Journal entries (Entrada Diario)
  journalLines: PurchaseInvoiceJournalLine[];
  // Totals
  subtotal: number;
  ivaTotal: number;
  total: number; // Liquido
  // Status
  status: 'draft' | 'confirmed' | 'cancelled';
  branchId: string;
  branchName: string;
  createdBy: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
}

// ---------- CRUD ----------

function getAll(): PurchaseInvoice[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch { return []; }
}

function saveAll(invoices: PurchaseInvoice[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(invoices));
}

export function getPurchaseInvoices(branchId?: string): PurchaseInvoice[] {
  let docs = getAll();
  if (branchId) docs = docs.filter(d => d.branchId === branchId);
  return docs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function getPurchaseInvoiceById(id: string): PurchaseInvoice | undefined {
  return getAll().find(d => d.id === id);
}

export function generatePurchaseInvoiceNumber(branchCode: string): string {
  const now = new Date();
  const date = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  const all = getAll();
  const seq = all.length + 1;
  return `FC-${branchCode}-${date}-${String(seq).padStart(4, '0')}`;
}

export function savePurchaseInvoice(invoice: PurchaseInvoice): PurchaseInvoice {
  const all = getAll();
  const idx = all.findIndex(d => d.id === invoice.id);
  if (idx >= 0) {
    all[idx] = { ...invoice, updatedAt: new Date().toISOString() };
  } else {
    all.push(invoice);
  }
  saveAll(all);
  return invoice;
}

export function deletePurchaseInvoice(id: string): void {
  saveAll(getAll().filter(d => d.id !== id));
}

// ---------- Line calculations ----------

export function calculateLine(line: Partial<PurchaseInvoiceLine>): PurchaseInvoiceLine {
  const qty = line.quantity || 0;
  const pkg = line.packaging || 1;
  const price = line.unitPrice || 0;
  const disc1 = line.discountPct || 0;
  const disc2 = line.discountPct2 || 0;
  const ivaRate = line.ivaRate || 0;

  const totalQty = qty * pkg;
  const gross = totalQty * price;
  const afterDisc1 = gross * (1 - disc1 / 100);
  const afterDisc2 = afterDisc1 * (1 - disc2 / 100);
  const ivaAmount = afterDisc2 * (ivaRate / 100);
  const totalWithIva = afterDisc2 + ivaAmount;

  return {
    id: line.id || `line_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    productId: line.productId || '',
    productCode: line.productCode || '',
    description: line.description || '',
    quantity: qty,
    packaging: pkg,
    unitPrice: price,
    discountPct: disc1,
    discountPct2: disc2,
    totalQty,
    total: Math.round(afterDisc2 * 100) / 100,
    ivaRate,
    ivaAmount: Math.round(ivaAmount * 100) / 100,
    totalWithIva: Math.round(totalWithIva * 100) / 100,
    warehouseId: line.warehouseId || '',
    warehouseName: line.warehouseName || '',
    currentStock: line.currentStock || 0,
    unit: line.unit || 'UN',
    barcode: line.barcode,
  };
}

export function calculateInvoiceTotals(lines: PurchaseInvoiceLine[]) {
  const subtotal = lines.reduce((s, l) => s + l.total, 0);
  const ivaTotal = lines.reduce((s, l) => s + l.ivaAmount, 0);
  const total = lines.reduce((s, l) => s + l.totalWithIva, 0);
  return {
    subtotal: Math.round(subtotal * 100) / 100,
    ivaTotal: Math.round(ivaTotal * 100) / 100,
    total: Math.round(total * 100) / 100,
  };
}

// ---------- Phase 2: Stock update ----------

export async function applyStockUpdate(invoice: PurchaseInvoice): Promise<void> {
  for (const line of invoice.lines) {
    if (!line.productId || line.totalQty <= 0) continue;
    await updateProductStock(line.productId, line.totalQty, invoice.branchId);
    await saveStockMovement({
      id: `sm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      productId: line.productId,
      productName: line.description,
      sku: line.productCode,
      branchId: invoice.branchId,
      type: 'IN',
      quantity: line.totalQty,
      reason: 'purchase',
      referenceId: invoice.id,
      referenceNumber: invoice.invoiceNumber,
      costAtTime: line.unitPrice,
      notes: `Fatura de Compra ${invoice.invoiceNumber} - ${invoice.supplierName}`,
      createdBy: invoice.createdBy,
      createdAt: new Date().toISOString(),
    });
  }
}

// ---------- Phase 5: Update product purchase price ----------

export async function applyPriceUpdate(invoice: PurchaseInvoice): Promise<void> {
  if (!invoice.changePrice) return;
  const products = await getAllProducts();
  for (const line of invoice.lines) {
    if (!line.productId) continue;
    const product = products.find(p => p.id === line.productId);
    if (!product) continue;

    // Stock was already updated in applyStockUpdate, so reverse the incoming qty
    // to get the true previous stock before this purchase.
    const currentStock = product.stock || 0;
    const previousStock = Math.max(currentStock - line.totalQty, 0);
    const previousAverageCost = product.avgCost || product.cost || 0;
    const previousTotalValue = previousStock * previousAverageCost;
    const newItemsTotalValue = line.totalQty * line.unitPrice;
    const newTotalStock = previousStock + line.totalQty;
    const newAvgCost = newTotalStock > 0
      ? (previousTotalValue + newItemsTotalValue) / newTotalStock
      : line.unitPrice;

    const updated: Product = {
      ...product,
      cost: newAvgCost,
      avgCost: newAvgCost,
      lastCost: line.unitPrice,
      firstCost: product.firstCost || line.unitPrice,
      updatedAt: new Date().toISOString(),
    };
    await saveProduct(updated);
  }
}

// ---------- Phase 3: Auto journal entry ----------

export function generateAutoJournalLines(invoice: PurchaseInvoice): PurchaseInvoiceJournalLine[] {
  const lines: PurchaseInvoiceJournalLine[] = [];

  // Debit: Purchase account (Compra Mercadorias)
  if (invoice.subtotal > 0) {
    lines.push({
      id: `jl_${Date.now()}_1`,
      accountCode: invoice.purchaseAccountCode || '2.1',
      accountName: 'Compra de Mercadorias',
      currency: invoice.currency,
      note: `FC ${invoice.invoiceNumber} - ${invoice.supplierName}`,
      debit: invoice.subtotal,
      credit: 0,
    });
  }

  // Debit: IVA Dedutível
  if (invoice.ivaTotal > 0) {
    lines.push({
      id: `jl_${Date.now()}_2`,
      accountCode: invoice.ivaAccountCode || '3456001',
      accountName: 'IVA Dedutível',
      currency: invoice.currency,
      note: `IVA - FC ${invoice.invoiceNumber}`,
      debit: invoice.ivaTotal,
      credit: 0,
    });
  }

  // Credit: Supplier account (Fornecedor)
  lines.push({
    id: `jl_${Date.now()}_3`,
    accountCode: invoice.supplierAccountCode,
    accountName: invoice.supplierName,
    currency: invoice.currency,
    note: `FC ${invoice.invoiceNumber}`,
    debit: 0,
    credit: invoice.total,
  });

  return lines;
}

// ---------- Phase 6: Update supplier balance ----------

export async function applySupplierBalanceUpdate(invoice: PurchaseInvoice): Promise<void> {
  if (invoice.total <= 0) return;
  const suppliers = await getSuppliers();
  // Match by account code or name
  const supplier = suppliers.find(
    s => s.id === invoice.supplierAccountCode || s.name === invoice.supplierName || s.nif === invoice.supplierNif
  );
  if (!supplier) {
    console.warn(`[PurchaseInvoice] Supplier not found for balance update: ${invoice.supplierName}`);
    return;
  }
  const updated = {
    ...supplier,
    balance: (supplier.balance || 0) + invoice.total,
    updatedAt: new Date().toISOString(),
  };
  await saveSupplier(updated);
  console.log(`[PurchaseInvoice] Updated supplier ${supplier.name} balance: ${supplier.balance} → ${updated.balance}`);
}
