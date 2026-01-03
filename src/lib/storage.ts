// Local storage layer - will be replaced with Supabase later
import { Branch, Product, Sale, User } from '@/types/erp';

const STORAGE_KEYS = {
  branches: 'kwanzaerp_branches',
  products: 'kwanzaerp_products',
  sales: 'kwanzaerp_sales',
  users: 'kwanzaerp_users',
  currentBranch: 'kwanzaerp_current_branch',
  currentUser: 'kwanzaerp_current_user',
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

export function saveProduct(product: Product): void {
  const products = getItem<Product[]>(STORAGE_KEYS.products, []);
  const index = products.findIndex(p => p.id === product.id);
  if (index >= 0) {
    products[index] = product;
  } else {
    products.push(product);
  }
  setItem(STORAGE_KEYS.products, products);
}

export function updateProductStock(productId: string, quantityChange: number): void {
  const products = getItem<Product[]>(STORAGE_KEYS.products, []);
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

export function saveSale(sale: Sale): void {
  const sales = getItem<Sale[]>(STORAGE_KEYS.sales, []);
  sales.push(sale);
  setItem(STORAGE_KEYS.sales, sales);
  
  // Update product stock
  sale.items.forEach(item => {
    updateProductStock(item.productId, -item.quantity);
  });
}

export function generateInvoiceNumber(branchCode: string): string {
  const sales = getSales();
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const count = sales.filter(s => 
    s.invoiceNumber.startsWith(`FT ${branchCode}/${today}`)
  ).length + 1;
  return `FT ${branchCode}/${today}/${count.toString().padStart(4, '0')}`;
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
      email: 'admin@smarterp.ao',
      name: 'Administrador',
      role: 'admin',
      branchId: 'branch-001',
      isActive: true,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'user-002',
      email: 'caixa1@smarterp.ao',
      name: 'João Silva',
      role: 'cashier',
      branchId: 'branch-001',
      isActive: true,
      createdAt: new Date().toISOString(),
    },
  ];
}
