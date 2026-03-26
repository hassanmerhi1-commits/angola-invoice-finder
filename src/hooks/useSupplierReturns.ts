// Supplier Returns Hook
import { useState, useEffect, useCallback } from 'react';
import { PurchaseOrder, StockMovement } from '@/types/erp';
import { 
  SupplierReturn, 
  SupplierReturnItem,
  getSupplierReturns, 
  saveSupplierReturn, 
  generateSupplierReturnNumber 
} from '@/lib/supplierReturns';
import { getBranches, updateProductStock, saveStockMovement } from '@/lib/storage';

export function useSupplierReturns(branchId?: string) {
  const [supplierReturns, setSupplierReturns] = useState<SupplierReturn[]>([]);

  const refreshReturns = useCallback(() => {
    setSupplierReturns(getSupplierReturns(branchId));
  }, [branchId]);

  useEffect(() => {
    refreshReturns();
  }, [refreshReturns]);

  const createSupplierReturn = useCallback(async (
    branchId: string,
    branchCode: string,
    purchaseOrder: PurchaseOrder,
    reason: SupplierReturn['reason'],
    reasonDescription: string,
    items: SupplierReturnItem[],
    createdBy: string,
    notes?: string,
    deductStock: boolean = true
  ): Promise<SupplierReturn> => {
    const branches = await getBranches();
    const branch = branches.find(b => b.id === branchId);
    const returnNumber = generateSupplierReturnNumber(branchCode);
    
    const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
    const taxAmount = items.reduce((sum, item) => sum + item.taxAmount, 0);
    const total = subtotal + taxAmount;

    const supplierReturn: SupplierReturn = {
      id: `sr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      returnNumber,
      branchId,
      branchName: branch?.name || '',
      purchaseOrderId: purchaseOrder.id,
      purchaseOrderNumber: purchaseOrder.orderNumber,
      supplierId: purchaseOrder.supplierId,
      supplierName: purchaseOrder.supplierName,
      reason,
      reasonDescription,
      items,
      subtotal,
      taxAmount,
      total,
      status: 'pending',
      createdBy,
      createdAt: new Date().toISOString(),
      notes,
    };

    saveSupplierReturn(supplierReturn);

    // Deduct stock when creating the return (items leaving our inventory)
    if (deductStock) {
      for (const item of items) {
        await updateProductStock(item.productId, -item.quantity);
        
        const movement: StockMovement = {
          id: `sm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          productId: item.productId,
          branchId,
          type: 'OUT',
          quantity: item.quantity,
          reason: 'return',
          userId: createdBy,
          referenceId: supplierReturn.id,
          referenceNumber: returnNumber,
          notes: `Devolução a fornecedor: ${reasonDescription}`,
          createdAt: new Date().toISOString(),
        };
        await saveStockMovement(movement);
      }
    }

    refreshReturns();
    return supplierReturn;
  }, [refreshReturns]);

  const approveReturn = useCallback((returnId: string, approvedBy: string) => {
    const returns = getSupplierReturns();
    const returnDoc = returns.find(r => r.id === returnId);
    if (returnDoc && returnDoc.status === 'pending') {
      returnDoc.status = 'approved';
      returnDoc.approvedBy = approvedBy;
      returnDoc.approvedAt = new Date().toISOString();
      saveSupplierReturn(returnDoc);
      refreshReturns();
    }
  }, [refreshReturns]);

  const markAsShipped = useCallback((returnId: string) => {
    const returns = getSupplierReturns();
    const returnDoc = returns.find(r => r.id === returnId);
    if (returnDoc && returnDoc.status === 'approved') {
      returnDoc.status = 'shipped';
      returnDoc.shippedAt = new Date().toISOString();
      saveSupplierReturn(returnDoc);
      refreshReturns();
    }
  }, [refreshReturns]);

  const completeReturn = useCallback((returnId: string) => {
    const returns = getSupplierReturns();
    const returnDoc = returns.find(r => r.id === returnId);
    if (returnDoc && returnDoc.status === 'shipped') {
      returnDoc.status = 'completed';
      returnDoc.completedAt = new Date().toISOString();
      saveSupplierReturn(returnDoc);
      refreshReturns();
    }
  }, [refreshReturns]);

  const cancelReturn = useCallback(async (returnId: string, userId: string) => {
    const returns = getSupplierReturns();
    const returnDoc = returns.find(r => r.id === returnId);
    if (returnDoc && returnDoc.status === 'pending') {
      // Restore stock if it was deducted
      for (const item of returnDoc.items) {
        await updateProductStock(item.productId, item.quantity);
        const movement: StockMovement = {
          id: `sm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          productId: item.productId,
          branchId: returnDoc.branchId,
          type: 'IN',
          quantity: item.quantity,
          reason: 'adjustment',
          userId,
          referenceId: returnDoc.id,
          referenceNumber: returnDoc.returnNumber,
          notes: 'Cancelamento de devolução a fornecedor',
          createdAt: new Date().toISOString(),
        };
        await saveStockMovement(movement);
      }
      
      returnDoc.status = 'cancelled';
      saveSupplierReturn(returnDoc);
      refreshReturns();
    }
  }, [refreshReturns]);

  return { 
    supplierReturns, 
    createSupplierReturn, 
    approveReturn, 
    markAsShipped, 
    completeReturn, 
    cancelReturn,
    refreshReturns 
  };
}
