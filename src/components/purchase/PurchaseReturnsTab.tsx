/**
 * Devolução de Compra (Purchase Returns) Tab Component
 * Lives inside the Compras page as a third tab.
 * Linked to existing Fatura de Compra documents.
 */
import { useState, useMemo, useCallback, useEffect } from 'react';
import { generateId } from '@/lib/utils';
import { useProducts, useSuppliers, useAuth } from '@/hooks/useERP';
import { useBranchContext } from '@/contexts/BranchContext';
import { api } from '@/lib/api/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import {
  PurchaseInvoice,
  getPurchaseInvoices,
} from '@/lib/purchaseInvoiceStorage';
import {
  SupplierReturn,
  SupplierReturnItem,
  getSupplierReturns,
  saveSupplierReturn,
  generateSupplierReturnNumber,
} from '@/lib/supplierReturns';
import { processTransaction } from '@/lib/transactionEngine';
import { saveDocument } from '@/lib/documentStorage';
import type { ERPDocument } from '@/types/documents';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
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
import {
  Search, Plus, Save, Eye, RotateCcw, CheckCircle, XCircle,
  Truck, Package, AlertCircle,
} from 'lucide-react';

const RETURN_STATUS_BADGES: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  pending: { label: 'Pendente', variant: 'secondary' },
  approved: { label: 'Aprovado', variant: 'default' },
  shipped: { label: 'Enviado', variant: 'outline' },
  completed: { label: 'Concluído', variant: 'default' },
  cancelled: { label: 'Anulado', variant: 'destructive' },
};

const REASON_LABELS: Record<string, string> = {
  damaged: 'Danificado',
  wrong_item: 'Produto Errado',
  quality: 'Qualidade',
  overstock: 'Excesso de Stock',
  other: 'Outro',
};

interface ReturnLineForm {
  productId: string;
  productName: string;
  sku: string;
  maxQty: number;
  quantity: number;
  unitCost: number;
  taxRate: number;
  selected: boolean;
}

export function PurchaseReturnsTab() {
  const { toast } = useToast();
  const { currentBranch } = useBranchContext();
  const { user } = useAuth();
  const branchId = currentBranch?.id;

  // Data
  const [returns, setReturns] = useState<SupplierReturn[]>([]);
  const [invoices, setInvoices] = useState<PurchaseInvoice[]>([]);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<PurchaseInvoice | null>(null);
  const [invoicePickerOpen, setInvoicePickerOpen] = useState(false);
  const [reason, setReason] = useState<SupplierReturn['reason']>('damaged');
  const [reasonDescription, setReasonDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [returnLines, setReturnLines] = useState<ReturnLineForm[]>([]);
  const [saving, setSaving] = useState(false);

  // View dialog
  const [viewReturn, setViewReturn] = useState<SupplierReturn | null>(null);

  // Load data
  const loadData = useCallback(async () => {
    const [rets, invs] = await Promise.all([
      getSupplierReturns(branchId),
      getPurchaseInvoices(branchId),
    ]);
    setReturns(rets);
    setInvoices(invs.filter(i => i.status === 'confirmed'));
  }, [branchId]);

  useEffect(() => { loadData(); }, [loadData]);

  // Filter returns
  const filteredReturns = useMemo(() => {
    let result = returns;
    if (filterStatus !== 'all') result = result.filter(r => r.status === filterStatus);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(r =>
        r.returnNumber.toLowerCase().includes(q) ||
        r.supplierName.toLowerCase().includes(q) ||
        r.purchaseOrderNumber?.toLowerCase().includes(q)
      );
    }
    return result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [returns, search, filterStatus]);

  // Select invoice → populate lines
  const handleSelectInvoice = useCallback((inv: PurchaseInvoice) => {
    setSelectedInvoice(inv);
    setReturnLines(inv.lines.map(line => ({
      productId: line.productId,
      productName: line.description,
      sku: line.productCode,
      maxQty: line.totalQty,
      quantity: line.totalQty,
      unitCost: line.unitPrice,
      taxRate: line.ivaRate,
      selected: true,
    })));
    setInvoicePickerOpen(false);
  }, []);

  // Create return
  const handleCreate = useCallback(async () => {
    if (!selectedInvoice || !branchId || !user) return;
    const selectedLines = returnLines.filter(l => l.selected && l.quantity > 0);
    if (selectedLines.length === 0) {
      toast({ title: 'Erro', description: 'Seleccione pelo menos uma linha', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      const branchCode = currentBranch?.code || currentBranch?.name?.substring(0, 4).toUpperCase() || 'SEDE';
      const returnNumber = generateSupplierReturnNumber(branchCode);

      const items: SupplierReturnItem[] = selectedLines.map(line => {
        const subtotal = line.quantity * line.unitCost;
        const taxAmount = subtotal * (line.taxRate / 100);
        return {
          productId: line.productId,
          productName: line.productName,
          sku: line.sku,
          quantity: line.quantity,
          unitCost: line.unitCost,
          taxRate: line.taxRate,
          taxAmount,
          subtotal,
          reason: reasonDescription,
        };
      });

      const subtotal = items.reduce((s, i) => s + i.subtotal, 0);
      const taxAmount = items.reduce((s, i) => s + i.taxAmount, 0);
      const total = subtotal + taxAmount;

      // Resolve real supplier ID from suppliers list by matching name/NIF
      let resolvedSupplierId = '';
      try {
        const suppliersResp = await api.suppliers.list();
        const allSuppliers = suppliersResp.data || [];
        const matched = allSuppliers.find((s: any) =>
          s.name === selectedInvoice.supplierName ||
          (selectedInvoice.supplierNif && s.nif === selectedInvoice.supplierNif)
        );
        resolvedSupplierId = matched?.id || '';
      } catch {
        // fallback: try localStorage
        const raw = localStorage.getItem('kwanzaerp_suppliers');
        const suppliers = raw ? JSON.parse(raw) : [];
        const matched = suppliers.find((s: any) =>
          s.name === selectedInvoice.supplierName ||
          (selectedInvoice.supplierNif && s.nif === selectedInvoice.supplierNif)
        );
        resolvedSupplierId = matched?.id || '';
      }

      const returnDoc: SupplierReturn = {
        id: generateId(),
        returnNumber,
        branchId,
        branchName: currentBranch?.name || '',
        purchaseOrderId: selectedInvoice.id,
        purchaseOrderNumber: selectedInvoice.invoiceNumber,
        supplierId: resolvedSupplierId,
        supplierName: selectedInvoice.supplierName,
        reason,
        reasonDescription,
        items,
        subtotal,
        taxAmount,
        total,
        status: 'pending',
        createdBy: user.name || user.username || 'Sistema',
        createdAt: new Date().toISOString(),
        notes,
      };

      // Save the return document
      await saveSupplierReturn(returnDoc);

      // Stock OUT movements (decrease inventory)
      for (const item of items) {
        try {
          await api.transactions.createStockMovement({
            productId: item.productId,
            warehouseId: branchId,
            movementType: 'OUT',
            quantity: item.quantity,
            referenceType: 'return',
            referenceId: returnDoc.id,
            referenceNumber: returnNumber,
            notes: `Devolução de compra: ${reasonDescription}`,
            createdBy: returnDoc.createdBy,
          });
        } catch {
          try {
            await api.products.updateStock(item.productId, -item.quantity);
          } catch { /* fallback silently */ }
        }
      }

      // Create linked Nota de Débito document
      const debitNoteDoc: ERPDocument = {
        id: generateId(),
        documentType: 'nota_debito',
        documentNumber: returnNumber,
        branchId,
        branchName: currentBranch?.name || '',
        entityType: 'supplier',
        entityName: selectedInvoice.supplierName,
        entityNif: selectedInvoice.supplierNif,
        entityCode: selectedInvoice.supplierAccountCode,
        lines: items.map(item => ({
          id: generateId(),
          productId: item.productId,
          productSku: item.sku,
          description: item.productName,
          quantity: item.quantity,
          unitPrice: item.unitCost,
          discount: 0,
          discountAmount: 0,
          taxRate: item.taxRate,
          taxAmount: item.taxAmount,
          lineTotal: item.subtotal + item.taxAmount,
        })),
        subtotal,
        totalDiscount: 0,
        totalTax: taxAmount,
        total,
        currency: selectedInvoice.currency === 'KZ' ? 'AOA' : selectedInvoice.currency,
        amountPaid: 0,
        amountDue: total,
        parentDocumentId: selectedInvoice.id,
        parentDocumentNumber: selectedInvoice.invoiceNumber,
        parentDocumentType: 'fatura_compra',
        status: 'confirmed',
        issueDate: new Date().toISOString().slice(0, 10),
        issueTime: new Date().toTimeString().slice(0, 8),
        notes: `Devolução: ${reasonDescription}`,
        createdBy: returnDoc.createdBy,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        confirmedBy: returnDoc.createdBy,
        confirmedAt: new Date().toISOString(),
      };

      await saveDocument(debitNoteDoc);

      // Reverse accounting — debit supplier (reduce payable), credit purchase account + IVA
      const purchaseAccountCode = selectedInvoice.purchaseAccountCode || '2.1.1';
      const ivaAccountCode = selectedInvoice.ivaAccountCode || '3.3.1';
      const supplierAccountCode = selectedInvoice.supplierAccountCode || '3.2.1';

      try {
        await processTransaction({
          transactionType: 'credit_note',
          documentId: returnDoc.id,
          documentNumber: returnNumber,
          branchId,
          branchName: currentBranch?.name || '',
          userId: user?.id || '',
          userName: user?.name || user?.username || 'Sistema',
          date: new Date().toISOString().slice(0, 10),
          description: `Devolução de compra - ${returnNumber} — ${selectedInvoice.supplierName}`,
          amount: total,

          // Phase 1: Stock OUT entries
          stockEntries: items.map(item => ({
            productId: item.productId,
            productName: item.productName,
            productSku: item.sku,
            quantity: item.quantity,
            unitCost: item.unitCost,
            direction: 'OUT' as const,
            warehouseId: branchId,
          })),

          // Phase 3: Reverse journal entries (mirror of purchase invoice)
          // Purchase invoice: Debit 2.1.1 (Purchase) + Debit 3.3.1 (IVA) / Credit Supplier
          // Return reversal: Debit Supplier / Credit 2.1.1 (Purchase) + Credit 3.3.1 (IVA)
          journalLines: [
            {
              accountCode: supplierAccountCode,
              accountName: `Fornecedor ${selectedInvoice.supplierName}`,
              debit: total,
              credit: 0,
              note: `Devolução ${returnNumber}`,
            },
            {
              accountCode: purchaseAccountCode,
              accountName: 'Compra de Mercadorias',
              debit: 0,
              credit: subtotal,
              note: `Devolução ${returnNumber} — base`,
            },
            ...(taxAmount > 0 ? [{
              accountCode: ivaAccountCode,
              accountName: 'IVA Dedutível',
              debit: 0,
              credit: taxAmount,
              note: `Devolução ${returnNumber} — IVA`,
            }] : []),
          ],

          // Phase 4: Open item (credit note reduces supplier payable)
          openItem: {
            entityType: 'supplier' as const,
            entityId: resolvedSupplierId,
            entityName: selectedInvoice.supplierName,
            documentType: 'credit_note' as const,
            originalAmount: total,
            isDebit: false,
            currency: selectedInvoice.currency === 'KZ' ? 'AOA' : selectedInvoice.currency,
          },

          // Phase 5: Document link (return → original invoice)
          documentLinks: [{
            sourceType: 'nota_debito',
            sourceId: returnDoc.id,
            sourceNumber: returnNumber,
            targetType: 'fatura_compra',
            targetId: selectedInvoice.id,
            targetNumber: selectedInvoice.invoiceNumber,
          }],

          // Phase 6: Update supplier balance (decrease)
          entityBalanceUpdate: {
            entityType: 'supplier',
            entityId: resolvedSupplierId,
            entityName: selectedInvoice.supplierName,
            entityNif: selectedInvoice.supplierNif,
            amount: -total,
          },
        });
      } catch (err) {
        console.warn('Transaction engine fallback for purchase return:', err);
      }

      toast({ title: 'Devolução criada', description: `${returnNumber} — ${selectedLines.length} linha(s)` });
      setCreateOpen(false);
      resetForm();
      await loadData();
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message || 'Falha ao criar devolução', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }, [selectedInvoice, branchId, user, returnLines, reason, reasonDescription, notes, currentBranch, loadData, toast]);

  const resetForm = () => {
    setSelectedInvoice(null);
    setReturnLines([]);
    setReason('damaged');
    setReasonDescription('');
    setNotes('');
  };

  // Status actions
  const handleApprove = useCallback(async (ret: SupplierReturn) => {
    if (ret.status !== 'pending') return;
    ret.status = 'approved';
    ret.approvedBy = user?.name || 'Sistema';
    ret.approvedAt = new Date().toISOString();
    await saveSupplierReturn(ret);
    toast({ title: 'Devolução aprovada' });
    await loadData();
  }, [user, loadData, toast]);

  const handleCancel = useCallback(async (ret: SupplierReturn) => {
    if (ret.status !== 'pending') return;
    // Reverse stock — add back IN
    for (const item of ret.items) {
      try {
        await api.transactions.createStockMovement({
          productId: item.productId,
          warehouseId: ret.branchId,
          movementType: 'IN',
          quantity: item.quantity,
          referenceType: 'adjustment',
          referenceId: ret.id,
          referenceNumber: ret.returnNumber,
          notes: 'Cancelamento de devolução de compra',
          createdBy: user?.name || 'Sistema',
        });
      } catch {
        try { await api.products.updateStock(item.productId, item.quantity); } catch { }
      }
    }
    ret.status = 'cancelled';
    await saveSupplierReturn(ret);
    toast({ title: 'Devolução anulada', description: 'Stock reposto' });
    await loadData();
  }, [user, loadData, toast]);

  const handleComplete = useCallback(async (ret: SupplierReturn) => {
    if (ret.status !== 'approved' && ret.status !== 'shipped') return;
    ret.status = 'completed';
    ret.completedAt = new Date().toISOString();
    await saveSupplierReturn(ret);
    toast({ title: 'Devolução concluída' });
    await loadData();
  }, [loadData, toast]);

  const fmtKz = (v: number) => new Intl.NumberFormat('pt-AO', { style: 'currency', currency: 'AOA', minimumFractionDigits: 2 }).format(v);

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-2 items-end">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Pesquisar devolução..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="pending">Pendente</SelectItem>
            <SelectItem value="approved">Aprovado</SelectItem>
            <SelectItem value="shipped">Enviado</SelectItem>
            <SelectItem value="completed">Concluído</SelectItem>
            <SelectItem value="cancelled">Anulado</SelectItem>
          </SelectContent>
        </Select>
        <Button className="gap-2 ml-auto" onClick={() => { resetForm(); setCreateOpen(true); }}>
          <Plus className="h-4 w-4" /> Nova Devolução
        </Button>
      </div>

      {/* Returns List */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="text-[11px] h-8">
                <TableHead className="w-[160px]">Nº Devolução</TableHead>
                <TableHead>Fornecedor</TableHead>
                <TableHead>Filial</TableHead>
                <TableHead>Fatura Origem</TableHead>
                <TableHead>Motivo</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Data</TableHead>
                <TableHead className="w-[120px]">Acções</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredReturns.map(ret => {
                const statusBadge = RETURN_STATUS_BADGES[ret.status] || { label: ret.status, variant: 'outline' as const };
                return (
                  <TableRow key={ret.id} className="h-8 text-[11px]">
                    <TableCell className="font-mono font-medium">{ret.returnNumber}</TableCell>
                    <TableCell>{ret.supplierName}</TableCell>
                    <TableCell className="text-muted-foreground">{ret.branchName || '—'}</TableCell>
                    <TableCell className="font-mono text-muted-foreground">{ret.purchaseOrderNumber}</TableCell>
                    <TableCell>{REASON_LABELS[ret.reason] || ret.reason}</TableCell>
                    <TableCell className="text-right font-mono">{fmtKz(ret.total)}</TableCell>
                    <TableCell>
                      <Badge variant={statusBadge.variant} className="text-[9px]">{statusBadge.label}</Badge>
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {ret.createdAt ? format(new Date(ret.createdAt), 'dd/MM/yy', { locale: pt }) : '—'}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setViewReturn(ret)}>
                          <Eye className="h-3 w-3" />
                        </Button>
                        {ret.status === 'pending' && (
                          <>
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-green-600" onClick={() => handleApprove(ret)} title="Aprovar">
                              <CheckCircle className="h-3 w-3" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => handleCancel(ret)} title="Anular">
                              <XCircle className="h-3 w-3" />
                            </Button>
                          </>
                        )}
                        {(ret.status === 'approved' || ret.status === 'shipped') && (
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-blue-600" onClick={() => handleComplete(ret)} title="Concluir">
                            <CheckCircle className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {filteredReturns.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                    <RotateCcw className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    Nenhuma devolução encontrada
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* ═══ CREATE RETURN DIALOG ═══ */}
      <Dialog open={createOpen} onOpenChange={v => { if (!v) setCreateOpen(false); }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="h-5 w-5" /> Nova Devolução de Compra
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Branch info */}
            <div className="flex items-center gap-2 text-sm px-3 py-2 bg-muted/50 rounded-md border">
              <Package className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Filial:</span>
              <span className="font-medium">{currentBranch?.name || '—'}</span>
            </div>

            {/* Source invoice selection */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Fatura de Compra Origem *</Label>
                <Button
                  variant="outline"
                  className="w-full justify-start gap-2 mt-1"
                  onClick={() => setInvoicePickerOpen(true)}
                >
                  <Package className="h-4 w-4" />
                  {selectedInvoice ? (
                    <span className="font-mono">{selectedInvoice.invoiceNumber} — {selectedInvoice.supplierName}</span>
                  ) : (
                    <span className="text-muted-foreground">Seleccione uma fatura...</span>
                  )}
                </Button>
              </div>
              <div>
                <Label>Motivo *</Label>
                <Select value={reason} onValueChange={v => setReason(v as any)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="damaged">Danificado</SelectItem>
                    <SelectItem value="wrong_item">Produto Errado</SelectItem>
                    <SelectItem value="quality">Qualidade</SelectItem>
                    <SelectItem value="overstock">Excesso de Stock</SelectItem>
                    <SelectItem value="other">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Descrição do Motivo *</Label>
              <Input
                value={reasonDescription}
                onChange={e => setReasonDescription(e.target.value)}
                placeholder="Descreva o motivo da devolução..."
                className="mt-1"
              />
            </div>

            {/* Lines from invoice */}
            {selectedInvoice && returnLines.length > 0 && (
              <div>
                <Label className="mb-2 block">Linhas da Fatura — seleccione as que pretende devolver</Label>
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="text-[11px] h-8 bg-muted/50">
                        <TableHead className="w-[40px]">✓</TableHead>
                        <TableHead>SKU</TableHead>
                        <TableHead>Descrição</TableHead>
                        <TableHead className="text-right">Qtd. Max</TableHead>
                        <TableHead className="text-right w-[100px]">Qtd. Devolver</TableHead>
                        <TableHead className="text-right">Preço Unit.</TableHead>
                        <TableHead className="text-right">IVA %</TableHead>
                        <TableHead className="text-right">Subtotal</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {returnLines.map((line, idx) => {
                        const lineSubtotal = line.quantity * line.unitCost;
                        const lineTax = lineSubtotal * (line.taxRate / 100);
                        return (
                          <TableRow key={idx} className={`h-8 text-[11px] ${!line.selected ? 'opacity-40' : ''}`}>
                            <TableCell>
                              <Checkbox
                                checked={line.selected}
                                onCheckedChange={v => {
                                  const updated = [...returnLines];
                                  updated[idx].selected = !!v;
                                  setReturnLines(updated);
                                }}
                              />
                            </TableCell>
                            <TableCell className="font-mono">{line.sku}</TableCell>
                            <TableCell>{line.productName}</TableCell>
                            <TableCell className="text-right font-mono">{line.maxQty}</TableCell>
                            <TableCell className="text-right">
                              <Input
                                type="number"
                                min={0}
                                max={line.maxQty}
                                value={line.quantity}
                                onChange={e => {
                                  const val = Math.min(Number(e.target.value) || 0, line.maxQty);
                                  const updated = [...returnLines];
                                  updated[idx].quantity = val;
                                  setReturnLines(updated);
                                }}
                                className="h-6 text-[11px] w-[80px] text-right ml-auto"
                                disabled={!line.selected}
                              />
                            </TableCell>
                            <TableCell className="text-right font-mono">{fmtKz(line.unitCost)}</TableCell>
                            <TableCell className="text-right">{line.taxRate}%</TableCell>
                            <TableCell className="text-right font-mono font-medium">
                              {fmtKz(lineSubtotal + lineTax)}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                {/* Summary */}
                {(() => {
                  const selected = returnLines.filter(l => l.selected && l.quantity > 0);
                  const sub = selected.reduce((s, l) => s + l.quantity * l.unitCost, 0);
                  const tax = selected.reduce((s, l) => s + l.quantity * l.unitCost * (l.taxRate / 100), 0);
                  return (
                    <div className="flex justify-end gap-6 mt-3 text-sm font-medium">
                      <span>Subtotal: <span className="font-mono">{fmtKz(sub)}</span></span>
                      <span>IVA: <span className="font-mono">{fmtKz(tax)}</span></span>
                      <span className="text-base font-bold">Total: <span className="font-mono">{fmtKz(sub + tax)}</span></span>
                    </div>
                  );
                })()}
              </div>
            )}

            <div>
              <Label>Observações</Label>
              <Textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Notas adicionais..."
                className="mt-1"
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button
              onClick={handleCreate}
              disabled={saving || !selectedInvoice || !reasonDescription.trim() || returnLines.filter(l => l.selected && l.quantity > 0).length === 0}
              className="gap-2"
            >
              {saving ? <span className="animate-spin">⏳</span> : <Save className="h-4 w-4" />}
              Criar Devolução
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══ INVOICE PICKER DIALOG ═══ */}
      <Dialog open={invoicePickerOpen} onOpenChange={setInvoicePickerOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Seleccionar Fatura de Compra</DialogTitle>
          </DialogHeader>
          <ScrollArea className="h-[400px]">
            <Table>
              <TableHeader>
                <TableRow className="text-[11px]">
                  <TableHead>Nº Fatura</TableHead>
                  <TableHead>Fornecedor</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Linhas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map(inv => (
                  <TableRow
                    key={inv.id}
                    className="cursor-pointer hover:bg-accent h-8 text-[11px]"
                    onClick={() => handleSelectInvoice(inv)}
                  >
                    <TableCell className="font-mono font-medium">{inv.invoiceNumber}</TableCell>
                    <TableCell>{inv.supplierName}</TableCell>
                    <TableCell>{inv.date}</TableCell>
                    <TableCell className="text-right font-mono">{fmtKz(inv.total)}</TableCell>
                    <TableCell className="text-right">{inv.lines.length}</TableCell>
                  </TableRow>
                ))}
                {invoices.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      Nenhuma fatura confirmada disponível
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* ═══ VIEW RETURN DIALOG ═══ */}
      <Dialog open={!!viewReturn} onOpenChange={() => setViewReturn(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="h-5 w-5" />
              Devolução {viewReturn?.returnNumber}
            </DialogTitle>
          </DialogHeader>
          {viewReturn && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <Label className="text-muted-foreground text-xs">Fornecedor</Label>
                  <p className="font-medium">{viewReturn.supplierName}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Fatura Origem</Label>
                  <p className="font-mono">{viewReturn.purchaseOrderNumber}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Estado</Label>
                  <Badge variant={RETURN_STATUS_BADGES[viewReturn.status]?.variant || 'outline'}>
                    {RETURN_STATUS_BADGES[viewReturn.status]?.label || viewReturn.status}
                  </Badge>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Motivo</Label>
                  <p>{REASON_LABELS[viewReturn.reason] || viewReturn.reason}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Descrição</Label>
                  <p>{viewReturn.reasonDescription}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Criado por</Label>
                  <p>{viewReturn.createdBy} — {viewReturn.createdAt ? format(new Date(viewReturn.createdAt), 'dd/MM/yyyy HH:mm') : ''}</p>
                </div>
              </div>

              <Table>
                <TableHeader>
                  <TableRow className="text-[11px]">
                    <TableHead>SKU</TableHead>
                    <TableHead>Produto</TableHead>
                    <TableHead className="text-right">Qtd</TableHead>
                    <TableHead className="text-right">Custo Unit.</TableHead>
                    <TableHead className="text-right">IVA</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {viewReturn.items.map((item, i) => (
                    <TableRow key={i} className="h-8 text-[11px]">
                      <TableCell className="font-mono">{item.sku}</TableCell>
                      <TableCell>{item.productName}</TableCell>
                      <TableCell className="text-right">{item.quantity}</TableCell>
                      <TableCell className="text-right font-mono">{fmtKz(item.unitCost)}</TableCell>
                      <TableCell className="text-right font-mono">{fmtKz(item.taxAmount)}</TableCell>
                      <TableCell className="text-right font-mono font-medium">{fmtKz(item.subtotal + item.taxAmount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <div className="flex justify-end gap-6 text-sm border-t pt-3">
                <span>Subtotal: <span className="font-mono">{fmtKz(viewReturn.subtotal)}</span></span>
                <span>IVA: <span className="font-mono">{fmtKz(viewReturn.taxAmount)}</span></span>
                <span className="font-bold text-base">Total: <span className="font-mono">{fmtKz(viewReturn.total)}</span></span>
              </div>

              {viewReturn.notes && (
                <div className="text-sm">
                  <Label className="text-muted-foreground text-xs">Observações</Label>
                  <p>{viewReturn.notes}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
