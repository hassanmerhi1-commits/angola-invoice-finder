// HTTP API Client for Kwanza ERP
import { getApiUrl } from './config';

export interface ApiResponse<T> {
  data?: T;
  error?: string;
}

// Get auth token from localStorage
function getAuthToken(): string | null {
  return localStorage.getItem('kwanza_auth_token');
}

// Set auth token
export function setAuthToken(token: string | null): void {
  if (token) {
    localStorage.setItem('kwanza_auth_token', token);
  } else {
    localStorage.removeItem('kwanza_auth_token');
  }
}

// Base fetch with auth headers
async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const url = `${getApiUrl()}/api${endpoint}`;
  const token = getAuthToken();
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };
  
  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      return { error: data.error || `HTTP ${response.status}` };
    }
    
    return { data };
  } catch (error) {
    console.error(`[API ERROR] ${endpoint}:`, error);
    return { error: error instanceof Error ? error.message : 'Network error' };
  }
}

// API Methods
export const api = {
  // Health check
  health: () => apiFetch<{ status: string; timestamp: string }>('/health'),
  
  // Auth
  auth: {
    login: (email: string, password: string) =>
      apiFetch<{ token: string; user: any }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }),
    me: () => apiFetch<any>('/auth/me'),
  },
  
  // Branches
  branches: {
    list: () => apiFetch<any[]>('/branches'),
    create: (data: any) =>
      apiFetch<any>('/branches', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) =>
      apiFetch<any>(`/branches/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  },
  
  // Products
  products: {
    list: (branchId?: string) =>
      apiFetch<any[]>(`/products${branchId ? `?branchId=${branchId}` : ''}`),
    create: (data: any) =>
      apiFetch<any>('/products', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) =>
      apiFetch<any>(`/products/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    updateStock: (id: string, quantityChange: number) =>
      apiFetch<any>(`/products/${id}/stock`, {
        method: 'PATCH',
        body: JSON.stringify({ quantityChange }),
      }),
    delete: (id: string) =>
      apiFetch<any>(`/products/${id}`, { method: 'DELETE' }),
  },
  
  // Sales
  sales: {
    list: (branchId?: string) =>
      apiFetch<any[]>(`/sales${branchId ? `?branchId=${branchId}` : ''}`),
    create: (data: any) =>
      apiFetch<any>('/sales', { method: 'POST', body: JSON.stringify(data) }),
    generateInvoiceNumber: (branchCode: string) =>
      apiFetch<{ invoiceNumber: string }>(`/sales/generate-invoice-number/${branchCode}`),
  },
  
  // Clients
  clients: {
    list: () => apiFetch<any[]>('/clients'),
    create: (data: any) =>
      apiFetch<any>('/clients', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) =>
      apiFetch<any>(`/clients/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) =>
      apiFetch<any>(`/clients/${id}`, { method: 'DELETE' }),
  },
  
  // Categories
  categories: {
    list: () => apiFetch<any[]>('/categories'),
    create: (data: any) =>
      apiFetch<any>('/categories', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) =>
      apiFetch<any>(`/categories/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) =>
      apiFetch<any>(`/categories/${id}`, { method: 'DELETE' }),
  },
  
  // Suppliers
  suppliers: {
    list: () => apiFetch<any[]>('/suppliers'),
    create: (data: any) =>
      apiFetch<any>('/suppliers', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) =>
      apiFetch<any>(`/suppliers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) =>
      apiFetch<any>(`/suppliers/${id}`, { method: 'DELETE' }),
  },
  
  // Daily Reports
  dailyReports: {
    list: (branchId?: string) =>
      apiFetch<any[]>(`/daily-reports${branchId ? `?branchId=${branchId}` : ''}`),
    generate: (branchId: string, date: string) =>
      apiFetch<any>('/daily-reports/generate', {
        method: 'POST',
        body: JSON.stringify({ branchId, date }),
      }),
    close: (id: string, data: { closingBalance: number; notes: string; closedBy: string }) =>
      apiFetch<any>(`/daily-reports/${id}/close`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  },
  
  // Stock Transfers
  stockTransfers: {
    list: (branchId?: string) =>
      apiFetch<any[]>(`/stock-transfers${branchId ? `?branchId=${branchId}` : ''}`),
    create: (data: any) =>
      apiFetch<any>('/stock-transfers', { method: 'POST', body: JSON.stringify(data) }),
    approve: (id: string, approvedBy: string) =>
      apiFetch<any>(`/stock-transfers/${id}/approve`, {
        method: 'POST',
        body: JSON.stringify({ approvedBy }),
      }),
    receive: (id: string, receivedBy: string, receivedQuantities?: Record<string, number>) =>
      apiFetch<any>(`/stock-transfers/${id}/receive`, {
        method: 'POST',
        body: JSON.stringify({ receivedBy, receivedQuantities }),
      }),
  },
  
  // Purchase Orders
  purchaseOrders: {
    list: (branchId?: string) =>
      apiFetch<any[]>(`/purchase-orders${branchId ? `?branchId=${branchId}` : ''}`),
    create: (data: any) =>
      apiFetch<any>('/purchase-orders', { method: 'POST', body: JSON.stringify(data) }),
    approve: (id: string, approvedBy: string) =>
      apiFetch<any>(`/purchase-orders/${id}/approve`, {
        method: 'POST',
        body: JSON.stringify({ approvedBy }),
      }),
      receive: (id: string, receivedBy: string, receivedQuantities: Record<string, number>) =>
      apiFetch<any>(`/purchase-orders/${id}/receive`, {
        method: 'POST',
        body: JSON.stringify({ receivedBy, receivedQuantities }),
      }),
  },
  
  // Chart of Accounts
  chartOfAccounts: {
    list: () => apiFetch<any[]>('/chart-of-accounts'),
    get: (id: string) => apiFetch<any>(`/chart-of-accounts/${id}`),
    getByType: (type: string) => apiFetch<any[]>(`/chart-of-accounts/type/${type}`),
    getChildren: (id: string) => apiFetch<any[]>(`/chart-of-accounts/${id}/children`),
    getBalance: (id: string, startDate?: string, endDate?: string) => {
      const params = new URLSearchParams();
      if (startDate) params.append('start_date', startDate);
      if (endDate) params.append('end_date', endDate);
      return apiFetch<any>(`/chart-of-accounts/${id}/balance?${params}`);
    },
    getTrialBalance: (startDate?: string, endDate?: string) => {
      const params = new URLSearchParams();
      if (startDate) params.append('start_date', startDate);
      if (endDate) params.append('end_date', endDate);
      return apiFetch<any[]>(`/chart-of-accounts/reports/trial-balance?${params}`);
    },
    create: (data: any) =>
      apiFetch<any>('/chart-of-accounts', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) =>
      apiFetch<any>(`/chart-of-accounts/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) =>
      apiFetch<any>(`/chart-of-accounts/${id}`, { method: 'DELETE' }),
  },

  // Journal Entries
  journalEntries: {
    list: (params?: { branchId?: string; referenceType?: string; startDate?: string; endDate?: string }) => {
      const searchParams = new URLSearchParams();
      if (params?.branchId) searchParams.append('branchId', params.branchId);
      if (params?.referenceType) searchParams.append('referenceType', params.referenceType);
      if (params?.startDate) searchParams.append('startDate', params.startDate);
      if (params?.endDate) searchParams.append('endDate', params.endDate);
      return apiFetch<any[]>(`/journal-entries?${searchParams}`);
    },
    get: (id: string) => apiFetch<any>(`/journal-entries/${id}`),
    getByReference: (type: string, id: string) => 
      apiFetch<any[]>(`/journal-entries/reference/${type}/${id}`),
    summary: (params?: { branchId?: string; startDate?: string; endDate?: string }) => {
      const searchParams = new URLSearchParams();
      if (params?.branchId) searchParams.append('branchId', params.branchId);
      if (params?.startDate) searchParams.append('startDate', params.startDate);
      if (params?.endDate) searchParams.append('endDate', params.endDate);
      return apiFetch<any[]>(`/journal-entries/reports/summary?${searchParams}`);
    },
  },
};
