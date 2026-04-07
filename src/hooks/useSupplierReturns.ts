// Supplier Returns Hook — async
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

  const refreshReturns = useCallback(async () => {
    const data = await getSupplierReturns(branchId);
    setSupplierReturns(data);
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

    await saveSupplierReturn(supplierReturn);

    if (deductStock) {
      for (const item of items) {
        await updateProductStock(item.productId, -item.quantity);
        
        const movement: StockMovement = {
          id: `sm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          productId: item.productId,
          productName: item.productName,
          sku: item.sku,
          branchId,
          type: 'OUT',
          quantity: item.quantity,
          reason: 'return',
          createdBy,
          referenceId: supplierReturn.id,
          referenceNumber: returnNumber,
          notes: `Devolução a fornecedor: ${reasonDescription}`,
          createdAt: new Date().toISOString(),
        };
        await saveStockMovement(movement);
      }
    }

    await refreshReturns();
    return supplierReturn;
  }, [refreshReturns]);

  const approveReturn = useCallback(async (returnId: string, approvedBy: string) => {
    const returns = await getSupplierReturns();
    const returnDoc = returns.find(r => r.id === returnId);
    if (returnDoc && returnDoc.status === 'pending') {
      returnDoc.status = 'approved';
      returnDoc.approvedBy = approvedBy;
      returnDoc.approvedAt = new Date().toISOString();
      await saveSupplierReturn(returnDoc);
      await refreshReturns();
    }
  }, [refreshReturns]);

  const markAsShipped = useCallback(async (returnId: string) => {
    const returns = await getSupplierReturns();
    const returnDoc = returns.find(r => r.id === returnId);
    if (returnDoc && returnDoc.status === 'approved') {
      returnDoc.status = 'shipped';
      returnDoc.shippedAt = new Date().toISOString();
      await saveSupplierReturn(returnDoc);
      await refreshReturns();
    }
  }, [refreshReturns]);

  const completeReturn = useCallback(async (returnId: string) => {
    const returns = await getSupplierReturns();
    const returnDoc = returns.find(r => r.id === returnId);
    if (returnDoc && returnDoc.status === 'shipped') {
      returnDoc.status = 'completed';
      returnDoc.completedAt = new Date().toISOString();
      await saveSupplierReturn(returnDoc);
      await refreshReturns();
    }
  }, [refreshReturns]);

  const cancelReturn = useCallback(async (returnId: string, userId: string) => {
    const returns = await getSupplierReturns();
    const returnDoc = returns.find(r => r.id === returnId);
    if (returnDoc && returnDoc.status === 'pending') {
      for (const item of returnDoc.items) {
        await updateProductStock(item.productId, item.quantity);
        const movement: StockMovement = {
          id: `sm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          productId: item.productId,
          productName: item.productName,
          sku: item.sku,
          branchId: returnDoc.branchId,
          type: 'IN',
          quantity: item.quantity,
          reason: 'adjustment',
          createdBy: userId,
          referenceId: returnDoc.id,
          referenceNumber: returnDoc.returnNumber,
          notes: 'Cancelamento de devolução a fornecedor',
          createdAt: new Date().toISOString(),
        };
        await saveStockMovement(movement);
      }
      
      returnDoc.status = 'cancelled';
      await saveSupplierReturn(returnDoc);
      await refreshReturns();
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
