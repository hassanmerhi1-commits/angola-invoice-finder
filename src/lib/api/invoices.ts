// Simulated Invoice API - Ready for backend migration
import { Sale } from '@/types/erp';
import { saveSale, generateInvoiceNumber } from '@/lib/storage';

export interface CreateInvoiceRequest {
  company: {
    name: string;
    nif: string;
    address: string;
  };
  customer: {
    name: string;
    nif: string;
  };
  invoice: {
    date: string;
    items: {
      description: string;
      quantity: number;
      unit_price: number;
      vat_rate: number;
    }[];
  };
}

export interface CreateInvoiceResponse {
  status: 'pending_agt' | 'error';
  invoice_id: string;
  invoice_number: string;
  subtotal: number;
  vat: number;
  total: number;
  error?: string;
}

export interface AGTValidationResponse {
  status: 'validated' | 'rejected' | 'error';
  agt_code: string;
  timestamp: string;
  error?: string;
}

// Validate NIF Angola (simplified validation)
export function validateNIF(nif: string): { valid: boolean; error?: string } {
  if (!nif || nif.trim() === '') {
    return { valid: false, error: 'NIF é obrigatório' };
  }
  
  const cleanNif = nif.replace(/\s/g, '');
  
  // Angola NIF: 10 digits, starts with 5
  if (!/^\d{10}$/.test(cleanNif)) {
    return { valid: false, error: 'NIF deve ter 10 dígitos' };
  }
  
  if (!cleanNif.startsWith('5')) {
    return { valid: false, error: 'NIF de empresa deve começar com 5' };
  }
  
  return { valid: true };
}

// Calculate invoice totals
export function calculateInvoiceTotals(items: CreateInvoiceRequest['invoice']['items']) {
  let subtotal = 0;
  let totalVat = 0;
  
  for (const item of items) {
    const lineTotal = item.quantity * item.unit_price;
    const lineVat = lineTotal * (item.vat_rate / 100);
    subtotal += lineTotal;
    totalVat += lineVat;
  }
  
  return {
    subtotal: Math.round(subtotal * 100) / 100,
    vat: Math.round(totalVat * 100) / 100,
    total: Math.round((subtotal + totalVat) * 100) / 100
  };
}

// POST /api/invoices - Create Invoice
export async function createInvoice(
  request: CreateInvoiceRequest,
  branchId: string,
  branchCode: string,
  userId: string
): Promise<CreateInvoiceResponse> {
  // Validate company NIF
  const companyNifValidation = validateNIF(request.company.nif);
  if (!companyNifValidation.valid) {
    return {
      status: 'error',
      invoice_id: '',
      invoice_number: '',
      subtotal: 0,
      vat: 0,
      total: 0,
      error: `NIF da empresa inválido: ${companyNifValidation.error}`
    };
  }
  
  // Validate customer NIF if provided
  if (request.customer.nif) {
    const customerNifValidation = validateNIF(request.customer.nif);
    if (!customerNifValidation.valid) {
      return {
        status: 'error',
        invoice_id: '',
        invoice_number: '',
        subtotal: 0,
        vat: 0,
        total: 0,
        error: `NIF do cliente inválido: ${customerNifValidation.error}`
      };
    }
  }
  
  // Validate items
  if (!request.invoice.items || request.invoice.items.length === 0) {
    return {
      status: 'error',
      invoice_id: '',
      invoice_number: '',
      subtotal: 0,
      vat: 0,
      total: 0,
      error: 'A factura deve ter pelo menos um item'
    };
  }
  
  // Calculate totals
  const totals = calculateInvoiceTotals(request.invoice.items);
  
  // Generate invoice number
  const invoiceNumber = generateInvoiceNumber(branchCode);
  const invoiceId = `INV-${Date.now()}`;
  
  // Create sale record
  const sale: Sale = {
    id: invoiceId,
    branchId,
    invoiceNumber,
    items: request.invoice.items.map((item, index) => ({
      productId: `manual-${index}`,
      productName: item.description,
      sku: `MAN-${index}`,
      quantity: item.quantity,
      unitPrice: item.unit_price,
      discount: 0,
      taxRate: item.vat_rate,
      subtotal: item.quantity * item.unit_price,
      taxAmount: (item.quantity * item.unit_price) * (item.vat_rate / 100)
    })),
    subtotal: totals.subtotal,
    taxAmount: totals.vat,
    discount: 0,
    total: totals.total,
    paymentMethod: 'cash',
    amountPaid: totals.total,
    change: 0,
    status: 'pending',
    cashierId: userId,
    cashierName: 'Sistema',
    customerName: request.customer.name || undefined,
    customerNif: request.customer.nif || undefined,
    createdAt: request.invoice.date || new Date().toISOString(),
    agtStatus: 'pending'
  };
  
  // Save to storage
  saveSale(sale);
  
  return {
    status: 'pending_agt',
    invoice_id: invoiceId,
    invoice_number: invoiceNumber,
    subtotal: totals.subtotal,
    vat: totals.vat,
    total: totals.total
  };
}

// POST /api/agt/send - Send to AGT (simulated)
export async function sendToAGT(invoiceId: string): Promise<AGTValidationResponse> {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Get invoice from storage
  const sales = JSON.parse(localStorage.getItem('kwanza_sales') || '[]') as Sale[];
  const saleIndex = sales.findIndex(s => s.id === invoiceId);
  
  if (saleIndex === -1) {
    return {
      status: 'error',
      agt_code: '',
      timestamp: new Date().toISOString(),
      error: 'Factura não encontrada'
    };
  }
  
  // Generate AGT code (simulated)
  const agtCode = `AGT-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
  const timestamp = new Date().toISOString();
  
  // Update sale with AGT validation
  sales[saleIndex] = {
    ...sales[saleIndex],
    status: 'completed',
    agtStatus: 'validated',
    agtCode,
    agtValidatedAt: timestamp
  };
  
  localStorage.setItem('kwanza_sales', JSON.stringify(sales));
  
  return {
    status: 'validated',
    agt_code: agtCode,
    timestamp
  };
}

// GET /api/agt/status - Check AGT status
export function getAGTStatus(invoiceId: string): { 
  status: 'pending' | 'validated' | 'rejected' | 'not_found';
  agtCode?: string;
  validatedAt?: string;
} {
  const sales = JSON.parse(localStorage.getItem('kwanza_sales') || '[]') as Sale[];
  const sale = sales.find(s => s.id === invoiceId);
  
  if (!sale) {
    return { status: 'not_found' };
  }
  
  if (sale.agtStatus === 'validated' && sale.agtCode) {
    return {
      status: 'validated',
      agtCode: sale.agtCode,
      validatedAt: sale.agtValidatedAt
    };
  }
  
  return { status: sale.agtStatus || 'pending' };
}
