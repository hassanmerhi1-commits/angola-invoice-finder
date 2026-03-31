// Document storage using localStorage (will route to SQLite in Electron)
import { ERPDocument, DocumentType, DocumentStatus, DocumentLine, generateDocumentNumber, DOCUMENT_TYPE_CONFIG } from '@/types/documents';

const STORAGE_KEY = 'kwanzaerp_documents';

function getAll(): ERPDocument[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch { return []; }
}

function saveAll(docs: ERPDocument[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(docs));
}

export function getDocuments(type?: DocumentType, branchId?: string): ERPDocument[] {
  let docs = getAll();
  if (type) docs = docs.filter(d => d.documentType === type);
  if (branchId) docs = docs.filter(d => d.branchId === branchId);
  return docs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function getDocumentById(id: string): ERPDocument | undefined {
  return getAll().find(d => d.id === id);
}

export function getNextSequence(type: DocumentType, branchId: string): number {
  const docs = getAll().filter(d => d.documentType === type && d.branchId === branchId);
  return docs.length + 1;
}

export function saveDocument(doc: ERPDocument): ERPDocument {
  const docs = getAll();
  const idx = docs.findIndex(d => d.id === doc.id);
  if (idx >= 0) {
    docs[idx] = { ...doc, updatedAt: new Date().toISOString() };
  } else {
    docs.push(doc);
  }
  saveAll(docs);
  return doc;
}

export function createDocument(
  type: DocumentType,
  branchId: string,
  branchCode: string,
  branchName: string,
  createdBy: string,
  createdByName: string,
  data: Partial<ERPDocument>
): ERPDocument {
  const seq = getNextSequence(type, branchId);
  const now = new Date().toISOString();
  
  const doc: ERPDocument = {
    id: `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    documentType: type,
    documentNumber: generateDocumentNumber(type, branchCode, seq),
    branchId,
    branchName,
    entityType: DOCUMENT_TYPE_CONFIG[type].entityType,
    entityName: data.entityName || 'Consumidor Final',
    entityNif: data.entityNif,
    entityAddress: data.entityAddress,
    entityPhone: data.entityPhone,
    entityEmail: data.entityEmail,
    entityId: data.entityId,
    lines: data.lines || [],
    subtotal: data.subtotal || 0,
    totalDiscount: data.totalDiscount || 0,
    totalTax: data.totalTax || 0,
    total: data.total || 0,
    currency: 'AOA',
    paymentMethod: data.paymentMethod,
    amountPaid: data.amountPaid || 0,
    amountDue: data.amountDue || data.total || 0,
    parentDocumentId: data.parentDocumentId,
    parentDocumentNumber: data.parentDocumentNumber,
    parentDocumentType: data.parentDocumentType,
    status: data.status || 'draft',
    issueDate: data.issueDate || now,
    issueTime: data.issueTime || new Date().toLocaleTimeString('pt-AO', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    dueDate: data.dueDate,
    validUntil: data.validUntil,
    notes: data.notes,
    internalNotes: data.internalNotes,
    termsAndConditions: data.termsAndConditions,
    createdBy,
    createdByName,
    createdAt: now,
    updatedAt: now,
  };

  return saveDocument(doc);
}

export function convertDocument(
  sourceId: string,
  targetType: DocumentType,
  branchCode: string,
  createdBy: string,
  createdByName: string
): ERPDocument | null {
  const source = getDocumentById(sourceId);
  if (!source) return null;

  const config = DOCUMENT_TYPE_CONFIG[source.documentType];
  if (!config.canConvertTo.includes(targetType)) return null;

  // Create new document from source
  const newDoc = createDocument(
    targetType,
    source.branchId,
    branchCode,
    source.branchName,
    createdBy,
    createdByName,
    {
      entityName: source.entityName,
      entityNif: source.entityNif,
      entityAddress: source.entityAddress,
      entityPhone: source.entityPhone,
      entityEmail: source.entityEmail,
      entityId: source.entityId,
      lines: source.lines.map(l => ({ ...l, id: `line_${Date.now()}_${Math.random().toString(36).substr(2, 5)}` })),
      subtotal: source.subtotal,
      totalDiscount: source.totalDiscount,
      totalTax: source.totalTax,
      total: source.total,
      parentDocumentId: source.id,
      parentDocumentNumber: source.documentNumber,
      parentDocumentType: source.documentType,
      status: 'confirmed',
    }
  );

  // Update source status
  source.status = 'converted';
  source.childDocuments = [
    ...(source.childDocuments || []),
    { id: newDoc.id, number: newDoc.documentNumber, type: targetType }
  ];
  saveDocument(source);

  return newDoc;
}

export function calculateLineTotals(line: Partial<DocumentLine>): DocumentLine {
  const qty = line.quantity || 0;
  const price = line.unitPrice || 0;
  const discPct = line.discount || 0;
  const taxRate = line.taxRate || 0;

  const gross = qty * price;
  const discountAmount = gross * (discPct / 100);
  const afterDiscount = gross - discountAmount;
  const taxAmount = afterDiscount * (taxRate / 100);
  const lineTotal = afterDiscount + taxAmount;

  return {
    id: line.id || `line_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    productId: line.productId,
    productSku: line.productSku,
    description: line.description || '',
    quantity: qty,
    unitPrice: price,
    discount: discPct,
    discountAmount: Math.round(discountAmount * 100) / 100,
    taxRate,
    taxAmount: Math.round(taxAmount * 100) / 100,
    lineTotal: Math.round(lineTotal * 100) / 100,
    accountCode: line.accountCode,
  };
}

export function calculateDocumentTotals(lines: DocumentLine[]) {
  const subtotal = lines.reduce((s, l) => s + (l.quantity * l.unitPrice), 0);
  const totalDiscount = lines.reduce((s, l) => s + l.discountAmount, 0);
  const totalTax = lines.reduce((s, l) => s + l.taxAmount, 0);
  const total = lines.reduce((s, l) => s + l.lineTotal, 0);
  return {
    subtotal: Math.round(subtotal * 100) / 100,
    totalDiscount: Math.round(totalDiscount * 100) / 100,
    totalTax: Math.round(totalTax * 100) / 100,
    total: Math.round(total * 100) / 100,
  };
}
