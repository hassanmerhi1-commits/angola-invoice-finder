// Local storage layer for Kwanza ERP
import { Branch, Product, Sale, User, DailySummary, Client, StockTransfer, SyncPackage, Supplier, PurchaseOrder, Category } from '@/types/erp';

const STORAGE_KEYS = {
  branches: 'kwanzaerp_branches',
  products: 'kwanzaerp_products',
  sales: 'kwanzaerp_sales',
  users: 'kwanzaerp_users',
  currentBranch: 'kwanzaerp_current_branch',
  currentUser: 'kwanzaerp_current_user',
  dailyReports: 'kwanzaerp_daily_reports',
  clients: 'kwanzaerp_clients',
  stockTransfers: 'kwanzaerp_stock_transfers',
  suppliers: 'kwanzaerp_suppliers',
  purchaseOrders: 'kwanzaerp_purchase_orders',
  categories: 'kwanzaerp_categories',
};

// Generic storage functions
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

// Branch functions
export function getBranches(): Branch[] {
  return getItem<Branch[]>(STORAGE_KEYS.branches, getDefaultBranches());
}

export function saveBranch(branch: Branch): void {
  const branches = getBranches();
  const index = branches.findIndex(b => b.id === branch.id);
  if (index >= 0) {
    branches[index] = branch;
  } else {
    branches.push(branch);
  }
  setItem(STORAGE_KEYS.branches, branches);
}

export function getCurrentBranch(): Branch | null {
  return getItem<Branch | null>(STORAGE_KEYS.currentBranch, null);
}

export function setCurrentBranch(branch: Branch): void {
  setItem(STORAGE_KEYS.currentBranch, branch);
}

// Product functions
export function getProducts(branchId?: string): Product[] {
  const products = getItem<Product[]>(STORAGE_KEYS.products, getDefaultProducts());
  if (branchId) {
    return products.filter(p => p.branchId === branchId || p.branchId === 'all');
  }
  return products;
}

export function getAllProducts(): Product[] {
  return getItem<Product[]>(STORAGE_KEYS.products, getDefaultProducts());
}

export function saveProduct(product: Product): void {
  const products = getAllProducts();
  const index = products.findIndex(p => p.id === product.id);
  if (index >= 0) {
    products[index] = product;
  } else {
    products.push(product);
  }
  setItem(STORAGE_KEYS.products, products);
}

export function updateProductStock(productId: string, quantityChange: number): void {
  const products = getAllProducts();
  const index = products.findIndex(p => p.id === productId);
  if (index >= 0) {
    products[index].stock += quantityChange;
    setItem(STORAGE_KEYS.products, products);
  }
}

// Sales functions
export function getSales(branchId?: string): Sale[] {
  const sales = getItem<Sale[]>(STORAGE_KEYS.sales, []);
  if (branchId) {
    return sales.filter(s => s.branchId === branchId);
  }
  return sales;
}

export function getAllSales(): Sale[] {
  return getItem<Sale[]>(STORAGE_KEYS.sales, []);
}

export function saveSale(sale: Sale): void {
  const sales = getAllSales();
  sales.push(sale);
  setItem(STORAGE_KEYS.sales, sales);
  
  // Update product stock
  sale.items.forEach(item => {
    updateProductStock(item.productId, -item.quantity);
  });
}

export function generateInvoiceNumber(branchCode: string): string {
  const sales = getAllSales();
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const count = sales.filter(s => 
    s.invoiceNumber.startsWith(`FT ${branchCode}/${today}`)
  ).length + 1;
  return `FT ${branchCode}/${today}/${count.toString().padStart(4, '0')}`;
}

// Daily Report functions
export function getDailyReports(branchId?: string): DailySummary[] {
  const reports = getItem<DailySummary[]>(STORAGE_KEYS.dailyReports, []);
  return branchId ? reports.filter(r => r.branchId === branchId) : reports;
}

export function saveDailyReport(report: DailySummary): void {
  const reports = getDailyReports();
  const index = reports.findIndex(r => r.id === report.id);
  if (index >= 0) {
    reports[index] = report;
  } else {
    reports.push(report);
  }
  setItem(STORAGE_KEYS.dailyReports, reports);
}

export function getTodayReport(branchId: string): DailySummary | null {
  const today = new Date().toISOString().split('T')[0];
  const reports = getDailyReports(branchId);
  return reports.find(r => r.date === today) || null;
}

export function generateDailyReport(branchId: string, date: string): DailySummary {
  const sales = getSales(branchId).filter(s => 
    s.createdAt.startsWith(date) && s.status === 'completed'
  );
  const branch = getBranches().find(b => b.id === branchId);
  
  const cashTotal = sales.filter(s => s.paymentMethod === 'cash').reduce((sum, s) => sum + s.total, 0);
  const cardTotal = sales.filter(s => s.paymentMethod === 'card').reduce((sum, s) => sum + s.total, 0);
  const transferTotal = sales.filter(s => s.paymentMethod === 'transfer').reduce((sum, s) => sum + s.total, 0);
  
  return {
    id: `report_${branchId}_${date}`,
    date,
    branchId,
    branchName: branch?.name || '',
    totalSales: sales.reduce((sum, s) => sum + s.total, 0),
    totalTransactions: sales.length,
    cashTotal,
    cardTotal,
    transferTotal,
    taxCollected: sales.reduce((sum, s) => sum + s.taxAmount, 0),
    openingBalance: 0,
    closingBalance: cashTotal,
    status: 'open',
    createdAt: new Date().toISOString(),
  };
}

// Client functions
export function getClients(): Client[] {
  return getItem<Client[]>(STORAGE_KEYS.clients, []);
}

export function saveClient(client: Client): void {
  const clients = getClients();
  const index = clients.findIndex(c => c.id === client.id);
  if (index >= 0) {
    clients[index] = { ...client, updatedAt: new Date().toISOString() };
  } else {
    clients.push(client);
  }
  setItem(STORAGE_KEYS.clients, clients);
}

export function deleteClient(clientId: string): void {
  const clients = getClients().filter(c => c.id !== clientId);
  setItem(STORAGE_KEYS.clients, clients);
}

// Stock Transfer functions
export function getStockTransfers(branchId?: string): StockTransfer[] {
  const transfers = getItem<StockTransfer[]>(STORAGE_KEYS.stockTransfers, []);
  if (!branchId) return transfers;
  return transfers.filter(t => t.fromBranchId === branchId || t.toBranchId === branchId);
}

export function saveStockTransfer(transfer: StockTransfer): void {
  const transfers = getStockTransfers();
  const index = transfers.findIndex(t => t.id === transfer.id);
  if (index >= 0) {
    transfers[index] = transfer;
  } else {
    transfers.push(transfer);
  }
  setItem(STORAGE_KEYS.stockTransfers, transfers);
}

export function processStockTransfer(transferId: string, action: 'approve' | 'receive' | 'cancel', userId: string): void {
  const transfers = getStockTransfers();
  const transfer = transfers.find(t => t.id === transferId);
  if (!transfer) return;
  
  if (action === 'approve') {
    transfer.status = 'in_transit';
    transfer.approvedBy = userId;
    transfer.approvedAt = new Date().toISOString();
    
    // Deduct from source branch
    transfer.items.forEach(item => {
      const products = getAllProducts();
      const product = products.find(p => p.id === item.productId && p.branchId === transfer.fromBranchId);
      if (product) {
        updateProductStock(product.id, -item.quantity);
      }
    });
  } else if (action === 'receive') {
    transfer.status = 'received';
    transfer.receivedBy = userId;
    transfer.receivedAt = new Date().toISOString();
    
    // Add to destination branch
    transfer.items.forEach(item => {
      const products = getAllProducts();
      let product = products.find(p => p.sku === item.sku && p.branchId === transfer.toBranchId);
      
      if (product) {
        updateProductStock(product.id, item.receivedQuantity || item.quantity);
      } else {
        // Create new product entry for this branch
        const sourceProduct = products.find(p => p.id === item.productId);
        if (sourceProduct) {
          const newProduct: Product = {
            ...sourceProduct,
            id: `prod_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            branchId: transfer.toBranchId,
            stock: item.receivedQuantity || item.quantity,
            createdAt: new Date().toISOString(),
          };
          saveProduct(newProduct);
        }
      }
    });
  } else if (action === 'cancel') {
    transfer.status = 'cancelled';
  }
  
  saveStockTransfer(transfer);
}

export function generateTransferNumber(): string {
  const transfers = getStockTransfers();
  const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
  const sequence = String(transfers.length + 1).padStart(4, '0');
  return `TRF${today}${sequence}`;
}

// Data Sync functions
export function createSyncPackage(branchId: string, dateFrom: string, dateTo: string): SyncPackage {
  const branch = getBranches().find(b => b.id === branchId);
  const sales = getSales(branchId).filter(s => {
    const saleDate = s.createdAt.split('T')[0];
    return saleDate >= dateFrom && saleDate <= dateTo && !s.syncedToMain;
  });
  const dailyReports = getDailyReports(branchId).filter(r => {
    return r.date >= dateFrom && r.date <= dateTo;
  });
  
  return {
    id: `sync_${branchId}_${Date.now()}`,
    branchId,
    branchCode: branch?.code || '',
    branchName: branch?.name || '',
    exportDate: new Date().toISOString(),
    dateRange: { from: dateFrom, to: dateTo },
    sales,
    dailyReports,
    version: '1.0.0',
  };
}

export function importSyncPackage(syncPackage: SyncPackage): { salesImported: number; reportsImported: number } {
  let salesImported = 0;
  let reportsImported = 0;
  
  // Import sales
  const existingSales = getAllSales();
  syncPackage.sales.forEach(sale => {
    if (!existingSales.find(s => s.id === sale.id)) {
      sale.syncedToMain = true;
      sale.syncedAt = new Date().toISOString();
      existingSales.push(sale);
      salesImported++;
    }
  });
  setItem(STORAGE_KEYS.sales, existingSales);
  
  // Import daily reports
  const existingReports = getDailyReports();
  syncPackage.dailyReports.forEach(report => {
    if (!existingReports.find(r => r.id === report.id)) {
      existingReports.push(report);
      reportsImported++;
    }
  });
  setItem(STORAGE_KEYS.dailyReports, existingReports);
  
  return { salesImported, reportsImported };
}

// User functions
export function getUsers(): User[] {
  return getItem<User[]>(STORAGE_KEYS.users, getDefaultUsers());
}

export function getCurrentUser(): User | null {
  return getItem<User | null>(STORAGE_KEYS.currentUser, null);
}

export function setCurrentUser(user: User | null): void {
  setItem(STORAGE_KEYS.currentUser, user);
}

// Default data
function getDefaultBranches(): Branch[] {
  return [
    {
      id: 'branch-001',
      name: 'Sede Principal - Luanda',
      code: 'LDA',
      address: 'Rua Principal 123, Luanda',
      phone: '+244 923 456 789',
      isMain: true,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'branch-002',
      name: 'Filial Viana',
      code: 'VIA',
      address: 'Av. Deolinda Rodrigues, Viana',
      phone: '+244 923 456 790',
      isMain: false,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'branch-003',
      name: 'Filial Benguela',
      code: 'BGL',
      address: 'Rua 4 de Fevereiro, Benguela',
      phone: '+244 923 456 791',
      isMain: false,
      createdAt: new Date().toISOString(),
    },
  ];
}

function getDefaultProducts(): Product[] {
  return [
    {
      id: 'prod-001',
      name: 'Arroz Tio João 1kg',
      sku: 'ARR-001',
      barcode: '7891234567890',
      category: 'Alimentação',
      price: 850,
      cost: 650,
      stock: 100,
      unit: 'un',
      taxRate: 14,
      branchId: 'all',
      isActive: true,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'prod-002',
      name: 'Óleo Alimentar 1L',
      sku: 'OLE-001',
      barcode: '7891234567891',
      category: 'Alimentação',
      price: 1200,
      cost: 900,
      stock: 80,
      unit: 'un',
      taxRate: 14,
      branchId: 'all',
      isActive: true,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'prod-003',
      name: 'Açúcar 1kg',
      sku: 'ACU-001',
      barcode: '7891234567892',
      category: 'Alimentação',
      price: 450,
      cost: 320,
      stock: 150,
      unit: 'un',
      taxRate: 14,
      branchId: 'all',
      isActive: true,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'prod-004',
      name: 'Água Mineral 1.5L',
      sku: 'AGU-001',
      barcode: '7891234567893',
      category: 'Bebidas',
      price: 250,
      cost: 150,
      stock: 200,
      unit: 'un',
      taxRate: 14,
      branchId: 'all',
      isActive: true,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'prod-005',
      name: 'Refrigerante Cola 2L',
      sku: 'REF-001',
      barcode: '7891234567894',
      category: 'Bebidas',
      price: 650,
      cost: 450,
      stock: 120,
      unit: 'un',
      taxRate: 14,
      branchId: 'all',
      isActive: true,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'prod-006',
      name: 'Sabão em Pó 1kg',
      sku: 'SAB-001',
      barcode: '7891234567895',
      category: 'Limpeza',
      price: 980,
      cost: 720,
      stock: 60,
      unit: 'un',
      taxRate: 14,
      branchId: 'all',
      isActive: true,
      createdAt: new Date().toISOString(),
    },
  ];
}

function getDefaultUsers(): User[] {
  return [
    {
      id: 'user-001',
      email: 'admin',
      name: 'Administrador',
      role: 'admin',
      branchId: 'branch-001',
      isActive: true,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'user-002',
      email: 'caixa1',
      name: 'João Silva',
      role: 'cashier',
      branchId: 'branch-001',
      isActive: true,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'user-003',
      email: 'gerente',
      name: 'Maria Santos',
      role: 'manager',
      branchId: 'branch-001',
      isActive: true,
      createdAt: new Date().toISOString(),
    },
  ];
}

// Supplier functions
export function getSuppliers(): Supplier[] {
  return getItem<Supplier[]>(STORAGE_KEYS.suppliers, []);
}

export function saveSupplier(supplier: Supplier): void {
  const suppliers = getSuppliers();
  const index = suppliers.findIndex(s => s.id === supplier.id);
  if (index >= 0) {
    suppliers[index] = supplier;
  } else {
    suppliers.push(supplier);
  }
  setItem(STORAGE_KEYS.suppliers, suppliers);
}

export function deleteSupplier(supplierId: string): void {
  const suppliers = getSuppliers().filter(s => s.id !== supplierId);
  setItem(STORAGE_KEYS.suppliers, suppliers);
}

// Purchase Order functions
export function getPurchaseOrders(branchId?: string): PurchaseOrder[] {
  const orders = getItem<PurchaseOrder[]>(STORAGE_KEYS.purchaseOrders, []);
  if (branchId) {
    return orders.filter(o => o.branchId === branchId);
  }
  return orders;
}

export function savePurchaseOrder(order: PurchaseOrder): void {
  const orders = getPurchaseOrders();
  const index = orders.findIndex(o => o.id === order.id);
  if (index >= 0) {
    orders[index] = order;
  } else {
    orders.push(order);
  }
  setItem(STORAGE_KEYS.purchaseOrders, orders);
}

export function generatePurchaseOrderNumber(): string {
  const orders = getPurchaseOrders();
  const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
  const sequence = String(orders.length + 1).padStart(4, '0');
  return `PO${today}${sequence}`;
}

export function processPurchaseOrderReceive(orderId: string, receivedQuantities: Record<string, number>, userId: string): void {
  const orders = getPurchaseOrders();
  const order = orders.find(o => o.id === orderId);
  if (!order) return;

  // Update received quantities
  order.items.forEach(item => {
    item.receivedQuantity = receivedQuantities[item.productId] ?? item.quantity;
  });

  // Check if partial or full receive
  const allReceived = order.items.every(item => (item.receivedQuantity || 0) >= item.quantity);
  const someReceived = order.items.some(item => (item.receivedQuantity || 0) > 0);

  if (allReceived) {
    order.status = 'received';
  } else if (someReceived) {
    order.status = 'partial';
  }

  order.receivedBy = userId;
  order.receivedAt = new Date().toISOString();

  savePurchaseOrder(order);

  // Update stock for each item
  order.items.forEach(item => {
    const received = receivedQuantities[item.productId] || 0;
    if (received > 0) {
      // Find product in the destination branch
      const products = getAllProducts();
      let product = products.find(p => p.id === item.productId);
      
      if (product) {
        updateProductStock(product.id, received);
      }
    }
  });
}

// Category functions
export function getCategories(): Category[] {
  return getItem<Category[]>(STORAGE_KEYS.categories, getDefaultCategories());
}

export function saveCategory(category: Category): void {
  const categories = getCategories();
  const index = categories.findIndex(c => c.id === category.id);
  if (index >= 0) {
    categories[index] = category;
  } else {
    categories.push(category);
  }
  setItem(STORAGE_KEYS.categories, categories);
}

export function deleteCategory(categoryId: string): void {
  const categories = getCategories().filter(c => c.id !== categoryId);
  setItem(STORAGE_KEYS.categories, categories);
}

function getDefaultCategories(): Category[] {
  return [
    { id: 'cat-001', name: 'Alimentação', description: 'Produtos alimentares', color: '#22c55e', isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'cat-002', name: 'Bebidas', description: 'Bebidas e sumos', color: '#3b82f6', isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'cat-003', name: 'Limpeza', description: 'Produtos de limpeza', color: '#a855f7', isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'cat-004', name: 'Higiene', description: 'Higiene pessoal', color: '#ec4899', isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'cat-005', name: 'Electrónicos', description: 'Electrónicos e acessórios', color: '#f59e0b', isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'cat-006', name: 'Vestuário', description: 'Roupa e calçado', color: '#ef4444', isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'cat-007', name: 'Papelaria', description: 'Material de escritório', color: '#14b8a6', isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'cat-008', name: 'Outros', description: 'Outros produtos', color: '#6b7280', isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  ];
}
