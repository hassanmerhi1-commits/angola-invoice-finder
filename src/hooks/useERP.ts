/**
 * Kwanza ERP - Core Business Logic Hooks
 * 
 * All hooks use async storage functions that transparently route to:
 * - Electron SQLite (via IPC/WebSocket) when in desktop mode
 * - localStorage when in web preview / demo mode
 */

import { useState, useEffect, useCallback, useSyncExternalStore } from 'react';
import { Branch, Product, Sale, User, CartItem, SaleItem, DailySummary, Client, StockTransfer, Supplier, PurchaseOrder, PurchaseOrderItem, Category } from '@/types/erp';
import * as storage from '@/lib/storage';
import { processSalePayment } from '@/lib/accountingStorage';

// ============================================
// BRANCHES
// ============================================
export function useBranches() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [currentBranch, setCurrentBranchState] = useState<Branch | null>(null);

  const refreshBranches = useCallback(async () => {
    const data = await storage.getBranches();
    setBranches(data);
    return data;
  }, []);

  useEffect(() => {
    refreshBranches().then(data => {
      const current = storage.getCurrentBranch();
      if (current) {
        setCurrentBranchState(current);
      } else {
        const mainBranch = data.find(b => b.isMain);
        if (mainBranch) {
          storage.setCurrentBranch(mainBranch);
          setCurrentBranchState(mainBranch);
        }
      }
    });
  }, [refreshBranches]);

  const setCurrentBranch = useCallback((branch: Branch) => {
    storage.setCurrentBranch(branch);
    setCurrentBranchState(branch);
  }, []);

  return { branches, currentBranch, setCurrentBranch, refreshBranches };
}

// ============================================
// PRODUCTS
// ============================================
export function useProducts(branchId?: string) {
  const [products, setProducts] = useState<Product[]>([]);

  const refreshProducts = useCallback(async () => {
    const data = await storage.getProducts(branchId);
    setProducts(data);
  }, [branchId]);

  useEffect(() => { refreshProducts(); }, [refreshProducts]);

  useEffect(() => {
    const handleProductsChanged = (event: Event) => {
      const customEvent = event as CustomEvent<{ branchId?: string }>;
      const changedBranchId = customEvent.detail?.branchId;

      if (!branchId || !changedBranchId || changedBranchId === branchId) {
        refreshProducts();
      }
    };

    window.addEventListener(storage.PRODUCTS_CHANGED_EVENT, handleProductsChanged as EventListener);
    return () => {
      window.removeEventListener(storage.PRODUCTS_CHANGED_EVENT, handleProductsChanged as EventListener);
    };
  }, [branchId, refreshProducts]);

  const addProduct = useCallback(async (product: Product) => {
    await storage.saveProduct(product);
    await refreshProducts();
  }, [refreshProducts]);

  const updateProduct = useCallback(async (product: Product) => {
    await storage.saveProduct(product);
    await refreshProducts();
  }, [refreshProducts]);

  const deleteProduct = useCallback(async (productId: string) => {
    await storage.deleteProduct(productId);
    await refreshProducts();
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
            ? { ...item, quantity: item.quantity + quantity, subtotal: (item.quantity + quantity) * item.product.price * (1 - item.discount / 100) }
            : item
        );
      }
      return [...prev, { product, quantity, discount: 0, subtotal: quantity * product.price }];
    });
  }, []);

  const updateQuantity = useCallback((productId: string, quantity: number) => {
    if (quantity <= 0) {
      setItems(prev => prev.filter(item => item.product.id !== productId));
    } else {
      setItems(prev => prev.map(item =>
        item.product.id === productId
          ? { ...item, quantity, subtotal: quantity * item.product.price * (1 - item.discount / 100) }
          : item
      ));
    }
  }, []);

  const setItemDiscount = useCallback((productId: string, discount: number) => {
    setItems(prev => prev.map(item =>
      item.product.id === productId
        ? { ...item, discount, subtotal: item.quantity * item.product.price * (1 - discount / 100) }
        : item
    ));
  }, []);

  const removeItem = useCallback((productId: string) => {
    setItems(prev => prev.filter(item => item.product.id !== productId));
  }, []);

  const clearCart = useCallback(() => setItems([]), []);

  const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
  const taxAmount = items.reduce((sum, item) => sum + item.subtotal * (item.product.taxRate / 100), 0);
  const total = subtotal + taxAmount;

  return { items, addItem, updateQuantity, setItemDiscount, removeItem, clearCart, subtotal, taxAmount, total };
}

// ============================================
// SALES
// ============================================
export function useSales(branchId?: string) {
  const [sales, setSales] = useState<Sale[]>([]);

  const refreshSales = useCallback(async () => {
    const data = await storage.getSales(branchId);
    setSales(data);
  }, [branchId]);

  useEffect(() => { refreshSales(); }, [refreshSales]);

  const completeSale = useCallback(async (
    cartItems: CartItem[],
    branchCode: string,
    branchId: string,
    cashierId: string,
    paymentMethod: Sale['paymentMethod'],
    amountPaid: number,
    customerNif?: string,
    customerName?: string,
  ): Promise<Sale> => {
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

    const cashierName = (() => {
      try {
        const u = JSON.parse(sessionStorage.getItem('kwanzaerp_current_user') || localStorage.getItem('kwanzaerp_current_user') || '{}');
        return u?.name || '';
      } catch { return ''; }
    })();

    // Try API first (Transaction Engine — atomic stock + journal + open items)
    const { api } = await import('@/lib/api/client');
    const apiResult = await api.sales.create({
      invoiceNumber: storage.generateInvoiceNumber(branchCode),
      branchId,
      cashierId,
      cashierName,
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
    });

    let sale: Sale;

    if (apiResult.data) {
      // API succeeded — transaction engine handled stock, journals, open items
      sale = {
        id: apiResult.data.id,
        invoiceNumber: apiResult.data.invoice_number || apiResult.data.invoiceNumber,
        branchId,
        cashierId,
        cashierName,
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
        createdAt: apiResult.data.created_at || new Date().toISOString(),
      };
      console.log(`[POS] Sale ${sale.invoiceNumber} processed via Transaction Engine ✓`);
    } else {
      // Fallback to localStorage mode (demo/offline)
      console.warn('[POS] API unavailable, falling back to localStorage:', apiResult.error);
      sale = {
        id: crypto.randomUUID(),
        invoiceNumber: storage.generateInvoiceNumber(branchCode),
        branchId,
        cashierId,
        cashierName,
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
      await storage.saveSale(sale);
    }

    // Update Caixa balance for cash payments (always local for real-time feedback)
    const caixaResult = await processSalePayment(
      branchId,
      sale.id,
      sale.invoiceNumber,
      sale.total,
      sale.paymentMethod === 'mixed' ? 'cash' : sale.paymentMethod,
      cashierId,
      customerName
    );
    if (caixaResult.caixaName) {
      console.log(`[POS] Sale ${sale.invoiceNumber} → Caixa "${caixaResult.caixaName}" balance: ${caixaResult.newBalance?.toLocaleString('pt-AO')} Kz`);
    }

    await refreshSales();
    return sale;
  }, [refreshSales]);

  return { sales, completeSale, refreshSales };
}

// ============================================
// AUTH
// ============================================
const SESSION_TOKEN_KEY = 'kwanzaerp_window_session';

type AuthState = { user: User | null; isLoading: boolean };
let authState: AuthState = { user: null, isLoading: true };
let authInitialized = false;
const authListeners = new Set<() => void>();

function setAuthState(patch: Partial<AuthState>) {
  authState = { ...authState, ...patch };
  authListeners.forEach(l => l());
}

function subscribeAuth(listener: () => void) {
  authListeners.add(listener);
  return () => authListeners.delete(listener);
}

function getAuthSnapshot() { return authState; }

function initWindowSession() {
  const existingToken = sessionStorage.getItem(SESSION_TOKEN_KEY);
  if (!existingToken) {
    const token = crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    sessionStorage.setItem(SESSION_TOKEN_KEY, token);
    storage.setCurrentUser(null);
  }
}

initWindowSession();

async function initAuthStateOnce() {
  if (authInitialized) return;
  authInitialized = true;

  const currentUser = storage.getCurrentUser();
  if (currentUser && currentUser.id && currentUser.email) {
    const users = await storage.getUsers();
    const validUser = users.find(u => u.id === currentUser.id && u.isActive);
    if (validUser) {
      setAuthState({ user: currentUser, isLoading: false });
      return;
    }
    storage.setCurrentUser(null);
  }
  setAuthState({ user: null, isLoading: false });
}

export function useAuth() {
  const snapshot = useSyncExternalStore(subscribeAuth, getAuthSnapshot, getAuthSnapshot);

  useEffect(() => { initAuthStateOnce(); }, []);

  const login = useCallback(async (identifier: string, password: string): Promise<boolean> => {
    const normalized = identifier.trim();
    const maybeEmail = normalized.includes('@') ? normalized : `${normalized}@kwanzaerp.ao`;
    const normalizedLower = normalized.toLowerCase();
    const normalizedUsername = normalizedLower.includes('@')
      ? normalizedLower.split('@')[0]
      : normalizedLower;

    // In Electron mode, check DB users (supports both username-first and email-first schemas)
    if (storage.isElectronMode()) {
      let dbReachable = true;
      try {
        const tryQuery = async (sql: string, params: unknown[]) => {
          try {
            const result = await window.electronAPI!.db.query(sql, params);
            if (result?.success === false) {
              throw new Error(result.error || 'Query failed');
            }
            return Array.isArray(result?.data) ? result.data : [];
          } catch {
            dbReachable = false;
            return [];
          }
        };

        const userColumns = await tryQuery("SELECT name FROM pragma_table_info('users')", []);
        const availableColumns = new Set(
          userColumns
            .map((column: { name?: string }) => String(column.name || '').toLowerCase())
            .filter(Boolean)
        );

        const identifierClauses: string[] = [];
        const identifierParams: unknown[] = [];

        if (availableColumns.has('username')) {
          identifierClauses.push('LOWER(username) = LOWER(?)');
          identifierParams.push(normalized);
        }
        if (availableColumns.has('email')) {
          identifierClauses.push('LOWER(email) = LOWER(?)');
          identifierParams.push(maybeEmail);
        }
        if (availableColumns.has('id')) {
          identifierClauses.push('id = ?');
          identifierParams.push(normalized);
        }

        if (identifierClauses.length > 0) {
          const activeClause = availableColumns.has('is_active')
            ? '(is_active = 1 OR is_active = true OR is_active = "1" OR is_active = "true" OR is_active IS NULL)'
            : '1 = 1';

          const matchedUsers = await tryQuery(
            `SELECT * FROM users WHERE ${activeClause} AND (${identifierClauses.join(' OR ')}) LIMIT 1`,
            identifierParams
          );

          if (matchedUsers.length > 0) {
            const dbUser = matchedUsers[0];
            const username = String(dbUser.username || dbUser.email?.split('@')?.[0] || dbUser.id || normalizedUsername).toLowerCase();
            const role = ['admin', 'manager', 'cashier', 'viewer'].includes(String(dbUser.role))
              ? dbUser.role
              : 'cashier';
          const isDemoAccount = username === 'admin' || username === 'caixa1';
          const storedPassword = dbUser.password ?? dbUser.password_hash;
          const validPassword = isDemoAccount || password === '' || !storedPassword || storedPassword === password;

          if (validPassword) {
            const user: User = {
              id: dbUser.id,
              email: dbUser.email || `${dbUser.username || normalized}@kwanzaerp.ao`,
              name: dbUser.name || dbUser.username || normalized,
              username: dbUser.username || normalizedUsername,
              role,
              branchId: dbUser.branch_id || '',
              isActive: true,
              createdAt: dbUser.created_at || '',
            };
            storage.setCurrentUser(user);
            setAuthState({ user });
            return true;
          }
          }
        }
      } catch (e) {
        console.error('[Auth] DB login error:', e);
      }

      if (normalizedUsername === 'admin' || normalizedUsername === 'caixa1') {
        const branches = await storage.getBranches();
        const mainBranchId = branches.find(b => b.isMain)?.id || branches[0]?.id || 'branch-main';
        const user: User = {
          id: normalizedUsername === 'admin' ? 'user-admin' : 'user-caixa1',
          email: `${normalizedUsername}@kwanzaerp.ao`,
          name: normalizedUsername === 'admin' ? 'Administrador' : 'Caixa 1',
          username: normalizedUsername,
          role: normalizedUsername === 'admin' ? 'admin' : 'cashier',
          branchId: mainBranchId,
          isActive: true,
          createdAt: new Date().toISOString(),
        };

        storage.setCurrentUser(user);
        setAuthState({ user });
        return true;
      }

      if (!dbReachable) {
        console.error('[Auth] Database not reachable in Electron mode during login');
      }
      return false;
    }

    // Demo mode: allow login by username or email (password ignored)
    const users = await storage.getUsers();
    const foundUser = users.find(u =>
      u.isActive && (u.username === normalized || u.email === normalized || u.email === maybeEmail)
    );

    if (foundUser) {
      storage.setCurrentUser(foundUser);
      setAuthState({ user: foundUser });
      return true;
    }
    return false;
  }, []);

  const logout = useCallback(() => {
    storage.setCurrentUser(null);
    setAuthState({ user: null });
  }, []);

  return { user: snapshot.user, isLoading: snapshot.isLoading, login, logout };
}

// ============================================
// DAILY REPORTS
// ============================================
export function useDailyReports(branchId?: string) {
  const [reports, setReports] = useState<DailySummary[]>([]);

  const refreshReports = useCallback(async () => {
    const data = await storage.getDailyReports(branchId);
    setReports(data);
  }, [branchId]);

  useEffect(() => { refreshReports(); }, [refreshReports]);

  const generateReport = useCallback(async (branchId: string, date: string): Promise<DailySummary> => {
    const report = await storage.generateDailyReport(branchId, date);
    await storage.saveDailyReport(report);
    await refreshReports();
    return report;
  }, [refreshReports]);

  const closeDay = useCallback(async (reportId: string, closingBalance: number, notes: string, userId: string) => {
    const allReports = await storage.getDailyReports();
    const report = allReports.find(r => r.id === reportId);
    if (report) {
      report.status = 'closed';
      report.closingBalance = closingBalance;
      report.notes = notes;
      report.closedBy = userId;
      report.closedAt = new Date().toISOString();
      await storage.saveDailyReport(report);
      await refreshReports();
    }
  }, [refreshReports]);

  const getTodayReport = useCallback(async (branchId: string): Promise<DailySummary | null> => {
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
    const data = await storage.getClients();
    setClients(data);
  }, []);

  useEffect(() => { refreshClients(); }, [refreshClients]);

  const saveClient = useCallback(async (client: Client) => {
    await storage.saveClient(client);
    await refreshClients();
  }, [refreshClients]);

  const deleteClient = useCallback(async (clientId: string) => {
    await storage.deleteClient(clientId);
    await refreshClients();
  }, [refreshClients]);

  const createClient = useCallback(async (data: Omit<Client, 'id' | 'createdAt' | 'updatedAt'>): Promise<Client> => {
    const client: Client = {
      ...data,
      id: `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await storage.saveClient(client);
    await refreshClients();
    return client;
  }, [refreshClients]);

  return { clients, saveClient, deleteClient, createClient, refreshClients };
}

// ============================================
// STOCK TRANSFERS
// ============================================
export function useStockTransfers(branchId?: string) {
  const [transfers, setTransfers] = useState<StockTransfer[]>([]);

  const refreshTransfers = useCallback(async () => {
    const data = await storage.getStockTransfers(branchId);
    setTransfers(data);
  }, [branchId]);

  useEffect(() => { refreshTransfers(); }, [refreshTransfers]);

  const createTransfer = useCallback(async (
    fromBranchId: string, toBranchId: string,
    items: { productId: string; productName: string; sku: string; quantity: number }[],
    requestedBy: string, notes?: string
  ): Promise<StockTransfer> => {
    const branches = await storage.getBranches();
    const fromBranch = branches.find(b => b.id === fromBranchId);
    const toBranch = branches.find(b => b.id === toBranchId);

    const transfer: StockTransfer = {
      id: `transfer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      transferNumber: storage.generateTransferNumber(),
      fromBranchId, fromBranchName: fromBranch?.name || '',
      toBranchId, toBranchName: toBranch?.name || '',
      items, status: 'pending', requestedBy,
      requestedAt: new Date().toISOString(), notes,
    };

    await storage.saveStockTransfer(transfer);
    await refreshTransfers();
    return transfer;
  }, [refreshTransfers]);

  const approveTransfer = useCallback(async (transferId: string, userId: string) => {
    const allTransfers = await storage.getStockTransfers();
    const transfer = allTransfers.find(t => t.id === transferId);
    if (transfer) {
      transfer.status = 'in_transit';
      transfer.approvedBy = userId;
      transfer.approvedAt = new Date().toISOString();
      // Deduct from SOURCE branch and record stock movements
      for (const item of transfer.items) {
        await storage.updateProductStock(item.productId, -item.quantity, transfer.fromBranchId);
        await storage.saveStockMovement({
          id: `sm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          productId: item.productId,
          productName: item.productName,
          sku: item.sku,
          branchId: transfer.fromBranchId,
          type: 'OUT',
          quantity: item.quantity,
          reason: 'transfer_out',
          referenceId: transfer.id,
          referenceNumber: transfer.transferNumber,
          notes: `Transferência para ${transfer.toBranchName}`,
          createdBy: userId,
          createdAt: new Date().toISOString(),
        });
      }
      await storage.saveStockTransfer(transfer);
      await refreshTransfers();
    }
  }, [refreshTransfers]);

  const receiveTransfer = useCallback(async (transferId: string, userId: string, receivedQuantities?: Record<string, number>) => {
    const allTransfers = await storage.getStockTransfers();
    const transfer = allTransfers.find(t => t.id === transferId);
    if (transfer) {
      if (receivedQuantities) {
        transfer.items.forEach(item => {
          item.receivedQuantity = receivedQuantities[item.productId] ?? item.quantity;
        });
      }
      transfer.status = 'received';
      transfer.receivedBy = userId;
      transfer.receivedAt = new Date().toISOString();
      // Add to DESTINATION branch and record stock movements
      for (const item of transfer.items) {
        const qty = item.receivedQuantity || item.quantity;
        await storage.updateProductStock(item.productId, qty, transfer.toBranchId);
        await storage.saveStockMovement({
          id: `sm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          productId: item.productId,
          productName: item.productName,
          sku: item.sku,
          branchId: transfer.toBranchId,
          type: 'IN',
          quantity: qty,
          reason: 'transfer_in',
          referenceId: transfer.id,
          referenceNumber: transfer.transferNumber,
          notes: `Transferência de ${transfer.fromBranchName}`,
          createdBy: userId,
          createdAt: new Date().toISOString(),
        });
      }
      await storage.saveStockTransfer(transfer);
      await refreshTransfers();
    }
  }, [refreshTransfers]);

  const cancelTransfer = useCallback(async (transferId: string, _userId: string) => {
    const allTransfers = await storage.getStockTransfers();
    const transfer = allTransfers.find(t => t.id === transferId);
    if (transfer) {
      transfer.status = 'cancelled';
      await storage.saveStockTransfer(transfer);
      await refreshTransfers();
    }
  }, [refreshTransfers]);

  return { transfers, createTransfer, approveTransfer, receiveTransfer, cancelTransfer, refreshTransfers };
}

// ============================================
// SUPPLIERS
// ============================================
export function useSuppliers() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  const refreshSuppliers = useCallback(async () => {
    const data = await storage.getSuppliers();
    setSuppliers(data);
  }, []);

  useEffect(() => { refreshSuppliers(); }, [refreshSuppliers]);

  const saveSupplier = useCallback(async (supplier: Supplier) => {
    await storage.saveSupplier(supplier);
    await refreshSuppliers();
  }, [refreshSuppliers]);

  const deleteSupplier = useCallback(async (supplierId: string) => {
    await storage.deleteSupplier(supplierId);
    await refreshSuppliers();
  }, [refreshSuppliers]);

  const createSupplier = useCallback(async (data: Omit<Supplier, 'id' | 'createdAt' | 'updatedAt'>): Promise<Supplier> => {
    const supplier: Supplier = {
      ...data,
      id: `supplier_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    console.log('[Suppliers] Creating supplier:', supplier.id, supplier.name);
    await storage.saveSupplier(supplier);
    console.log('[Suppliers] Supplier saved, refreshing list...');
    await refreshSuppliers();
    return supplier;
  }, [refreshSuppliers]);

  return { suppliers, saveSupplier, deleteSupplier, createSupplier, refreshSuppliers };
}

// ============================================
// PURCHASE ORDERS
// ============================================
export function usePurchaseOrders(branchId?: string) {
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);

  const refreshOrders = useCallback(async () => {
    const data = await storage.getPurchaseOrders(branchId);
    setOrders(data);
  }, [branchId]);

  useEffect(() => { refreshOrders(); }, [refreshOrders]);

  const createOrder = useCallback(async (
    supplierId: string, branchId: string, items: PurchaseOrderItem[],
    createdBy: string, notes?: string, expectedDeliveryDate?: string,
    freightCost?: number, otherCosts?: number, otherCostsDescription?: string
  ): Promise<PurchaseOrder> => {
    const suppliers = await storage.getSuppliers();
    const branches = await storage.getBranches();
    const supplier = suppliers.find(s => s.id === supplierId);
    const branch = branches.find(b => b.id === branchId);

    const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
    const taxAmount = items.reduce((sum, item) => sum + (item.subtotal * item.taxRate / 100), 0);
    const totalWithCosts = subtotal + taxAmount + (freightCost || 0) + (otherCosts || 0);

    const order: PurchaseOrder = {
      id: `po_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      orderNumber: storage.generatePurchaseOrderNumber(),
      supplierId, supplierName: supplier?.name || '',
      branchId, branchName: branch?.name || '',
      items, subtotal, taxAmount, total: totalWithCosts,
      freightCost, otherCosts, otherCostsDescription,
      status: 'pending', notes, createdBy,
      createdAt: new Date().toISOString(), expectedDeliveryDate,
    };

    await storage.savePurchaseOrder(order);
    await refreshOrders();
    return order;
  }, [refreshOrders]);

  const approveOrder = useCallback(async (orderId: string, userId: string) => {
    const allOrders = await storage.getPurchaseOrders();
    const order = allOrders.find(o => o.id === orderId);
    if (order) {
      order.status = 'approved';
      order.approvedBy = userId;
      order.approvedAt = new Date().toISOString();
      await storage.savePurchaseOrder(order);
      await refreshOrders();
    }
  }, [refreshOrders]);

  const receiveOrder = useCallback(async (orderId: string, userId: string, receivedQuantities: Record<string, number>) => {
    await storage.processPurchaseOrderReceive(orderId, receivedQuantities, userId);
    await refreshOrders();
  }, [refreshOrders]);

  const cancelOrder = useCallback(async (orderId: string) => {
    const allOrders = await storage.getPurchaseOrders();
    const order = allOrders.find(o => o.id === orderId);
    if (order) {
      order.status = 'cancelled';
      await storage.savePurchaseOrder(order);
      await refreshOrders();
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
    const data = await storage.getCategories();
    setCategories(data);
  }, []);

  useEffect(() => { refreshCategories(); }, [refreshCategories]);

  const saveCategory = useCallback(async (category: Category) => {
    await storage.saveCategory(category);
    await refreshCategories();
  }, [refreshCategories]);

  const deleteCategory = useCallback(async (categoryId: string) => {
    await storage.deleteCategory(categoryId);
    await refreshCategories();
  }, [refreshCategories]);

  const createCategory = useCallback(async (data: Omit<Category, 'id' | 'createdAt' | 'updatedAt'>): Promise<Category> => {
    const category: Category = {
      ...data,
      id: `cat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await storage.saveCategory(category);
    await refreshCategories();
    return category;
  }, [refreshCategories]);

  return { categories, saveCategory, deleteCategory, createCategory, refreshCategories };
}

// ============================================
// DATA SYNC (Offline USB scenarios)
// ============================================
export function useDataSync() {
  const exportData = useCallback(async (branchId: string, dateFrom: string, dateTo: string) => {
    const [products, suppliers, clients, sales, stockMovements, stockTransfers, dailyReports, branches] = await Promise.all([
      storage.getProducts(branchId),
      storage.getSuppliers(),
      storage.getClients(),
      storage.getSales(branchId),
      storage.getStockMovements(branchId),
      storage.getStockTransfers(branchId),
      storage.getDailyReports(branchId),
      storage.getBranches(),
    ]);

    const branch = branches.find(b => b.id === branchId);
    const isInRange = (dateStr: string) => {
      const d = dateStr.split('T')[0];
      return d >= dateFrom && d <= dateTo;
    };

    return {
      id: `sync_${branch?.code || branchId}_${Date.now()}`,
      branchId, branchCode: branch?.code || '', branchName: branch?.name || '',
      exportDate: new Date().toISOString(),
      dateRange: { from: dateFrom, to: dateTo },
      products,
      suppliers,
      clients,
      purchases: [] as PurchaseOrder[],
      sales: sales.filter(s => isInRange(s.createdAt)),
      stockMovements: stockMovements.filter(m => isInRange(m.createdAt)),
      stockTransfers: stockTransfers.filter(t => isInRange(t.requestedAt)),
      dailyReports: dailyReports.filter(r => r.date >= dateFrom && r.date <= dateTo),
      version: '2.0.0',
      totalRecords: 0,
    };
  }, []);

  const downloadSyncPackage = useCallback((syncPackage: any) => {
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

  return { exportData, downloadSyncPackage };
}
