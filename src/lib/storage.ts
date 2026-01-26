// Local storage layer for Kwanza ERP - Offline First Architecture
import { Branch, Product, Sale, User, DailySummary, Client, StockTransfer, SyncPackage, Supplier, PurchaseOrder, Category, StockMovement } from '@/types/erp';

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
  stockMovements: 'kwanzaerp_stock_movements',
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

export function deleteBranch(branchId: string): void {
  const branches = getBranches().filter(b => b.id !== branchId);
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

// ==================== STOCK MOVEMENTS ====================
// Track every stock IN/OUT with reason for full traceability

export function getStockMovements(branchId?: string): StockMovement[] {
  const movements = getItem<StockMovement[]>(STORAGE_KEYS.stockMovements, []);
  if (branchId) {
    return movements.filter(m => m.branchId === branchId);
  }
  return movements;
}

export function saveStockMovement(movement: StockMovement): void {
  const movements = getStockMovements();
  movements.push(movement);
  setItem(STORAGE_KEYS.stockMovements, movements);
}

export function createStockMovement(
  productId: string,
  branchId: string,
  type: 'IN' | 'OUT',
  quantity: number,
  reason: StockMovement['reason'],
  userId: string,
  referenceId?: string,
  referenceNumber?: string,
  notes?: string
): StockMovement {
  const products = getAllProducts();
  const product = products.find(p => p.id === productId);
  
  const movement: StockMovement = {
    id: `mov_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    productId,
    productName: product?.name || '',
    sku: product?.sku || '',
    branchId,
    type,
    quantity,
    reason,
    referenceId,
    referenceNumber,
    costAtTime: product?.lastCost || product?.cost,
    notes,
    createdBy: userId,
    createdAt: new Date().toISOString(),
  };
  
  saveStockMovement(movement);
  return movement;
}

// ==================== DATA SYNC (FILIAL → HEAD OFFICE) ====================
// Complete sync package for offline-first architecture

export function createSyncPackage(branchId: string, dateFrom: string, dateTo: string): SyncPackage {
  const branch = getBranches().find(b => b.id === branchId);
  
  // Filter function for date range
  const isInDateRange = (dateStr: string) => {
    const date = dateStr.split('T')[0];
    return date >= dateFrom && date <= dateTo;
  };
  
  // Get all data for this branch within date range
  const products = getProducts(branchId);
  const suppliers = getSuppliers();
  const clients = getClients();
  
  const purchases = getPurchaseOrders(branchId).filter(p => isInDateRange(p.createdAt));
  const sales = getSales(branchId).filter(s => isInDateRange(s.createdAt) && !s.syncedToMain);
  const stockMovements = getStockMovements(branchId).filter(m => isInDateRange(m.createdAt));
  const stockTransfers = getStockTransfers(branchId).filter(t => isInDateRange(t.requestedAt));
  const dailyReports = getDailyReports(branchId).filter(r => r.date >= dateFrom && r.date <= dateTo);
  
  const totalRecords = products.length + suppliers.length + clients.length + 
                       purchases.length + sales.length + stockMovements.length + 
                       stockTransfers.length + dailyReports.length;
  
  return {
    id: `sync_${branch?.code || branchId}_${Date.now()}`,
    branchId,
    branchCode: branch?.code || '',
    branchName: branch?.name || '',
    exportDate: new Date().toISOString(),
    dateRange: { from: dateFrom, to: dateTo },
    products,
    suppliers,
    clients,
    purchases,
    sales,
    stockMovements,
    stockTransfers,
    dailyReports,
    version: '2.0.0',
    totalRecords,
  };
}

// ==================== DATA SYNC (HEAD OFFICE → FILIAL) ====================
// Price and code updates only - NO stock information

export interface PriceUpdatePackage {
  id: string;
  fromBranchId: string;
  fromBranchName: string;
  exportDate: string;
  products: Array<{
    id: string;
    sku: string;
    barcode?: string;
    name: string;
    price: number;
    cost: number;
    taxRate: number;
    category: string;
    unit: string;
    supplierName?: string;
    // Explicitly NO stock field
  }>;
  categories: Array<{
    id: string;
    name: string;
  }>;
  version: string;
  totalRecords: number;
}

export function createPriceUpdatePackage(): PriceUpdatePackage {
  const mainBranch = getBranches().find(b => b.isMain);
  const allProducts = getAllProducts();
  const categories = getCategories();
  
  // Extract only pricing and identification data - NO STOCK
  const priceProducts = allProducts.map(p => ({
    id: p.id,
    sku: p.sku,
    barcode: p.barcode,
    name: p.name,
    price: p.price,
    cost: p.cost,
    taxRate: p.taxRate,
    category: p.category,
    unit: p.unit,
    supplierName: p.supplierName,
  }));
  
  return {
    id: `price_update_${Date.now()}`,
    fromBranchId: mainBranch?.id || '',
    fromBranchName: mainBranch?.name || 'Sede',
    exportDate: new Date().toISOString(),
    products: priceProducts,
    categories: categories.map(c => ({ id: c.id, name: c.name })),
    version: '1.0.0',
    totalRecords: priceProducts.length,
  };
}

export interface PriceUpdateResult {
  productsUpdated: number;
  productsAdded: number;
  categoriesUpdated: number;
  totalProcessed: number;
}

export function importPriceUpdatePackage(pkg: PriceUpdatePackage): PriceUpdateResult {
  const result: PriceUpdateResult = {
    productsUpdated: 0,
    productsAdded: 0,
    categoriesUpdated: 0,
    totalProcessed: 0,
  };
  
  // Import categories
  if (pkg.categories) {
    const existingCategories = getCategories();
    pkg.categories.forEach(cat => {
      if (!existingCategories.find(c => c.id === cat.id || c.name === cat.name)) {
        existingCategories.push({
          id: cat.id,
          name: cat.name,
          description: '',
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        result.categoriesUpdated++;
      }
    });
    setItem(STORAGE_KEYS.categories, existingCategories);
  }
  
  // Import/update products - PRESERVE LOCAL STOCK
  if (pkg.products) {
    const existingProducts = getAllProducts();
    
    pkg.products.forEach(newProduct => {
      const existingIndex = existingProducts.findIndex(
        p => p.id === newProduct.id || p.sku === newProduct.sku
      );
      
      if (existingIndex >= 0) {
        // Update existing product - KEEP LOCAL STOCK
        const existing = existingProducts[existingIndex];
        existingProducts[existingIndex] = {
          ...existing,
          // Update pricing and identification
          sku: newProduct.sku,
          barcode: newProduct.barcode,
          name: newProduct.name,
          price: newProduct.price,
          cost: newProduct.cost,
          taxRate: newProduct.taxRate,
          category: newProduct.category,
          unit: newProduct.unit,
          supplierName: newProduct.supplierName,
          updatedAt: new Date().toISOString(),
          // KEEP LOCAL STOCK - do not override
        };
        result.productsUpdated++;
      } else {
        // Add new product with ZERO stock at filial
        const newProd: Product = {
          id: newProduct.id,
          sku: newProduct.sku,
          barcode: newProduct.barcode,
          name: newProduct.name,
          price: newProduct.price,
          cost: newProduct.cost,
          firstCost: newProduct.cost,
          lastCost: newProduct.cost,
          avgCost: newProduct.cost,
          taxRate: newProduct.taxRate,
          category: newProduct.category,
          unit: newProduct.unit,
          supplierName: newProduct.supplierName,
          stock: 0, // New products start with ZERO stock at filial
          branchId: '', // Will be set based on current branch
          isActive: true,
          createdAt: new Date().toISOString(),
        };
        existingProducts.push(newProd);
        result.productsAdded++;
      }
    });
    
    setItem(STORAGE_KEYS.products, existingProducts);
  }
  
  result.totalProcessed = result.productsUpdated + result.productsAdded + result.categoriesUpdated;
  return result;
}

// Helper to check if current branch is a filial (not main office)
export function isFilialBranch(branchId?: string): boolean {
  const branches = getBranches();
  if (!branchId) {
    const currentBranch = branches.find(b => !b.isMain); // Default check
    return currentBranch ? !currentBranch.isMain : false;
  }
  const branch = branches.find(b => b.id === branchId);
  return branch ? !branch.isMain : false;
}

export interface ImportResult {
  productsImported: number;
  suppliersImported: number;
  clientsImported: number;
  purchasesImported: number;
  salesImported: number;
  stockMovementsImported: number;
  stockTransfersImported: number;
  reportsImported: number;
  totalImported: number;
}

export function importSyncPackage(syncPackage: SyncPackage): ImportResult {
  const result: ImportResult = {
    productsImported: 0,
    suppliersImported: 0,
    clientsImported: 0,
    purchasesImported: 0,
    salesImported: 0,
    stockMovementsImported: 0,
    stockTransfersImported: 0,
    reportsImported: 0,
    totalImported: 0,
  };
  
  // Import products (update existing or add new)
  if (syncPackage.products) {
    const existingProducts = getAllProducts();
    syncPackage.products.forEach(product => {
      const existing = existingProducts.find(p => p.id === product.id || p.sku === product.sku);
      if (!existing) {
        existingProducts.push(product);
        result.productsImported++;
      }
    });
    setItem(STORAGE_KEYS.products, existingProducts);
  }
  
  // Import suppliers
  if (syncPackage.suppliers) {
    const existingSuppliers = getSuppliers();
    syncPackage.suppliers.forEach(supplier => {
      if (!existingSuppliers.find(s => s.id === supplier.id || s.nif === supplier.nif)) {
        existingSuppliers.push(supplier);
        result.suppliersImported++;
      }
    });
    setItem(STORAGE_KEYS.suppliers, existingSuppliers);
  }
  
  // Import clients
  if (syncPackage.clients) {
    const existingClients = getClients();
    syncPackage.clients.forEach(client => {
      if (!existingClients.find(c => c.id === client.id || c.nif === client.nif)) {
        existingClients.push(client);
        result.clientsImported++;
      }
    });
    setItem(STORAGE_KEYS.clients, existingClients);
  }
  
  // Import purchases
  if (syncPackage.purchases) {
    const existingPurchases = getPurchaseOrders();
    syncPackage.purchases.forEach(purchase => {
      if (!existingPurchases.find(p => p.id === purchase.id)) {
        existingPurchases.push(purchase);
        result.purchasesImported++;
      }
    });
    setItem(STORAGE_KEYS.purchaseOrders, existingPurchases);
  }
  
  // Import sales and DEDUCT STOCK from main office for each sale
  if (syncPackage.sales) {
    const existingSales = getAllSales();
    syncPackage.sales.forEach(sale => {
      if (!existingSales.find(s => s.id === sale.id)) {
        sale.syncedToMain = true;
        sale.syncedAt = new Date().toISOString();
        existingSales.push(sale);
        result.salesImported++;
        
        // CRITICAL: Deduct stock from main office for imported sales
        // This ensures the main office stock reflects all branch sales
        if (sale.items && Array.isArray(sale.items)) {
          sale.items.forEach(item => {
            updateProductStock(item.productId, -item.quantity);
          });
        }
      }
    });
    setItem(STORAGE_KEYS.sales, existingSales);
  }
  
  // Import stock movements
  if (syncPackage.stockMovements) {
    const existingMovements = getStockMovements();
    syncPackage.stockMovements.forEach(movement => {
      if (!existingMovements.find(m => m.id === movement.id)) {
        existingMovements.push(movement);
        result.stockMovementsImported++;
      }
    });
    setItem(STORAGE_KEYS.stockMovements, existingMovements);
  }
  
  // Import stock transfers
  if (syncPackage.stockTransfers) {
    const existingTransfers = getStockTransfers();
    syncPackage.stockTransfers.forEach(transfer => {
      if (!existingTransfers.find(t => t.id === transfer.id)) {
        existingTransfers.push(transfer);
        result.stockTransfersImported++;
      }
    });
    setItem(STORAGE_KEYS.stockTransfers, existingTransfers);
  }
  
  // Import daily reports
  if (syncPackage.dailyReports) {
    const existingReports = getDailyReports();
    syncPackage.dailyReports.forEach(report => {
      if (!existingReports.find(r => r.id === report.id)) {
        existingReports.push(report);
        result.reportsImported++;
      }
    });
    setItem(STORAGE_KEYS.dailyReports, existingReports);
  }
  
  result.totalImported = result.productsImported + result.suppliersImported + 
                         result.clientsImported + result.purchasesImported + 
                         result.salesImported + result.stockMovementsImported + 
                         result.stockTransfersImported + result.reportsImported;
  
  return result;
}

// User functions
export function getUsers(): User[] {
  return getItem<User[]>(STORAGE_KEYS.users, getDefaultUsers());
}

export function getUserById(userId: string): User | null {
  const users = getUsers();
  return users.find(u => u.id === userId) || null;
}

export function saveUser(user: User): void {
  const users = getUsers();
  const index = users.findIndex(u => u.id === user.id);
  if (index >= 0) {
    users[index] = { ...user, updatedAt: new Date().toISOString() };
  } else {
    users.push(user);
  }
  setItem(STORAGE_KEYS.users, users);
}

export function deleteUser(userId: string): void {
  const users = getUsers().filter(u => u.id !== userId);
  setItem(STORAGE_KEYS.users, users);
}

export function createUser(data: Omit<User, 'id' | 'createdAt'>): User {
  const user: User = {
    ...data,
    id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    createdAt: new Date().toISOString(),
  };
  saveUser(user);
  return user;
}

export function updateUserRole(userId: string, role: User['role']): void {
  const users = getUsers();
  const index = users.findIndex(u => u.id === userId);
  if (index >= 0) {
    users[index].role = role;
    users[index].updatedAt = new Date().toISOString();
    setItem(STORAGE_KEYS.users, users);
  }
}

export function toggleUserActive(userId: string): void {
  const users = getUsers();
  const index = users.findIndex(u => u.id === userId);
  if (index >= 0) {
    users[index].isActive = !users[index].isActive;
    users[index].updatedAt = new Date().toISOString();
    setItem(STORAGE_KEYS.users, users);
  }
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
      firstCost: 650,
      lastCost: 650,
      avgCost: 650,
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
      firstCost: 900,
      lastCost: 900,
      avgCost: 900,
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
      firstCost: 320,
      lastCost: 320,
      avgCost: 320,
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
      firstCost: 150,
      lastCost: 150,
      avgCost: 150,
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
      firstCost: 450,
      lastCost: 450,
      avgCost: 450,
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
      firstCost: 720,
      lastCost: 720,
      avgCost: 720,
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
      email: 'admin@kwanzaerp.ao',
      username: 'admin',
      name: 'Administrador',
      role: 'admin',
      branchId: 'branch-001',
      isActive: true,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'user-002',
      email: 'caixa1@kwanzaerp.ao',
      username: 'caixa1',
      name: 'João Silva',
      role: 'cashier',
      branchId: 'branch-001',
      isActive: true,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'user-003',
      email: 'gerente@kwanzaerp.ao',
      username: 'gerente',
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

  // Calculate total order value for freight allocation
  const orderItemsTotal = order.items.reduce((sum, item) => sum + (item.quantity * item.unitCost), 0);
  const totalLandingCosts = (order.freightCost || 0) + (order.otherCosts || 0);

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
  order.freightDistributed = true; // Mark freight as distributed to costs

  savePurchaseOrder(order);

  // Update stock AND cost for each item using weighted average
  order.items.forEach(item => {
    const received = receivedQuantities[item.productId] || 0;
    if (received > 0) {
      const products = getAllProducts();
      const product = products.find(p => p.id === item.productId);
      
      if (product) {
        // Calculate freight allocation for this item (proportional to value)
        let freightPerUnit = 0;
        if (orderItemsTotal > 0 && totalLandingCosts > 0) {
          const itemValue = item.quantity * item.unitCost;
          const proportion = itemValue / orderItemsTotal;
          freightPerUnit = (totalLandingCosts * proportion) / item.quantity;
        }
        
        // Effective cost = unit cost + freight allocation
        const effectiveCost = item.unitCost + freightPerUnit;
        
        // Calculate weighted average cost
        // WAC = (Previous Stock × Previous Cost + Received Qty × Landed Cost) / Total Stock
        const previousTotalValue = product.stock * (product.cost || 0);
        const newItemsTotalValue = received * effectiveCost;
        const newTotalStock = product.stock + received;
        
        const newAverageCost = newTotalStock > 0 
          ? (previousTotalValue + newItemsTotalValue) / newTotalStock
          : effectiveCost;

        // Update product with new stock AND cost
        const updatedProduct: Product = {
          ...product,
          stock: newTotalStock,
          cost: newAverageCost, // Update to weighted average cost
          avgCost: newAverageCost, // Also update avgCost field
          lastCost: effectiveCost, // Track last purchase cost (with freight)
          // Set firstCost only if it's 0 (first purchase)
          firstCost: product.firstCost || effectiveCost,
          updatedAt: new Date().toISOString(),
        };
        
        saveProduct(updatedProduct);
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
