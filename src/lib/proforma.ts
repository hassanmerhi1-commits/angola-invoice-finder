// Pro Forma storage and management for Kwanza ERP
import { ProForma, ProFormaItem } from '@/types/proforma';

const STORAGE_KEY = 'kwanzaerp_proformas';

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

// Pro Forma CRUD
export function getProFormas(branchId?: string): ProForma[] {
  const proformas = getItem<ProForma[]>(STORAGE_KEY, []);
  if (branchId) {
    return proformas.filter(p => p.branchId === branchId);
  }
  return proformas;
}

export function getProFormaById(id: string): ProForma | undefined {
  const proformas = getItem<ProForma[]>(STORAGE_KEY, []);
  return proformas.find(p => p.id === id);
}

export function saveProForma(proforma: ProForma): void {
  const proformas = getItem<ProForma[]>(STORAGE_KEY, []);
  const index = proformas.findIndex(p => p.id === proforma.id);
  
  if (index >= 0) {
    proformas[index] = { ...proforma, updatedAt: new Date().toISOString() };
  } else {
    proformas.push(proforma);
  }
  
  setItem(STORAGE_KEY, proformas);
}

export function deleteProForma(id: string): void {
  const proformas = getItem<ProForma[]>(STORAGE_KEY, []);
  const filtered = proformas.filter(p => p.id !== id);
  setItem(STORAGE_KEY, filtered);
}

export function generateProFormaNumber(branchCode: string): string {
  const proformas = getItem<ProForma[]>(STORAGE_KEY, []);
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
  
  // Count proformas for today
  const todayPrefix = `OR ${branchCode}/${dateStr}/`;
  const todayProformas = proformas.filter(p => p.documentNumber.startsWith(todayPrefix));
  const sequence = (todayProformas.length + 1).toString().padStart(4, '0');
  
  return `${todayPrefix}${sequence}`;
}

// Calculate totals for items
export function calculateProFormaTotals(items: ProFormaItem[]): {
  subtotal: number;
  taxAmount: number;
  total: number;
} {
  let subtotal = 0;
  let taxAmount = 0;
  
  items.forEach(item => {
    const itemSubtotal = item.quantity * item.unitPrice * (1 - item.discount / 100);
    const itemTax = itemSubtotal * (item.taxRate / 100);
    subtotal += itemSubtotal;
    taxAmount += itemTax;
  });
  
  return {
    subtotal: Math.round(subtotal * 100) / 100,
    taxAmount: Math.round(taxAmount * 100) / 100,
    total: Math.round((subtotal + taxAmount) * 100) / 100,
  };
}

// Check and update expired proformas
export function updateExpiredProFormas(): void {
  const proformas = getItem<ProForma[]>(STORAGE_KEY, []);
  const now = new Date();
  let updated = false;
  
  proformas.forEach(p => {
    if (['draft', 'sent'].includes(p.status) && new Date(p.validUntil) < now) {
      p.status = 'expired';
      p.updatedAt = now.toISOString();
      updated = true;
    }
  });
  
  if (updated) {
    setItem(STORAGE_KEY, proformas);
  }
}

// Get statistics
export function getProFormaStats(branchId?: string): {
  total: number;
  draft: number;
  sent: number;
  accepted: number;
  converted: number;
  expired: number;
  totalValue: number;
  pendingValue: number;
} {
  const proformas = getProFormas(branchId);
  
  return {
    total: proformas.length,
    draft: proformas.filter(p => p.status === 'draft').length,
    sent: proformas.filter(p => p.status === 'sent').length,
    accepted: proformas.filter(p => p.status === 'accepted').length,
    converted: proformas.filter(p => p.status === 'converted').length,
    expired: proformas.filter(p => p.status === 'expired').length,
    totalValue: proformas.reduce((sum, p) => sum + p.total, 0),
    pendingValue: proformas
      .filter(p => ['draft', 'sent', 'accepted'].includes(p.status))
      .reduce((sum, p) => sum + p.total, 0),
  };
}
