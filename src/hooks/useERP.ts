// ERP Hooks - Core business logic
import { useState, useEffect, useCallback } from 'react';
import { Branch, Product, Sale, User, CartItem, SaleItem, DailySummary, Client, StockTransfer, SyncPackage, Supplier, PurchaseOrder, PurchaseOrderItem, Category } from '@/types/erp';
import * as storage from '@/lib/storage';

export function useBranches() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [currentBranch, setCurrentBranchState] = useState<Branch | null>(null);

  useEffect(() => {
    setBranches(storage.getBranches());
    const current = storage.getCurrentBranch();
    if (current) {
      setCurrentBranchState(current);
    } else {
      const mainBranch = storage.getBranches().find(b => b.isMain);
      if (mainBranch) {
        storage.setCurrentBranch(mainBranch);
        setCurrentBranchState(mainBranch);
      }
    }
  }, []);

  const setCurrentBranch = useCallback((branch: Branch) => {
    storage.setCurrentBranch(branch);
    setCurrentBranchState(branch);
  }, []);

  return { branches, currentBranch, setCurrentBranch };
}

export function useProducts(branchId?: string) {
  const [products, setProducts] = useState<Product[]>([]);

  const refreshProducts = useCallback(() => {
    setProducts(storage.getProducts(branchId));
  }, [branchId]);

  useEffect(() => {
    refreshProducts();
  }, [refreshProducts]);

  const addProduct = useCallback((product: Product) => {
    storage.saveProduct(product);
    refreshProducts();
  }, [refreshProducts]);

  const updateProduct = useCallback((product: Product) => {
    storage.saveProduct(product);
    refreshProducts();
  }, [refreshProducts]);

  const deleteProduct = useCallback((productId: string) => {
    const allProducts = storage.getAllProducts();
    const filtered = allProducts.filter(p => p.id !== productId);
    localStorage.setItem('kwanza_products', JSON.stringify(filtered));
    refreshProducts();
  }, [refreshProducts]);

  return { products, refreshProducts, addProduct, updateProduct, deleteProduct };
}

export function useCart() {
  const [items, setItems] = useState<CartItem[]>([]);

  const addItem = useCallback((product: Product, quantity: number = 1) => {
    setItems(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        return prev.map(item =>
          item.product.id === product.id
            ? {
                ...item,
                quantity: item.quantity + quantity,
                subtotal: (item.quantity + quantity) * item.product.price * (1 - item.discount / 100),
              }
            : item
        );
      }
      return [...prev, {
        product,
        quantity,
        discount: 0,
        subtotal: quantity * product.price,
      }];
    });
  }, []);

  const updateQuantity = useCallback((productId: string, quantity: number) => {
    if (quantity <= 0) {
      setItems(prev => prev.filter(item => item.product.id !== productId));
    } else {
      setItems(prev =>
        prev.map(item =>
          item.product.id === productId
            ? {
                ...item,
                quantity,
                subtotal: quantity * item.product.price * (1 - item.discount / 100),
              }
            : item
        )
      );
    }
  }, []);

  const setItemDiscount = useCallback((productId: string, discount: number) => {
    setItems(prev =>
      prev.map(item =>
        item.product.id === productId
          ? {
              ...item,
              discount,
              subtotal: item.quantity * item.product.price * (1 - discount / 100),
            }
          : item
      )
    );
  }, []);

  const removeItem = useCallback((productId: string) => {
    setItems(prev => prev.filter(item => item.product.id !== productId));
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
  }, []);

  const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
  const taxAmount = items.reduce((sum, item) => {
    const itemTax = item.subtotal * (item.product.taxRate / 100);
    return sum + itemTax;
  }, 0);
  const total = subtotal + taxAmount;

  return {
    items,
    addItem,
    updateQuantity,
    setItemDiscount,
    removeItem,
    clearCart,
    subtotal,
    taxAmount,
    total,
  };
}

export function useSales(branchId?: string) {
  const [sales, setSales] = useState<Sale[]>([]);

  const refreshSales = useCallback(() => {
    setSales(storage.getSales(branchId));
  }, [branchId]);

  useEffect(() => {
    refreshSales();
  }, [refreshSales]);

  const completeSale = useCallback((
    cartItems: CartItem[],
    branchCode: string,
    branchId: string,
    cashierId: string,
    paymentMethod: Sale['paymentMethod'],
    amountPaid: number,
    customerNif?: string,
    customerName?: string,
  ): Sale => {
    const saleItems: SaleItem[] = cartItems.map(item => ({
      productId: item.product.id,
      productName: item.product.name,
      sku: item.product.sku,
      quantity: item.quantity,
      unitPrice: item.product.price,
      discount: item.discount,
      taxRate: item.product.taxRate,
      taxAmount: item.subtotal * (item.product.taxRate / 100),
      subtotal: item.subtotal,
    }));

    const subtotal = saleItems.reduce((sum, item) => sum + item.subtotal, 0);
    const taxAmount = saleItems.reduce((sum, item) => sum + item.taxAmount, 0);
    const total = subtotal + taxAmount;

    const sale: Sale = {
      id: crypto.randomUUID(),
      invoiceNumber: storage.generateInvoiceNumber(branchCode),
      branchId,
      cashierId,
      items: saleItems,
      subtotal,
      taxAmount,
      discount: 0,
      total,
      paymentMethod,
      amountPaid,
      change: amountPaid - total,
      customerNif,
      customerName,
      status: 'completed',
      createdAt: new Date().toISOString(),
    };

    storage.saveSale(sale);
    refreshSales();
    return sale;
  }, [refreshSales]);

  return { sales, completeSale, refreshSales };
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const currentUser = storage.getCurrentUser();
    setUser(currentUser);
    setIsLoading(false);
  }, []);

  const login = useCallback((email: string, _password: string): boolean => {
    // Simple demo login - will be replaced with Supabase auth
    const users = storage.getUsers();
    const foundUser = users.find(u => u.email === email && u.isActive);
    if (foundUser) {
      storage.setCurrentUser(foundUser);
      setUser(foundUser);
      return true;
    }
    return false;
  }, []);

  const logout = useCallback(() => {
    storage.setCurrentUser(null);
    setUser(null);
  }, []);

  return { user, isLoading, login, logout };
}

// Daily Reports management
export function useDailyReports(branchId?: string) {
  const [reports, setReports] = useState<DailySummary[]>([]);

  const refreshReports = useCallback(() => {
    setReports(storage.getDailyReports(branchId));
  }, [branchId]);

  useEffect(() => {
    refreshReports();
  }, [refreshReports]);

  const generateReport = useCallback((branchId: string, date: string): DailySummary => {
    const report = storage.generateDailyReport(branchId, date);
    storage.saveDailyReport(report);
    refreshReports();
    return report;
  }, [refreshReports]);

  const closeDay = useCallback((reportId: string, closingBalance: number, notes: string, userId: string) => {
    const allReports = storage.getDailyReports();
    const report = allReports.find(r => r.id === reportId);
    if (report) {
      report.status = 'closed';
      report.closingBalance = closingBalance;
      report.notes = notes;
      report.closedBy = userId;
      report.closedAt = new Date().toISOString();
      storage.saveDailyReport(report);
      refreshReports();
    }
  }, [refreshReports]);

  const getTodayReport = useCallback((branchId: string): DailySummary | null => {
    return storage.getTodayReport(branchId);
  }, []);

  return { reports, generateReport, closeDay, getTodayReport, refreshReports };
}

// Client management
export function useClients() {
  const [clients, setClients] = useState<Client[]>([]);

  const refreshClients = useCallback(() => {
    setClients(storage.getClients());
  }, []);

  useEffect(() => {
    refreshClients();
  }, [refreshClients]);

  const saveClient = useCallback((client: Client) => {
    storage.saveClient(client);
    refreshClients();
  }, [refreshClients]);

  const deleteClient = useCallback((clientId: string) => {
    storage.deleteClient(clientId);
    refreshClients();
  }, [refreshClients]);

  const createClient = useCallback((data: Omit<Client, 'id' | 'createdAt' | 'updatedAt'>): Client => {
    const client: Client = {
      ...data,
      id: `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    storage.saveClient(client);
    refreshClients();
    return client;
  }, [refreshClients]);

  return { clients, saveClient, deleteClient, createClient, refreshClients };
}

// Stock Transfer management
export function useStockTransfers(branchId?: string) {
  const [transfers, setTransfers] = useState<StockTransfer[]>([]);

  const refreshTransfers = useCallback(() => {
    setTransfers(storage.getStockTransfers(branchId));
  }, [branchId]);

  useEffect(() => {
    refreshTransfers();
  }, [refreshTransfers]);

  const createTransfer = useCallback((
    fromBranchId: string,
    toBranchId: string,
    items: { productId: string; productName: string; sku: string; quantity: number }[],
    requestedBy: string,
    notes?: string
  ): StockTransfer => {
    const branches = storage.getBranches();
    const fromBranch = branches.find(b => b.id === fromBranchId);
    const toBranch = branches.find(b => b.id === toBranchId);

    const transfer: StockTransfer = {
      id: `transfer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      transferNumber: storage.generateTransferNumber(),
      fromBranchId,
      fromBranchName: fromBranch?.name || '',
      toBranchId,
      toBranchName: toBranch?.name || '',
      items,
      status: 'pending',
      requestedBy,
      requestedAt: new Date().toISOString(),
      notes,
    };

    storage.saveStockTransfer(transfer);
    refreshTransfers();
    return transfer;
  }, [refreshTransfers]);

  const approveTransfer = useCallback((transferId: string, userId: string) => {
    storage.processStockTransfer(transferId, 'approve', userId);
    refreshTransfers();
  }, [refreshTransfers]);

  const receiveTransfer = useCallback((transferId: string, userId: string, receivedQuantities?: Record<string, number>) => {
    const allTransfers = storage.getStockTransfers();
    const transfer = allTransfers.find(t => t.id === transferId);
    if (transfer && receivedQuantities) {
      transfer.items.forEach(item => {
        item.receivedQuantity = receivedQuantities[item.productId] ?? item.quantity;
      });
      storage.saveStockTransfer(transfer);
    }
    storage.processStockTransfer(transferId, 'receive', userId);
    refreshTransfers();
  }, [refreshTransfers]);

  const cancelTransfer = useCallback((transferId: string, userId: string) => {
    storage.processStockTransfer(transferId, 'cancel', userId);
    refreshTransfers();
  }, [refreshTransfers]);

  return { transfers, createTransfer, approveTransfer, receiveTransfer, cancelTransfer, refreshTransfers };
}

// Data Sync management
export function useDataSync() {
  const exportData = useCallback((branchId: string, dateFrom: string, dateTo: string): SyncPackage => {
    return storage.createSyncPackage(branchId, dateFrom, dateTo);
  }, []);

  const importData = useCallback((syncPackage: SyncPackage): { salesImported: number; reportsImported: number } => {
    return storage.importSyncPackage(syncPackage);
  }, []);

  const downloadSyncPackage = useCallback((syncPackage: SyncPackage) => {
    const dataStr = JSON.stringify(syncPackage, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `kwanza_sync_${syncPackage.branchCode}_${syncPackage.dateRange.from}_${syncPackage.dateRange.to}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, []);

  const sendSyncPackageByEmail = useCallback((syncPackage: SyncPackage, email: string) => {
    const dataStr = JSON.stringify(syncPackage, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const subject = encodeURIComponent(`Sincronização Kwanza ERP - ${syncPackage.branchName} - ${syncPackage.dateRange.from}`);
    const body = encodeURIComponent(`Dados de sincronização da filial ${syncPackage.branchName}\nPeríodo: ${syncPackage.dateRange.from} a ${syncPackage.dateRange.to}\n\nPor favor, anexe o ficheiro JSON baixado a este email.`);
    
    window.open(`mailto:${email}?subject=${subject}&body=${body}`);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `kwanza_sync_${syncPackage.branchCode}_${syncPackage.dateRange.from}_${syncPackage.dateRange.to}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, []);

  return { exportData, importData, downloadSyncPackage, sendSyncPackageByEmail };
}

// Supplier management
export function useSuppliers() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  const refreshSuppliers = useCallback(() => {
    setSuppliers(storage.getSuppliers());
  }, []);

  useEffect(() => {
    refreshSuppliers();
  }, [refreshSuppliers]);

  const saveSupplier = useCallback((supplier: Supplier) => {
    storage.saveSupplier(supplier);
    refreshSuppliers();
  }, [refreshSuppliers]);

  const deleteSupplier = useCallback((supplierId: string) => {
    storage.deleteSupplier(supplierId);
    refreshSuppliers();
  }, [refreshSuppliers]);

  const createSupplier = useCallback((data: Omit<Supplier, 'id' | 'createdAt' | 'updatedAt'>): Supplier => {
    const supplier: Supplier = {
      ...data,
      id: `supplier_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    storage.saveSupplier(supplier);
    refreshSuppliers();
    return supplier;
  }, [refreshSuppliers]);

  return { suppliers, saveSupplier, deleteSupplier, createSupplier, refreshSuppliers };
}

// Purchase Order management
export function usePurchaseOrders(branchId?: string) {
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);

  const refreshOrders = useCallback(() => {
    setOrders(storage.getPurchaseOrders(branchId));
  }, [branchId]);

  useEffect(() => {
    refreshOrders();
  }, [refreshOrders]);

  const createOrder = useCallback((
    supplierId: string,
    branchId: string,
    items: PurchaseOrderItem[],
    createdBy: string,
    notes?: string,
    expectedDeliveryDate?: string
  ): PurchaseOrder => {
    const suppliers = storage.getSuppliers();
    const branches = storage.getBranches();
    const supplier = suppliers.find(s => s.id === supplierId);
    const branch = branches.find(b => b.id === branchId);

    const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
    const taxAmount = items.reduce((sum, item) => sum + (item.subtotal * item.taxRate / 100), 0);

    const order: PurchaseOrder = {
      id: `po_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      orderNumber: storage.generatePurchaseOrderNumber(),
      supplierId,
      supplierName: supplier?.name || '',
      branchId,
      branchName: branch?.name || '',
      items,
      subtotal,
      taxAmount,
      total: subtotal + taxAmount,
      status: 'pending',
      notes,
      createdBy,
      createdAt: new Date().toISOString(),
      expectedDeliveryDate,
    };

    storage.savePurchaseOrder(order);
    refreshOrders();
    return order;
  }, [refreshOrders]);

  const approveOrder = useCallback((orderId: string, userId: string) => {
    const allOrders = storage.getPurchaseOrders();
    const order = allOrders.find(o => o.id === orderId);
    if (order) {
      order.status = 'approved';
      order.approvedBy = userId;
      order.approvedAt = new Date().toISOString();
      storage.savePurchaseOrder(order);
      refreshOrders();
    }
  }, [refreshOrders]);

  const receiveOrder = useCallback((orderId: string, userId: string, receivedQuantities: Record<string, number>) => {
    storage.processPurchaseOrderReceive(orderId, receivedQuantities, userId);
    refreshOrders();
  }, [refreshOrders]);

  const cancelOrder = useCallback((orderId: string) => {
    const allOrders = storage.getPurchaseOrders();
    const order = allOrders.find(o => o.id === orderId);
    if (order) {
      order.status = 'cancelled';
      storage.savePurchaseOrder(order);
      refreshOrders();
    }
  }, [refreshOrders]);

  return { orders, createOrder, approveOrder, receiveOrder, cancelOrder, refreshOrders };
}

// Category management
export function useCategories() {
  const [categories, setCategories] = useState<Category[]>([]);

  const refreshCategories = useCallback(() => {
    setCategories(storage.getCategories());
  }, []);

  useEffect(() => {
    refreshCategories();
  }, [refreshCategories]);

  const saveCategory = useCallback((category: Category) => {
    storage.saveCategory(category);
    refreshCategories();
  }, [refreshCategories]);

  const deleteCategory = useCallback((categoryId: string) => {
    storage.deleteCategory(categoryId);
    refreshCategories();
  }, [refreshCategories]);

  const createCategory = useCallback((data: Omit<Category, 'id' | 'createdAt' | 'updatedAt'>): Category => {
    const category: Category = {
      ...data,
      id: `cat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    storage.saveCategory(category);
    refreshCategories();
    return category;
  }, [refreshCategories]);

  return { categories, saveCategory, deleteCategory, createCategory, refreshCategories };
}
