// Kwanza ERP Document Creation/Edit Dialog
// Used for all document types: Proforma, Fatura, Recibo, Pagamento, etc.

import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Plus, Trash2, Search, Save, Printer, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DocumentType, DocumentLine, ERPDocument, DOCUMENT_TYPE_CONFIG } from '@/types/documents';
import { calculateLineTotals, calculateDocumentTotals, createDocument, saveDocument } from '@/lib/documentStorage';
import { useProducts, useAuth } from '@/hooks/useERP';
import { useBranchContext } from '@/contexts/BranchContext';

interface DocumentFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentType: DocumentType;
  editDocument?: ERPDocument | null;
  prefillFrom?: ERPDocument | null;  // for conversions
  onSaved?: (doc: ERPDocument) => void;
}

export function DocumentFormDialog({ open, onOpenChange, documentType, editDocument, prefillFrom, onSaved }: DocumentFormDialogProps) {
  const { user } = useAuth();
  const { currentBranch } = useBranchContext();
  const { products } = useProducts(currentBranch?.id);
  const config = DOCUMENT_TYPE_CONFIG[documentType];

  // Form state
  const [entityName, setEntityName] = useState('');
  const [entityNif, setEntityNif] = useState('');
  const [entityAddress, setEntityAddress] = useState('');
  const [entityPhone, setEntityPhone] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [notes, setNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<string>('cash');
  const [amountPaid, setAmountPaid] = useState(0);
  const [lines, setLines] = useState<DocumentLine[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [activeLineTab, setActiveLineTab] = useState('linhas');

  // Reset form when opening
  useEffect(() => {
    if (open) {
      const source = editDocument || prefillFrom;
      if (source) {
        setEntityName(source.entityName);
        setEntityNif(source.entityNif || '');
        setEntityAddress(source.entityAddress || '');
        setEntityPhone(source.entityPhone || '');
        setDueDate(source.dueDate || '');
        setValidUntil(source.validUntil || '');
        setNotes(source.notes || '');
        setPaymentMethod(source.paymentMethod || 'cash');
        setAmountPaid(source.amountPaid || 0);
        setLines(source.lines.map(l => ({ ...l })));
      } else {
        setEntityName('');
        setEntityNif('');
        setEntityAddress('');
        setEntityPhone('');
        setDueDate('');
        setValidUntil('');
        setNotes('');
        setPaymentMethod('cash');
        setAmountPaid(0);
        setLines([]);
      }
    }
  }, [open, editDocument, prefillFrom]);

  // Filtered products for search
  const filteredProducts = useMemo(() => {
    if (!productSearch) return products.slice(0, 20);
    const q = productSearch.toLowerCase();
    return products.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q) ||
      (p.barcode && p.barcode.includes(q))
    ).slice(0, 20);
  }, [products, productSearch]);

  // Totals
  const totals = useMemo(() => calculateDocumentTotals(lines), [lines]);

  const addLine = (productId?: string) => {
    const product = productId ? products.find(p => p.id === productId) : null;
    const newLine = calculateLineTotals({
      description: product ? product.name : '',
      productId: product?.id,
      productSku: product?.sku,
      quantity: 1,
      unitPrice: product?.price || 0,
      discount: 0,
      taxRate: product?.taxRate || 14,
    });
    setLines(prev => [...prev, newLine]);
    setProductSearch('');
  };

  const updateLine = (index: number, field: keyof DocumentLine, value: any) => {
    setLines(prev => {
      const updated = [...prev];
      const line = { ...updated[index], [field]: value };
      updated[index] = calculateLineTotals(line);
      return updated;
    });
  };

  const removeLine = (index: number) => {
    setLines(prev => prev.filter((_, i) => i !== index));
  };

  const handleSave = (status: 'draft' | 'confirmed') => {
    if (!entityName && config.entityType === 'customer') {
      setEntityName('Consumidor Final');
    }
    if (lines.length === 0) {
      toast.error('Adicione pelo menos uma linha');
      return;
    }

    try {
      if (editDocument) {
        const updated: ERPDocument = {
          ...editDocument,
          entityName: entityName || 'Consumidor Final',
          entityNif,
          entityAddress,
          entityPhone,
          lines,
          ...totals,
          paymentMethod: paymentMethod as any,
          amountPaid: config.requiresPayment ? amountPaid : 0,
          amountDue: config.requiresPayment ? totals.total - amountPaid : totals.total,
          dueDate,
          validUntil,
          notes,
          status,
        };
        saveDocument(updated);
        onSaved?.(updated);
        toast.success(`${config.shortLabel} actualizado`);
      } else {
        const doc = createDocument(
          documentType,
          currentBranch?.id || '',
          currentBranch?.code || 'SEDE',
          currentBranch?.name || '',
          user?.id || '',
          user?.name || '',
          {
            entityName: entityName || 'Consumidor Final',
            entityNif,
            entityAddress,
            entityPhone,
            lines,
            ...totals,
            paymentMethod: paymentMethod as any,
            amountPaid: config.requiresPayment ? amountPaid : 0,
            amountDue: config.requiresPayment ? totals.total - amountPaid : totals.total,
            parentDocumentId: prefillFrom?.id,
            parentDocumentNumber: prefillFrom?.documentNumber,
            parentDocumentType: prefillFrom?.documentType,
            dueDate,
            validUntil,
            notes,
            status,
          }
        );
        onSaved?.(doc);
        toast.success(`${config.shortLabel} ${doc.documentNumber} criado`);
      }
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || 'Erro ao guardar');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto p-0">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 bg-muted/50 border-b">
          <DialogTitle className={cn("text-sm font-bold", config.color)}>
            {editDocument ? `Editar ${config.shortLabel}` : `Novo ${config.label}`}
            {editDocument && ` - ${editDocument.documentNumber}`}
            {prefillFrom && (
              <span className="text-muted-foreground font-normal ml-2">
                (de {prefillFrom.documentNumber})
              </span>
            )}
          </DialogTitle>
          <div className="flex gap-1">
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => handleSave('draft')}>
              <Save className="w-3 h-3" /> Guardar Rascunho
            </Button>
            <Button size="sm" className="h-7 text-xs gap-1" onClick={() => handleSave('confirmed')}>
              <Save className="w-3 h-3" /> Confirmar
            </Button>
          </div>
        </div>

        <div className="p-4 space-y-4">
          {/* Entity info row */}
          <div className="grid grid-cols-4 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">{config.entityType === 'customer' ? 'Cliente' : 'Fornecedor'}</Label>
              <Input value={entityName} onChange={e => setEntityName(e.target.value)} placeholder="Consumidor Final" className="h-8 text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">NIF</Label>
              <Input value={entityNif} onChange={e => setEntityNif(e.target.value)} placeholder="999999999" className="h-8 text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Endereço</Label>
              <Input value={entityAddress} onChange={e => setEntityAddress(e.target.value)} className="h-8 text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Telefone</Label>
              <Input value={entityPhone} onChange={e => setEntityPhone(e.target.value)} className="h-8 text-xs" />
            </div>
          </div>

          {/* Dates & payment row */}
          <div className="grid grid-cols-4 gap-3">
            {documentType === 'proforma' && (
              <div className="space-y-1">
                <Label className="text-xs">Válido Até</Label>
                <Input type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)} className="h-8 text-xs" />
              </div>
            )}
            {(documentType !== 'proforma') && (
              <div className="space-y-1">
                <Label className="text-xs">Data Vencimento</Label>
                <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="h-8 text-xs" />
              </div>
            )}
            {config.requiresPayment && (
              <>
                <div className="space-y-1">
                  <Label className="text-xs">Método Pagamento</Label>
                  <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Numerário</SelectItem>
                      <SelectItem value="card">Cartão</SelectItem>
                      <SelectItem value="transfer">Transferência</SelectItem>
                      <SelectItem value="cheque">Cheque</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Valor Pago</Label>
                  <Input type="number" value={amountPaid} onChange={e => setAmountPaid(Number(e.target.value))} className="h-8 text-xs" />
                </div>
              </>
            )}
          </div>

          {/* Product search + add */}
          <div className="flex gap-2 items-end">
            <div className="flex-1 space-y-1">
              <Label className="text-xs">Adicionar Produto</Label>
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                <Input value={productSearch} onChange={e => setProductSearch(e.target.value)}
                  placeholder="Pesquisar por nome, código ou barcode..." className="h-8 text-xs pl-7" />
              </div>
            </div>
            <Button size="sm" variant="outline" className="h-8 text-xs gap-1" onClick={() => addLine()}>
              <Plus className="w-3 h-3" /> Linha Manual
            </Button>
          </div>

          {/* Product search results */}
          {productSearch && filteredProducts.length > 0 && (
            <div className="border rounded max-h-32 overflow-y-auto">
              {filteredProducts.map(p => (
                <button key={p.id} className="w-full text-left px-3 py-1.5 text-xs hover:bg-accent/50 flex justify-between"
                  onClick={() => addLine(p.id)}>
                  <span><span className="font-mono text-muted-foreground">{p.sku}</span> {p.name}</span>
                  <span className="font-mono">{p.price.toLocaleString('pt-AO')} Kz</span>
                </button>
              ))}
            </div>
          )}

          {/* Lines tabs */}
          <Tabs value={activeLineTab} onValueChange={setActiveLineTab}>
            <TabsList className="h-7 p-0 bg-muted/30 rounded-none border-b w-full justify-start">
              <TabsTrigger value="linhas" className="text-xs h-7 rounded-none border-b-2 border-transparent data-[state=active]:border-primary">
                Linhas ({lines.length})
              </TabsTrigger>
              <TabsTrigger value="notas" className="text-xs h-7 rounded-none border-b-2 border-transparent data-[state=active]:border-primary">
                Notas
              </TabsTrigger>
            </TabsList>

            <TabsContent value="linhas" className="mt-0">
              <div className="border rounded overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-muted/60 border-b">
                    <tr>
                      <th className="px-2 py-1.5 text-left w-8">#</th>
                      <th className="px-2 py-1.5 text-left w-20">Código</th>
                      <th className="px-2 py-1.5 text-left">Descrição</th>
                      <th className="px-2 py-1.5 text-right w-16">Qtd</th>
                      <th className="px-2 py-1.5 text-right w-24">Preço (s/IVA)</th>
                      <th className="px-2 py-1.5 text-right w-16">Desc%</th>
                      <th className="px-2 py-1.5 text-right w-20">Base Trib.</th>
                      <th className="px-2 py-1.5 text-right w-14">IVA%</th>
                      <th className="px-2 py-1.5 text-right w-24">Valor IVA</th>
                      <th className="px-2 py-1.5 text-right w-28">Total c/IVA</th>
                      <th className="px-2 py-1.5 w-8"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {lines.map((line, idx) => (
                      <tr key={line.id} className="hover:bg-accent/30">
                        <td className="px-2 py-1 text-muted-foreground">{idx + 1}</td>
                        <td className="px-2 py-1">
                          <Input value={line.productSku || ''} readOnly className="h-6 text-xs border-0 bg-transparent p-0" />
                        </td>
                        <td className="px-2 py-1">
                          <Input value={line.description} onChange={e => updateLine(idx, 'description', e.target.value)}
                            className="h-6 text-xs border-0 bg-transparent p-0 focus:bg-background focus:border" />
                        </td>
                        <td className="px-2 py-1">
                          <Input type="number" value={line.quantity} onChange={e => updateLine(idx, 'quantity', Number(e.target.value))}
                            className="h-6 text-xs text-right border-0 bg-transparent p-0 focus:bg-background focus:border w-full" />
                        </td>
                        <td className="px-2 py-1">
                          <Input type="number" value={line.unitPrice} onChange={e => updateLine(idx, 'unitPrice', Number(e.target.value))}
                            className="h-6 text-xs text-right border-0 bg-transparent p-0 focus:bg-background focus:border w-full" />
                        </td>
                        <td className="px-2 py-1">
                          <Input type="number" value={line.discount} onChange={e => updateLine(idx, 'discount', Number(e.target.value))}
                            className="h-6 text-xs text-right border-0 bg-transparent p-0 focus:bg-background focus:border w-full" />
                        </td>
                        <td className="px-2 py-1">
                          <Input type="number" value={line.taxRate} onChange={e => updateLine(idx, 'taxRate', Number(e.target.value))}
                            className="h-6 text-xs text-right border-0 bg-transparent p-0 focus:bg-background focus:border w-full" />
                        </td>
                        <td className="px-2 py-1 text-right font-mono">{line.taxAmount.toLocaleString('pt-AO')}</td>
                        <td className="px-2 py-1 text-right font-mono font-medium">{line.lineTotal.toLocaleString('pt-AO')}</td>
                        <td className="px-2 py-1">
                          <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => removeLine(idx)}>
                            <Trash2 className="w-3 h-3 text-destructive" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                    {lines.length === 0 && (
                      <tr><td colSpan={10} className="px-4 py-8 text-center text-muted-foreground">Nenhuma linha adicionada</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </TabsContent>

            <TabsContent value="notas" className="mt-2">
              <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Observações..." rows={3} className="text-xs" />
            </TabsContent>
          </Tabs>

          {/* Totals panel */}
          <div className="flex justify-end">
            <div className="w-72 space-y-1 text-xs border rounded p-3 bg-muted/30">
              <div className="flex justify-between"><span>Subtotal:</span><span className="font-mono">{totals.subtotal.toLocaleString('pt-AO')} Kz</span></div>
              <div className="flex justify-between text-muted-foreground"><span>Desconto:</span><span className="font-mono">-{totals.totalDiscount.toLocaleString('pt-AO')} Kz</span></div>
              <div className="flex justify-between text-muted-foreground"><span>IVA:</span><span className="font-mono">{totals.totalTax.toLocaleString('pt-AO')} Kz</span></div>
              <div className="border-t pt-1 flex justify-between font-bold text-sm">
                <span>Total:</span><span className="font-mono">{totals.total.toLocaleString('pt-AO')} Kz</span>
              </div>
              {config.requiresPayment && (
                <>
                  <div className="flex justify-between text-green-600"><span>Pago:</span><span className="font-mono">{amountPaid.toLocaleString('pt-AO')} Kz</span></div>
                  <div className="flex justify-between text-destructive font-medium"><span>Em Dívida:</span><span className="font-mono">{(totals.total - amountPaid).toLocaleString('pt-AO')} Kz</span></div>
                </>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
