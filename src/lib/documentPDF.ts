// Kwanza ERP - A4 Document PDF Generator
// Generates professional A4 invoices, receipts, proformas for all document types

import { ERPDocument, DOCUMENT_TYPE_CONFIG, DocumentLine } from '@/types/documents';
import { getCompanySettings } from '@/lib/companySettings';

interface PDFOptions {
  showQR?: boolean;
  showTerms?: boolean;
  copies?: number;
}

function formatCurrency(value: number): string {
  return `${value.toLocaleString('pt-AO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Kz`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

export function generateDocumentHTML(doc: ERPDocument, options: PDFOptions = {}): string {
  const config = DOCUMENT_TYPE_CONFIG[doc.documentType];
  const company = getCompanySettings();
  
  const entityLabel = config.entityType === 'customer' ? 'Cliente' : 'Fornecedor';

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  @page { size: A4; margin: 15mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 10px; color: #222; line-height: 1.4; }
  
  .header { display: flex; justify-content: space-between; border-bottom: 3px solid #1a1a2e; padding-bottom: 12px; margin-bottom: 16px; }
  .company-info h1 { font-size: 18px; font-weight: 800; color: #1a1a2e; }
  .company-info p { font-size: 9px; color: #555; margin-top: 2px; }
  .doc-info { text-align: right; }
  .doc-type { font-size: 16px; font-weight: 800; color: #1a1a2e; text-transform: uppercase; }
  .doc-number { font-size: 12px; font-weight: 600; color: #555; margin-top: 4px; }
  .doc-date { font-size: 9px; color: #777; margin-top: 2px; }
  
  .entity-box { background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 4px; padding: 10px; margin-bottom: 16px; }
  .entity-box .label { font-size: 8px; text-transform: uppercase; color: #888; font-weight: 600; letter-spacing: 0.5px; }
  .entity-box .name { font-size: 12px; font-weight: 700; margin-top: 2px; }
  .entity-box .detail { font-size: 9px; color: #555; margin-top: 1px; }
  
  .lines-table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
  .lines-table th { background: #1a1a2e; color: white; padding: 6px 8px; text-align: left; font-size: 8px; text-transform: uppercase; font-weight: 600; letter-spacing: 0.3px; }
  .lines-table th.right { text-align: right; }
  .lines-table td { padding: 5px 8px; border-bottom: 1px solid #eee; font-size: 9px; }
  .lines-table td.right { text-align: right; font-family: 'Courier New', monospace; }
  .lines-table td.center { text-align: center; }
  .lines-table tr:nth-child(even) { background: #fafafa; }
  .lines-table tfoot td { border-top: 2px solid #1a1a2e; font-weight: 700; padding: 6px 8px; }
  
  .totals-box { display: flex; justify-content: flex-end; margin-bottom: 16px; }
  .totals-inner { width: 250px; }
  .totals-row { display: flex; justify-content: space-between; padding: 3px 0; font-size: 9px; }
  .totals-row.total { border-top: 2px solid #1a1a2e; margin-top: 4px; padding-top: 6px; font-size: 12px; font-weight: 800; }
  .totals-row .label { color: #555; }
  .totals-row .value { font-family: 'Courier New', monospace; font-weight: 600; }
  
  .footer { border-top: 1px solid #ddd; padding-top: 10px; margin-top: 20px; }
  .footer-grid { display: flex; gap: 20px; }
  .footer-col { flex: 1; }
  .footer-col h4 { font-size: 8px; text-transform: uppercase; color: #888; font-weight: 600; margin-bottom: 4px; }
  .footer-col p { font-size: 8px; color: #555; }
  
  .signatures { display: flex; justify-content: space-between; margin-top: 40px; }
  .sig-line { width: 200px; border-top: 1px solid #999; padding-top: 4px; font-size: 8px; color: #777; text-align: center; }
  
  .notes-box { background: #f0f0f0; border-radius: 4px; padding: 8px; margin-top: 12px; font-size: 8px; color: #555; }
  
  .watermark { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-30deg); font-size: 60px; color: rgba(0,0,0,0.03); font-weight: 900; pointer-events: none; }
  
  .qr-placeholder { width: 80px; height: 80px; border: 1px solid #ddd; display: flex; align-items: center; justify-content: center; font-size: 7px; color: #999; }
  
  .status-badge { display: inline-block; padding: 2px 8px; border-radius: 3px; font-size: 8px; font-weight: 700; text-transform: uppercase; }
  .status-confirmed { background: #d4edda; color: #155724; }
  .status-draft { background: #fff3cd; color: #856404; }
  .status-cancelled { background: #f8d7da; color: #721c24; }
  .status-paid { background: #cce5ff; color: #004085; }
</style>
</head>
<body>
  <div class="watermark">${config.shortLabel}</div>
  
  <!-- HEADER -->
  <div class="header">
    <div class="company-info">
      <h1>${company.name || company.tradeName || 'Kwanza ERP'}</h1>
      <p>${company.address || ''}</p>
      <p>NIF: ${company.nif || ''} ${company.phone ? '| Tel: ' + company.phone : ''}</p>
      <p>${company.email || ''}</p>
    </div>
    <div class="doc-info">
      <div class="doc-type">${config.label}</div>
      <div class="doc-number">${doc.documentNumber}</div>
      <div class="doc-date">Data: ${formatDate(doc.issueDate)}</div>
      ${doc.dueDate ? `<div class="doc-date">Vencimento: ${formatDate(doc.dueDate)}</div>` : ''}
      ${doc.validUntil ? `<div class="doc-date">Válido até: ${formatDate(doc.validUntil)}</div>` : ''}
      <span class="status-badge status-${doc.status}">${doc.status}</span>
    </div>
  </div>
  
  <!-- ENTITY -->
  <div class="entity-box">
    <div class="label">${entityLabel}</div>
    <div class="name">${doc.entityName}</div>
    ${doc.entityNif ? `<div class="detail">NIF: ${doc.entityNif}</div>` : ''}
    ${doc.entityAddress ? `<div class="detail">${doc.entityAddress}</div>` : ''}
    ${doc.entityPhone ? `<div class="detail">Tel: ${doc.entityPhone}</div>` : ''}
  </div>
  
  ${doc.parentDocumentNumber ? `
  <div style="margin-bottom: 12px; font-size: 9px; color: #555;">
    <strong>Documento de Origem:</strong> ${doc.parentDocumentNumber}
  </div>
  ` : ''}
  
  <!-- LINE ITEMS -->
  <table class="lines-table">
    <thead>
      <tr>
        <th style="width: 30px">#</th>
        <th style="width: 60px">Código</th>
        <th>Descrição</th>
        <th class="right" style="width: 40px">Qtd</th>
        <th class="right" style="width: 80px">Preço Unit.</th>
        <th class="right" style="width: 40px">Desc%</th>
        <th class="right" style="width: 40px">IVA%</th>
        <th class="right" style="width: 70px">IVA</th>
        <th class="right" style="width: 80px">Total</th>
      </tr>
    </thead>
    <tbody>
      ${doc.lines.map((line, i) => `
      <tr>
        <td class="center">${i + 1}</td>
        <td>${line.productSku || ''}</td>
        <td>${line.description}</td>
        <td class="right">${line.quantity}</td>
        <td class="right">${formatCurrency(line.unitPrice)}</td>
        <td class="right">${line.discount > 0 ? line.discount + '%' : ''}</td>
        <td class="right">${line.taxRate}%</td>
        <td class="right">${formatCurrency(line.taxAmount)}</td>
        <td class="right"><strong>${formatCurrency(line.lineTotal)}</strong></td>
      </tr>
      `).join('')}
    </tbody>
  </table>
  
  <!-- TOTALS -->
  <div class="totals-box">
    <div class="totals-inner">
      <div class="totals-row"><span class="label">Subtotal:</span><span class="value">${formatCurrency(doc.subtotal)}</span></div>
      ${doc.totalDiscount > 0 ? `<div class="totals-row"><span class="label">Desconto:</span><span class="value">-${formatCurrency(doc.totalDiscount)}</span></div>` : ''}
      <div class="totals-row"><span class="label">IVA:</span><span class="value">${formatCurrency(doc.totalTax)}</span></div>
      <div class="totals-row total"><span class="label">TOTAL:</span><span class="value">${formatCurrency(doc.total)}</span></div>
      ${doc.amountPaid > 0 ? `
        <div class="totals-row"><span class="label">Valor Pago:</span><span class="value">${formatCurrency(doc.amountPaid)}</span></div>
        <div class="totals-row"><span class="label">Em Dívida:</span><span class="value">${formatCurrency(doc.amountDue)}</span></div>
      ` : ''}
    </div>
  </div>
  
  ${doc.notes ? `<div class="notes-box"><strong>Observações:</strong> ${doc.notes}</div>` : ''}
  
  <!-- FOOTER -->
  <div class="footer">
    <div class="footer-grid">
      <div class="footer-col">
        <h4>Processado por</h4>
        <p>${doc.createdByName || doc.createdBy}</p>
        <p>${formatDate(doc.createdAt)}</p>
      </div>
      <div class="footer-col">
        <h4>Filial</h4>
        <p>${doc.branchName}</p>
      </div>
      ${options.showQR ? `
      <div class="footer-col" style="text-align: right;">
        <div class="qr-placeholder">QR AGT</div>
      </div>
      ` : ''}
    </div>
    
    <div class="signatures">
      <div class="sig-line">O Emitente</div>
      <div class="sig-line">O ${entityLabel}</div>
    </div>
  </div>
  
  <div style="text-align: center; margin-top: 20px; font-size: 7px; color: #aaa;">
    Documento gerado por ${company.tradeName || company.name || 'Kwanza ERP'} — Software de Gestão Empresarial
  </div>
</body>
</html>`;
}

// Open print preview in a new window
export function printDocument(doc: ERPDocument, options: PDFOptions = {}) {
  const html = generateDocumentHTML(doc, { showQR: true, ...options });
  const printWindow = window.open('', '_blank', 'width=800,height=1100');
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 500);
  }
}

// Download as HTML (can be opened and printed to PDF)
export function downloadDocumentHTML(doc: ERPDocument) {
  const html = generateDocumentHTML(doc, { showQR: true, showTerms: true });
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${doc.documentNumber}.html`;
  a.click();
  URL.revokeObjectURL(url);
}
