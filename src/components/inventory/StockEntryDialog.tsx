import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { 
  PackagePlus, 
  Search, 
  Plus, 
  Trash2,
  Save,
  Building2
} from 'lucide-react';
import { Product, Branch } from '@/types/erp';
import { useBranches } from '@/hooks/useERP';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface EntryItem {
  productId: string;
  sku: string;
  name: string;
  unit: string;
  quantity: number;
  cost: number;
}

interface StockEntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: Product[];
  currentBranch: Branch | null;
  onApplyEntry: (items: EntryItem[], sourceBranch: string, reference: string, notes: string) => void;
}

export function StockEntryDialog({
  open,
  onOpenChange,
  products,
  currentBranch,
  onApplyEntry,
}: StockEntryDialogProps) {
  const { toast } = useToast();
  const { branches } = useBranches();
  const [searchTerm, setSearchTerm] = useState('');
  const [sourceBranch, setSourceBranch] = useState<string>('');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<EntryItem[]>([]);
  const [newItemQty, setNewItemQty] = useState<Record<string, number>>({});

  // Filter out current branch from source options
  const sourceBranches = useMemo(() => 
    branches.filter(b => b.id !== currentBranch?.id),
    [branches, currentBranch]
  );

  // Search products
  const filteredProducts = useMemo(() => {
    if (!searchTerm) return [];
    const term = searchTerm.toLowerCase();
    return products
      .filter(p => 
        p.sku.toLowerCase().includes(term) || 
        p.name.toLowerCase().includes(term) ||
        p.barcode?.toLowerCase().includes(term)
      )
      .slice(0, 10);
  }, [products, searchTerm]);

  // Generate entry number
  const entryNumber = useMemo(() => {
    const date = format(new Date(), 'yyyyMMdd');
    const seq = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `ENT-${currentBranch?.code || 'XX'}-${date}-${seq}`;
  }, [currentBranch]);

  // Add item to list
  const handleAddItem = (product: Product) => {
    const qty = newItemQty[product.id] || 1;
    const existing = items.find(i => i.productId === product.id);
    
    if (existing) {
      setItems(prev => prev.map(i => 
        i.productId === product.id 
          ? { ...i, quantity: i.quantity + qty }
          : i
      ));
    } else {
      setItems(prev => [...prev, {
        productId: product.id,
        sku: product.sku,
        name: product.name,
        unit: product.unit,
        quantity: qty,
        cost: product.cost || 0,
      }]);
    }
    
    setNewItemQty(prev => ({ ...prev, [product.id]: 1 }));
    setSearchTerm('');
  };

  // Remove item from list
  const handleRemoveItem = (productId: string) => {
    setItems(prev => prev.filter(i => i.productId !== productId));
  };

  // Update quantity
  const handleUpdateQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      handleRemoveItem(productId);
      return;
    }
    setItems(prev => prev.map(i => 
      i.productId === productId ? { ...i, quantity } : i
    ));
  };

  // Calculate totals
  const totals = useMemo(() => ({
    items: items.length,
    units: items.reduce((sum, i) => sum + i.quantity, 0),
    value: items.reduce((sum, i) => sum + (i.quantity * i.cost), 0),
  }), [items]);

  // Apply entry
  const handleApply = () => {
    if (items.length === 0) {
      toast({
        title: 'Sem itens',
        description: 'Adicione pelo menos um item para dar entrada.',
        variant: 'destructive',
      });
      return;
    }

    if (!sourceBranch) {
      toast({
        title: 'Filial de origem obrigatória',
        description: 'Seleccione a filial de onde vem a mercadoria.',
        variant: 'destructive',
      });
      return;
    }

    onApplyEntry(items, sourceBranch, reference || entryNumber, notes);
    
    toast({
      title: 'Entrada registada',
      description: `${items.length} produtos adicionados ao stock.`,
    });

    // Reset form
    setItems([]);
    setSourceBranch('');
    setReference('');
    setNotes('');
    onOpenChange(false);
  };

  const formatCurrency = (value: number) => 
    new Intl.NumberFormat('pt-AO', { style: 'currency', currency: 'AOA' }).format(value);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PackagePlus className="w-5 h-5 text-emerald-600" />
            Ajustar Entrada - Recepção de Stock
          </DialogTitle>
          <DialogDescription>
            Dê entrada de mercadoria transferida de outra filial para {currentBranch?.name || 'esta filial'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-4">
          {/* Entry Info */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 border rounded-lg bg-muted/30">
            <div className="space-y-2">
              <Label>Nº Entrada</Label>
              <Input value={entryNumber} readOnly className="font-mono bg-muted" />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Building2 className="w-4 h-4" />
                Filial de Origem *
              </Label>
              <Select value={sourceBranch} onValueChange={setSourceBranch}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar origem..." />
                </SelectTrigger>
                <SelectContent className="bg-background border shadow-lg z-50">
                  {sourceBranches.map(b => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name} ({b.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Referência / Guia</Label>
              <Input 
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="Nº guia de remessa..."
              />
            </div>
          </div>

          {/* Search Products */}
          <div className="space-y-2">
            <Label>Adicionar Produtos</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Pesquisar por código, nome ou código de barras..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            {/* Search Results */}
            {filteredProducts.length > 0 && (
              <div className="border rounded-lg max-h-48 overflow-auto">
                {filteredProducts.map(p => (
                  <div 
                    key={p.id} 
                    className="flex items-center justify-between p-2 hover:bg-muted border-b last:border-b-0"
                  >
                    <div className="flex-1">
                      <span className="font-mono text-sm mr-2">{p.sku}</span>
                      <span className="text-sm">{p.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min="1"
                        value={newItemQty[p.id] || 1}
                        onChange={(e) => setNewItemQty(prev => ({ 
                          ...prev, 
                          [p.id]: parseInt(e.target.value) || 1 
                        }))}
                        className="w-20 h-8"
                      />
                      <Button 
                        size="sm" 
                        className="h-8"
                        onClick={() => handleAddItem(p)}
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Items Table */}
          <ScrollArea className="flex-1 border rounded-lg">
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10">
                <TableRow>
                  <TableHead className="w-[100px]">Código</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead className="w-[60px] text-center">Un.</TableHead>
                  <TableHead className="w-[120px] text-center">Quantidade</TableHead>
                  <TableHead className="w-[120px] text-right">Custo Un.</TableHead>
                  <TableHead className="w-[120px] text-right">Total</TableHead>
                  <TableHead className="w-[60px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                      <PackagePlus className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>Nenhum produto adicionado</p>
                      <p className="text-xs">Pesquise e adicione produtos acima</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((item) => (
                    <TableRow key={item.productId}>
                      <TableCell className="font-mono text-sm">{item.sku}</TableCell>
                      <TableCell>{item.name}</TableCell>
                      <TableCell className="text-center">{item.unit}</TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => handleUpdateQuantity(item.productId, parseInt(e.target.value) || 0)}
                          className="h-8 text-center"
                        />
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(item.cost)}
                      </TableCell>
                      <TableCell className="text-right font-mono font-medium">
                        {formatCurrency(item.quantity * item.cost)}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-destructive hover:text-destructive"
                          onClick={() => handleRemoveItem(item.productId)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </ScrollArea>

          {/* Summary */}
          <div className="grid grid-cols-3 gap-4 p-4 border rounded-lg bg-emerald-50 dark:bg-emerald-950/30">
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Itens</p>
              <p className="text-xl font-bold">{totals.items}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Total Unidades</p>
              <p className="text-xl font-bold">{totals.units}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Valor Total</p>
              <p className="text-xl font-bold text-emerald-600">{formatCurrency(totals.value)}</p>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notas adicionais sobre esta entrada..."
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button 
            onClick={handleApply}
            className="bg-emerald-600 hover:bg-emerald-700"
            disabled={items.length === 0}
          >
            <Save className="w-4 h-4 mr-2" />
            Confirmar Entrada ({items.length} itens)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
