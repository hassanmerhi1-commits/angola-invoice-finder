// Supplier Returns Hook
import { useState, useEffect, useCallback } from 'react';
import { PurchaseOrder } from '@/types/erp';
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

  const createSupplierReturn = useCallback((
    branchId: string,
    branchCode: string,
    purchaseOrder: PurchaseOrder,
    reason: SupplierReturn['reason'],
    reasonDescription: string,
    items: SupplierReturnItem[],
    createdBy: string,
    notes?: string,
    deductStock: boolean = true
  ): SupplierReturn => {
    const branch = getBranches().find(b => b.id === branchId);
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
      items.forEach(item => {
        // Decrease stock (negative quantity)
        updateProductStock(item.productId, -item.quantity);
        
        // Record stock movement
        createStockMovement(
          item.productId,
          branchId,
          'OUT',
          item.quantity,
          'return',
          createdBy,
          supplierReturn.id,
          returnNumber,
          `Devolução a fornecedor: ${reasonDescription}`
        );
      });
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

  const cancelReturn = useCallback((returnId: string, userId: string) => {
    const returns = getSupplierReturns();
    const returnDoc = returns.find(r => r.id === returnId);
    if (returnDoc && returnDoc.status === 'pending') {
      // Restore stock if it was deducted
      returnDoc.items.forEach(item => {
        updateProductStock(item.productId, item.quantity);
        createStockMovement(
          item.productId,
          returnDoc.branchId,
          'IN',
          item.quantity,
          'adjustment',
          userId,
          returnDoc.id,
          returnDoc.returnNumber,
          'Cancelamento de devolução a fornecedor'
        );
      });
      
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
