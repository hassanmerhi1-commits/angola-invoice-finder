import { useState, useEffect } from 'react';
import { Product } from '@/types/erp';
import { useBranches, useCategories, useSuppliers } from '@/hooks/useERP';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Check, X, ChevronLeft, ChevronRight, Plus, Search } from 'lucide-react';

interface ProductDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product?: Product | null;
  onSave: (product: Product) => void;
}

const UNITS = [
  { value: 'un', label: 'Unidade' },
  { value: 'kg', label: 'Quilograma' },
  { value: 'g', label: 'Grama' },
  { value: 'l', label: 'Litro' },
  { value: 'ml', label: 'Mililitro' },
  { value: 'cx', label: 'Caixa' },
  { value: 'emb', label: 'Embalagem' },
  { value: 'pct', label: 'Pacote' },
];

const IVA_RATES = [0, 5, 7, 14];

export function ProductDetailDialog({
  open,
  onOpenChange,
  product,
  onSave,
}: ProductDetailDialogProps) {
  const { branches } = useBranches();
  const { categories } = useCategories();
  const { suppliers } = useSuppliers();
  
  const activeCategories = categories.filter(c => c.isActive);
  const activeSuppliers = suppliers.filter(s => s.isActive);

  const [formData, setFormData] = useState({
    // Basic Info
    id: '',
    sku: '',
    name: '',
    description2: '',
    category: '',
    subcategory1: '',
    subcategory2: '',
    // Location & Supplier
    lugar: '',
    fornecedorCode: '',
    fornecedorName: '',
    curso: '',
    embalagem: 1,
    qtdMinima: 0,
    qtdMaxima: 0,
    unit: 'un',
    transacao: 'ALL',
    iva: 14,
    tipo: 'INVENTARIO',
    plu: '',
    hasSN: false,
    motivoTabela: '',
    uDate: new Date().toISOString().split('T')[0],
    // Prices
    moeda: 'KZ',
    pesoLiquido: 0,
    pesoBruto: 0,
    posPrice: 0,
    volumeNo: false,
    vendaDesconto: false,
    price1: 0,
    price2: 0,
    price3: 0,
    priceIVA: 0,
    spPrice: 0,
    compraDesconto: 0,
    descontoMaximo: 100,
    // Costs
    iniciarCustoUS: 0,
    iniciarCustoAK: 0,
    custoMedioUS: 0,
    custoMedioAK: 0,
    ultimoCustoUS: 0,
    lCostVat: 0,
    custoManual: 0,
    custoEmbalagem: {
      USD: 0,
      AKZ: 0,
    },
    ultimoCustoUS2: 0,
    ultimoCustoAI: 0,
    // POS Info
    noPedido: 0,
    cor: '',
    corNot: '',
    impressora: '',
    posPriceLC: 0,
    pricePercent: 0,
    posDiscount2: 0,
    precoIVA: 0,
    lastPRate: 0,
    // Barcodes
    barcodes: [
      { barPrice: '', embalagem: 1, priceLC: 0, plu: '', ultimoCusto: 0 },
    ],
    // Stock
    stock: 0,
    branchId: 'all',
    isActive: true,
  });

  useEffect(() => {
    if (product) {
      setFormData(prev => ({
        ...prev,
        id: product.id,
        sku: product.sku,
        name: product.name,
        category: product.category,
        unit: product.unit,
        iva: product.taxRate,
        price1: product.price,
        posPrice: product.price,
        posPriceLC: product.price,
        priceIVA: product.price * (1 + product.taxRate / 100),
        iniciarCustoAK: product.cost,
        custoMedioAK: product.cost,
        stock: product.stock,
        branchId: product.branchId,
        isActive: product.isActive,
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        id: '',
        sku: '',
        name: '',
        category: 'Alimentação',
        unit: 'un',
        iva: 14,
        price1: 0,
        posPrice: 0,
        posPriceLC: 0,
        priceIVA: 0,
        iniciarCustoAK: 0,
        custoMedioAK: 0,
        stock: 0,
        branchId: 'all',
        isActive: true,
      }));
    }
  }, [product, open]);

  const handleSave = () => {
    const cost = formData.iniciarCustoAK || formData.custoMedioAK;
    const savedProduct: Product = {
      id: formData.id || `prod_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: formData.name,
      sku: formData.sku || `SKU-${Date.now()}`,
      barcode: formData.barcodes[0]?.barPrice || undefined,
      category: formData.category,
      price: formData.price1 || formData.posPrice,
      cost: cost,
      firstCost: product?.firstCost || formData.iniciarCustoAK || cost,
      lastCost: formData.ultimoCustoUS || cost,
      avgCost: formData.custoMedioAK || cost,
      stock: formData.stock,
      unit: formData.unit,
      taxRate: formData.iva,
      branchId: formData.branchId,
      supplierId: undefined,
      supplierName: formData.fornecedorName || undefined,
      isActive: formData.isActive,
      createdAt: product?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    onSave(savedProduct);
    onOpenChange(false);
  };

  const margin = formData.price1 > 0 && formData.iniciarCustoAK > 0
    ? (((formData.price1 - formData.iniciarCustoAK) / formData.iniciarCustoAK) * 100).toFixed(2)
    : '0.00';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden p-0">
        <DialogHeader className="px-4 py-3 border-b bg-muted/50">
          <DialogTitle className="text-lg">Stock Produto</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="info" className="flex flex-col h-full">
          <TabsList className="w-full justify-start rounded-none border-b bg-muted/30 px-4">
            <TabsTrigger value="info" className="text-xs">Informações de Produto</TabsTrigger>
            <TabsTrigger value="barcodes" className="text-xs">Barcodes</TabsTrigger>
          </TabsList>

          <TabsContent value="info" className="flex-1 overflow-auto m-0 p-0">
            <div className="grid grid-cols-3 gap-0 text-xs">
              {/* Column 1 - Basic Info */}
              <div className="border-r p-3 space-y-2">
                <div className="grid grid-cols-[100px_1fr] items-center gap-1">
                  <Label className="text-[11px]">Codigo do Produto</Label>
                  <Input 
                    value={formData.sku} 
                    onChange={e => setFormData({...formData, sku: e.target.value})}
                    className="h-7 text-xs"
                  />
                </div>
                <div className="grid grid-cols-[100px_1fr] items-center gap-1">
                  <Label className="text-[11px]">Descrição 1</Label>
                  <Input 
                    value={formData.name} 
                    onChange={e => setFormData({...formData, name: e.target.value})}
                    className="h-7 text-xs"
                  />
                </div>
                <div className="grid grid-cols-[100px_1fr] items-center gap-1">
                  <Label className="text-[11px]">Descrição 2</Label>
                  <Input 
                    value={formData.description2} 
                    onChange={e => setFormData({...formData, description2: e.target.value})}
                    className="h-7 text-xs"
                  />
                </div>
                <div className="grid grid-cols-[100px_1fr] items-center gap-1">
                  <Label className="text-[11px]">Categoria</Label>
                  <Select value={formData.category} onValueChange={v => setFormData({...formData, category: v})}>
                    <SelectTrigger className="h-7 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border shadow-lg z-50">
                      {activeCategories.map(cat => (
                        <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-[100px_1fr] items-center gap-1">
                  <Label className="text-[11px]">Subcategoria 1</Label>
                  <Input 
                    value={formData.subcategory1} 
                    onChange={e => setFormData({...formData, subcategory1: e.target.value})}
                    className="h-7 text-xs"
                  />
                </div>
                <div className="grid grid-cols-[100px_1fr] items-center gap-1">
                  <Label className="text-[11px]">Subcategoria 2</Label>
                  <Input 
                    value={formData.subcategory2} 
                    onChange={e => setFormData({...formData, subcategory2: e.target.value})}
                    className="h-7 text-xs"
                  />
                </div>
                <div className="grid grid-cols-[100px_1fr] items-center gap-1">
                  <Label className="text-[11px]">Lugar</Label>
                  <Input 
                    value={formData.lugar} 
                    onChange={e => setFormData({...formData, lugar: e.target.value})}
                    className="h-7 text-xs"
                  />
                </div>
                <div className="grid grid-cols-[100px_1fr] items-center gap-1">
                  <Label className="text-[11px]">Fornecedor</Label>
                  <div className="flex gap-1">
                    <Input 
                      value={formData.fornecedorCode} 
                      onChange={e => setFormData({...formData, fornecedorCode: e.target.value})}
                      className="h-7 text-xs w-24"
                    />
                    <Select 
                      value={formData.fornecedorName} 
                      onValueChange={v => setFormData({...formData, fornecedorName: v})}
                    >
                      <SelectTrigger className="h-7 text-xs flex-1">
                        <SelectValue placeholder="Selecionar" />
                      </SelectTrigger>
                      <SelectContent className="bg-popover border shadow-lg z-50">
                        {activeSuppliers.map(sup => (
                          <SelectItem key={sup.id} value={sup.name}>{sup.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-[100px_1fr] items-center gap-1">
                  <Label className="text-[11px]">Curso</Label>
                  <Input 
                    value={formData.curso} 
                    onChange={e => setFormData({...formData, curso: e.target.value})}
                    className="h-7 text-xs"
                  />
                </div>
                <div className="grid grid-cols-[100px_1fr] items-center gap-1">
                  <Label className="text-[11px]">Embalagem</Label>
                  <Input 
                    type="number"
                    value={formData.embalagem} 
                    onChange={e => setFormData({...formData, embalagem: parseInt(e.target.value) || 1})}
                    className="h-7 text-xs"
                  />
                </div>
                <div className="grid grid-cols-[100px_1fr] items-center gap-1">
                  <Label className="text-[11px]">Qtd Minima</Label>
                  <Input 
                    type="number"
                    value={formData.qtdMinima} 
                    onChange={e => setFormData({...formData, qtdMinima: parseInt(e.target.value) || 0})}
                    className="h-7 text-xs"
                  />
                </div>
                <div className="grid grid-cols-[100px_1fr] items-center gap-1">
                  <Label className="text-[11px]">Qtd Maximo</Label>
                  <Input 
                    type="number"
                    value={formData.qtdMaxima} 
                    onChange={e => setFormData({...formData, qtdMaxima: parseInt(e.target.value) || 0})}
                    className="h-7 text-xs"
                  />
                </div>
                <div className="grid grid-cols-[100px_1fr] items-center gap-1">
                  <Label className="text-[11px]">Unidade</Label>
                  <Select value={formData.unit} onValueChange={v => setFormData({...formData, unit: v})}>
                    <SelectTrigger className="h-7 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border shadow-lg z-50">
                      {UNITS.map(u => (
                        <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-[100px_1fr] items-center gap-1">
                  <Label className="text-[11px]">Transação</Label>
                  <Select value={formData.transacao} onValueChange={v => setFormData({...formData, transacao: v})}>
                    <SelectTrigger className="h-7 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border shadow-lg z-50">
                      <SelectItem value="ALL">ALL</SelectItem>
                      <SelectItem value="VENDA">VENDA</SelectItem>
                      <SelectItem value="COMPRA">COMPRA</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-[100px_1fr] items-center gap-1">
                  <Label className="text-[11px]">IVA</Label>
                  <Select 
                    value={String(formData.iva)} 
                    onValueChange={v => setFormData({...formData, iva: parseInt(v)})}
                  >
                    <SelectTrigger className="h-7 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border shadow-lg z-50">
                      {IVA_RATES.map(rate => (
                        <SelectItem key={rate} value={String(rate)}>{rate}%</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-[100px_1fr] items-center gap-1">
                  <Label className="text-[11px]">Tipo</Label>
                  <Select value={formData.tipo} onValueChange={v => setFormData({...formData, tipo: v})}>
                    <SelectTrigger className="h-7 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border shadow-lg z-50">
                      <SelectItem value="INVENTARIO">INVENTARIO</SelectItem>
                      <SelectItem value="SERVICO">SERVICO</SelectItem>
                      <SelectItem value="CONSUMIVEL">CONSUMIVEL</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-[100px_1fr] items-center gap-1">
                  <Label className="text-[11px]">Fornecedor</Label>
                  <Select 
                    value={formData.fornecedorName} 
                    onValueChange={v => setFormData({...formData, fornecedorName: v})}
                  >
                    <SelectTrigger className="h-7 text-xs">
                      <SelectValue placeholder="Selecionar" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border shadow-lg z-50">
                      {activeSuppliers.map(sup => (
                        <SelectItem key={sup.id} value={sup.name}>{sup.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-[100px_1fr] items-center gap-1">
                  <Label className="text-[11px]">PLU</Label>
                  <Input 
                    value={formData.plu} 
                    onChange={e => setFormData({...formData, plu: e.target.value})}
                    className="h-7 text-xs"
                  />
                </div>
                <div className="grid grid-cols-[100px_1fr] items-center gap-1">
                  <Label className="text-[11px]">Has SN</Label>
                  <Select 
                    value={formData.hasSN ? 'YES' : 'NO'} 
                    onValueChange={v => setFormData({...formData, hasSN: v === 'YES'})}
                  >
                    <SelectTrigger className="h-7 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border shadow-lg z-50">
                      <SelectItem value="NO">NO</SelectItem>
                      <SelectItem value="YES">YES</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-[100px_1fr] items-center gap-1">
                  <Label className="text-[11px]">Tabela de Motivo</Label>
                  <Input 
                    value={formData.motivoTabela} 
                    onChange={e => setFormData({...formData, motivoTabela: e.target.value})}
                    className="h-7 text-xs"
                  />
                </div>
                <div className="grid grid-cols-[100px_1fr] items-center gap-1">
                  <Label className="text-[11px]">U Date</Label>
                  <Input 
                    type="date"
                    value={formData.uDate} 
                    onChange={e => setFormData({...formData, uDate: e.target.value})}
                    className="h-7 text-xs"
                  />
                </div>
              </div>

              {/* Column 2 - Prices & Costs */}
              <div className="border-r p-3 space-y-2">
                <div className="border-b pb-2 mb-2">
                  <h4 className="text-[11px] font-semibold mb-2">Preços de Venda</h4>
                  <div className="grid grid-cols-[100px_1fr] items-center gap-1">
                    <Label className="text-[11px]">Moeda De Vend</Label>
                    <Select value={formData.moeda} onValueChange={v => setFormData({...formData, moeda: v})}>
                      <SelectTrigger className="h-7 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-popover border shadow-lg z-50">
                        <SelectItem value="KZ">KZ</SelectItem>
                        <SelectItem value="USD">USD</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-[100px_1fr] items-center gap-1">
                    <Label className="text-[11px]">POSPRICE</Label>
                    <Input 
                      type="number"
                      value={formData.posPrice} 
                      onChange={e => setFormData({...formData, posPrice: parseFloat(e.target.value) || 0})}
                      className="h-7 text-xs"
                    />
                  </div>
                  <div className="grid grid-cols-[100px_1fr] items-center gap-1">
                    <Label className="text-[11px]">PRICE1</Label>
                    <Input 
                      type="number"
                      value={formData.price1} 
                      onChange={e => setFormData({...formData, price1: parseFloat(e.target.value) || 0})}
                      className="h-7 text-xs"
                    />
                  </div>
                  <div className="grid grid-cols-[100px_1fr] items-center gap-1">
                    <Label className="text-[11px]">PRICE2</Label>
                    <Input 
                      type="number"
                      value={formData.price2} 
                      onChange={e => setFormData({...formData, price2: parseFloat(e.target.value) || 0})}
                      className="h-7 text-xs"
                    />
                  </div>
                  <div className="grid grid-cols-[100px_1fr] items-center gap-1">
                    <Label className="text-[11px]">PRICE3</Label>
                    <Input 
                      type="number"
                      value={formData.price3} 
                      onChange={e => setFormData({...formData, price3: parseFloat(e.target.value) || 0})}
                      className="h-7 text-xs"
                    />
                  </div>
                  <div className="grid grid-cols-[100px_1fr] items-center gap-1">
                    <Label className="text-[11px]">PRICE IVA</Label>
                    <Input 
                      type="number"
                      value={formData.priceIVA} 
                      onChange={e => setFormData({...formData, priceIVA: parseFloat(e.target.value) || 0})}
                      className="h-7 text-xs"
                    />
                  </div>
                  <div className="grid grid-cols-[100px_1fr] items-center gap-1">
                    <Label className="text-[11px]">Sp Price</Label>
                    <Input 
                      type="number"
                      value={formData.spPrice} 
                      onChange={e => setFormData({...formData, spPrice: parseFloat(e.target.value) || 0})}
                      className="h-7 text-xs"
                    />
                  </div>
                </div>

                <div className="border-b pb-2 mb-2">
                  <h4 className="text-[11px] font-semibold mb-2">Custo</h4>
                  <div className="grid grid-cols-[100px_1fr] items-center gap-1">
                    <Label className="text-[11px]">Iniciar Custo US</Label>
                    <Input 
                      type="number"
                      value={formData.iniciarCustoUS} 
                      onChange={e => setFormData({...formData, iniciarCustoUS: parseFloat(e.target.value) || 0})}
                      className="h-7 text-xs"
                    />
                  </div>
                  <div className="grid grid-cols-[100px_1fr] items-center gap-1">
                    <Label className="text-[11px]">Iniciar Custo AK</Label>
                    <Input 
                      type="number"
                      value={formData.iniciarCustoAK} 
                      onChange={e => setFormData({...formData, iniciarCustoAK: parseFloat(e.target.value) || 0})}
                      className="h-7 text-xs"
                    />
                  </div>
                  <div className="grid grid-cols-[100px_1fr] items-center gap-1">
                    <Label className="text-[11px]">Custo Medio US</Label>
                    <Input 
                      type="number"
                      value={formData.custoMedioUS} 
                      onChange={e => setFormData({...formData, custoMedioUS: parseFloat(e.target.value) || 0})}
                      className="h-7 text-xs"
                    />
                  </div>
                  <div className="grid grid-cols-[100px_1fr] items-center gap-1">
                    <Label className="text-[11px]">Custo Medio AK</Label>
                    <Input 
                      type="number"
                      value={formData.custoMedioAK} 
                      onChange={e => setFormData({...formData, custoMedioAK: parseFloat(e.target.value) || 0})}
                      className="h-7 text-xs"
                    />
                  </div>
                  <div className="grid grid-cols-[100px_1fr] items-center gap-1">
                    <Label className="text-[11px]">Ultimo Custo US</Label>
                    <Input 
                      type="number"
                      value={formData.ultimoCustoUS} 
                      onChange={e => setFormData({...formData, ultimoCustoUS: parseFloat(e.target.value) || 0})}
                      className="h-7 text-xs"
                    />
                  </div>
                  <div className="grid grid-cols-[100px_1fr] items-center gap-1">
                    <Label className="text-[11px]">L Cost Vat</Label>
                    <Input 
                      type="number"
                      value={formData.lCostVat} 
                      onChange={e => setFormData({...formData, lCostVat: parseFloat(e.target.value) || 0})}
                      className="h-7 text-xs"
                    />
                  </div>
                  <div className="grid grid-cols-[100px_1fr] items-center gap-1">
                    <Label className="text-[11px]">Custo Manual</Label>
                    <Input 
                      type="number"
                      value={formData.custoManual} 
                      onChange={e => setFormData({...formData, custoManual: parseFloat(e.target.value) || 0})}
                      className="h-7 text-xs"
                    />
                  </div>
                </div>

                <div>
                  <h4 className="text-[11px] font-semibold mb-2">Custo de Embalagem</h4>
                  <div className="grid grid-cols-[100px_1fr] items-center gap-1">
                    <Label className="text-[11px]">USD</Label>
                    <Input 
                      type="number"
                      value={formData.custoEmbalagem.USD} 
                      onChange={e => setFormData({...formData, custoEmbalagem: {...formData.custoEmbalagem, USD: parseFloat(e.target.value) || 0}})}
                      className="h-7 text-xs"
                    />
                  </div>
                  <div className="grid grid-cols-[100px_1fr] items-center gap-1">
                    <Label className="text-[11px]">AKZ</Label>
                    <Input 
                      type="number"
                      value={formData.custoEmbalagem.AKZ} 
                      onChange={e => setFormData({...formData, custoEmbalagem: {...formData.custoEmbalagem, AKZ: parseFloat(e.target.value) || 0}})}
                      className="h-7 text-xs"
                    />
                  </div>
                  <div className="grid grid-cols-[100px_1fr] items-center gap-1">
                    <Label className="text-[11px]">Ultimo Custo US</Label>
                    <Input 
                      type="number"
                      value={formData.ultimoCustoUS2} 
                      onChange={e => setFormData({...formData, ultimoCustoUS2: parseFloat(e.target.value) || 0})}
                      className="h-7 text-xs"
                    />
                  </div>
                  <div className="grid grid-cols-[100px_1fr] items-center gap-1">
                    <Label className="text-[11px]">Ultimo Custo AI</Label>
                    <Input 
                      type="number"
                      value={formData.ultimoCustoAI} 
                      onChange={e => setFormData({...formData, ultimoCustoAI: parseFloat(e.target.value) || 0})}
                      className="h-7 text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Column 3 - Weight, POS Info */}
              <div className="p-3 space-y-2">
                <div className="border-b pb-2 mb-2">
                  <h4 className="text-[11px] font-semibold mb-2">Peso Bruto</h4>
                  <div className="grid grid-cols-[100px_1fr] items-center gap-1">
                    <Label className="text-[11px]">L. Pesos</Label>
                    <Input 
                      type="number"
                      value={formData.pesoBruto} 
                      onChange={e => setFormData({...formData, pesoBruto: parseFloat(e.target.value) || 0})}
                      className="h-7 text-xs"
                    />
                  </div>
                  <div className="grid grid-cols-[100px_1fr] items-center gap-1">
                    <Label className="text-[11px]">Vol./1=No</Label>
                    <div className="flex items-center">
                      <Switch 
                        checked={formData.volumeNo}
                        onCheckedChange={v => setFormData({...formData, volumeNo: v})}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-[100px_1fr] items-center gap-1">
                    <Label className="text-[11px]">Venda Descon</Label>
                    <div className="flex items-center">
                      <Switch 
                        checked={formData.vendaDesconto}
                        onCheckedChange={v => setFormData({...formData, vendaDesconto: v})}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-[100px_1fr] items-center gap-1">
                    <Label className="text-[11px]">Compra Descot</Label>
                    <Input 
                      type="number"
                      value={formData.compraDesconto} 
                      onChange={e => setFormData({...formData, compraDesconto: parseFloat(e.target.value) || 0})}
                      className="h-7 text-xs"
                    />
                  </div>
                  <div className="grid grid-cols-[100px_1fr] items-center gap-1">
                    <Label className="text-[11px]">Desc. Maximo</Label>
                    <Input 
                      type="number"
                      value={formData.descontoMaximo} 
                      onChange={e => setFormData({...formData, descontoMaximo: parseFloat(e.target.value) || 0})}
                      className="h-7 text-xs"
                    />
                  </div>
                </div>

                <div>
                  <h4 className="text-[11px] font-semibold mb-2">Info. de POS</h4>
                  <div className="grid grid-cols-[100px_1fr] items-center gap-1">
                    <Label className="text-[11px]">No de Pedido</Label>
                    <Input 
                      type="number"
                      value={formData.noPedido} 
                      onChange={e => setFormData({...formData, noPedido: parseInt(e.target.value) || 0})}
                      className="h-7 text-xs"
                    />
                  </div>
                  <div className="grid grid-cols-[100px_1fr] items-center gap-1">
                    <Label className="text-[11px]">Cor</Label>
                    <Input 
                      value={formData.cor} 
                      onChange={e => setFormData({...formData, cor: e.target.value})}
                      className="h-7 text-xs"
                    />
                  </div>
                  <div className="grid grid-cols-[100px_1fr] items-center gap-1">
                    <Label className="text-[11px]">Color not</Label>
                    <Input 
                      value={formData.corNot} 
                      onChange={e => setFormData({...formData, corNot: e.target.value})}
                      className="h-7 text-xs"
                    />
                  </div>
                  <div className="grid grid-cols-[100px_1fr] items-center gap-1">
                    <Label className="text-[11px]">Impressora</Label>
                    <Input 
                      value={formData.impressora} 
                      onChange={e => setFormData({...formData, impressora: e.target.value})}
                      className="h-7 text-xs"
                    />
                  </div>
                  <div className="grid grid-cols-[100px_1fr] items-center gap-1">
                    <Label className="text-[11px]">Pos Price LC</Label>
                    <Input 
                      type="number"
                      value={formData.posPriceLC} 
                      onChange={e => setFormData({...formData, posPriceLC: parseFloat(e.target.value) || 0})}
                      className="h-7 text-xs"
                    />
                  </div>
                  <div className="grid grid-cols-[100px_1fr] items-center gap-1">
                    <Label className="text-[11px]">Price %</Label>
                    <Input 
                      type="number"
                      value={formData.pricePercent} 
                      onChange={e => setFormData({...formData, pricePercent: parseFloat(e.target.value) || 0})}
                      className="h-7 text-xs"
                    />
                  </div>
                  <div className="grid grid-cols-[100px_1fr] items-center gap-1">
                    <Label className="text-[11px]">Pos Dics. 2 %</Label>
                    <Input 
                      type="number"
                      value={formData.posDiscount2} 
                      onChange={e => setFormData({...formData, posDiscount2: parseFloat(e.target.value) || 0})}
                      className="h-7 text-xs"
                    />
                  </div>
                  <div className="grid grid-cols-[100px_1fr] items-center gap-1">
                    <Label className="text-[11px]">Preço IVA</Label>
                    <Input 
                      type="number"
                      value={formData.precoIVA} 
                      onChange={e => setFormData({...formData, precoIVA: parseFloat(e.target.value) || 0})}
                      className="h-7 text-xs"
                    />
                  </div>
                  <div className="grid grid-cols-[100px_1fr] items-center gap-1">
                    <Label className="text-[11px]">Last P. Rate</Label>
                    <Input 
                      type="number"
                      value={formData.lastPRate} 
                      onChange={e => setFormData({...formData, lastPRate: parseFloat(e.target.value) || 0})}
                      className="h-7 text-xs"
                    />
                  </div>
                  <div className="grid grid-cols-[100px_1fr] items-center gap-1">
                    <Label className="text-[11px]">Margem</Label>
                    <div className="h-7 px-2 bg-muted rounded flex items-center text-xs font-mono">
                      {margin}%
                    </div>
                  </div>
                </div>

                <div className="border-t pt-3 mt-3">
                  <div className="grid grid-cols-[100px_1fr] items-center gap-1">
                    <Label className="text-[11px]">Stock</Label>
                    <Input 
                      type="number"
                      value={formData.stock} 
                      onChange={e => setFormData({...formData, stock: parseInt(e.target.value) || 0})}
                      className="h-7 text-xs"
                    />
                  </div>
                  <div className="grid grid-cols-[100px_1fr] items-center gap-1 mt-1">
                    <Label className="text-[11px]">Filial</Label>
                    <Select value={formData.branchId} onValueChange={v => setFormData({...formData, branchId: v})}>
                      <SelectTrigger className="h-7 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-popover border shadow-lg z-50">
                        <SelectItem value="all">Todas</SelectItem>
                        {branches.map(b => (
                          <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <Switch 
                      checked={formData.isActive}
                      onCheckedChange={v => setFormData({...formData, isActive: v})}
                    />
                    <Label className="text-[11px]">Produto Activo</Label>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="barcodes" className="flex-1 overflow-auto m-0 p-4">
            <table className="w-full text-xs border">
              <thead>
                <tr className="bg-muted">
                  <th className="border p-2 text-left">Inv BarCode</th>
                  <th className="border p-2 text-left">Embalagem</th>
                  <th className="border p-2 text-left">Price LC</th>
                  <th className="border p-2 text-left">PLU</th>
                  <th className="border p-2 text-left">Ultimo Custo</th>
                </tr>
              </thead>
              <tbody>
                {formData.barcodes.map((bc, idx) => (
                  <tr key={idx}>
                    <td className="border p-1">
                      <Input 
                        value={bc.barPrice}
                        onChange={e => {
                          const newBarcodes = [...formData.barcodes];
                          newBarcodes[idx] = {...bc, barPrice: e.target.value};
                          setFormData({...formData, barcodes: newBarcodes});
                        }}
                        className="h-6 text-xs"
                      />
                    </td>
                    <td className="border p-1">
                      <Input 
                        type="number"
                        value={bc.embalagem}
                        onChange={e => {
                          const newBarcodes = [...formData.barcodes];
                          newBarcodes[idx] = {...bc, embalagem: parseInt(e.target.value) || 1};
                          setFormData({...formData, barcodes: newBarcodes});
                        }}
                        className="h-6 text-xs"
                      />
                    </td>
                    <td className="border p-1">
                      <Input 
                        type="number"
                        value={bc.priceLC}
                        onChange={e => {
                          const newBarcodes = [...formData.barcodes];
                          newBarcodes[idx] = {...bc, priceLC: parseFloat(e.target.value) || 0};
                          setFormData({...formData, barcodes: newBarcodes});
                        }}
                        className="h-6 text-xs"
                      />
                    </td>
                    <td className="border p-1">
                      <Input 
                        value={bc.plu}
                        onChange={e => {
                          const newBarcodes = [...formData.barcodes];
                          newBarcodes[idx] = {...bc, plu: e.target.value};
                          setFormData({...formData, barcodes: newBarcodes});
                        }}
                        className="h-6 text-xs"
                      />
                    </td>
                    <td className="border p-1">
                      <Input 
                        type="number"
                        value={bc.ultimoCusto}
                        onChange={e => {
                          const newBarcodes = [...formData.barcodes];
                          newBarcodes[idx] = {...bc, ultimoCusto: parseFloat(e.target.value) || 0};
                          setFormData({...formData, barcodes: newBarcodes});
                        }}
                        className="h-6 text-xs"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Button 
              variant="outline" 
              size="sm" 
              className="mt-2"
              onClick={() => setFormData({
                ...formData, 
                barcodes: [...formData.barcodes, { barPrice: '', embalagem: 1, priceLC: 0, plu: '', ultimoCusto: 0 }]
              })}
            >
              <Plus className="w-3 h-3 mr-1" /> Adicionar Barcode
            </Button>
          </TabsContent>
        </Tabs>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t bg-muted/50">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-8">
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" className="h-8">
              <ChevronRight className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" className="h-8">
              <Plus className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" className="h-8">
              <Search className="w-4 h-4" />
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={handleSave} size="sm" className="h-8 gap-1">
              <Check className="w-4 h-4" />
              Guardar
            </Button>
            <Button variant="outline" size="sm" className="h-8 gap-1" onClick={() => onOpenChange(false)}>
              <X className="w-4 h-4" />
              Cancelar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}