import { useState, useMemo, useCallback, useEffect } from 'react';
import { generateId } from '@/lib/utils';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useProducts, useSuppliers, useAuth } from '@/hooks/useERP';
import { useBranchContext } from '@/contexts/BranchContext';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import {
  PurchaseInvoice,
  PurchaseInvoiceLine,
  PurchaseInvoiceJournalLine,
  calculateLine,
  calculateInvoiceTotals,
  getPurchaseInvoices,
  savePurchaseInvoice,
  generatePurchaseInvoiceNumber,
} from '@/lib/purchaseInvoiceStorage';
import { processTransaction } from '@/lib/transactionEngine';
import { ensureSupplierAccount } from '@/lib/chartOfAccountsEngine';
import { Supplier, Product } from '@/types/erp';
import { ProductDetailDialog } from '@/components/inventory/ProductDetailDialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Search, Plus, Save, X, Trash2, Eye, FileText, BookOpen,
  Package, ArrowLeft, CheckCircle, Printer, AlertCircle,
  ShoppingCart, Filter, Calendar, Download,
} from 'lucide-react';
import { saveDocument, getDocuments } from '@/lib/documentStorage';
import type { ERPDocument } from '@/types/documents';
import { usePurchaseOrders } from '@/hooks/useERP';

// ─────────── Supplier Picker Dialog ───────────
function SupplierPickerDialog({
  open, onClose, suppliers, onSelect, onCreateNew, onRefresh,
}: {
  open: boolean;
  onClose: () => void;
  suppliers: Supplier[];
  onSelect: (s: Supplier) => void;
  onCreateNew?: () => void;
  onRefresh?: () => void;
}) {
  // Auto-refresh when dialog opens
  useEffect(() => {
    if (open && onRefresh) onRefresh();
  }, [open, onRefresh]);
  const [search, setSearch] = useState('');
  const filtered = useMemo(() => {
    if (!search) return suppliers;
    const q = search.toLowerCase();
    return suppliers.filter(s =>
      s.name.toLowerCase().includes(q) ||
      s.nif?.toLowerCase().includes(q) ||
      s.phone?.toLowerCase().includes(q)
    );
  }, [suppliers, search]);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Listagem de Contas — Fornecedores</DialogTitle>
        </DialogHeader>
        <Input
          placeholder="Pesquisar fornecedor..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          autoFocus
        />
        {onCreateNew && (
          <Button variant="outline" size="sm" className="w-full gap-1" onClick={onCreateNew}>
            <Plus className="h-4 w-4" /> Criar Novo Fornecedor
          </Button>
        )}
        <ScrollArea className="h-[400px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Conta</TableHead>
                <TableHead>Nome de Conta</TableHead>
                <TableHead>NIF</TableHead>
                <TableHead>Tel</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(s => (
                <TableRow
                  key={s.id}
                  className="cursor-pointer hover:bg-accent"
                  onClick={() => { onSelect(s); onClose(); }}
                >
                  <TableCell className="font-mono text-xs">{s.nif || '—'}</TableCell>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell className="text-xs">{s.nif || 'Desconhecido'}</TableCell>
                  <TableCell className="text-xs">{s.phone || '—'}</TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    Nenhum fornecedor encontrado
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

async function syncPurchaseInvoiceDocument(invoice: PurchaseInvoice) {
  const lines = invoice.lines.map(line => {
    const gross = line.totalQty * line.unitPrice;
    const discountAmount = Math.max(gross - line.total, 0);
    const discount = gross > 0 ? (discountAmount / gross) * 100 : 0;

    return {
      id: line.id,
      productId: line.productId || undefined,
      productSku: line.productCode,
      description: line.description,
      quantity: line.totalQty,
      unit: line.unit,
      unitPrice: line.unitPrice,
      discount: Math.round(discount * 100) / 100,
      discountAmount: Math.round(discountAmount * 100) / 100,
      taxRate: line.ivaRate,
      taxAmount: line.ivaAmount,
      lineTotal: line.totalWithIva,
      accountCode: invoice.purchaseAccountCode,
    };
  });

  const document: ERPDocument = {
    id: invoice.id,
    documentType: 'fatura_compra',
    documentNumber: invoice.invoiceNumber,
    branchId: invoice.branchId,
    branchName: invoice.branchName,
    entityType: 'supplier',
    entityName: invoice.supplierName,
    entityNif: invoice.supplierNif,
    entityPhone: invoice.supplierPhone,
    entityCode: invoice.supplierAccountCode || undefined,
    paymentCondition: invoice.paymentDate ? `Pagamento até ${invoice.paymentDate}` : undefined,
    lines,
    subtotal: invoice.subtotal,
    totalDiscount: lines.reduce((sum, line) => sum + line.discountAmount, 0),
    totalTax: invoice.ivaTotal,
    total: invoice.total,
    currency: invoice.currency === 'KZ' ? 'AOA' : invoice.currency,
    amountPaid: 0,
    amountDue: invoice.total,
    accountCode: invoice.supplierAccountCode,
    status: 'confirmed',
    issueDate: invoice.date,
    issueTime: invoice.createdAt.includes('T') ? invoice.createdAt.split('T')[1].slice(0, 8) : new Date().toTimeString().slice(0, 8),
    dueDate: invoice.paymentDate,
    notes: invoice.extraNote,
    internalNotes: invoice.supplierInvoiceNo ? `Nº Fatura Fornecedor: ${invoice.supplierInvoiceNo}` : undefined,
    createdBy: invoice.createdBy,
    createdByName: invoice.createdByName,
    createdAt: invoice.createdAt,
    updatedAt: invoice.updatedAt,
    confirmedBy: invoice.createdBy,
    confirmedAt: invoice.updatedAt,
  };

  await saveDocument(document);
}

// ─────────── Product Picker Dialog ───────────
function ProductPickerDialog({
  open, onClose, products, onSelect, onCreateNew,
}: {
  open: boolean;
  onClose: () => void;
  products: Product[];
  onSelect: (p: Product) => void;
  onCreateNew: () => void;
}) {
  const [search, setSearch] = useState('');
  const filtered = useMemo(() => {
    if (!search) return products.slice(0, 100);
    const q = search.toLowerCase();
    return products.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q) ||
      p.barcode?.toLowerCase().includes(q)
    ).slice(0, 100);
  }, [products, search]);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Lista de Produtos</span>
            <Button variant="outline" size="sm" className="gap-1" onClick={() => { onClose(); onCreateNew(); }}>
              <Plus className="h-4 w-4" /> Novo Produto
            </Button>
          </DialogTitle>
        </DialogHeader>
        <Input
          placeholder="Pesquisar produto por nome, SKU ou código de barras..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          autoFocus
        />
        <ScrollArea className="h-[400px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produto</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead className="text-right">Preço</TableHead>
                <TableHead className="text-right">Stock</TableHead>
                <TableHead className="text-right">IVA</TableHead>
                <TableHead>Unidade</TableHead>
                <TableHead>Categoria</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(p => (
                <TableRow
                  key={p.id}
                  className="cursor-pointer hover:bg-accent"
                  onClick={() => { onSelect(p); onClose(); }}
                >
                  <TableCell className="font-mono text-xs">{p.sku}</TableCell>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell className="text-right font-mono">
                    {(p.cost || p.price || 0).toLocaleString('pt-AO')}
                  </TableCell>
                  <TableCell className="text-right">{p.stock}</TableCell>
                  <TableCell className="text-right">{p.taxRate}%</TableCell>
                  <TableCell>{p.unit || 'UN'}</TableCell>
                  <TableCell className="text-xs">{p.category}</TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    Nenhum produto encontrado
                    <br />
                    <Button variant="link" size="sm" className="mt-2 gap-1" onClick={() => { onClose(); onCreateNew(); }}>
                      <Plus className="h-4 w-4" /> Criar novo produto
                    </Button>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

// ─────────── Account Picker Dialog ───────────
function AccountPickerDialog({
  open, onClose, onSelect,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (code: string, name: string) => void;
}) {
  const [search, setSearch] = useState('');
  const accounts = useMemo(() => {
    try {
      const data = localStorage.getItem('kwanzaerp_chart_of_accounts');
      const all: Array<{ code: string; name: string; is_active: boolean }> = data ? JSON.parse(data) : [];
      return all.filter(a => a.is_active !== false).sort((a, b) => a.code.localeCompare(b.code));
    } catch { return []; }
  }, []);

  const filtered = useMemo(() => {
    if (!search) return accounts;
    const q = search.toLowerCase();
    return accounts.filter(a =>
      a.code.toLowerCase().includes(q) || a.name.toLowerCase().includes(q)
    );
  }, [accounts, search]);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-xl max-h-[70vh]">
        <DialogHeader>
          <DialogTitle>Pesquisar Conta</DialogTitle>
        </DialogHeader>
        <Input placeholder="Pesquisar por código ou nome..." value={search} onChange={e => setSearch(e.target.value)} autoFocus />
        <ScrollArea className="h-[350px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>No. de Conta</TableHead>
                <TableHead>Nome de Conta</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(a => (
                <TableRow key={a.code} className="cursor-pointer hover:bg-accent" onClick={() => { onSelect(a.code, a.name); onClose(); }}>
                  <TableCell className="font-mono">{a.code}</TableCell>
                  <TableCell>{a.name}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

function buildPurchaseInvoiceJournalLines({
  documentId,
  invoiceNumber,
  currency,
  purchaseAccountCode,
  ivaAccountCode,
  supplierAccountCode,
  supplierName,
  subtotal,
  ivaTotal,
  supplierTotal,
  landingCosts,
  freightSourceAccount,
  freightSourceName,
  manualLines,
}: {
  documentId: string;
  invoiceNumber: string;
  currency: string;
  purchaseAccountCode: string;
  ivaAccountCode: string;
  supplierAccountCode: string;
  supplierName: string;
  subtotal: number;
  ivaTotal: number;
  supplierTotal: number;
  landingCosts: number;
  freightSourceAccount: string;
  freightSourceName: string;
  manualLines: PurchaseInvoiceJournalLine[];
}): PurchaseInvoiceJournalLine[] {
  const postedLines: PurchaseInvoiceJournalLine[] = [];
  let autoIndex = 0;
  const nextId = (suffix: string) => `${documentId}_${suffix}_${++autoIndex}`;

  if (subtotal > 0) {
    postedLines.push({
      id: nextId('purchase'),
      accountCode: purchaseAccountCode || '2.1.1',
      accountName: 'Compra de Mercadorias',
      currency,
      note: `Mercadoria - FC ${invoiceNumber}`,
      debit: subtotal,
      credit: 0,
    });
  }

  if (landingCosts > 0) {
    postedLines.push({
      id: nextId('freight_debit'),
      accountCode: purchaseAccountCode || '2.1.1',
      accountName: 'Compra de Mercadorias',
      currency,
      note: `Frete / Transporte rateado - FC ${invoiceNumber}`,
      debit: landingCosts,
      credit: 0,
    });
  }

  if (ivaTotal > 0) {
    postedLines.push({
      id: nextId('iva'),
      accountCode: ivaAccountCode || '3.3.1',
      accountName: 'IVA Dedutível',
      currency,
      note: `IVA - FC ${invoiceNumber}`,
      debit: ivaTotal,
      credit: 0,
    });
  }

  postedLines.push({
    id: nextId('supplier'),
    accountCode: supplierAccountCode,
    accountName: supplierName,
    currency,
    note: `FC ${invoiceNumber}`,
    debit: 0,
    credit: supplierTotal,
  });

  if (landingCosts > 0) {
    postedLines.push({
      id: nextId('freight_credit'),
      accountCode: freightSourceAccount,
      accountName: freightSourceName,
      currency,
      note: `Saída de caixa/banco - Frete FC ${invoiceNumber}`,
      debit: 0,
      credit: landingCosts,
    });
  }

  return [
    ...postedLines,
    ...manualLines.map((line, index) => ({
      ...line,
      id: line.id || nextId(`manual_${index + 1}`),
    })),
  ];
}

// ─────────── Invoice View Dialog ───────────
function InvoiceViewDialog({
  open, onClose, invoice,
}: {
  open: boolean;
  onClose: () => void;
  invoice: PurchaseInvoice | null;
}) {
  if (!invoice) return null;

  const handlePrint = () => {
    const lines = invoice.lines.map(l => `
      <tr>
        <td style="font-family:monospace;font-size:11px">${l.productCode}</td>
        <td>${l.description}</td>
        <td style="text-align:right">${l.totalQty}</td>
        <td style="text-align:right;font-family:monospace">${l.unitPrice.toLocaleString('pt-AO')}</td>
        <td style="text-align:right">${l.ivaRate}%</td>
        <td style="text-align:right;font-family:monospace;font-weight:bold">${l.totalWithIva.toLocaleString('pt-AO')}</td>
      </tr>
    `).join('');
    const journalRows = invoice.journalLines.map(j => `
      <tr>
        <td style="font-family:monospace">${j.accountCode}</td>
        <td>${j.accountName}</td>
        <td>${j.note}</td>
        <td style="text-align:right;font-family:monospace">${j.debit > 0 ? j.debit.toLocaleString('pt-AO') : '—'}</td>
        <td style="text-align:right;font-family:monospace">${j.credit > 0 ? j.credit.toLocaleString('pt-AO') : '—'}</td>
      </tr>
    `).join('');
    const html = `<html><head><title>FC ${invoice.invoiceNumber}</title>
      <style>body{font-family:Arial,sans-serif;font-size:12px;margin:20px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccc;padding:4px 8px}th{background:#f5f5f5;text-align:left}h2{color:#c2410c}@media print{body{margin:0}}</style>
    </head><body>
      <h2>FATURA DE COMPRA</h2>
      <p><strong>${invoice.invoiceNumber}</strong>${invoice.supplierInvoiceNo ? ' — Fatura Fornecedor: ' + invoice.supplierInvoiceNo : ''}</p>
      <table style="width:auto;border:none;margin-bottom:16px"><tr style="border:none">
        <td style="border:none"><strong>Fornecedor:</strong> ${invoice.supplierName}</td>
        <td style="border:none"><strong>Data:</strong> ${new Date(invoice.date).toLocaleDateString('pt-AO')}</td>
        <td style="border:none"><strong>Armazém:</strong> ${invoice.warehouseName}</td>
        <td style="border:none"><strong>Moeda:</strong> ${invoice.currency}</td>
      </tr></table>
      <table><thead><tr><th>Produto</th><th>Descrição</th><th>Qtd</th><th>Preço</th><th>IVA</th><th>Total</th></tr></thead><tbody>${lines}</tbody></table>
      <div style="text-align:right;margin-top:12px">
        <p>Sub Total: <strong>${invoice.subtotal.toLocaleString('pt-AO')} ${invoice.currency}</strong></p>
        <p style="color:#c2410c">IVA: <strong>${invoice.ivaTotal.toLocaleString('pt-AO')} ${invoice.currency}</strong></p>
        <p style="font-size:16px">Líquido: <strong>${invoice.total.toLocaleString('pt-AO')} ${invoice.currency}</strong></p>
      </div>
      ${invoice.journalLines.length > 0 ? `<h3>Entrada Diário</h3><table><thead><tr><th>Conta</th><th>Nome</th><th>Nota</th><th>Débito</th><th>Crédito</th></tr></thead><tbody>${journalRows}</tbody></table>` : ''}
    </body></html>`;

    // Use iframe to avoid popup blocker
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = 'none';
    document.body.appendChild(iframe);
    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) return;
    doc.open();
    doc.write(html);
    doc.close();
    setTimeout(() => {
      iframe.contentWindow?.print();
      setTimeout(() => document.body.removeChild(iframe), 1000);
    }, 300);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <span className="text-orange-600 font-bold">COMPRA</span>
            <span>{invoice.invoiceNumber}</span>
            <Badge variant={invoice.status === 'confirmed' ? 'default' : invoice.status === 'cancelled' ? 'destructive' : 'outline'}>
              {invoice.status === 'confirmed' ? 'Confirmado' : invoice.status === 'cancelled' ? 'Anulado' : 'Rascunho'}
            </Badge>
            <Button variant="outline" size="sm" className="ml-auto gap-1" onClick={handlePrint}>
              <Printer className="h-4 w-4" /> Imprimir
            </Button>
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[65vh]">
          <div className="space-y-4 p-1">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="text-muted-foreground">Fornecedor:</span> <strong>{invoice.supplierName}</strong></div>
              <div><span className="text-muted-foreground">Data:</span> {format(new Date(invoice.date), 'dd/MM/yyyy')}</div>
              <div><span className="text-muted-foreground">Armazém:</span> {invoice.warehouseName}</div>
              <div><span className="text-muted-foreground">Moeda:</span> {invoice.currency}</div>
              {invoice.supplierInvoiceNo && (
                <div><span className="text-muted-foreground">Nº Fatura Fornecedor:</span> <strong>{invoice.supplierInvoiceNo}</strong></div>
              )}
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="text-right">Qtd</TableHead>
                  <TableHead className="text-right">Preço</TableHead>
                  <TableHead className="text-right">IVA</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoice.lines.map(l => (
                  <TableRow key={l.id}>
                    <TableCell className="font-mono text-xs">{l.productCode}</TableCell>
                    <TableCell>{l.description}</TableCell>
                    <TableCell className="text-right">{l.totalQty}</TableCell>
                    <TableCell className="text-right font-mono">{l.unitPrice.toLocaleString('pt-AO')}</TableCell>
                    <TableCell className="text-right">{l.ivaRate}%</TableCell>
                    <TableCell className="text-right font-mono font-medium">{l.totalWithIva.toLocaleString('pt-AO')}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="flex justify-end">
              <div className="space-y-1 text-sm w-64">
                <div className="flex justify-between"><span>Sub Total:</span> <strong className="font-mono">{invoice.subtotal.toLocaleString('pt-AO')}</strong></div>
                <div className="flex justify-between text-orange-600"><span>IVA:</span> <strong className="font-mono">{invoice.ivaTotal.toLocaleString('pt-AO')}</strong></div>
                <div className="flex justify-between text-lg border-t pt-1"><span>Líquido:</span> <strong className="font-mono">{invoice.total.toLocaleString('pt-AO')}</strong></div>
              </div>
            </div>
            {invoice.journalLines.length > 0 && (
              <>
                <h4 className="font-semibold text-sm mt-4">Entrada Diário</h4>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Conta</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>Nota</TableHead>
                      <TableHead className="text-right">Débito</TableHead>
                      <TableHead className="text-right">Crédito</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoice.journalLines.map(j => (
                      <TableRow key={j.id}>
                        <TableCell className="font-mono text-xs">{j.accountCode}</TableCell>
                        <TableCell>{j.accountName}</TableCell>
                        <TableCell className="text-xs">{j.note}</TableCell>
                        <TableCell className="text-right font-mono">{j.debit > 0 ? j.debit.toLocaleString('pt-AO') : '—'}</TableCell>
                        <TableCell className="text-right font-mono">{j.credit > 0 ? j.credit.toLocaleString('pt-AO') : '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

// ═══════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════
export default function PurchaseInvoices() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const { currentBranch, branches } = useBranchContext();
  const { products, addProduct: addProductToStock, refreshProducts } = useProducts(currentBranch?.id);
  const { suppliers, refreshSuppliers, createSupplier } = useSuppliers();
  const { toast } = useToast();
  const navigate = useNavigate();

   // State
  const [invoices, setInvoices] = useState<PurchaseInvoice[]>([]);
  const [mode, setMode] = useState<'list' | 'create'>('list');
  const [searchTerm, setSearchTerm] = useState('');
  const [supplierPickerOpen, setSupplierPickerOpen] = useState(false);
  const [productPickerOpen, setProductPickerOpen] = useState(false);
  const [accountPickerOpen, setAccountPickerOpen] = useState(false);
  const [accountPickerTarget, setAccountPickerTarget] = useState<'journal' | null>(null);
  const [editingJournalIdx, setEditingJournalIdx] = useState<number | null>(null);
  const [viewInvoice, setViewInvoice] = useState<PurchaseInvoice | null>(null);
  const [activeTab, setActiveTab] = useState('fatura');
  const [showCreateProduct, setShowCreateProduct] = useState(false);
  const [showCreateSupplier, setShowCreateSupplier] = useState(false);
  const [newSupplierForm, setNewSupplierForm] = useState({ name: '', nif: '', email: '', phone: '', address: '', city: '', country: 'Angola', contactPerson: '', notes: '' });
  const [saveError, setSaveError] = useState<string | null>(null);
  // List mode state
  const [listTab, setListTab] = useState<'faturas' | 'encomendas'>('faturas');
  const [filterSupplier, setFilterSupplier] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  // Form state
  const [form, setForm] = useState<Partial<PurchaseInvoice>>({});
  const [lines, setLines] = useState<PurchaseInvoiceLine[]>([]);
  const [journalLines, setJournalLines] = useState<PurchaseInvoiceJournalLine[]>([]);
  // Freight / Transport cost
  const [freightCost, setFreightCost] = useState(0);
  const [freightOtherCosts, setFreightOtherCosts] = useState(0);
  const [freightSourceAccount, setFreightSourceAccount] = useState('4.1.1'); // default Caixa
  const [freightSourceName, setFreightSourceName] = useState('Caixa');
  const [freightPickerOpen, setFreightPickerOpen] = useState(false);

  // Purchase orders
  const { orders, createOrder, approveOrder, receiveOrder, cancelOrder } = usePurchaseOrders();

  const totalLandingCosts = freightCost + freightOtherCosts;

  // Freight allocation per product (proportional to value)
  const freightAllocations = useMemo(() => {
    const itemsTotal = lines.reduce((s, l) => s + l.total, 0);
    if (itemsTotal === 0 || totalLandingCosts === 0) return {} as Record<string, number>;
    const alloc: Record<string, number> = {};
    lines.forEach(l => {
      if (!l.productId || l.totalQty <= 0) return;
      const proportion = l.total / itemsTotal;
      alloc[l.productId] = (totalLandingCosts * proportion) / l.totalQty;
    });
    return alloc;
  }, [lines, totalLandingCosts]);

  const activeSuppliers = useMemo(() => suppliers.filter(s => s.isActive), [suppliers]);

  // Load invoices — pull from BOTH purchase invoice storage AND document storage
  useEffect(() => {
    const loadAll = async () => {
      // Primary: purchase invoice storage
      const piInvoices = await getPurchaseInvoices(currentBranch?.id);
      
      // Fallback: also load from document storage (fatura_compra type)
      const docInvoices = await getDocuments('fatura_compra', currentBranch?.id);
      
      // Merge: use PI storage as primary, fill gaps from doc storage
      const piIds = new Set(piInvoices.map(i => i.id));
      const docOnlyInvoices: PurchaseInvoice[] = docInvoices
        .filter(d => !piIds.has(d.id))
        .map(d => ({
          id: d.id,
          invoiceNumber: d.documentNumber,
          supplierAccountCode: d.accountCode || '',
          supplierName: d.entityName,
          supplierNif: d.entityNif,
          supplierPhone: d.entityPhone,
          supplierBalance: 0,
          supplierInvoiceNo: d.internalNotes?.replace('Nº Fatura Fornecedor: ', '') || '',
          date: d.issueDate,
          paymentDate: d.dueDate || d.issueDate,
          currency: d.currency === 'AOA' ? 'KZ' : d.currency || 'KZ',
          warehouseId: d.branchId,
          warehouseName: d.branchName,
          priceType: 'last_price' as const,
          purchaseAccountCode: '2.1.1',
          ivaAccountCode: '3.3.1',
          transactionType: 'ALL',
          currencyRate: 1,
          taxRate2: 0,
          surchargePercent: 0,
          changePrice: false,
          isPending: false,
          lines: (d.lines || []).map(l => ({
            id: l.id,
            productId: l.productId || '',
            productCode: l.productSku || '',
            description: l.description,
            quantity: l.quantity,
            packaging: 1,
            unitPrice: l.unitPrice,
            discountPct: l.discount || 0,
            discountPct2: 0,
            totalQty: l.quantity,
            total: l.lineTotal - (l.taxAmount || 0),
            ivaRate: l.taxRate || 0,
            ivaAmount: l.taxAmount || 0,
            totalWithIva: l.lineTotal,
            warehouseId: d.branchId,
            warehouseName: d.branchName,
            currentStock: 0,
            unit: l.unit || 'UN',
          })),
          journalLines: [],
          subtotal: d.subtotal,
          ivaTotal: d.totalTax,
          total: d.total,
          status: d.status === 'cancelled' ? 'cancelled' as const : 'confirmed' as const,
          branchId: d.branchId,
          branchName: d.branchName,
          createdBy: d.createdBy || '',
          createdByName: d.createdByName || '',
          createdAt: d.createdAt,
          updatedAt: d.updatedAt,
        }));
      
      setInvoices([...piInvoices, ...docOnlyInvoices]);
    };
    loadAll();
  }, [currentBranch?.id]);

  // Filtered list with date range and supplier filters
  const filtered = useMemo(() => {
    let result = invoices;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      result = result.filter(i =>
        i.invoiceNumber.toLowerCase().includes(q) ||
        i.supplierName.toLowerCase().includes(q) ||
        (i.supplierInvoiceNo && i.supplierInvoiceNo.toLowerCase().includes(q))
      );
    }
    if (filterSupplier && filterSupplier !== '__all__') {
      const q = filterSupplier.toLowerCase();
      result = result.filter(i => i.supplierName.toLowerCase().includes(q));
    }
    if (filterDateFrom) {
      result = result.filter(i => i.date >= filterDateFrom);
    }
    if (filterDateTo) {
      result = result.filter(i => i.date <= filterDateTo);
    }
    return result;
  }, [invoices, searchTerm, filterSupplier, filterDateFrom, filterDateTo]);

  const filteredProducts = useMemo(() => {
    if (!searchTerm) return products.slice(0, 300);
    const q = searchTerm.toLowerCase();
    return products.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q) ||
      p.barcode?.toLowerCase().includes(q)
    ).slice(0, 300);
  }, [products, searchTerm]);

  // ─────── Create mode ───────
  const startCreate = useCallback(() => {
    const now = new Date().toISOString();
    setSaveError(null);
    setForm({
      date: now.split('T')[0],
      paymentDate: now.split('T')[0],
      currency: 'KZ',
      warehouseId: currentBranch?.id || '',
      warehouseName: currentBranch?.name || '',
      priceType: 'last_price',
      purchaseAccountCode: '2.1.1',
      ivaAccountCode: '3.3.1',
      transactionType: 'ALL',
      currencyRate: 1,
      taxRate2: 1000,
      surchargePercent: 0,
      changePrice: true,
      isPending: false,
    });
    setLines([]);
    setJournalLines([]);
    setFreightCost(0);
    setFreightOtherCosts(0);
    setFreightSourceAccount('4.1.1');
    setFreightSourceName('Caixa');
    setActiveTab('fatura');
    setMode('create');
  }, [currentBranch]);

  useEffect(() => {
    if (searchParams.get('mode') !== 'create' || mode === 'create') return;
    startCreate();
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('mode');
    setSearchParams(nextParams, { replace: true });
  }, [searchParams, setSearchParams, mode, startCreate]);

   // Select supplier — auto-create CoA sub-account under 3.2 Fornecedores
  const handleSelectSupplier = useCallback(async (s: Supplier) => {
    const accountCode = await ensureSupplierAccount(s.id, s.name, s.nif);
    setForm(prev => ({
      ...prev,
      supplierAccountCode: accountCode,
      supplierId: s.id, // Real supplier DB ID for open items & balance updates
      supplierName: s.name,
      supplierNif: s.nif,
      supplierPhone: s.phone,
      supplierBalance: 0,
    }));
  }, []);

  // Add product line
  const handleAddProduct = useCallback((p: Product) => {
    const newLine = calculateLine({
      productId: p.id,
      productCode: p.sku,
      description: p.name,
      quantity: 1,
      packaging: 1,
      unitPrice: p.lastCost || p.cost || 0,
      discountPct: 0,
      discountPct2: 0,
      ivaRate: p.taxRate || 14,
      warehouseId: form.warehouseId || currentBranch?.id || '',
      warehouseName: form.warehouseName || currentBranch?.name || '',
      currentStock: p.stock,
      unit: p.unit || 'UN',
      barcode: p.barcode,
    });
    setLines(prev => [...prev, newLine]);
  }, [form.warehouseId, form.warehouseName, currentBranch]);

  const handleOpenProductPicker = useCallback(() => {
    setProductPickerOpen(true);
  }, []);

  const handleCloseCreate = useCallback(() => {
    setSaveError(null);
    setMode("list");
  }, []);

  const openSupplierPicker = useCallback(async () => {
    await refreshSuppliers();
    setSupplierPickerOpen(true);
  }, [refreshSuppliers]);

  // Update line field
  const updateLineField = useCallback((idx: number, field: keyof PurchaseInvoiceLine, value: number | string) => {
    setLines(prev => {
      const updated = [...prev];
      const line = { ...updated[idx], [field]: value };
      updated[idx] = calculateLine(line);
      return updated;
    });
  }, []);

  // Remove line
  const removeLine = useCallback((idx: number) => {
    setLines(prev => prev.filter((_, i) => i !== idx));
  }, []);

  // Totals
  const totals = useMemo(() => calculateInvoiceTotals(lines), [lines]);

  const postedJournalPreview = useMemo(() => buildPurchaseInvoiceJournalLines({
    documentId: 'preview',
    invoiceNumber: form.supplierInvoiceNo || form.ref || 'PRÉVIA',
    currency: form.currency || 'KZ',
    purchaseAccountCode: form.purchaseAccountCode || '2.1.1',
    ivaAccountCode: form.ivaAccountCode || '3.3.1',
    supplierAccountCode: form.supplierAccountCode || '',
    supplierName: form.supplierName || 'Fornecedor',
    subtotal: totals.subtotal,
    ivaTotal: totals.ivaTotal,
    supplierTotal: totals.total,
    landingCosts: totalLandingCosts,
    freightSourceAccount,
    freightSourceName,
    manualLines: journalLines,
  }), [
    form.currency,
    form.ivaAccountCode,
    form.purchaseAccountCode,
    form.ref,
    form.supplierAccountCode,
    form.supplierInvoiceNo,
    form.supplierName,
    freightSourceAccount,
    freightSourceName,
    journalLines,
    totals.ivaTotal,
    totals.subtotal,
    totals.total,
    totalLandingCosts,
  ]);

  const postedJournalTotals = useMemo(() => {
    const debit = postedJournalPreview.reduce((sum, line) => sum + (line.debit || 0), 0);
    const credit = postedJournalPreview.reduce((sum, line) => sum + (line.credit || 0), 0);
    return {
      debit,
      credit,
      difference: debit - credit,
    };
  }, [postedJournalPreview]);

  // Add journal line
  const addJournalLine = useCallback(() => {
    setJournalLines(prev => [...prev, {
      id: `jl_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      accountCode: '',
      accountName: '',
      currency: form.currency || 'KZ',
      note: '',
      debit: 0,
      credit: 0,
    }]);
  }, [form.currency]);

  const updateJournalLine = useCallback((idx: number, field: keyof PurchaseInvoiceJournalLine, value: string | number) => {
    setJournalLines(prev => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], [field]: value };
      return updated;
    });
  }, []);

  const removeJournalLine = useCallback((idx: number) => {
    setJournalLines(prev => prev.filter((_, i) => i !== idx));
  }, []);

  // Open account picker for a journal line
  const openAccountPicker = useCallback((idx: number) => {
    setEditingJournalIdx(idx);
    setAccountPickerTarget('journal');
    setAccountPickerOpen(true);
  }, []);

  const handleAccountSelect = useCallback((code: string, name: string) => {
    if (freightPickerOpen) {
      setFreightSourceAccount(code);
      setFreightSourceName(name);
      setFreightPickerOpen(false);
    } else if (accountPickerTarget === 'journal' && editingJournalIdx !== null) {
      updateJournalLine(editingJournalIdx, 'accountCode', code);
      updateJournalLine(editingJournalIdx, 'accountName', name);
    }
    setAccountPickerTarget(null);
    setEditingJournalIdx(null);
  }, [accountPickerTarget, editingJournalIdx, updateJournalLine, freightPickerOpen]);

  // ─────── SAVE (all phases) ───────
  const handleSave = useCallback(async () => {
    setSaveError(null);
    console.log('[PurchaseInvoices] === SAVE START ===');
    console.log('[PurchaseInvoices] form.supplierName:', form.supplierName);
    console.log('[PurchaseInvoices] form.supplierAccountCode:', form.supplierAccountCode);
    console.log('[PurchaseInvoices] lines count:', lines.length);
    console.log('[PurchaseInvoices] activeSuppliers count:', activeSuppliers.length);

    // Validate supplier FIRST before any async work
    if (!form.supplierName) {
      setSaveError('Selecione um fornecedor antes de guardar.');
      console.warn('[PurchaseInvoices] BLOCKED: No supplier name');
      toast({ title: 'Erro', description: 'Selecione um fornecedor', variant: 'destructive' });
      return;
    }

    const formWithSupplier = form as Partial<PurchaseInvoice> & { supplierId?: string; supplierInvoiceNo?: string };
    console.log('[PurchaseInvoices] formWithSupplier.supplierId:', formWithSupplier.supplierId);

    const matchedSupplier = activeSuppliers.find(s =>
      s.id === formWithSupplier.supplierId ||
      (!!form.supplierNif && s.nif === form.supplierNif) ||
      (!!form.supplierName && s.name.trim().toLowerCase() === form.supplierName.trim().toLowerCase())
    );
    console.log('[PurchaseInvoices] matchedSupplier:', matchedSupplier ? `${matchedSupplier.id} — ${matchedSupplier.name}` : 'NOT FOUND');

    const resolvedSupplierId = matchedSupplier?.id || formWithSupplier.supplierId;

    if (!resolvedSupplierId) {
      setSaveError('Fornecedor sem ligação válida. Selecione novamente o fornecedor na lista.');
      console.warn('[PurchaseInvoices] BLOCKED: No resolved supplier ID');
      toast({
        title: 'Erro',
        description: 'Fornecedor sem ligação válida. Crie ou selecione novamente o fornecedor na lista antes de guardar a compra.',
        variant: 'destructive',
      });
      return;
    }

    // Resolve supplier account code — with explicit error handling
    let resolvedSupplierAccountCode = form.supplierAccountCode || '';
    console.log('[PurchaseInvoices] Initial supplierAccountCode:', resolvedSupplierAccountCode);

    if (!resolvedSupplierAccountCode && matchedSupplier) {
      try {
        resolvedSupplierAccountCode = await ensureSupplierAccount(matchedSupplier.id, matchedSupplier.name, matchedSupplier.nif);
        console.log(`[PurchaseInvoices] Resolved supplier account: ${resolvedSupplierAccountCode} for ${matchedSupplier.name}`);
      } catch (err: any) {
        setSaveError(`Não foi possível resolver a conta contabilística do fornecedor: ${err?.message || 'Erro desconhecido'}`);
        console.error('[PurchaseInvoices] Failed to resolve supplier account:', err);
        toast({
          title: 'Erro na conta do fornecedor',
          description: `Não foi possível resolver a conta contabilística: ${err?.message || 'Erro desconhecido'}`,
          variant: 'destructive',
        });
        return;
      }
    }
    if (!resolvedSupplierAccountCode) {
      setSaveError('O fornecedor seleccionado ainda não tem subconta contabilística válida.');
      console.warn('[PurchaseInvoices] BLOCKED: No supplier account code resolved');
      toast({
        title: 'Erro',
        description: 'O fornecedor seleccionado ainda não tem subconta contabilística válida.',
        variant: 'destructive',
      });
      return;
    }
    if (lines.length === 0) {
      setSaveError('Adicione pelo menos um produto antes de guardar.');
      console.warn('[PurchaseInvoices] BLOCKED: No lines');
      toast({ title: 'Erro', description: 'Adicione pelo menos um produto', variant: 'destructive' });
      return;
    }

    const resolvedBranchId = currentBranch?.id || form.warehouseId || '';
    const resolvedBranchName = currentBranch?.name || form.warehouseName || '';
    const resolvedWarehouseId = form.warehouseId || currentBranch?.id || '';
    const resolvedWarehouseName = form.warehouseName || currentBranch?.name || '';

    if (!resolvedBranchId) {
      setSaveError('Nenhuma filial activa foi encontrada. Selecione o armazém/filial antes de guardar.');
      toast({
        title: 'Erro',
        description: 'Nenhuma filial activa foi encontrada. Selecione o armazém/filial antes de guardar.',
        variant: 'destructive',
      });
      return;
    }

    if (!resolvedWarehouseId) {
      setSaveError('Selecione um armazém antes de guardar a compra.');
      toast({
        title: 'Erro',
        description: 'Selecione um armazém antes de guardar a compra.',
        variant: 'destructive',
      });
      return;
    }

    console.log('[PurchaseInvoices] All validations passed, building invoice...');

    const now = new Date().toISOString();
    const branchCode = currentBranch?.code || 'SEDE';

    const manualJournalLines = journalLines;

    const invoice: PurchaseInvoice = {
      id: generateId(),
      invoiceNumber: generatePurchaseInvoiceNumber(branchCode),
      supplierAccountCode: resolvedSupplierAccountCode,
      supplierName: matchedSupplier?.name || form.supplierName || '',
      supplierNif: matchedSupplier?.nif || form.supplierNif,
      supplierPhone: matchedSupplier?.phone || form.supplierPhone,
      supplierBalance: form.supplierBalance || 0,
      ref: form.ref,
      supplierInvoiceNo: formWithSupplier.supplierInvoiceNo,
      contact: form.contact,
      department: form.department,
      ref2: form.ref2,
      date: form.date || now,
      paymentDate: form.paymentDate || now,
      project: form.project,
      currency: form.currency || 'KZ',
      warehouseId: resolvedWarehouseId,
      warehouseName: resolvedWarehouseName,
      priceType: form.priceType || 'last_price',
      address: form.address,
      purchaseAccountCode: form.purchaseAccountCode || '2.1',
      ivaAccountCode: form.ivaAccountCode || '3.3.1',
      transactionType: form.transactionType || 'ALL',
      currencyRate: form.currencyRate || 1,
      taxRate2: form.taxRate2 || 1000,
      orderNo: form.orderNo,
      surchargePercent: form.surchargePercent || 0,
      changePrice: form.changePrice || false,
      isPending: form.isPending || false,
      extraNote: form.extraNote,
      lines,
      journalLines: [],
      subtotal: totals.subtotal,
      ivaTotal: totals.ivaTotal,
      total: totals.total,
      status: 'confirmed',
      branchId: resolvedBranchId,
      branchName: resolvedBranchName,
      createdBy: user?.id || '',
      createdByName: user?.name || '',
      createdAt: now,
      updatedAt: now,
    };

    invoice.journalLines = buildPurchaseInvoiceJournalLines({
      documentId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      currency: invoice.currency,
      purchaseAccountCode: invoice.purchaseAccountCode || '2.1.1',
      ivaAccountCode: invoice.ivaAccountCode || '3.3.1',
      supplierAccountCode: invoice.supplierAccountCode,
      supplierName: invoice.supplierName,
      subtotal: invoice.subtotal,
      ivaTotal: invoice.ivaTotal,
      supplierTotal: invoice.total,
      landingCosts: totalLandingCosts,
      freightSourceAccount,
      freightSourceName,
      manualLines: manualJournalLines,
    });

    try {
      console.log('[PurchaseInvoices] Calling processTransaction...', {
        type: 'purchase_invoice',
        docId: invoice.id,
        docNumber: invoice.invoiceNumber,
        branchId: invoice.branchId,
        supplierId: resolvedSupplierId,
        supplierAccountCode: resolvedSupplierAccountCode,
        linesCount: invoice.lines.length,
        total: invoice.total,
      });
      // Use central transaction engine for atomic processing
      const txResult = await processTransaction({
        transactionType: 'purchase_invoice',
        documentId: invoice.id,
        documentNumber: invoice.invoiceNumber,
        branchId: invoice.branchId,
        branchName: invoice.branchName,
        userId: user?.id || '',
        userName: user?.name || '',
        date: invoice.date,
        currency: invoice.currency,
        description: `Fatura de Compra ${invoice.invoiceNumber} — ${invoice.supplierName}`,
        amount: invoice.total,

        // Phase 1: Stock entries — scoped to the selected warehouse
        stockEntries: invoice.lines
          .filter(l => l.productId && l.totalQty > 0)
          .map(l => ({
            productId: l.productId,
            productName: l.description,
            productSku: l.productCode,
            quantity: l.totalQty,
            unitCost: l.unitPrice,
            direction: 'IN' as const,
            warehouseId: l.warehouseId || invoice.warehouseId, // BRANCH-SCOPED
          })),

        // Phase 2: Price updates (WAC) — includes freight allocation
        priceUpdates: invoice.changePrice
          ? invoice.lines
              .filter(l => l.productId && l.totalQty > 0)
              .map(l => ({
                productId: l.productId,
                newUnitCost: l.unitPrice + (freightAllocations[l.productId] || 0),
                quantityReceived: l.totalQty,
                updateAvgCost: true,
              }))
          : undefined,

        // Phase 3: Journal entries
        journalLines: invoice.journalLines.map((line) => ({
          accountCode: line.accountCode,
          accountName: line.accountName,
          debit: line.debit,
          credit: line.credit,
          note: line.note,
        })),

        // Phase 4: Open item (payable to supplier) — use REAL supplier ID
        openItem: {
          entityType: 'supplier',
          entityId: resolvedSupplierId,
          entityName: invoice.supplierName,
          documentType: 'invoice',
          originalAmount: invoice.total,
          isDebit: true,
          dueDate: invoice.paymentDate,
          currency: invoice.currency === 'KZ' ? 'AOA' : invoice.currency,
        },

        // Phase 6: Update supplier balance — use REAL supplier ID
        entityBalanceUpdate: {
          entityType: 'supplier',
          entityId: resolvedSupplierId,
          entityName: invoice.supplierName,
          entityNif: invoice.supplierNif,
          amount: invoice.total,
        },
      });

      console.log('[PurchaseInvoices] Transaction result:', JSON.stringify(txResult));

      if (!txResult.success) {
        const txError = txResult.errors.join('; ') || 'Stock e contabilidade não foram actualizados.';
        const description = txError.includes('invalid input syntax for type uuid')
          ? 'Existe um ID inválido na compra. Reabra o fornecedor e o armazém, depois grave novamente.'
          : txError;

        console.error('[PurchaseInvoices] Transaction engine errors:', txResult.errors);
          setSaveError(description);
        toast({
          title: 'Aviso: Falha no motor de transação',
          description,
          variant: 'destructive',
        });
        return;
      }

      await savePurchaseInvoice(invoice);
      await syncPurchaseInvoiceDocument(invoice);
      await Promise.all([refreshProducts(), refreshSuppliers()]);

      toast({
        title: 'Fatura de Compra Guardada',
        description: `${invoice.invoiceNumber} — ${invoice.supplierName} — ${invoice.total.toLocaleString('pt-AO')} ${invoice.currency}`,
      });

      getPurchaseInvoices(currentBranch?.id).then(setInvoices);
      // Show the saved invoice immediately for printing
      setViewInvoice(invoice);
      setMode('list');
    } catch (error: any) {
      console.error('[PurchaseInvoices] Failed to save purchase invoice:', error);
      setSaveError(error?.message || 'A compra não foi sincronizada corretamente com stock e fornecedor.');
      toast({
        title: 'Erro ao guardar a fatura de compra',
        description: error?.message || 'A compra não foi sincronizada corretamente com stock e fornecedor.',
        variant: 'destructive',
      });
    }
  }, [activeSuppliers, form, lines, journalLines, totals, currentBranch, user, toast, refreshProducts, refreshSuppliers]);

  // ═══════════════ RENDER ═══════════════


  // ─── LIST MODE ───
  if (mode === 'list') {
    const filteredOrders = orders.filter(order =>
      order.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.supplierName.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const invoiceTotals = {
      count: filtered.length,
      subtotal: filtered.reduce((s, i) => s + (i.subtotal || 0), 0),
      iva: filtered.reduce((s, i) => s + (i.ivaTotal || 0), 0),
      total: filtered.reduce((s, i) => s + (i.total || 0), 0),
    };

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Compras</h1>
              <p className="text-sm text-muted-foreground">Gestão de encomendas e facturas de compra</p>
            </div>
          </div>
          <div className="flex gap-2">
            {listTab === 'encomendas' && (
              <Button variant="outline" className="gap-2" onClick={() => navigate('/purchase-orders')}>
                <ShoppingCart className="h-4 w-4" /> Gerir Encomendas
              </Button>
            )}
            <Button onClick={() => setSearchParams({ mode: "create" })} className="gap-2">
              <Plus className="h-4 w-4" /> Nova Fatura de Compra
            </Button>
          </div>
        </div>

        {/* Tabs: Faturas / Encomendas */}
        <Tabs value={listTab} onValueChange={v => setListTab(v as any)}>
          <TabsList>
            <TabsTrigger value="faturas" className="gap-1">
              <FileText className="h-4 w-4" /> Faturas de Compra
              <Badge variant="secondary" className="ml-1 text-[10px]">{invoices.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="encomendas" className="gap-1">
              <ShoppingCart className="h-4 w-4" /> Encomendas
              <Badge variant="secondary" className="ml-1 text-[10px]">{orders.length}</Badge>
            </TabsTrigger>
          </TabsList>

          {/* ═══ FATURAS TAB ═══ */}
          <TabsContent value="faturas" className="space-y-3 mt-2">
            {/* Filters */}
            <div className="flex flex-wrap gap-2 items-end">
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Pesquisar nº fatura, fornecedor..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-9" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Fornecedor</Label>
                <Select value={filterSupplier} onValueChange={setFilterSupplier}>
                  <SelectTrigger className="w-48 h-9">
                    <SelectValue placeholder="Todos fornecedores" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Todos</SelectItem>
                    {[...new Set(invoices.map(i => i.supplierName))].sort().map(name => (
                      <SelectItem key={name} value={name.toLowerCase()}>{name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">De</Label>
                <Input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} className="h-9 w-36" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Até</Label>
                <Input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} className="h-9 w-36" />
              </div>
              {(filterSupplier && filterSupplier !== '__all__' || filterDateFrom || filterDateTo) && (
                <Button variant="ghost" size="sm" onClick={() => { setFilterSupplier('__all__'); setFilterDateFrom(''); setFilterDateTo(''); }}>
                  <X className="h-4 w-4 mr-1" /> Limpar
                </Button>
              )}
            </div>

            {/* Summary */}
            <div className="flex gap-4 text-sm">
              <span className="text-muted-foreground">{invoiceTotals.count} facturas</span>
              <span>Sub Total: <strong className="font-mono">{invoiceTotals.subtotal.toLocaleString('pt-AO')} Kz</strong></span>
              <span>IVA: <strong className="font-mono">{invoiceTotals.iva.toLocaleString('pt-AO')} Kz</strong></span>
              <span>Total: <strong className="font-mono">{invoiceTotals.total.toLocaleString('pt-AO')} Kz</strong></span>
            </div>

            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nº Fatura</TableHead>
                      <TableHead>Nº Fat. Fornecedor</TableHead>
                      <TableHead>Fornecedor</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Armazém</TableHead>
                      <TableHead className="text-right">Sub Total</TableHead>
                      <TableHead className="text-right">IVA</TableHead>
                      <TableHead className="text-right">Líquido</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="text-right">Acções</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map(inv => (
                      <TableRow key={inv.id} className="cursor-pointer hover:bg-accent/50" onClick={() => setViewInvoice(inv)}>
                        <TableCell className="font-mono text-xs font-medium">{inv.invoiceNumber}</TableCell>
                        <TableCell className="text-xs">{inv.supplierInvoiceNo || '—'}</TableCell>
                        <TableCell>{inv.supplierName}</TableCell>
                        <TableCell className="text-sm">{format(new Date(inv.date), 'dd/MM/yyyy')}</TableCell>
                        <TableCell className="text-sm">{inv.warehouseName}</TableCell>
                        <TableCell className="text-right font-mono">{inv.subtotal.toLocaleString('pt-AO')}</TableCell>
                        <TableCell className="text-right font-mono text-destructive">{inv.ivaTotal.toLocaleString('pt-AO')}</TableCell>
                        <TableCell className="text-right font-mono font-bold">{inv.total.toLocaleString('pt-AO')}</TableCell>
                        <TableCell>
                          <Badge variant={inv.status === 'confirmed' ? 'default' : inv.status === 'cancelled' ? 'destructive' : 'outline'}>
                            {inv.status === 'confirmed' ? 'Confirmado' : inv.status === 'cancelled' ? 'Anulado' : 'Rascunho'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-1 justify-end">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={e => { e.stopPropagation(); setViewInvoice(inv); }}>
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={e => { e.stopPropagation(); setViewInvoice(inv); }}>
                              <Printer className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {filtered.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={10} className="text-center py-12 text-muted-foreground">
                          <FileText className="h-10 w-10 mx-auto mb-2 opacity-50" />
                          Nenhuma fatura de compra encontrada
                          <br />
                          <Button variant="link" size="sm" className="mt-2" onClick={() => setSearchParams({ mode: "create" })}>
                            <Plus className="h-4 w-4 mr-1" /> Criar nova fatura de compra
                          </Button>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ═══ ENCOMENDAS TAB ═══ */}
          <TabsContent value="encomendas" className="space-y-3 mt-2">
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nº Encomenda</TableHead>
                      <TableHead>Fornecedor</TableHead>
                      <TableHead>Filial</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="text-right">Acções</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOrders.map(order => (
                      <TableRow key={order.id}>
                        <TableCell className="font-mono">{order.orderNumber}</TableCell>
                        <TableCell>{order.supplierName}</TableCell>
                        <TableCell>{order.branchName}</TableCell>
                        <TableCell>{format(new Date(order.createdAt), 'dd/MM/yyyy')}</TableCell>
                        <TableCell className="text-right font-medium font-mono">{order.total.toLocaleString('pt-AO')} Kz</TableCell>
                        <TableCell>
                          <Badge variant={
                            order.status === 'received' ? 'default' :
                            order.status === 'cancelled' ? 'destructive' :
                            order.status === 'approved' ? 'default' : 'outline'
                          }>
                            {order.status === 'draft' ? 'Rascunho' :
                             order.status === 'pending' ? 'Pendente' :
                             order.status === 'approved' ? 'Aprovado' :
                             order.status === 'received' ? 'Recebido' :
                             order.status === 'partial' ? 'Parcial' : 'Cancelado'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-1 justify-end">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => navigate('/purchase-orders')}>
                              <Eye className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredOrders.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                          <ShoppingCart className="h-10 w-10 mx-auto mb-2 opacity-50" />
                          Nenhuma encomenda encontrada
                          <br />
                          <Button variant="link" size="sm" className="mt-2" onClick={() => navigate('/purchase-orders')}>
                            <Plus className="h-4 w-4 mr-1" /> Criar nova encomenda
                          </Button>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <InvoiceViewDialog open={!!viewInvoice} onClose={() => setViewInvoice(null)} invoice={viewInvoice} />
      </div>
    );
  }

  // ─── CREATE MODE ───
  return (
    <div className="space-y-3">
      {/* Top bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={handleCloseCreate}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-orange-600 font-bold text-xl">COMPRA</span>
              <span className="font-mono text-sm text-muted-foreground">
                {form.supplierAccountCode || '—'}
              </span>
              <span className="font-medium">{form.supplierName || '—'}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleCloseCreate} className="gap-1">
            <X className="h-4 w-4" /> Cancelar
          </Button>
          <Button size="sm" onClick={handleSave} className="gap-1">
            <Save className="h-4 w-4" /> Guardar
          </Button>
        </div>
      </div>

      {saveError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Falha ao guardar</AlertTitle>
          <AlertDescription>{saveError}</AlertDescription>
        </Alert>
      )}

      {/* Supplier bar */}
      {!form.supplierName && (
        <Card className="border-orange-300 bg-orange-50 dark:bg-orange-950/30">
          <CardContent className="py-4">
            <Button variant="outline" onClick={() => void openSupplierPicker()} className="gap-2 w-full justify-start">
              <Search className="h-4 w-4" /> Selecionar Fornecedor...
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Tabs: Fatura / Entrada do Diário */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="fatura" className="gap-1"><FileText className="h-4 w-4" /> Fatura</TabsTrigger>
          <TabsTrigger value="diario" className="gap-1"><BookOpen className="h-4 w-4" /> Entrada do Diário</TabsTrigger>
        </TabsList>

        {/* ──── FATURA TAB ──── */}
        <TabsContent value="fatura" className="space-y-3 mt-2">
          {/* Header form */}
          <div className="grid grid-cols-12 gap-3">
            {/* Left: main fields */}
            <Card className="col-span-4">
              <CardContent className="p-3 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">No</Label>
                    <Input value={form.ref || ''} onChange={e => setForm(p => ({ ...p, ref: e.target.value }))} placeholder="Auto" className="h-8 text-xs" />
                  </div>
                  <div>
                    <Label className="text-xs">Nº Fatura Fornecedor</Label>
                    <Input value={(form as any).supplierInvoiceNo || ''} onChange={e => setForm(p => ({ ...p, supplierInvoiceNo: e.target.value }))} placeholder="Nº da fatura do fornecedor" className="h-8 text-xs" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Ref</Label>
                    <Input value={form.ref2 || ''} onChange={e => setForm(p => ({ ...p, ref2: e.target.value }))} className="h-8 text-xs" />
                  </div>
                  <div>
                    <Label className="text-xs">Departamento</Label>
                    <Input value={form.department || ''} onChange={e => setForm(p => ({ ...p, department: e.target.value }))} className="h-8 text-xs" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Data</Label>
                    <Input type="date" value={form.date || ''} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} className="h-8 text-xs" />
                  </div>
                  <div>
                    <Label className="text-xs">Data Pagamento</Label>
                    <Input type="date" value={form.paymentDate || ''} onChange={e => setForm(p => ({ ...p, paymentDate: e.target.value }))} className="h-8 text-xs" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Moeda</Label>
                    <Select value={form.currency} onValueChange={v => setForm(p => ({ ...p, currency: v }))}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="KZ">KZ</SelectItem>
                        <SelectItem value="USD">USD</SelectItem>
                        <SelectItem value="EUR">EUR</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Armazém</Label>
                    <Select value={form.warehouseId} onValueChange={v => {
                      const br = branches.find(b => b.id === v);
                      setForm(p => ({ ...p, warehouseId: v, warehouseName: br?.name || v }));
                    }}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {branches.filter(b => b.id).map(b => (
                          <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Contacto</Label>
                  <Input value={form.contact || ''} onChange={e => setForm(p => ({ ...p, contact: e.target.value }))} className="h-8 text-xs" placeholder={form.supplierPhone || '—'} />
                </div>
                <div>
                  <Label className="text-xs">Tipo de Preço</Label>
                  <Select value={form.priceType} onValueChange={v => setForm(p => ({ ...p, priceType: v as any }))}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="last_price">Last Price</SelectItem>
                      <SelectItem value="average_price">Average Price</SelectItem>
                      <SelectItem value="manual">Manual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {form.supplierName && (
                  <Button variant="ghost" size="sm" className="text-xs w-full" onClick={() => void openSupplierPicker()}>
                    Alterar Fornecedor
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Center: options */}
            <Card className="col-span-4">
              <CardContent className="p-3 space-y-3">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="changePrice"
                    checked={form.changePrice}
                    onCheckedChange={v => setForm(p => ({ ...p, changePrice: !!v }))}
                  />
                  <Label htmlFor="changePrice" className="text-xs font-medium">Change Price</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="pending"
                    checked={form.isPending}
                    onCheckedChange={v => setForm(p => ({ ...p, isPending: !!v }))}
                  />
                  <Label htmlFor="pending" className="text-xs">Pendente</Label>
                </div>
                <div>
                  <Label className="text-xs">Extra Note</Label>
                  <Textarea
                    value={form.extraNote || ''}
                    onChange={e => setForm(p => ({ ...p, extraNote: e.target.value }))}
                    className="text-xs h-16 resize-none"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Right: accounting codes */}
            <Card className="col-span-4 border-red-200 dark:border-red-900">
              <CardContent className="p-3 space-y-2">
                <div className="grid grid-cols-2 gap-1 text-xs">
                  <span className="text-muted-foreground">Conta de Fatura</span>
                  <Input value={form.purchaseAccountCode || ''} onChange={e => setForm(p => ({ ...p, purchaseAccountCode: e.target.value }))} className="h-7 text-xs font-mono" />
                  <span className="text-muted-foreground">IVA Conta</span>
                  <Input value={form.ivaAccountCode || ''} onChange={e => setForm(p => ({ ...p, ivaAccountCode: e.target.value }))} className="h-7 text-xs font-mono" />
                  <span className="text-muted-foreground">Transação</span>
                  <Input value={form.transactionType || ''} onChange={e => setForm(p => ({ ...p, transactionType: e.target.value }))} className="h-7 text-xs font-mono" />
                  <span className="text-muted-foreground">Moeda Valor</span>
                  <Input type="number" value={form.currencyRate || 1} onChange={e => setForm(p => ({ ...p, currencyRate: parseFloat(e.target.value) || 1 }))} className="h-7 text-xs font-mono" />
                  <span className="text-muted-foreground">Taxa 2</span>
                  <Input type="number" value={form.taxRate2 || 1000} onChange={e => setForm(p => ({ ...p, taxRate2: parseFloat(e.target.value) || 0 }))} className="h-7 text-xs font-mono" />
                  <span className="text-muted-foreground">Ordem NO.</span>
                  <Input value={form.orderNo || ''} onChange={e => setForm(p => ({ ...p, orderNo: e.target.value }))} className="h-7 text-xs font-mono" />
                  <span className="text-muted-foreground">Sobrecusto%</span>
                  <Input type="number" value={form.surchargePercent || 0} onChange={e => setForm(p => ({ ...p, surchargePercent: parseFloat(e.target.value) || 0 }))} className="h-7 text-xs font-mono" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Product lines toolbar */}
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1" onClick={handleOpenProductPicker}>
              <Plus className="h-4 w-4" /> Inserir Produto
            </Button>
            <Button variant="ghost" size="sm" className="gap-1" onClick={handleOpenProductPicker}>
              <Search className="h-4 w-4" /> Encontrar
            </Button>
            <span className="text-xs text-muted-foreground ml-auto">F2 para pesquisar</span>
          </div>

          {/* Product lines grid */}
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                     <TableRow className="text-xs">
                       <TableHead className="w-8">#</TableHead>
                       <TableHead>Produto</TableHead>
                       <TableHead className="min-w-[200px]">Descrição</TableHead>
                       <TableHead className="w-20 text-right">Qtd</TableHead>
                       <TableHead className="w-16 text-right">Emb.</TableHead>
                       <TableHead className="w-24 text-right">Preço (s/IVA)</TableHead>
                       <TableHead className="w-16 text-right">Desc %</TableHead>
                       <TableHead className="w-16 text-right">% 2</TableHead>
                       <TableHead className="w-20 text-right">Total QTD</TableHead>
                       <TableHead className="w-28 text-right">Base Trib.</TableHead>
                       <TableHead className="w-16 text-right">IVA%</TableHead>
                       <TableHead className="w-20 text-right">Valor IVA</TableHead>
                       <TableHead className="w-24">Armazém</TableHead>
                       <TableHead className="w-20 text-right">Qtd Atual</TableHead>
                       <TableHead className="w-28 text-right">Total c/IVA</TableHead>
                       <TableHead className="w-16">Unidade</TableHead>
                       <TableHead className="w-8" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lines.map((line, idx) => (
                      <TableRow key={line.id} className="text-xs">
                        <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                        <TableCell className="font-mono">{line.productCode}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{line.description}</TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            value={line.quantity}
                            onChange={e => updateLineField(idx, 'quantity', parseFloat(e.target.value) || 0)}
                            className="h-7 w-16 text-xs text-right font-mono"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            value={line.packaging}
                            onChange={e => updateLineField(idx, 'packaging', parseFloat(e.target.value) || 1)}
                            className="h-7 w-14 text-xs text-right font-mono"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            value={line.unitPrice}
                            onChange={e => updateLineField(idx, 'unitPrice', parseFloat(e.target.value) || 0)}
                            className="h-7 w-20 text-xs text-right font-mono"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            value={line.discountPct}
                            onChange={e => updateLineField(idx, 'discountPct', parseFloat(e.target.value) || 0)}
                            className="h-7 w-14 text-xs text-right font-mono"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            value={line.discountPct2}
                            onChange={e => updateLineField(idx, 'discountPct2', parseFloat(e.target.value) || 0)}
                            className="h-7 w-14 text-xs text-right font-mono"
                          />
                        </TableCell>
                        <TableCell className="text-right font-mono">{line.totalQty}</TableCell>
                        <TableCell className="text-right font-mono font-medium">{line.total.toLocaleString('pt-AO')}</TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            value={line.ivaRate}
                            onChange={e => updateLineField(idx, 'ivaRate', parseFloat(e.target.value) || 0)}
                            className="h-7 w-14 text-xs text-right font-mono"
                            onWheel={e => (e.target as HTMLInputElement).blur()}
                          />
                        </TableCell>
                        <TableCell className="text-right font-mono text-muted-foreground">{line.ivaAmount.toLocaleString('pt-AO')}</TableCell>
                        <TableCell className="text-xs">{line.warehouseName}</TableCell>
                        <TableCell className="text-right font-mono">{line.currentStock}</TableCell>
                        <TableCell className="text-right font-mono font-bold">{line.totalWithIva.toLocaleString('pt-AO')}</TableCell>
                        <TableCell>{line.unit}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeLine(idx)}>
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {lines.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={18} className="text-center py-8 text-muted-foreground">
                          <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          Clique em "Inserir Produto" ou pressione F2 para adicionar produtos
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* 🚚 Freight / Transport Costs */}
          <Card className="border-amber-200 dark:border-amber-900">
            <CardContent className="p-4 space-y-3">
              <h4 className="text-sm font-semibold flex items-center gap-2">🚚 Frete e Despesas de Transporte</h4>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div>
                  <Label className="text-xs">Frete (Transporte)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={freightCost || ''}
                    onChange={e => setFreightCost(parseFloat(e.target.value) || 0)}
                    className="h-8 text-xs font-mono"
                  />
                </div>
                <div>
                  <Label className="text-xs">Outras Despesas</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={freightOtherCosts || ''}
                    onChange={e => setFreightOtherCosts(parseFloat(e.target.value) || 0)}
                    className="h-8 text-xs font-mono"
                  />
                </div>
                <div>
                  <Label className="text-xs">Conta de Saída (Crédito)</Label>
                  <div className="flex gap-1">
                    <Input
                      value={freightSourceAccount}
                      onChange={e => setFreightSourceAccount(e.target.value)}
                      className="h-8 text-xs font-mono flex-1"
                      placeholder="4.1.1"
                    />
                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => {
                      setAccountPickerTarget('freight' as any);
                      setFreightPickerOpen(true);
                      setAccountPickerOpen(true);
                    }}>
                      <Search className="h-3 w-3" />
                    </Button>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{freightSourceName}</p>
                </div>
                <div>
                  <Label className="text-xs">Total Custos Adicionais</Label>
                  <div className="h-8 flex items-center text-sm font-bold font-mono text-amber-700 dark:text-amber-400">
                    {totalLandingCosts.toLocaleString('pt-AO')} Kz
                  </div>
                </div>
              </div>

              {/* Freight allocation preview */}
              {totalLandingCosts > 0 && lines.length > 0 && (
                <div className="border rounded p-2 bg-muted/30 space-y-1">
                  <p className="text-[10px] font-medium text-muted-foreground">Distribuição proporcional do frete por produto:</p>
                  {lines.filter(l => l.productId && l.totalQty > 0).map(l => {
                    const perUnit = freightAllocations[l.productId] || 0;
                    const effectiveCost = l.unitPrice + perUnit;
                    return (
                      <div key={l.productId} className="flex justify-between text-[11px]">
                        <span className="truncate max-w-[200px]">{l.description}</span>
                        <span className="font-mono text-muted-foreground">
                          {l.unitPrice.toLocaleString('pt-AO')} + {perUnit.toFixed(2)} = <span className="font-bold text-foreground">{effectiveCost.toFixed(2)} Kz/un</span>
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Totals bar */}
          <div className="flex justify-end">
            <Card className="w-80">
              <CardContent className="p-3 space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Sub Total</span>
                  <span className="font-mono font-medium">{totals.subtotal.toLocaleString('pt-AO')}</span>
                </div>
                {totalLandingCosts > 0 && (
                  <>
                    <div className="flex justify-between text-sm text-amber-600">
                      <span>Frete / Transporte</span>
                      <span className="font-mono font-medium">{totalLandingCosts.toLocaleString('pt-AO')}</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Rateado ao custo dos produtos, sem alterar o valor da fatura do fornecedor.
                    </p>
                  </>
                )}
                <div className="flex justify-between text-sm text-orange-600">
                  <span>IVA</span>
                  <span className="font-mono font-medium">{totals.ivaTotal.toLocaleString('pt-AO')}</span>
                </div>
                <div className="flex justify-between text-lg font-bold border-t pt-1">
                  <span>Total da Fatura</span>
                  <span className="font-mono">{totals.total.toLocaleString('pt-AO')}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ──── DIÁRIO TAB ──── */}
        <TabsContent value="diario" className="space-y-3 mt-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Entrada Diário de Fatura — Lançamentos adicionais</h3>
            <Button variant="outline" size="sm" className="gap-1" onClick={addJournalLine}>
              <Plus className="h-4 w-4" /> Adicionar Linha
            </Button>
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Pré-visualização do lançamento final</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="text-xs">
                    <TableHead>Conta</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Nota</TableHead>
                    <TableHead className="w-28 text-right">Débito</TableHead>
                    <TableHead className="w-28 text-right">Crédito</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {postedJournalPreview.map((line) => (
                    <TableRow key={line.id} className="text-xs">
                      <TableCell className="font-mono">{line.accountCode || '—'}</TableCell>
                      <TableCell>{line.accountName || '—'}</TableCell>
                      <TableCell>{line.note || '—'}</TableCell>
                      <TableCell className="text-right font-mono">{line.debit > 0 ? line.debit.toLocaleString('pt-AO') : '—'}</TableCell>
                      <TableCell className="text-right font-mono">{line.credit > 0 ? line.credit.toLocaleString('pt-AO') : '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="flex justify-end border-t px-4 py-3 text-sm">
                <div className="w-80 space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Débito:</span>
                    <span className="font-mono">{postedJournalTotals.debit.toLocaleString('pt-AO')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Crédito:</span>
                    <span className="font-mono">{postedJournalTotals.credit.toLocaleString('pt-AO')}</span>
                  </div>
                  <div className="flex justify-between font-bold border-t pt-1">
                    <span>Diferença:</span>
                    <span className={`font-mono ${Math.abs(postedJournalTotals.difference) > 0.01 ? 'text-destructive' : 'text-green-600'}`}>
                      {postedJournalTotals.difference.toLocaleString('pt-AO')}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="text-xs">
                    <TableHead>No. de Conta</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Moeda</TableHead>
                    <TableHead className="min-w-[180px]">Nota</TableHead>
                    <TableHead className="w-28 text-right">Débito</TableHead>
                    <TableHead className="w-28 text-right">Crédito</TableHead>
                    <TableHead className="w-8" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {journalLines.map((jl, idx) => (
                    <TableRow key={jl.id} className="text-xs">
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Input
                            value={jl.accountCode}
                            onChange={e => updateJournalLine(idx, 'accountCode', e.target.value)}
                            className="h-7 w-28 text-xs font-mono"
                          />
                          <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => openAccountPicker(idx)}>
                            <Search className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Input
                          value={jl.accountName}
                          onChange={e => updateJournalLine(idx, 'accountName', e.target.value)}
                          className="h-7 text-xs"
                        />
                      </TableCell>
                      <TableCell>
                        <Select value={jl.currency} onValueChange={v => updateJournalLine(idx, 'currency', v)}>
                          <SelectTrigger className="h-7 w-16 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="KZ">KZ</SelectItem>
                            <SelectItem value="USD">USD</SelectItem>
                            <SelectItem value="EUR">EUR</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Input
                          value={jl.note}
                          onChange={e => updateJournalLine(idx, 'note', e.target.value)}
                          className="h-7 text-xs"
                          placeholder="Descrição..."
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={jl.debit || ''}
                          onChange={e => updateJournalLine(idx, 'debit', parseFloat(e.target.value) || 0)}
                          className="h-7 w-24 text-xs text-right font-mono"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={jl.credit || ''}
                          onChange={e => updateJournalLine(idx, 'credit', parseFloat(e.target.value) || 0)}
                          className="h-7 w-24 text-xs text-right font-mono"
                        />
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeJournalLine(idx)}>
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {journalLines.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        <BookOpen className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        Os lançamentos automáticos acima já mostram Compra, IVA, Fornecedor e Frete.
                        <br />
                        Adicione linhas aqui apenas para ajustes extras.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <SupplierPickerDialog
        open={supplierPickerOpen}
        onClose={() => setSupplierPickerOpen(false)}
        suppliers={activeSuppliers}
        onSelect={handleSelectSupplier}
        onRefresh={refreshSuppliers}
        onCreateNew={() => {
          setSupplierPickerOpen(false);
          setNewSupplierForm({ name: '', nif: '', email: '', phone: '', address: '', city: '', country: 'Angola', contactPerson: '', notes: '' });
          setShowCreateSupplier(true);
        }}
      />
      <ProductPickerDialog
        open={productPickerOpen}
        onClose={() => setProductPickerOpen(false)}
        products={products}
        onSelect={handleAddProduct}
        onCreateNew={() => setShowCreateProduct(true)}
      />
      <AccountPickerDialog
        open={accountPickerOpen}
        onClose={() => setAccountPickerOpen(false)}
        onSelect={handleAccountSelect}
      />
      <ProductDetailDialog
        open={showCreateProduct}
        onOpenChange={setShowCreateProduct}
        product={null}
        onSave={async (newProduct) => {
          const savedProduct = await addProductToStock(newProduct);
          handleAddProduct(savedProduct);
          toast({ title: 'Produto criado', description: `${savedProduct.name} adicionado ao stock e à fatura` });
        }}
      />

      {/* Inline Create Supplier Dialog */}
      <Dialog open={showCreateSupplier} onOpenChange={setShowCreateSupplier}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Novo Fornecedor</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome *</Label>
              <Input value={newSupplierForm.name} onChange={e => setNewSupplierForm(f => ({ ...f, name: e.target.value }))} placeholder="Nome do fornecedor" />
            </div>
            <div>
              <Label>NIF</Label>
              <Input value={newSupplierForm.nif} onChange={e => setNewSupplierForm(f => ({ ...f, nif: e.target.value }))} placeholder="NIF" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Email</Label>
                <Input value={newSupplierForm.email} onChange={e => setNewSupplierForm(f => ({ ...f, email: e.target.value }))} placeholder="Email" />
              </div>
              <div>
                <Label>Telefone</Label>
                <Input value={newSupplierForm.phone} onChange={e => setNewSupplierForm(f => ({ ...f, phone: e.target.value }))} placeholder="Telefone" />
              </div>
            </div>
            <div>
              <Label>Morada</Label>
              <Input value={newSupplierForm.address} onChange={e => setNewSupplierForm(f => ({ ...f, address: e.target.value }))} placeholder="Morada" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Cidade</Label>
                <Input value={newSupplierForm.city} onChange={e => setNewSupplierForm(f => ({ ...f, city: e.target.value }))} placeholder="Cidade" />
              </div>
              <div>
                <Label>País</Label>
                <Input value={newSupplierForm.country} onChange={e => setNewSupplierForm(f => ({ ...f, country: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateSupplier(false)}>Cancelar</Button>
            <Button
              disabled={!newSupplierForm.name.trim()}
              onClick={async () => {
                try {
                  const created = await createSupplier({
                    name: newSupplierForm.name.trim(),
                    nif: newSupplierForm.nif.trim() || '',
                    email: newSupplierForm.email.trim(),
                    phone: newSupplierForm.phone.trim(),
                    address: newSupplierForm.address.trim(),
                    city: newSupplierForm.city.trim(),
                    country: newSupplierForm.country.trim() || 'Angola',
                    contactPerson: newSupplierForm.contactPerson.trim(),
                    notes: newSupplierForm.notes.trim(),
                    isActive: true,
                    balance: 0,
                    paymentTerms: '30_days',
                  } as any);
                  setShowCreateSupplier(false);
                  handleSelectSupplier(created);
                  toast({ title: 'Fornecedor criado', description: `${created.name} adicionado e seleccionado` });
                } catch (err: any) {
                  toast({ title: 'Erro', description: err.message || 'Falha ao criar fornecedor', variant: 'destructive' });
                }
              }}
            >
              <Save className="h-4 w-4 mr-1" /> Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
