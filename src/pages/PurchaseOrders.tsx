import { useState, useMemo } from 'react';
import { useBranches, useProducts, useSuppliers, usePurchaseOrders, useAuth } from '@/hooks/useERP';
import { PurchaseOrder, PurchaseOrderItem, Product } from '@/types/erp';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Search, Plus, Eye, CheckCircle, Package, ShoppingCart, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';

const STATUS_LABELS: Record<PurchaseOrder['status'], { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  draft: { label: 'Rascunho', variant: 'outline' },
  pending: { label: 'Pendente', variant: 'secondary' },
  approved: { label: 'Aprovado', variant: 'default' },
  received: { label: 'Recebido', variant: 'default' },
  partial: { label: 'Parcial', variant: 'secondary' },
  cancelled: { label: 'Cancelado', variant: 'destructive' },
};

export default function PurchaseOrders() {
  const { user } = useAuth();
  const { branches, currentBranch } = useBranches();
  const { products } = useProducts();
  const { suppliers } = useSuppliers();
  const { 
    orders, 
    createOrder, 
    approveOrder, 
    receiveOrder, 
    cancelOrder 
  } = usePurchaseOrders();
  const { toast } = useToast();

  const [searchTerm, setSearchTerm] = useState('');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [receiveDialogOpen, setReceiveDialogOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<PurchaseOrder | null>(null);
  const [receivedQuantities, setReceivedQuantities] = useState<Record<string, number>>({});

  // Create order form state
  const [orderForm, setOrderForm] = useState({
    supplierId: '',
    branchId: currentBranch?.id || '',
    notes: '',
    expectedDeliveryDate: '',
    items: [] as { productId: string; quantity: number; unitCost: number }[],
  });

  const [newItemForm, setNewItemForm] = useState({
    productId: '',
    quantity: 1,
    unitCost: 0,
  });

  const filteredOrders = orders.filter(order =>
    order.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    order.supplierName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const stats = useMemo(() => ({
    total: orders.length,
    pending: orders.filter(o => o.status === 'pending' || o.status === 'approved').length,
    received: orders.filter(o => o.status === 'received').length,
    totalValue: orders.filter(o => o.status === 'received').reduce((sum, o) => sum + o.total, 0),
  }), [orders]);

  const handleAddItem = () => {
    if (!newItemForm.productId || newItemForm.quantity <= 0) {
      toast({
        title: 'Erro',
        description: 'Seleccione um produto e quantidade válida',
        variant: 'destructive',
      });
      return;
    }

    const product = products.find(p => p.id === newItemForm.productId);
    if (!product) return;

    // Check if product already in list
    if (orderForm.items.find(i => i.productId === newItemForm.productId)) {
      toast({
        title: 'Aviso',
        description: 'Este produto já está na lista',
        variant: 'destructive',
      });
      return;
    }

    setOrderForm({
      ...orderForm,
      items: [
        ...orderForm.items,
        {
          productId: newItemForm.productId,
          quantity: newItemForm.quantity,
          unitCost: newItemForm.unitCost || product.cost,
        },
      ],
    });

    setNewItemForm({ productId: '', quantity: 1, unitCost: 0 });
  };

  const handleRemoveItem = (productId: string) => {
    setOrderForm({
      ...orderForm,
      items: orderForm.items.filter(i => i.productId !== productId),
    });
  };

  const handleCreateOrder = () => {
    if (!orderForm.supplierId || !orderForm.branchId || orderForm.items.length === 0) {
      toast({
        title: 'Erro',
        description: 'Seleccione fornecedor, filial e adicione pelo menos um produto',
        variant: 'destructive',
      });
      return;
    }

    const items: PurchaseOrderItem[] = orderForm.items.map(item => {
      const product = products.find(p => p.id === item.productId)!;
      const subtotal = item.quantity * item.unitCost;
      return {
        productId: item.productId,
        productName: product.name,
        sku: product.sku,
        quantity: item.quantity,
        unitCost: item.unitCost,
        taxRate: product.taxRate,
        subtotal,
      };
    });

    createOrder(
      orderForm.supplierId,
      orderForm.branchId,
      items,
      user?.id || '',
      orderForm.notes || undefined,
      orderForm.expectedDeliveryDate || undefined
    );

    toast({
      title: 'Encomenda criada',
      description: 'A encomenda foi criada com sucesso',
    });

    setCreateDialogOpen(false);
    setOrderForm({
      supplierId: '',
      branchId: currentBranch?.id || '',
      notes: '',
      expectedDeliveryDate: '',
      items: [],
    });
  };

  const handleApprove = (order: PurchaseOrder) => {
    approveOrder(order.id, user?.id || '');
    toast({
      title: 'Encomenda aprovada',
      description: `Encomenda ${order.orderNumber} foi aprovada`,
    });
  };

  const handleOpenReceive = (order: PurchaseOrder) => {
    setSelectedOrder(order);
    const quantities: Record<string, number> = {};
    order.items.forEach(item => {
      quantities[item.productId] = item.quantity;
    });
    setReceivedQuantities(quantities);
    setReceiveDialogOpen(true);
  };

  const handleReceive = () => {
    if (!selectedOrder) return;

    receiveOrder(selectedOrder.id, user?.id || '', receivedQuantities);
    toast({
      title: 'Stock actualizado',
      description: `Encomenda ${selectedOrder.orderNumber} foi recebida e stock actualizado`,
    });
    setReceiveDialogOpen(false);
    setSelectedOrder(null);
  };

  const handleCancel = (order: PurchaseOrder) => {
    cancelOrder(order.id);
    toast({
      title: 'Encomenda cancelada',
      description: `Encomenda ${order.orderNumber} foi cancelada`,
    });
  };

  const handleViewOrder = (order: PurchaseOrder) => {
    setSelectedOrder(order);
    setViewDialogOpen(true);
  };

  const orderItemsTotal = orderForm.items.reduce((sum, item) => {
    return sum + (item.quantity * item.unitCost);
  }, 0);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Encomendas de Compra</h1>
          <p className="text-muted-foreground">
            Gestão de compras e recepção de mercadoria
          </p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Nova Encomenda
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-lg">
                <ShoppingCart className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Encomendas</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-orange-500/10 rounded-lg">
                <Package className="w-6 h-6 text-orange-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pendentes</p>
                <p className="text-2xl font-bold">{stats.pending}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-500/10 rounded-lg">
                <CheckCircle className="w-6 h-6 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Recebidas</p>
                <p className="text-2xl font-bold">{stats.received}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-500/10 rounded-lg">
                <ShoppingCart className="w-6 h-6 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Valor Total Recebido</p>
                <p className="text-2xl font-bold">{stats.totalValue.toLocaleString('pt-AO')} Kz</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Lista de Encomendas</CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Pesquisar..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredOrders.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <ShoppingCart className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Nenhuma encomenda encontrada</p>
            </div>
          ) : (
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
                    <TableCell>
                      {format(new Date(order.createdAt), 'dd/MM/yyyy', { locale: pt })}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {order.total.toLocaleString('pt-AO')} Kz
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_LABELS[order.status].variant}>
                        {STATUS_LABELS[order.status].label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleViewOrder(order)}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        {order.status === 'pending' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleApprove(order)}
                            title="Aprovar"
                          >
                            <CheckCircle className="w-4 h-4 text-green-500" />
                          </Button>
                        )}
                        {order.status === 'approved' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenReceive(order)}
                            title="Receber mercadoria"
                          >
                            <Package className="w-4 h-4 text-blue-500" />
                          </Button>
                        )}
                        {(order.status === 'draft' || order.status === 'pending') && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleCancel(order)}
                            title="Cancelar"
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create Order Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nova Encomenda de Compra</DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Fornecedor *</Label>
                <Select
                  value={orderForm.supplierId}
                  onValueChange={(value) => setOrderForm({ ...orderForm, supplierId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccione o fornecedor" />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers.filter(s => s.isActive).map((supplier) => (
                      <SelectItem key={supplier.id} value={supplier.id}>
                        {supplier.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Filial Destino *</Label>
                <Select
                  value={orderForm.branchId}
                  onValueChange={(value) => setOrderForm({ ...orderForm, branchId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccione a filial" />
                  </SelectTrigger>
                  <SelectContent>
                    {branches.map((branch) => (
                      <SelectItem key={branch.id} value={branch.id}>
                        {branch.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Data Prevista de Entrega</Label>
                <Input
                  type="date"
                  value={orderForm.expectedDeliveryDate}
                  onChange={(e) => setOrderForm({ ...orderForm, expectedDeliveryDate: e.target.value })}
                />
              </div>

              <div>
                <Label>Notas</Label>
                <Textarea
                  value={orderForm.notes}
                  onChange={(e) => setOrderForm({ ...orderForm, notes: e.target.value })}
                  placeholder="Observações..."
                  rows={1}
                />
              </div>
            </div>

            {/* Add product to order */}
            <div className="border rounded-lg p-4 space-y-4">
              <h4 className="font-medium">Adicionar Produto</h4>
              <div className="grid grid-cols-4 gap-4">
                <div className="col-span-2">
                  <Select
                    value={newItemForm.productId}
                    onValueChange={(value) => {
                      const product = products.find(p => p.id === value);
                      setNewItemForm({
                        ...newItemForm,
                        productId: value,
                        unitCost: product?.cost || 0,
                      });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccione o produto" />
                    </SelectTrigger>
                    <SelectContent>
                      {products.filter(p => p.isActive).map((product) => (
                        <SelectItem key={product.id} value={product.id}>
                          {product.name} ({product.sku})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Input
                    type="number"
                    min="1"
                    placeholder="Qtd"
                    value={newItemForm.quantity}
                    onChange={(e) => setNewItemForm({ ...newItemForm, quantity: parseInt(e.target.value) || 1 })}
                  />
                </div>
                <div>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Custo Unit."
                    value={newItemForm.unitCost}
                    onChange={(e) => setNewItemForm({ ...newItemForm, unitCost: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              </div>
              <Button type="button" variant="secondary" onClick={handleAddItem}>
                <Plus className="w-4 h-4 mr-2" />
                Adicionar à Lista
              </Button>
            </div>

            {/* Order items list */}
            {orderForm.items.length > 0 && (
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produto</TableHead>
                      <TableHead className="text-right">Quantidade</TableHead>
                      <TableHead className="text-right">Custo Unit.</TableHead>
                      <TableHead className="text-right">Subtotal</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orderForm.items.map((item) => {
                      const product = products.find(p => p.id === item.productId);
                      return (
                        <TableRow key={item.productId}>
                          <TableCell>{product?.name}</TableCell>
                          <TableCell className="text-right">{item.quantity}</TableCell>
                          <TableCell className="text-right">{item.unitCost.toLocaleString('pt-AO')} Kz</TableCell>
                          <TableCell className="text-right font-medium">
                            {(item.quantity * item.unitCost).toLocaleString('pt-AO')} Kz
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleRemoveItem(item.productId)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    <TableRow>
                      <TableCell colSpan={3} className="text-right font-bold">
                        Total:
                      </TableCell>
                      <TableCell className="text-right font-bold">
                        {orderItemsTotal.toLocaleString('pt-AO')} Kz
                      </TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreateOrder} disabled={orderForm.items.length === 0}>
              Criar Encomenda
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Order Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalhes da Encomenda {selectedOrder?.orderNumber}</DialogTitle>
          </DialogHeader>

          {selectedOrder && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Fornecedor:</span>
                  <p className="font-medium">{selectedOrder.supplierName}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Filial:</span>
                  <p className="font-medium">{selectedOrder.branchName}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Data:</span>
                  <p className="font-medium">
                    {format(new Date(selectedOrder.createdAt), 'dd/MM/yyyy HH:mm', { locale: pt })}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Estado:</span>
                  <Badge variant={STATUS_LABELS[selectedOrder.status].variant} className="ml-2">
                    {STATUS_LABELS[selectedOrder.status].label}
                  </Badge>
                </div>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produto</TableHead>
                    <TableHead className="text-right">Qtd</TableHead>
                    <TableHead className="text-right">Custo</TableHead>
                    <TableHead className="text-right">Subtotal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedOrder.items.map((item) => (
                    <TableRow key={item.productId}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{item.productName}</p>
                          <p className="text-xs text-muted-foreground">{item.sku}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">{item.quantity}</TableCell>
                      <TableCell className="text-right">{item.unitCost.toLocaleString('pt-AO')} Kz</TableCell>
                      <TableCell className="text-right">{item.subtotal.toLocaleString('pt-AO')} Kz</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <div className="text-right space-y-1">
                <p>Subtotal: {selectedOrder.subtotal.toLocaleString('pt-AO')} Kz</p>
                <p>IVA: {selectedOrder.taxAmount.toLocaleString('pt-AO')} Kz</p>
                <p className="text-lg font-bold">Total: {selectedOrder.total.toLocaleString('pt-AO')} Kz</p>
              </div>

              {selectedOrder.notes && (
                <div>
                  <span className="text-muted-foreground">Notas:</span>
                  <p>{selectedOrder.notes}</p>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setViewDialogOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Receive Order Dialog */}
      <Dialog open={receiveDialogOpen} onOpenChange={setReceiveDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Receber Mercadoria - {selectedOrder?.orderNumber}</DialogTitle>
          </DialogHeader>

          {selectedOrder && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Confirme as quantidades recebidas. O stock será actualizado automaticamente.
              </p>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produto</TableHead>
                    <TableHead className="text-right">Encomendado</TableHead>
                    <TableHead className="text-right">Recebido</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedOrder.items.map((item) => (
                    <TableRow key={item.productId}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{item.productName}</p>
                          <p className="text-xs text-muted-foreground">{item.sku}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">{item.quantity}</TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          min="0"
                          max={item.quantity}
                          className="w-24 ml-auto"
                          value={receivedQuantities[item.productId] || 0}
                          onChange={(e) => setReceivedQuantities({
                            ...receivedQuantities,
                            [item.productId]: parseInt(e.target.value) || 0,
                          })}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setReceiveDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleReceive}>
              <CheckCircle className="w-4 h-4 mr-2" />
              Confirmar Recepção
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}