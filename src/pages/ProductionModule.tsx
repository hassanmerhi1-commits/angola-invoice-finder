// Kwanza ERP - Production Module
// BOM, Production Orders, Material Consumption, Finished Goods

import { useState, useMemo } from 'react';
import { useBranchContext } from '@/contexts/BranchContext';
import { useAuth, useProducts } from '@/hooks/useERP';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import {
  Plus, Search, Edit2, Trash2, RefreshCw, Factory, Package,
  Play, CheckCircle, XCircle, Clock, Layers, Settings, ArrowRight
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Types
interface BOMItem {
  id: string;
  materialId: string;
  materialName: string;
  materialSku: string;
  quantity: number;
  unit: string;
  wastagePercent: number;
}

interface BillOfMaterials {
  id: string;
  productId: string;
  productName: string;
  productSku: string;
  version: string;
  items: BOMItem[];
  laborCost: number;
  overheadCost: number;
  totalMaterialCost: number;
  totalCost: number;
  outputQuantity: number;
  isActive: boolean;
  createdBy: string;
  createdAt: string;
}

interface ProductionOrder {
  id: string;
  orderNumber: string;   // PO-20260328-001
  bomId: string;
  productId: string;
  productName: string;
  quantity: number;
  branchId: string;
  branchName: string;
  status: 'planned' | 'in_progress' | 'completed' | 'cancelled';
  startDate: string;
  endDate?: string;
  completedDate?: string;
  completedQuantity: number;
  wastedQuantity: number;
  notes?: string;
  createdBy: string;
  createdAt: string;
}

// Storage
const STORAGE_KEYS = { boms: 'kwanzaerp_boms', orders: 'kwanzaerp_production_orders' };
function getStored<T>(key: string): T[] {
  try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch { return []; }
}
function setStored<T>(key: string, data: T[]) { localStorage.setItem(key, JSON.stringify(data)); }

export default function ProductionModule() {
  const { user } = useAuth();
  const { currentBranch } = useBranchContext();
  const { products } = useProducts(currentBranch?.id);
  const [activeTab, setActiveTab] = useState('ordens');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // BOM form
  const [bomFormOpen, setBomFormOpen] = useState(false);
  // Order form
  const [orderFormOpen, setOrderFormOpen] = useState(false);
  const [orderProduct, setOrderProduct] = useState('');
  const [orderQty, setOrderQty] = useState(1);

  const refresh = () => setRefreshKey(k => k + 1);

  const orders = useMemo(() => {
    const all = getStored<ProductionOrder>(STORAGE_KEYS.orders);
    return all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [refreshKey]);

  const boms = useMemo(() => getStored<BillOfMaterials>(STORAGE_KEYS.boms), [refreshKey]);

  const filteredOrders = useMemo(() => {
    if (!searchTerm) return orders;
    const q = searchTerm.toLowerCase();
    return orders.filter(o => o.orderNumber.toLowerCase().includes(q) || o.productName.toLowerCase().includes(q));
  }, [orders, searchTerm]);

  const summary = useMemo(() => ({
    total: orders.length,
    planned: orders.filter(o => o.status === 'planned').length,
    inProgress: orders.filter(o => o.status === 'in_progress').length,
    completed: orders.filter(o => o.status === 'completed').length,
  }), [orders]);

  const createOrder = () => {
    if (!orderProduct) { toast.error('Seleccione um produto'); return; }
    const product = products.find(p => p.id === orderProduct);
    if (!product) return;

    const all = getStored<ProductionOrder>(STORAGE_KEYS.orders);
    const seq = all.length + 1;
    const now = new Date();
    const order: ProductionOrder = {
      id: `po_${Date.now()}`,
      orderNumber: `PO-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(seq).padStart(3, '0')}`,
      bomId: '',
      productId: product.id,
      productName: product.name,
      quantity: orderQty,
      branchId: currentBranch?.id || '',
      branchName: currentBranch?.name || '',
      status: 'planned',
      startDate: now.toISOString(),
      completedQuantity: 0,
      wastedQuantity: 0,
      createdBy: user?.id || '',
      createdAt: now.toISOString(),
    };
    all.push(order);
    setStored(STORAGE_KEYS.orders, all);
    toast.success(`Ordem ${order.orderNumber} criada`);
    setOrderFormOpen(false);
    setOrderProduct('');
    setOrderQty(1);
    refresh();
  };

  const updateOrderStatus = (orderId: string, status: ProductionOrder['status']) => {
    const all = getStored<ProductionOrder>(STORAGE_KEYS.orders);
    const idx = all.findIndex(o => o.id === orderId);
    if (idx >= 0) {
      all[idx].status = status;
      if (status === 'completed') {
        all[idx].completedDate = new Date().toISOString();
        all[idx].completedQuantity = all[idx].quantity;
      }
      setStored(STORAGE_KEYS.orders, all);
      toast.success(`Ordem actualizada para ${status}`);
      refresh();
    }
  };

  const selectedOrder = orders.find(o => o.id === selectedId);

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Toolbar */}
      <div className="flex items-center gap-1 px-2 py-1 bg-muted/50 border-b flex-wrap">
        <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => setOrderFormOpen(true)}>
          <Plus className="w-3 h-3" /> Nova Ordem
        </Button>
        <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => setBomFormOpen(true)}>
          <Layers className="w-3 h-3" /> Nova BOM
        </Button>
        <div className="w-px h-5 bg-border mx-1" />
        <Button variant="outline" size="sm" className="h-7 text-xs gap-1 text-blue-600 border-blue-200" disabled={!selectedOrder || selectedOrder.status !== 'planned'}
          onClick={() => selectedOrder && updateOrderStatus(selectedOrder.id, 'in_progress')}>
          <Play className="w-3 h-3" /> Iniciar
        </Button>
        <Button variant="outline" size="sm" className="h-7 text-xs gap-1 text-green-600 border-green-200" disabled={!selectedOrder || selectedOrder.status !== 'in_progress'}
          onClick={() => selectedOrder && updateOrderStatus(selectedOrder.id, 'completed')}>
          <CheckCircle className="w-3 h-3" /> Concluir
        </Button>
        <Button variant="outline" size="sm" className="h-7 text-xs gap-1 text-destructive" disabled={!selectedOrder || selectedOrder.status === 'completed'}
          onClick={() => selectedOrder && updateOrderStatus(selectedOrder.id, 'cancelled')}>
          <XCircle className="w-3 h-3" /> Cancelar
        </Button>
        <Button variant="outline" size="icon" className="h-7 w-7" onClick={refresh}><RefreshCw className="w-3 h-3" /></Button>
        <div className="flex-1" />
        <div className="flex items-center gap-2 text-[10px] mr-2">
          <Badge variant="outline" className="gap-1"><Factory className="w-3 h-3" /> {summary.total}</Badge>
          <Badge variant="outline" className="gap-1 text-blue-600">{summary.planned} planeadas</Badge>
          <Badge variant="outline" className="gap-1 text-amber-600">{summary.inProgress} em curso</Badge>
          <Badge variant="outline" className="gap-1 text-green-600">{summary.completed} concluídas</Badge>
        </div>
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
          <Input placeholder="Pesquisar..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="h-7 text-xs pl-7 w-40" />
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <TabsList className="w-full justify-start rounded-none border-b bg-muted/30 h-auto p-0">
          {[
            { key: 'ordens', label: 'Ordens de Produção', icon: Factory },
            { key: 'bom', label: 'Bill of Materials', icon: Layers },
            { key: 'consumo', label: 'Consumo Materiais', icon: Package },
            { key: 'custos', label: 'Custos de Produção', icon: Settings },
          ].map(tab => (
            <TabsTrigger key={tab.key} value={tab.key}
              className="text-xs rounded-none border-b-2 border-transparent data-[state=active]:border-primary px-4 py-1.5 gap-1">
              <tab.icon className="w-3 h-3" /> {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Orders Tab */}
        <TabsContent value="ordens" className="flex-1 m-0 overflow-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted/60 border-b sticky top-0 z-10">
              <tr>
                <th className="px-3 py-2 text-left font-semibold w-32">Nº Ordem</th>
                <th className="px-3 py-2 text-left font-semibold">Produto</th>
                <th className="px-3 py-2 text-right font-semibold w-16">Qtd</th>
                <th className="px-3 py-2 text-right font-semibold w-20">Concluído</th>
                <th className="px-3 py-2 text-left font-semibold w-20">Filial</th>
                <th className="px-3 py-2 text-left font-semibold w-24">Início</th>
                <th className="px-3 py-2 text-left font-semibold w-24">Conclusão</th>
                <th className="px-3 py-2 text-center font-semibold w-20">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {filteredOrders.map(order => (
                <tr key={order.id} className={cn("cursor-pointer hover:bg-accent/50", selectedId === order.id && "bg-primary/15")}
                  onClick={() => setSelectedId(order.id)}>
                  <td className="px-3 py-1.5 font-mono">{order.orderNumber}</td>
                  <td className="px-3 py-1.5 font-medium">{order.productName}</td>
                  <td className="px-3 py-1.5 text-right font-mono">{order.quantity}</td>
                  <td className="px-3 py-1.5 text-right font-mono">{order.completedQuantity}</td>
                  <td className="px-3 py-1.5 text-muted-foreground">{order.branchName}</td>
                  <td className="px-3 py-1.5 text-muted-foreground">{new Date(order.startDate).toLocaleDateString('pt-AO')}</td>
                  <td className="px-3 py-1.5 text-muted-foreground">{order.completedDate ? new Date(order.completedDate).toLocaleDateString('pt-AO') : '-'}</td>
                  <td className="px-3 py-1.5 text-center">
                    <Badge variant={
                      order.status === 'completed' ? 'default' :
                      order.status === 'in_progress' ? 'secondary' :
                      order.status === 'cancelled' ? 'destructive' : 'outline'
                    } className="text-[9px] px-1.5 py-0">
                      {order.status === 'planned' ? 'Planeada' : order.status === 'in_progress' ? 'Em Curso' : order.status === 'completed' ? 'Concluída' : 'Cancelada'}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredOrders.length === 0 && (
            <div className="text-center py-12 text-muted-foreground text-sm">
              <Factory className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>Nenhuma ordem de produção</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="bom" className="flex-1 m-0 p-4">
          <Card><CardContent className="pt-6 text-center text-muted-foreground">
            <Layers className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>Bill of Materials (Lista de Materiais)</p>
            <p className="text-xs mt-1">Defina os materiais necessários para cada produto</p>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="consumo" className="flex-1 m-0 p-4">
          <Card><CardContent className="pt-6 text-center text-muted-foreground">
            <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>Consumo de Materiais</p>
            <p className="text-xs mt-1">Registo automático de saída de matéria-prima</p>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="custos" className="flex-1 m-0 p-4">
          <Card><CardContent className="pt-6 text-center text-muted-foreground">
            <Settings className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>Custos de Produção</p>
            <p className="text-xs mt-1">Análise de custos: materiais, mão-de-obra, overhead</p>
          </CardContent></Card>
        </TabsContent>
      </Tabs>

      {/* New Order Dialog */}
      <Dialog open={orderFormOpen} onOpenChange={setOrderFormOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Nova Ordem de Produção</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label className="text-xs">Produto a Produzir</Label>
              <Select value={orderProduct} onValueChange={setOrderProduct}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Seleccionar produto..." /></SelectTrigger>
                <SelectContent>
                  {products.map(p => <SelectItem key={p.id} value={p.id}>{p.sku} - {p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Quantidade</Label>
              <Input type="number" value={orderQty} onChange={e => setOrderQty(Number(e.target.value))} className="h-8 text-xs" min={1} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOrderFormOpen(false)}>Cancelar</Button>
            <Button onClick={createOrder}>Criar Ordem</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* BOM Form Dialog */}
      <Dialog open={bomFormOpen} onOpenChange={setBomFormOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Nova Bill of Materials</DialogTitle></DialogHeader>
          <CardContent className="pt-4 text-center text-muted-foreground text-sm">
            <Layers className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p>Funcionalidade BOM em desenvolvimento</p>
          </CardContent>
          <DialogFooter><Button variant="outline" onClick={() => setBomFormOpen(false)}>Fechar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
