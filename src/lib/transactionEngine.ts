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
  isElectronMode,
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
  warehouseId: string;
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
  transactionType: 'purchase_invoice' | 'sale' | 'payment_receipt' | 'payment_out' | 'stock_transfer' | 'adjustment' | 'expense' | 'credit_note';
  documentId: string;
  documentNumber: string;
  branchId: string;
  branchName: string;
  userId: string;
  userName: string;
  date: string;
  currency?: string;
  stockEntries?: StockEntry[];
  journalLines?: JournalLine[];
  openItem?: OpenItemEntry;
  documentLinks?: DocumentLinkEntry[];
  priceUpdates?: {
    productId: string;
    newUnitCost: number;
    quantityReceived: number;
    updateAvgCost: boolean;
  }[];
  entityBalanceUpdate?: {
    entityType: 'customer' | 'supplier';
    entityId: string;
    entityName: string;
    entityNif?: string;
    amount: number;
  };
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

// ==================== STORAGE (dual-mode: SQLite / localStorage) ====================
const OPEN_ITEMS_KEY = 'kwanzaerp_open_items';
const DOCUMENT_LINKS_KEY = 'kwanzaerp_document_links';

async function getOpenItems(): Promise<OpenItem[]> {
  if (isElectronMode()) {
    try {
      const result = await window.electronAPI!.db.getAll('open_items');
      return (result.data || []).map((row: any) => ({
        id: row.id,
        entityType: row.entity_type,
        entityId: row.entity_id,
        documentType: row.document_type,
        documentId: row.document_id,
        documentNumber: row.document_number,
        documentDate: row.document_date,
        dueDate: row.due_date,
        currency: row.currency || 'AOA',
        originalAmount: Number(row.original_amount || 0),
        remainingAmount: Number(row.remaining_amount || 0),
        isDebit: !!row.is_debit,
        status: row.status || 'open',
        branchId: row.branch_id,
        createdAt: row.created_at,
      }));
    } catch (e) {
      console.error('[TransactionEngine] getOpenItems error:', e);
      return [];
    }
  }
  try {
    return JSON.parse(localStorage.getItem(OPEN_ITEMS_KEY) || '[]');
  } catch { return []; }
}

async function saveOpenItem(item: OpenItem): Promise<void> {
  if (isElectronMode()) {
    try {
      await window.electronAPI!.db.insert('open_items', {
        id: item.id,
        entity_type: item.entityType,
        entity_id: item.entityId,
        document_type: item.documentType,
        document_id: item.documentId,
        document_number: item.documentNumber,
        document_date: item.documentDate,
        due_date: item.dueDate || '',
        currency: item.currency || 'AOA',
        original_amount: item.originalAmount,
        remaining_amount: item.remainingAmount,
        is_debit: item.isDebit ? 1 : 0,
        status: item.status,
        branch_id: item.branchId,
      });
    } catch (e) {
      console.error('[TransactionEngine] saveOpenItem error:', e);
    }
    return;
  }
  const items = await getOpenItems();
  items.push(item);
  localStorage.setItem(OPEN_ITEMS_KEY, JSON.stringify(items));
}

async function getDocumentLinks(): Promise<DocumentLink[]> {
  if (isElectronMode()) {
    try {
      const result = await window.electronAPI!.db.getAll('document_links');
      return (result.data || []).map((row: any) => ({
        id: row.id,
        sourceType: row.source_type,
        sourceId: row.source_id,
        sourceNumber: row.source_number,
        targetType: row.target_type,
        targetId: row.target_id,
        targetNumber: row.target_number,
        createdAt: row.created_at,
      }));
    } catch (e) {
      console.error('[TransactionEngine] getDocumentLinks error:', e);
      return [];
    }
  }
  try {
    return JSON.parse(localStorage.getItem(DOCUMENT_LINKS_KEY) || '[]');
  } catch { return []; }
}

async function saveDocumentLink(link: DocumentLink): Promise<void> {
  if (isElectronMode()) {
    try {
      await window.electronAPI!.db.insert('document_links', {
        id: link.id,
        source_type: link.sourceType,
        source_id: link.sourceId,
        source_number: link.sourceNumber,
        target_type: link.targetType,
        target_id: link.targetId,
        target_number: link.targetNumber,
      });
    } catch (e) {
      console.error('[TransactionEngine] saveDocumentLink error:', e);
    }
    return;
  }
  const links = await getDocumentLinks();
  links.push(link);
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
          branchId: entry.warehouseId,
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
    
    // ── Phase 4: Open Item (receivable/payable) → SQLite in Electron ──
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
      
      await saveOpenItem(openItem);
      result.openItemId = openItem.id;
    }
    
    // ── Phase 5: Document Links → SQLite in Electron ──
    if (request.documentLinks && request.documentLinks.length > 0) {
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
        await saveDocumentLink(link);
        result.documentLinkIds.push(link.id);
      }
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

export async function getOpenItemsByEntity(entityType: 'customer' | 'supplier', entityId: string): Promise<OpenItem[]> {
  const items = await getOpenItems();
  return items.filter(oi => oi.entityType === entityType && oi.entityId === entityId && oi.status !== 'cleared');
}

export async function getOpenItemsByBranch(branchId: string): Promise<OpenItem[]> {
  const items = await getOpenItems();
  return items.filter(oi => oi.branchId === branchId);
}

export async function getDocumentLinksBySource(sourceType: string, sourceId: string): Promise<DocumentLink[]> {
  const links = await getDocumentLinks();
  return links.filter(dl => dl.sourceType === sourceType && dl.sourceId === sourceId);
}

export async function getDocumentLinksByTarget(targetType: string, targetId: string): Promise<DocumentLink[]> {
  const links = await getDocumentLinks();
  return links.filter(dl => dl.targetType === targetType && dl.targetId === targetId);
}

export async function getDocumentChain(documentType: string, documentId: string): Promise<DocumentLink[]> {
  const links = await getDocumentLinks();
  const chain: DocumentLink[] = [];
  chain.push(...links.filter(dl => dl.sourceType === documentType && dl.sourceId === documentId));
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
