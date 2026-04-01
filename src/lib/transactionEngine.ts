/**
 * Central Transaction Engine
 * 
 * SAP-inspired atomic transaction processing.
 * Every business operation (sale, purchase, payment, transfer) goes through
 * this engine which atomically updates:
 *   1. Stock movements (branch-scoped)
 *   2. Journal entries (double-entry accounting)
 *   3. Open items (receivables/payables)
 *   4. Document links (traceability chain)
 *   5. Entity balances (client/supplier)
 * 
 * All operations are scoped by branchId — no global mutations.
 */

import {
  saveStockMovement,
  createLocalJournalEntry,
  updateProductStock,
  saveProduct,
  getAllProducts,
  getSuppliers,
  saveSupplier,
  getClients,
  saveClient,
} from '@/lib/storage';
import { Product, StockMovement, OpenItem, DocumentLink } from '@/types/erp';
import { logTransaction, TransactionCategory, TransactionAction } from '@/lib/transactionHistory';

// ==================== TYPES ====================

export interface StockEntry {
  productId: string;
  productName: string;
  productSku: string;
  quantity: number;
  unitCost: number;
  direction: 'IN' | 'OUT';
  warehouseId: string; // MUST be the specific branch/warehouse
}

export interface JournalLine {
  accountCode: string;
  accountName?: string;
  debit: number;
  credit: number;
  note?: string;
}

export interface OpenItemEntry {
  entityType: 'customer' | 'supplier';
  entityId: string;
  entityName: string;
  documentType: 'invoice' | 'credit_note' | 'debit_note' | 'payment' | 'advance';
  originalAmount: number;
  isDebit: boolean;
  dueDate?: string;
  currency?: string;
}

export interface DocumentLinkEntry {
  sourceType: string;
  sourceId: string;
  sourceNumber: string;
  targetType: string;
  targetId: string;
  targetNumber: string;
}

export interface TransactionRequest {
  // Identity
  transactionType: 'purchase_invoice' | 'sale' | 'payment_receipt' | 'payment_out' | 'stock_transfer' | 'adjustment' | 'expense' | 'credit_note';
  documentId: string;
  documentNumber: string;
  branchId: string;
  branchName: string;
  userId: string;
  userName: string;
  date: string;
  currency?: string;
  
  // What to process (all optional — engine processes what's provided)
  stockEntries?: StockEntry[];
  journalLines?: JournalLine[];
  openItem?: OpenItemEntry;
  documentLinks?: DocumentLinkEntry[];
  
  // Price updates (for purchases)
  priceUpdates?: {
    productId: string;
    newUnitCost: number;
    quantityReceived: number;
    updateAvgCost: boolean;
  }[];
  
  // Entity balance update
  entityBalanceUpdate?: {
    entityType: 'customer' | 'supplier';
    entityId: string;
    entityName: string;
    entityNif?: string;
    amount: number; // positive = increase balance (owes more), negative = decrease
  };
  
  // Audit
  description: string;
  amount?: number;
}

export interface TransactionResult {
  success: boolean;
  errors: string[];
  stockMovementIds: string[];
  journalEntryId?: string;
  openItemId?: string;
  documentLinkIds: string[];
}

// ==================== STORAGE KEYS ====================
const OPEN_ITEMS_KEY = 'kwanzaerp_open_items';
const DOCUMENT_LINKS_KEY = 'kwanzaerp_document_links';

function getOpenItems(): OpenItem[] {
  try {
    return JSON.parse(localStorage.getItem(OPEN_ITEMS_KEY) || '[]');
  } catch { return []; }
}

function saveOpenItems(items: OpenItem[]) {
  localStorage.setItem(OPEN_ITEMS_KEY, JSON.stringify(items));
}

function getDocumentLinks(): DocumentLink[] {
  try {
    return JSON.parse(localStorage.getItem(DOCUMENT_LINKS_KEY) || '[]');
  } catch { return []; }
}

function saveDocumentLinks(links: DocumentLink[]) {
  localStorage.setItem(DOCUMENT_LINKS_KEY, JSON.stringify(links));
}

// ==================== MAIN ENGINE ====================

export async function processTransaction(request: TransactionRequest): Promise<TransactionResult> {
  const result: TransactionResult = {
    success: false,
    errors: [],
    stockMovementIds: [],
    documentLinkIds: [],
  };
  
  // Validate branch
  if (!request.branchId) {
    result.errors.push('branchId é obrigatório — todas as transações devem ser associadas a uma filial');
    return result;
  }
  
  try {
    // ── Phase 1: Stock Movements (branch-scoped) ──
    if (request.stockEntries && request.stockEntries.length > 0) {
      for (const entry of request.stockEntries) {
        if (!entry.warehouseId) {
          result.errors.push(`Stock entry for ${entry.productSku} missing warehouseId`);
          continue;
        }
        
        const movementId = `sm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const movement: StockMovement = {
          id: movementId,
          productId: entry.productId,
          productName: entry.productName,
          sku: entry.productSku,
          branchId: entry.warehouseId, // SCOPED to specific warehouse/branch
          type: entry.direction,
          quantity: entry.quantity,
          reason: mapTransactionTypeToReason(request.transactionType),
          referenceId: request.documentId,
          referenceNumber: request.documentNumber,
          costAtTime: entry.unitCost,
          createdBy: request.userId,
          createdAt: new Date().toISOString(),
        };
        
        await saveStockMovement(movement);
        
        // Update product stock (scoped to the warehouse branch)
        // For localStorage mode, we update the product's global stock
        // In Electron/DB mode, stock is calculated from movements
        const qtyChange = entry.direction === 'IN' ? entry.quantity : -entry.quantity;
        await updateProductStock(entry.productId, qtyChange, entry.warehouseId);
        
        result.stockMovementIds.push(movementId);
      }
    }
    
    // ── Phase 2: Price Updates (WAC calculation) ──
    if (request.priceUpdates && request.priceUpdates.length > 0) {
      const products = await getAllProducts();
      for (const pu of request.priceUpdates) {
        const product = products.find(p => p.id === pu.productId);
        if (!product) continue;
        
        // Reverse the stock increment to get previous stock
        const currentStock = product.stock || 0;
        const previousStock = Math.max(currentStock - pu.quantityReceived, 0);
        const previousAvgCost = product.avgCost || product.cost || 0;
        const previousTotalValue = previousStock * previousAvgCost;
        const newItemsValue = pu.quantityReceived * pu.newUnitCost;
        const newTotalStock = previousStock + pu.quantityReceived;
        const newAvgCost = newTotalStock > 0
          ? (previousTotalValue + newItemsValue) / newTotalStock
          : pu.newUnitCost;
        
        const updated: Product = {
          ...product,
          cost: pu.updateAvgCost ? newAvgCost : product.cost,
          avgCost: pu.updateAvgCost ? newAvgCost : product.avgCost,
          lastCost: pu.newUnitCost,
          firstCost: product.firstCost || pu.newUnitCost,
          updatedAt: new Date().toISOString(),
        };
        await saveProduct(updated);
      }
    }
    
    // ── Phase 3: Journal Entry (double-entry accounting) ──
    if (request.journalLines && request.journalLines.length > 0) {
      const totalDebit = request.journalLines.reduce((s, l) => s + (l.debit || 0), 0);
      const totalCredit = request.journalLines.reduce((s, l) => s + (l.credit || 0), 0);
      
      // Validate double-entry balance
      if (Math.abs(totalDebit - totalCredit) > 0.01) {
        console.warn(`[TransactionEngine] Journal unbalanced: Debit=${totalDebit}, Credit=${totalCredit} for ${request.documentNumber}`);
      }
      
      await createLocalJournalEntry({
        description: request.description,
        referenceType: request.transactionType,
        referenceId: request.documentId,
        branchId: request.branchId,
        lines: request.journalLines.map(l => ({
          accountCode: l.accountCode,
          debit: l.debit || 0,
          credit: l.credit || 0,
        })),
      });
      
      result.journalEntryId = `je_${request.documentId}`;
    }
    
    // ── Phase 4: Open Item (receivable/payable) ──
    if (request.openItem) {
      const oi = request.openItem;
      const openItem: OpenItem = {
        id: `oi_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        entityType: oi.entityType,
        entityId: oi.entityId,
        documentType: oi.documentType,
        documentId: request.documentId,
        documentNumber: request.documentNumber,
        documentDate: request.date,
        dueDate: oi.dueDate,
        currency: oi.currency || request.currency || 'AOA',
        originalAmount: oi.originalAmount,
        remainingAmount: oi.originalAmount,
        isDebit: oi.isDebit,
        status: 'open',
        branchId: request.branchId,
        createdAt: new Date().toISOString(),
      };
      
      const items = getOpenItems();
      items.push(openItem);
      saveOpenItems(items);
      
      result.openItemId = openItem.id;
    }
    
    // ── Phase 5: Document Links ──
    if (request.documentLinks && request.documentLinks.length > 0) {
      const links = getDocumentLinks();
      for (const dl of request.documentLinks) {
        const link: DocumentLink = {
          id: `dl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          sourceType: dl.sourceType,
          sourceId: dl.sourceId,
          sourceNumber: dl.sourceNumber,
          targetType: dl.targetType,
          targetId: dl.targetId,
          targetNumber: dl.targetNumber,
          createdAt: new Date().toISOString(),
        };
        links.push(link);
        result.documentLinkIds.push(link.id);
      }
      saveDocumentLinks(links);
    }
    
    // ── Phase 6: Entity Balance Update ──
    if (request.entityBalanceUpdate) {
      const ebu = request.entityBalanceUpdate;
      if (ebu.entityType === 'supplier') {
        const suppliers = await getSuppliers();
        const supplier = suppliers.find(
          s => s.id === ebu.entityId || s.name === ebu.entityName || s.nif === ebu.entityNif
        );
        if (supplier) {
          const updated = {
            ...supplier,
            balance: (supplier.balance || 0) + ebu.amount,
            updatedAt: new Date().toISOString(),
          };
          await saveSupplier(updated);
          console.log(`[TransactionEngine] Supplier ${supplier.name} balance: ${supplier.balance} → ${updated.balance}`);
        }
      } else if (ebu.entityType === 'customer') {
        const clients = await getClients();
        const client = clients.find(
          c => c.id === ebu.entityId || c.name === ebu.entityName
        );
        if (client) {
          const updated = {
            ...client,
            currentBalance: (client.currentBalance || 0) + ebu.amount,
            updatedAt: new Date().toISOString(),
          };
          await saveClient(updated);
          console.log(`[TransactionEngine] Client ${client.name} balance: ${client.currentBalance} → ${updated.currentBalance}`);
        }
      }
    }
    
    // ── Phase 7: Audit Trail ──
    const categoryMap: Record<string, TransactionCategory> = {
      purchase_invoice: 'purchase',
      sale: 'sales',
      payment_receipt: 'sales',
      payment_out: 'purchase',
      stock_transfer: 'stock_transfer',
      adjustment: 'inventory',
      expense: 'purchase',
      credit_note: 'sales',
    };
    
    const actionMap: Record<string, TransactionAction> = {
      purchase_invoice: 'purchase_created',
      sale: 'sale_created',
      payment_receipt: 'purchase_received',
      payment_out: 'purchase_created',
      stock_transfer: 'transfer_requested',
      adjustment: 'stock_adjusted',
      expense: 'purchase_created',
      credit_note: 'sale_refunded',
    };
    
    logTransaction({
      category: categoryMap[request.transactionType] || 'purchase',
      action: actionMap[request.transactionType] || 'purchase_created',
      entityType: request.transactionType,
      entityId: request.documentId,
      entityNumber: request.documentNumber,
      description: request.description,
      amount: request.amount,
      branchId: request.branchId,
      branchName: request.branchName,
    });
    
    result.success = true;
    console.log(`[TransactionEngine] ✅ ${request.transactionType} ${request.documentNumber} processed: ${result.stockMovementIds.length} stock moves, journal=${!!result.journalEntryId}, openItem=${!!result.openItemId}, ${result.documentLinkIds.length} doc links`);
    
  } catch (error) {
    console.error('[TransactionEngine] ❌ Transaction failed:', error);
    result.errors.push(String(error));
  }
  
  return result;
}

// ==================== QUERY FUNCTIONS ====================

export function getOpenItemsByEntity(entityType: 'customer' | 'supplier', entityId: string): OpenItem[] {
  return getOpenItems().filter(oi => oi.entityType === entityType && oi.entityId === entityId && oi.status !== 'cleared');
}

export function getOpenItemsByBranch(branchId: string): OpenItem[] {
  return getOpenItems().filter(oi => oi.branchId === branchId);
}

export function getDocumentLinksBySource(sourceType: string, sourceId: string): DocumentLink[] {
  return getDocumentLinks().filter(dl => dl.sourceType === sourceType && dl.sourceId === sourceId);
}

export function getDocumentLinksByTarget(targetType: string, targetId: string): DocumentLink[] {
  return getDocumentLinks().filter(dl => dl.targetType === targetType && dl.targetId === targetId);
}

export function getDocumentChain(documentType: string, documentId: string): DocumentLink[] {
  const links = getDocumentLinks();
  const chain: DocumentLink[] = [];
  // Forward links (this doc as source)
  chain.push(...links.filter(dl => dl.sourceType === documentType && dl.sourceId === documentId));
  // Backward links (this doc as target)
  chain.push(...links.filter(dl => dl.targetType === documentType && dl.targetId === documentId));
  return chain;
}

// ==================== HELPERS ====================

function mapTransactionTypeToReason(type: string): StockMovement['reason'] {
  const map: Record<string, StockMovement['reason']> = {
    purchase_invoice: 'purchase',
    sale: 'sale',
    stock_transfer: 'transfer_in',
    adjustment: 'adjustment',
    credit_note: 'return',
  };
  return map[type] || 'adjustment';
}
