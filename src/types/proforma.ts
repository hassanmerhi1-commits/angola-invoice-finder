// Pro Forma (Orçamento) Types for Kwanza ERP

export interface ProFormaItem {
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  taxRate: number;
  taxAmount: number;
  subtotal: number;
}

export interface ProForma {
  id: string;
  documentNumber: string; // OR BRANCH/DATE/SEQUENCE
  branchId: string;
  branchName: string;
  
  // Customer
  customerName: string;
  customerNif?: string;
  customerEmail?: string;
  customerPhone?: string;
  customerAddress?: string;
  
  // Items and totals
  items: ProFormaItem[];
  subtotal: number;
  taxAmount: number;
  discount: number;
  total: number;
  
  // Validity
  validUntil: string;
  
  // Status
  status: 'draft' | 'sent' | 'accepted' | 'rejected' | 'converted' | 'expired';
  
  // Conversion tracking
  convertedToInvoiceId?: string;
  convertedToInvoiceNumber?: string;
  convertedAt?: string;
  
  // Notes
  notes?: string;
  termsAndConditions?: string;
  
  // Audit
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}
