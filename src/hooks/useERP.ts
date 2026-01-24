// ERP Hooks - Core business logic
// Supports both: Local Network (API + WebSocket) and Demo Mode (localStorage)

import { useState, useEffect, useCallback } from 'react';
import { Branch, Product, Sale, User, CartItem, SaleItem, DailySummary, Client, StockTransfer, SyncPackage, Supplier, PurchaseOrder, PurchaseOrderItem, Category } from '@/types/erp';
import { api, setAuthToken } from '@/lib/api/client';
import { isLocalNetworkMode } from '@/lib/api/config';
import { onTableSync } from '@/lib/realtime/socket';
import * as storage from '@/lib/storage';

// ============================================
// BRANCHES
// ============================================
export function useBranches() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [currentBranch, setCurrentBranchState] = useState<Branch | null>(null);

  useEffect(() => {
    if (isLocalNetworkMode()) {
      // Real-time mode: subscribe to WebSocket updates
      const unsubscribe = onTableSync('branches', (data) => {
        const mapped = data.map(mapBranchFromDb);
        setBranches(mapped);
      });
      
      // Also fetch initial data
      api.branches.list().then(res => {
        if (res.data) setBranches(res.data.map(mapBranchFromDb));
      });
      
      return unsubscribe;
    } else {
      // Demo mode: use localStorage
      setBranches(storage.getBranches());
    }
    
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

// ============================================
// PRODUCTS
// ============================================
export function useProducts(branchId?: string) {
  const [products, setProducts] = useState<Product[]>([]);

  const refreshProducts = useCallback(async () => {
    if (isLocalNetworkMode()) {
      const res = await api.products.list(branchId);
      if (res.data) setProducts(res.data.map(mapProductFromDb));
    } else {
      setProducts(storage.getProducts(branchId));
    }
  }, [branchId]);

  useEffect(() => {
    if (isLocalNetworkMode()) {
      // Subscribe to real-time updates
      const unsubscribe = onTableSync('products', (data) => {
        let mapped = data.map(mapProductFromDb);
        if (branchId) {
          mapped = mapped.filter(p => p.branchId === branchId || p.branchId === 'all');
        }
        setProducts(mapped);
      });
      
      // Initial fetch
      refreshProducts();
      
      return unsubscribe;
    } else {
      refreshProducts();
    }
  }, [refreshProducts, branchId]);

  const addProduct = useCallback(async (product: Product) => {
    if (isLocalNetworkMode()) {
      await api.products.create(mapProductToDb(product));
      // Real-time will update the list
    } else {
      storage.saveProduct(product);
      refreshProducts();
    }
  }, [refreshProducts]);

  const updateProduct = useCallback(async (product: Product) => {
    if (isLocalNetworkMode()) {
      await api.products.update(product.id, mapProductToDb(product));
    } else {
      storage.saveProduct(product);
      refreshProducts();
    }
  }, [refreshProducts]);

  const deleteProduct = useCallback(async (productId: string) => {
    if (isLocalNetworkMode()) {
      await api.products.delete(productId);
    } else {
      const allProducts = storage.getAllProducts();
      const filtered = allProducts.filter(p => p.id !== productId);
      localStorage.setItem('kwanza_products', JSON.stringify(filtered));
      refreshProducts();
    }
  }, [refreshProducts]);

  return { products, refreshProducts, addProduct, updateProduct, deleteProduct };
}

// ============================================
// CART (Always local - per session)
// ============================================
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

// ============================================
// SALES
// ============================================
export function useSales(branchId?: string) {
  const [sales, setSales] = useState<Sale[]>([]);

  const refreshSales = useCallback(async () => {
    if (isLocalNetworkMode()) {
      const res = await api.sales.list(branchId);
      if (res.data) setSales(res.data.map(mapSaleFromDb));
    } else {
      setSales(storage.getSales(branchId));
    }
  }, [branchId]);

  useEffect(() => {
    if (isLocalNetworkMode()) {
      const unsubscribe = onTableSync('sales', (data) => {
        let mapped = data.map(mapSaleFromDb);
        if (branchId) {
          mapped = mapped.filter(s => s.branchId === branchId);
        }
        setSales(mapped);
      });
      
      refreshSales();
      return unsubscribe;
    } else {
      refreshSales();
    }
  }, [refreshSales, branchId]);

  const completeSale = useCallback(async (
    cartItems: CartItem[],
    branchCode: string,
    branchId: string,
    cashierId: string,
    paymentMethod: Sale['paymentMethod'],
    amountPaid: number,
    customerNif?: string,
    customerName?: string,
  ): Promise<Sale & { caixaInfo?: { caixaName: string; newBalance: number; message: string } }> => {
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

    if (isLocalNetworkMode()) {
      // Get invoice number from server
      const invoiceRes = await api.sales.generateInvoiceNumber(branchCode);
      const invoiceNumber = invoiceRes.data?.invoiceNumber || storage.generateInvoiceNumber(branchCode);
      
      const saleData = {
        invoiceNumber,
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
      };
      
      const res = await api.sales.create(saleData);
      if (res.data) {
        return mapSaleFromDb(res.data);
      }
      throw new Error(res.error || 'Failed to create sale');
    } else {
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
      
      // THE BLOOD FLOWS! Process payment through Caixa system
      // Only cash and mixed payments affect Caixa
      let caixaInfo: { caixaName: string; newBalance: number; message: string } | undefined;
      
      if (paymentMethod === 'cash' || paymentMethod === 'mixed') {
        const { processSalePayment } = await import('@/lib/accountingStorage');
        const caixaResult = processSalePayment(
          branchId,
          sale.id,
          sale.invoiceNumber,
          paymentMethod === 'cash' ? total : amountPaid, // For mixed, use cash portion
          'cash', // Treat as cash for Caixa purposes
          cashierId,
          customerName
        );
        
        if (caixaResult.caixaName && caixaResult.newBalance !== undefined) {
          caixaInfo = {
            caixaName: caixaResult.caixaName,
            newBalance: caixaResult.newBalance,
            message: caixaResult.message
          };
        } else if (caixaResult.message) {
          console.warn('[SALE]', caixaResult.message);
        }
      }
      
      refreshSales();
      return { ...sale, caixaInfo };
    }
  }, [refreshSales]);

  return { sales, completeSale, refreshSales };
}

// ============================================
// AUTH
// ============================================
// Unique session token set once per Electron window.
// If not present the session is treated as "fresh" (not yet logged in).
const SESSION_TOKEN_KEY = 'kwanzaerp_window_session';

// Generate a new token once per main.tsx mount and store it
function initWindowSession() {
  // If running in Electron a token is injected per window; otherwise use sessionStorage
  const existingToken = sessionStorage.getItem(SESSION_TOKEN_KEY);
  if (!existingToken) {
    const token = crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    sessionStorage.setItem(SESSION_TOKEN_KEY, token);
    // Clear any leftover login so the new window starts with login screen
    storage.setCurrentUser(null);
  }
}

initWindowSession();

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Each window starts without a logged-in user because initWindowSession()
    // already cleared the session above. However we still read current user
    // in case it was restored during this same session (i.e. after a login).
    const currentUser = storage.getCurrentUser();

    if (currentUser && currentUser.id && currentUser.email) {
      // Verify user still exists in users list
      const users = storage.getUsers();
      const validUser = users.find(u => u.id === currentUser.id && u.isActive);

      if (validUser) {
        setUser(currentUser);
      } else {
        storage.setCurrentUser(null);
        setUser(null);
      }
    } else {
      setUser(null);
    }

    setIsLoading(false);
  }, []);

  const login = useCallback(async (identifier: string, password: string): Promise<boolean> => {
    const normalized = identifier.trim();
    const maybeEmail = normalized.includes('@') ? normalized : `${normalized}@kwanzaerp.ao`;

    if (isLocalNetworkMode()) {
      // Network mode expects an email. We allow typing a username and
      // automatically expand it to our default domain.
      const res = await api.auth.login(maybeEmail, password);
      if (res.data) {
        setAuthToken(res.data.token);
        const user = mapUserFromDb(res.data.user);
        storage.setCurrentUser(user);
        setUser(user);
        return true;
      }
      return false;
    } else {
      // Demo mode: allow login by username or email (password is ignored).
      const users = storage.getUsers();
      const foundUser = users.find(
        (u) =>
          u.isActive &&
          (u.username === normalized || u.email === normalized || u.email === maybeEmail)
      );

      if (foundUser) {
        storage.setCurrentUser(foundUser);
        setUser(foundUser);
        return true;
      }
      return false;
    }
  }, []);

  const logout = useCallback(() => {
    setAuthToken(null);
    storage.setCurrentUser(null);
    setUser(null);
  }, []);

  return { user, isLoading, login, logout };
}

// ============================================
// DAILY REPORTS
// ============================================
export function useDailyReports(branchId?: string) {
  const [reports, setReports] = useState<DailySummary[]>([]);

  const refreshReports = useCallback(async () => {
    if (isLocalNetworkMode()) {
      const res = await api.dailyReports.list(branchId);
      if (res.data) setReports(res.data.map(mapDailyReportFromDb));
    } else {
      setReports(storage.getDailyReports(branchId));
    }
  }, [branchId]);

  useEffect(() => {
    if (isLocalNetworkMode()) {
      const unsubscribe = onTableSync('daily_reports', (data) => {
        let mapped = data.map(mapDailyReportFromDb);
        if (branchId) {
          mapped = mapped.filter(r => r.branchId === branchId);
        }
        setReports(mapped);
      });
      
      refreshReports();
      return unsubscribe;
    } else {
      refreshReports();
    }
  }, [refreshReports, branchId]);

  const generateReport = useCallback(async (branchId: string, date: string): Promise<DailySummary> => {
    if (isLocalNetworkMode()) {
      const res = await api.dailyReports.generate(branchId, date);
      if (res.data) return mapDailyReportFromDb(res.data);
      throw new Error(res.error || 'Failed to generate report');
    } else {
      const report = storage.generateDailyReport(branchId, date);
      storage.saveDailyReport(report);
      refreshReports();
      return report;
    }
  }, [refreshReports]);

  const closeDay = useCallback(async (reportId: string, closingBalance: number, notes: string, userId: string) => {
    if (isLocalNetworkMode()) {
      await api.dailyReports.close(reportId, { closingBalance, notes, closedBy: userId });
    } else {
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
    }
  }, [refreshReports]);

  const getTodayReport = useCallback((branchId: string): DailySummary | null => {
    return storage.getTodayReport(branchId);
  }, []);

  return { reports, generateReport, closeDay, getTodayReport, refreshReports };
}

// ============================================
// CLIENTS
// ============================================
export function useClients() {
  const [clients, setClients] = useState<Client[]>([]);

  const refreshClients = useCallback(async () => {
    if (isLocalNetworkMode()) {
      const res = await api.clients.list();
      if (res.data) setClients(res.data.map(mapClientFromDb));
    } else {
      setClients(storage.getClients());
    }
  }, []);

  useEffect(() => {
    if (isLocalNetworkMode()) {
      const unsubscribe = onTableSync('clients', (data) => {
        setClients(data.map(mapClientFromDb));
      });
      refreshClients();
      return unsubscribe;
    } else {
      refreshClients();
    }
  }, [refreshClients]);

  const saveClient = useCallback(async (client: Client) => {
    if (isLocalNetworkMode()) {
      if (client.id.startsWith('client_')) {
        await api.clients.create(mapClientToDb(client));
      } else {
        await api.clients.update(client.id, mapClientToDb(client));
      }
    } else {
      storage.saveClient(client);
      refreshClients();
    }
  }, [refreshClients]);

  const deleteClient = useCallback(async (clientId: string) => {
    if (isLocalNetworkMode()) {
      await api.clients.delete(clientId);
    } else {
      storage.deleteClient(clientId);
      refreshClients();
    }
  }, [refreshClients]);

  const createClient = useCallback(async (data: Omit<Client, 'id' | 'createdAt' | 'updatedAt'>): Promise<Client> => {
    if (isLocalNetworkMode()) {
      const res = await api.clients.create(mapClientToDb(data as Client));
      if (res.data) return mapClientFromDb(res.data);
      throw new Error(res.error || 'Failed to create client');
    } else {
      const client: Client = {
        ...data,
        id: `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      storage.saveClient(client);
      refreshClients();
      return client;
    }
  }, [refreshClients]);

  return { clients, saveClient, deleteClient, createClient, refreshClients };
}

// ============================================
// STOCK TRANSFERS
// ============================================
export function useStockTransfers(branchId?: string) {
  const [transfers, setTransfers] = useState<StockTransfer[]>([]);

  const refreshTransfers = useCallback(async () => {
    if (isLocalNetworkMode()) {
      const res = await api.stockTransfers.list(branchId);
      if (res.data) setTransfers(res.data.map(mapStockTransferFromDb));
    } else {
      setTransfers(storage.getStockTransfers(branchId));
    }
  }, [branchId]);

  useEffect(() => {
    if (isLocalNetworkMode()) {
      const unsubscribe = onTableSync('stock_transfers', (data) => {
        let mapped = data.map(mapStockTransferFromDb);
        if (branchId) {
          mapped = mapped.filter(t => t.fromBranchId === branchId || t.toBranchId === branchId);
        }
        setTransfers(mapped);
      });
      refreshTransfers();
      return unsubscribe;
    } else {
      refreshTransfers();
    }
  }, [refreshTransfers, branchId]);

  const createTransfer = useCallback(async (
    fromBranchId: string,
    toBranchId: string,
    items: { productId: string; productName: string; sku: string; quantity: number }[],
    requestedBy: string,
    notes?: string
  ): Promise<StockTransfer> => {
    if (isLocalNetworkMode()) {
      const res = await api.stockTransfers.create({ fromBranchId, toBranchId, items, requestedBy, notes });
      if (res.data) return mapStockTransferFromDb(res.data);
      throw new Error(res.error || 'Failed to create transfer');
    } else {
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
    }
  }, [refreshTransfers]);

  const approveTransfer = useCallback(async (transferId: string, userId: string) => {
    if (isLocalNetworkMode()) {
      await api.stockTransfers.approve(transferId, userId);
    } else {
      storage.processStockTransfer(transferId, 'approve', userId);
      refreshTransfers();
    }
  }, [refreshTransfers]);

  const receiveTransfer = useCallback(async (transferId: string, userId: string, receivedQuantities?: Record<string, number>) => {
    if (isLocalNetworkMode()) {
      await api.stockTransfers.receive(transferId, userId, receivedQuantities);
    } else {
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
    }
  }, [refreshTransfers]);

  const cancelTransfer = useCallback(async (transferId: string, userId: string) => {
    if (isLocalNetworkMode()) {
      // API doesn't have cancel endpoint yet, fall back to local
      storage.processStockTransfer(transferId, 'cancel', userId);
      refreshTransfers();
    } else {
      storage.processStockTransfer(transferId, 'cancel', userId);
      refreshTransfers();
    }
  }, [refreshTransfers]);

  return { transfers, createTransfer, approveTransfer, receiveTransfer, cancelTransfer, refreshTransfers };
}

// ============================================
// DATA SYNC (Keep for offline scenarios)
// ============================================
export function useDataSync() {
  const exportData = useCallback((branchId: string, dateFrom: string, dateTo: string): SyncPackage => {
    return storage.createSyncPackage(branchId, dateFrom, dateTo);
  }, []);

  const importData = useCallback((syncPackage: SyncPackage): storage.ImportResult => {
    return storage.importSyncPackage(syncPackage);
  }, []);

  // NEW: Export price updates from main office to filials (no stock info)
  const exportPriceUpdates = useCallback((): storage.PriceUpdatePackage => {
    return storage.createPriceUpdatePackage();
  }, []);

  // NEW: Import price updates at filial (preserves local stock)
  const importPriceUpdates = useCallback((pkg: storage.PriceUpdatePackage): storage.PriceUpdateResult => {
    return storage.importPriceUpdatePackage(pkg);
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

  // NEW: Download price update package
  const downloadPriceUpdatePackage = useCallback((pkg: storage.PriceUpdatePackage) => {
    const dataStr = JSON.stringify(pkg, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `kwanza_price_update_${new Date().toISOString().split('T')[0]}.json`;
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

  return { 
    exportData, 
    importData, 
    exportPriceUpdates,
    importPriceUpdates,
    downloadSyncPackage, 
    downloadPriceUpdatePackage,
    sendSyncPackageByEmail 
  };
}

// ============================================
// SUPPLIERS
// ============================================
export function useSuppliers() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  const refreshSuppliers = useCallback(async () => {
    if (isLocalNetworkMode()) {
      const res = await api.suppliers.list();
      if (res.data) setSuppliers(res.data.map(mapSupplierFromDb));
    } else {
      setSuppliers(storage.getSuppliers());
    }
  }, []);

  useEffect(() => {
    if (isLocalNetworkMode()) {
      const unsubscribe = onTableSync('suppliers', (data) => {
        setSuppliers(data.map(mapSupplierFromDb));
      });
      refreshSuppliers();
      return unsubscribe;
    } else {
      refreshSuppliers();
    }
  }, [refreshSuppliers]);

  const saveSupplier = useCallback(async (supplier: Supplier) => {
    if (isLocalNetworkMode()) {
      if (supplier.id.startsWith('supplier_')) {
        await api.suppliers.create(mapSupplierToDb(supplier));
      } else {
        await api.suppliers.update(supplier.id, mapSupplierToDb(supplier));
      }
    } else {
      storage.saveSupplier(supplier);
      refreshSuppliers();
    }
  }, [refreshSuppliers]);

  const deleteSupplier = useCallback(async (supplierId: string) => {
    if (isLocalNetworkMode()) {
      await api.suppliers.delete(supplierId);
    } else {
      storage.deleteSupplier(supplierId);
      refreshSuppliers();
    }
  }, [refreshSuppliers]);

  const createSupplier = useCallback(async (data: Omit<Supplier, 'id' | 'createdAt' | 'updatedAt'>): Promise<Supplier> => {
    if (isLocalNetworkMode()) {
      const res = await api.suppliers.create(mapSupplierToDb(data as Supplier));
      if (res.data) return mapSupplierFromDb(res.data);
      throw new Error(res.error || 'Failed to create supplier');
    } else {
      const supplier: Supplier = {
        ...data,
        id: `supplier_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      storage.saveSupplier(supplier);
      refreshSuppliers();
      return supplier;
    }
  }, [refreshSuppliers]);

  return { suppliers, saveSupplier, deleteSupplier, createSupplier, refreshSuppliers };
}

// ============================================
// PURCHASE ORDERS
// ============================================
export function usePurchaseOrders(branchId?: string) {
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);

  const refreshOrders = useCallback(async () => {
    if (isLocalNetworkMode()) {
      const res = await api.purchaseOrders.list(branchId);
      if (res.data) setOrders(res.data.map(mapPurchaseOrderFromDb));
    } else {
      setOrders(storage.getPurchaseOrders(branchId));
    }
  }, [branchId]);

  useEffect(() => {
    if (isLocalNetworkMode()) {
      const unsubscribe = onTableSync('purchase_orders', (data) => {
        let mapped = data.map(mapPurchaseOrderFromDb);
        if (branchId) {
          mapped = mapped.filter(o => o.branchId === branchId);
        }
        setOrders(mapped);
      });
      refreshOrders();
      return unsubscribe;
    } else {
      refreshOrders();
    }
  }, [refreshOrders, branchId]);

  const createOrder = useCallback(async (
    supplierId: string,
    branchId: string,
    items: PurchaseOrderItem[],
    createdBy: string,
    notes?: string,
    expectedDeliveryDate?: string,
    freightCost?: number,
    otherCosts?: number,
    otherCostsDescription?: string
  ): Promise<PurchaseOrder> => {
    if (isLocalNetworkMode()) {
      const res = await api.purchaseOrders.create({
        supplierId, branchId, items, createdBy, notes, expectedDeliveryDate,
        freightCost, otherCosts, otherCostsDescription
      });
      if (res.data) return mapPurchaseOrderFromDb(res.data);
      throw new Error(res.error || 'Failed to create order');
    } else {
      const suppliers = storage.getSuppliers();
      const branches = storage.getBranches();
      const supplier = suppliers.find(s => s.id === supplierId);
      const branch = branches.find(b => b.id === branchId);

      const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
      const taxAmount = items.reduce((sum, item) => sum + (item.subtotal * item.taxRate / 100), 0);
      const totalWithCosts = subtotal + taxAmount + (freightCost || 0) + (otherCosts || 0);

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
        total: totalWithCosts,
        freightCost,
        otherCosts,
        otherCostsDescription,
        status: 'pending',
        notes,
        createdBy,
        createdAt: new Date().toISOString(),
        expectedDeliveryDate,
      };

      storage.savePurchaseOrder(order);
      refreshOrders();
      return order;
    }
  }, [refreshOrders]);

  const approveOrder = useCallback(async (orderId: string, userId: string) => {
    if (isLocalNetworkMode()) {
      await api.purchaseOrders.approve(orderId, userId);
    } else {
      const allOrders = storage.getPurchaseOrders();
      const order = allOrders.find(o => o.id === orderId);
      if (order) {
        order.status = 'approved';
        order.approvedBy = userId;
        order.approvedAt = new Date().toISOString();
        storage.savePurchaseOrder(order);
        refreshOrders();
      }
    }
  }, [refreshOrders]);

  const receiveOrder = useCallback(async (orderId: string, userId: string, receivedQuantities: Record<string, number>) => {
    if (isLocalNetworkMode()) {
      await api.purchaseOrders.receive(orderId, userId, receivedQuantities);
    } else {
      storage.processPurchaseOrderReceive(orderId, receivedQuantities, userId);
      refreshOrders();
    }
  }, [refreshOrders]);

  const cancelOrder = useCallback(async (orderId: string) => {
    if (isLocalNetworkMode()) {
      // No API endpoint for cancel, handle locally
      const allOrders = storage.getPurchaseOrders();
      const order = allOrders.find(o => o.id === orderId);
      if (order) {
        order.status = 'cancelled';
        storage.savePurchaseOrder(order);
        refreshOrders();
      }
    } else {
      const allOrders = storage.getPurchaseOrders();
      const order = allOrders.find(o => o.id === orderId);
      if (order) {
        order.status = 'cancelled';
        storage.savePurchaseOrder(order);
        refreshOrders();
      }
    }
  }, [refreshOrders]);

  return { orders, createOrder, approveOrder, receiveOrder, cancelOrder, refreshOrders };
}

// ============================================
// CATEGORIES
// ============================================
export function useCategories() {
  const [categories, setCategories] = useState<Category[]>([]);

  const refreshCategories = useCallback(async () => {
    if (isLocalNetworkMode()) {
      const res = await api.categories.list();
      if (res.data) setCategories(res.data.map(mapCategoryFromDb));
    } else {
      setCategories(storage.getCategories());
    }
  }, []);

  useEffect(() => {
    if (isLocalNetworkMode()) {
      const unsubscribe = onTableSync('categories', (data) => {
        setCategories(data.map(mapCategoryFromDb));
      });
      refreshCategories();
      return unsubscribe;
    } else {
      refreshCategories();
    }
  }, [refreshCategories]);

  const saveCategory = useCallback(async (category: Category) => {
    if (isLocalNetworkMode()) {
      if (category.id.startsWith('cat_')) {
        await api.categories.create(mapCategoryToDb(category));
      } else {
        await api.categories.update(category.id, mapCategoryToDb(category));
      }
    } else {
      storage.saveCategory(category);
      refreshCategories();
    }
  }, [refreshCategories]);

  const deleteCategory = useCallback(async (categoryId: string) => {
    if (isLocalNetworkMode()) {
      await api.categories.delete(categoryId);
    } else {
      storage.deleteCategory(categoryId);
      refreshCategories();
    }
  }, [refreshCategories]);

  const createCategory = useCallback(async (data: Omit<Category, 'id' | 'createdAt' | 'updatedAt'>): Promise<Category> => {
    if (isLocalNetworkMode()) {
      const res = await api.categories.create(mapCategoryToDb(data as Category));
      if (res.data) return mapCategoryFromDb(res.data);
      throw new Error(res.error || 'Failed to create category');
    } else {
      const category: Category = {
        ...data,
        id: `cat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      storage.saveCategory(category);
      refreshCategories();
      return category;
    }
  }, [refreshCategories]);

  return { categories, saveCategory, deleteCategory, createCategory, refreshCategories };
}

// ============================================
// DB MAPPING FUNCTIONS (snake_case <-> camelCase)
// ============================================

function mapBranchFromDb(row: any): Branch {
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    address: row.address,
    phone: row.phone,
    isMain: row.is_main ?? row.isMain,
    createdAt: row.created_at ?? row.createdAt,
  };
}

function mapProductFromDb(row: any): Product {
  const cost = Number(row.cost);
  return {
    id: row.id,
    name: row.name,
    sku: row.sku,
    barcode: row.barcode,
    category: row.category,
    price: Number(row.price),
    cost: cost,
    firstCost: Number(row.first_cost ?? row.firstCost ?? cost),
    lastCost: Number(row.last_cost ?? row.lastCost ?? cost),
    avgCost: Number(row.avg_cost ?? row.avgCost ?? cost),
    stock: Number(row.stock),
    unit: row.unit,
    taxRate: Number(row.tax_rate ?? row.taxRate ?? 14),
    branchId: row.branch_id ?? row.branchId,
    supplierId: row.supplier_id ?? row.supplierId,
    supplierName: row.supplier_name ?? row.supplierName,
    isActive: row.is_active ?? row.isActive ?? true,
    createdAt: row.created_at ?? row.createdAt,
    updatedAt: row.updated_at ?? row.updatedAt,
  };
}

function mapProductToDb(product: Product): any {
  return {
    name: product.name,
    sku: product.sku,
    barcode: product.barcode,
    category: product.category,
    price: product.price,
    cost: product.cost,
    stock: product.stock,
    unit: product.unit,
    taxRate: product.taxRate,
    branchId: product.branchId,
    isActive: product.isActive,
  };
}

function mapSaleFromDb(row: any): Sale {
  return {
    id: row.id,
    invoiceNumber: row.invoice_number ?? row.invoiceNumber,
    branchId: row.branch_id ?? row.branchId,
    cashierId: row.cashier_id ?? row.cashierId,
    cashierName: row.cashier_name ?? row.cashierName,
    items: row.items || [],
    subtotal: Number(row.subtotal),
    taxAmount: Number(row.tax_amount ?? row.taxAmount),
    discount: Number(row.discount ?? 0),
    total: Number(row.total),
    paymentMethod: row.payment_method ?? row.paymentMethod,
    amountPaid: Number(row.amount_paid ?? row.amountPaid),
    change: Number(row.change ?? 0),
    customerNif: row.customer_nif ?? row.customerNif,
    customerName: row.customer_name ?? row.customerName,
    status: row.status,
    saftHash: row.saft_hash ?? row.saftHash,
    agtStatus: row.agt_status ?? row.agtStatus,
    agtCode: row.agt_code ?? row.agtCode,
    agtValidatedAt: row.agt_validated_at ?? row.agtValidatedAt,
    createdAt: row.created_at ?? row.createdAt,
    syncedAt: row.synced_at ?? row.syncedAt,
    syncedToMain: row.synced_to_main ?? row.syncedToMain,
  };
}

function mapUserFromDb(row: any): User {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    branchId: row.branch_id ?? row.branchId,
    isActive: row.is_active ?? row.isActive ?? true,
    createdAt: row.created_at ?? row.createdAt,
  };
}

function mapDailyReportFromDb(row: any): DailySummary {
  return {
    id: row.id,
    date: row.date,
    branchId: row.branch_id ?? row.branchId,
    branchName: row.branch_name ?? row.branchName,
    totalSales: Number(row.total_sales ?? row.totalSales ?? 0),
    totalTransactions: Number(row.total_transactions ?? row.totalTransactions ?? 0),
    cashTotal: Number(row.cash_total ?? row.cashTotal ?? 0),
    cardTotal: Number(row.card_total ?? row.cardTotal ?? 0),
    transferTotal: Number(row.transfer_total ?? row.transferTotal ?? 0),
    taxCollected: Number(row.tax_collected ?? row.taxCollected ?? 0),
    openingBalance: Number(row.opening_balance ?? row.openingBalance ?? 0),
    closingBalance: Number(row.closing_balance ?? row.closingBalance ?? 0),
    status: row.status ?? 'open',
    closedBy: row.closed_by ?? row.closedBy,
    closedAt: row.closed_at ?? row.closedAt,
    notes: row.notes,
    createdAt: row.created_at ?? row.createdAt,
  };
}

function mapClientFromDb(row: any): Client {
  return {
    id: row.id,
    name: row.name,
    nif: row.nif,
    email: row.email,
    phone: row.phone,
    address: row.address,
    city: row.city,
    country: row.country ?? 'Angola',
    creditLimit: Number(row.credit_limit ?? row.creditLimit ?? 0),
    currentBalance: Number(row.current_balance ?? row.currentBalance ?? 0),
    isActive: row.is_active ?? row.isActive ?? true,
    createdAt: row.created_at ?? row.createdAt,
    updatedAt: row.updated_at ?? row.updatedAt,
  };
}

function mapClientToDb(client: Client): any {
  return {
    name: client.name,
    nif: client.nif,
    email: client.email,
    phone: client.phone,
    address: client.address,
    city: client.city,
    country: client.country,
    creditLimit: client.creditLimit,
    currentBalance: client.currentBalance,
    isActive: client.isActive,
  };
}

function mapSupplierFromDb(row: any): Supplier {
  return {
    id: row.id,
    name: row.name,
    nif: row.nif,
    email: row.email,
    phone: row.phone,
    address: row.address,
    city: row.city,
    country: row.country ?? 'Angola',
    contactPerson: row.contact_person ?? row.contactPerson,
    paymentTerms: row.payment_terms ?? row.paymentTerms ?? '30_days',
    isActive: row.is_active ?? row.isActive ?? true,
    notes: row.notes,
    createdAt: row.created_at ?? row.createdAt,
    updatedAt: row.updated_at ?? row.updatedAt,
  };
}

function mapSupplierToDb(supplier: Supplier): any {
  return {
    name: supplier.name,
    nif: supplier.nif,
    email: supplier.email,
    phone: supplier.phone,
    address: supplier.address,
    city: supplier.city,
    country: supplier.country,
    contactPerson: supplier.contactPerson,
    paymentTerms: supplier.paymentTerms,
    isActive: supplier.isActive,
    notes: supplier.notes,
  };
}

function mapStockTransferFromDb(row: any): StockTransfer {
  return {
    id: row.id,
    transferNumber: row.transfer_number ?? row.transferNumber,
    fromBranchId: row.from_branch_id ?? row.fromBranchId,
    fromBranchName: row.from_branch_name ?? row.fromBranchName,
    toBranchId: row.to_branch_id ?? row.toBranchId,
    toBranchName: row.to_branch_name ?? row.toBranchName,
    items: row.items || [],
    status: row.status,
    requestedBy: row.requested_by ?? row.requestedBy,
    requestedAt: row.requested_at ?? row.requestedAt,
    approvedBy: row.approved_by ?? row.approvedBy,
    approvedAt: row.approved_at ?? row.approvedAt,
    receivedBy: row.received_by ?? row.receivedBy,
    receivedAt: row.received_at ?? row.receivedAt,
    notes: row.notes,
  };
}

function mapPurchaseOrderFromDb(row: any): PurchaseOrder {
  return {
    id: row.id,
    orderNumber: row.order_number ?? row.orderNumber,
    supplierId: row.supplier_id ?? row.supplierId,
    supplierName: row.supplier_name ?? row.supplierName,
    branchId: row.branch_id ?? row.branchId,
    branchName: row.branch_name ?? row.branchName,
    items: row.items || [],
    subtotal: Number(row.subtotal ?? 0),
    taxAmount: Number(row.tax_amount ?? row.taxAmount ?? 0),
    total: Number(row.total ?? 0),
    status: row.status ?? 'draft',
    notes: row.notes,
    createdBy: row.created_by ?? row.createdBy,
    createdAt: row.created_at ?? row.createdAt,
    approvedBy: row.approved_by ?? row.approvedBy,
    approvedAt: row.approved_at ?? row.approvedAt,
    receivedBy: row.received_by ?? row.receivedBy,
    receivedAt: row.received_at ?? row.receivedAt,
    expectedDeliveryDate: row.expected_delivery_date ?? row.expectedDeliveryDate,
  };
}

function mapCategoryFromDb(row: any): Category {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    color: row.color,
    isActive: row.is_active ?? row.isActive ?? true,
    createdAt: row.created_at ?? row.createdAt,
    updatedAt: row.updated_at ?? row.updatedAt,
  };
}

function mapCategoryToDb(category: Category): any {
  return {
    name: category.name,
    description: category.description,
    color: category.color,
    isActive: category.isActive,
  };
}
