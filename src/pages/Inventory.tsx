import { useState, useRef } from 'react';
import { useProducts } from '@/hooks/useERP';
import { useBranchContext } from '@/contexts/BranchContext';
import { Product } from '@/types/erp';
import { saveProduct } from '@/lib/storage';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  FileText, 
  Plus, 
  Edit, 
  Trash2, 
  Filter, 
  BarChart3, 
  Eye, 
  FileSpreadsheet,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Download,
  Upload,
  ArrowRightLeft
} from 'lucide-react';
import { AdvancedDataGrid } from '@/components/inventory/AdvancedDataGrid';
import { ProductDetailDialog } from '@/components/inventory/ProductDetailDialog';
import { BranchStockDetail } from '@/components/inventory/BranchStockDetail';
import { BranchSelector } from '@/components/BranchSelector';
import { exportProductsToExcel, parseExcelFile, validateImportedProducts, downloadImportTemplate, ExcelProduct } from '@/lib/excel';
import { ExcelImportDialog } from '@/components/import/ExcelImportDialog';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

export default function Inventory() {
  const navigate = useNavigate();
  const { currentBranch } = useBranchContext();
  const { products, refreshProducts, updateProduct, addProduct, deleteProduct } = useProducts(currentBranch?.id);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('lista');

  // Check if current branch is a filial (not main office)
  const isFilial = currentBranch && !currentBranch.isMain;

  const handleOpenDialog = (product?: Product) => {
    setSelectedProduct(product || null);
    setDialogOpen(true);
  };

  const handleSaveProduct = (product: Product) => {
    if (selectedProduct) {
      updateProduct(product);
    } else {
      addProduct(product);
    }
    refreshProducts();
  };

  const handleSelectProduct = (product: Product) => {
    setSelectedProduct(product);
  };

  const handleDoubleClickProduct = () => {
    if (selectedProduct) {
      setDialogOpen(true);
    }
  };

  const handleImportProducts = (data: ExcelProduct[]) => {
    let imported = 0;
    data.forEach((item) => {
      addProduct({
        id: crypto.randomUUID(),
        sku: item.codigo,
        name: item.descricao,
        barcode: item.codigoBarras || '',
        category: item.categoria || 'GERAL',
        price: item.preco,
        cost: item.custo,
        firstCost: item.custo,
        lastCost: item.custo,
        avgCost: item.custo,
        stock: item.quantidade,
        unit: item.unidade || 'UN',
        taxRate: item.iva || 14,
        isActive: true,
        branchId: currentBranch?.id || '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      imported++;
    });
    toast.success(`${imported} produtos importados com sucesso`);
  };

  const productImportColumns: { key: keyof ExcelProduct; label: string }[] = [
    { key: 'codigo', label: 'Código' },
    { key: 'descricao', label: 'Descrição' },
    { key: 'preco', label: 'Preço' },
    { key: 'quantidade', label: 'Qtd' },
    { key: 'categoria', label: 'Categoria' },
  ];

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Filial Notice - Stock hidden for branches */}
      {isFilial && (
        <Alert className="mx-2 mt-2 bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800">
          <AlertCircle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800 dark:text-amber-200">
            <strong>Modo Filial:</strong> Informações de stock não disponíveis. Apenas preços e códigos de produtos são exibidos.
            Receba atualizações de preços da sede via sincronização.
          </AlertDescription>
        </Alert>
      )}
      
      {/* Toolbar */}
      <div className="flex items-center gap-1 px-2 py-1 bg-muted/50 border-b">
        <BranchSelector compact />
        <div className="w-px h-5 bg-border mx-1" />
        <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => handleOpenDialog()}>
          <Plus className="w-3 h-3" />
          Novo
        </Button>
        <Button 
          variant="outline" 
          size="sm" 
          className="h-7 text-xs gap-1" 
          disabled={!selectedProduct}
          onClick={() => selectedProduct && handleOpenDialog(selectedProduct)}
        >
          <Edit className="w-3 h-3" />
          Editar
        </Button>
        <Button 
          variant="outline" 
          size="sm" 
          className="h-7 text-xs gap-1 text-destructive" 
          disabled={!selectedProduct}
          onClick={() => {
            if (selectedProduct && confirm('Eliminar este produto?')) {
              deleteProduct(selectedProduct.id);
              setSelectedProduct(null);
            }
          }}
        >
          <Trash2 className="w-3 h-3" />
          Eliminar
        </Button>
        <div className="w-px h-5 bg-border mx-1" />
        <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
          <Filter className="w-3 h-3" />
          Filtro
        </Button>
        <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
          Ajustar Entrada
        </Button>
        <Button 
          variant="outline" 
          size="sm" 
          className="h-7 text-xs gap-1"
          onClick={() => setImportDialogOpen(true)}
        >
          <Upload className="w-3 h-3" />
          Importar Excel
        </Button>
        <Button 
          variant="outline" 
          size="sm" 
          className="h-7 text-xs gap-1"
          onClick={() => {
            exportProductsToExcel(products);
            toast.success('Produtos exportados para Excel');
          }}
        >
          <Download className="w-3 h-3" />
          Exportar Excel
        </Button>

        <div className="flex-1" />

        {/* Quick navigation */}
        <div className="flex items-center gap-1 border rounded px-2 py-1 bg-background">
          <Input 
            value={selectedProduct?.sku || ''} 
            readOnly
            className="h-5 w-24 text-xs border-0 p-0 focus-visible:ring-0"
            placeholder="Código"
          />
          <span className="text-xs text-muted-foreground">{selectedProduct?.name || ''}</span>
          <div className="flex gap-0.5 ml-2">
            <Button variant="ghost" size="icon" className="h-5 w-5">
              <ChevronLeft className="w-3 h-3" />
            </Button>
            <Button variant="ghost" size="icon" className="h-5 w-5">
              <ChevronRight className="w-3 h-3" />
            </Button>
          </div>
        </div>
      </div>

      {/* Sub-tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <TabsList className="w-full justify-start rounded-none border-b bg-muted/30 h-auto p-0">
          <TabsTrigger value="lista" className="text-xs rounded-none border-b-2 border-transparent data-[state=active]:border-primary">
            Lista
          </TabsTrigger>
          <TabsTrigger value="extracto" className="text-xs rounded-none border-b-2 border-transparent data-[state=active]:border-primary">
            Extracto
          </TabsTrigger>
          <TabsTrigger value="mes" className="text-xs rounded-none border-b-2 border-transparent data-[state=active]:border-primary">
            Mês
          </TabsTrigger>
          <TabsTrigger value="qtd-detalhada" className="text-xs rounded-none border-b-2 border-transparent data-[state=active]:border-primary">
            Qtd Detalhada
          </TabsTrigger>
          <TabsTrigger value="transferencia" className="text-xs rounded-none border-b-2 border-transparent data-[state=active]:border-primary">
            Transferência Pendente
          </TabsTrigger>
          <TabsTrigger value="grafico" className="text-xs rounded-none border-b-2 border-transparent data-[state=active]:border-primary">
            Gráfico
          </TabsTrigger>
          <TabsTrigger value="preco-compra" className="text-xs rounded-none border-b-2 border-transparent data-[state=active]:border-primary">
            Preço de Compra
          </TabsTrigger>
          <TabsTrigger value="no-serie" className="text-xs rounded-none border-b-2 border-transparent data-[state=active]:border-primary">
            No. de Serie
          </TabsTrigger>
          <TabsTrigger value="info-produto" className="text-xs rounded-none border-b-2 border-transparent data-[state=active]:border-primary">
            Informações de Produto
          </TabsTrigger>
          <TabsTrigger value="cost-history" className="text-xs rounded-none border-b-2 border-transparent data-[state=active]:border-primary">
            Cost History
          </TabsTrigger>
          <TabsTrigger value="pedidos" className="text-xs rounded-none border-b-2 border-transparent data-[state=active]:border-primary">
            Pedidos
          </TabsTrigger>
          <TabsTrigger value="barcode-qty" className="text-xs rounded-none border-b-2 border-transparent data-[state=active]:border-primary">
            Barcode Qty
          </TabsTrigger>
          <TabsTrigger value="vendas-mensais" className="text-xs rounded-none border-b-2 border-transparent data-[state=active]:border-primary">
            Vendas Mensais
          </TabsTrigger>
          <TabsTrigger value="auditoria" className="text-xs rounded-none border-b-2 border-transparent data-[state=active]:border-primary">
            Auditoria
          </TabsTrigger>
        </TabsList>

        {/* Action buttons row */}
        <div className="flex items-center gap-1 px-2 py-1 bg-muted/30 border-b">
          <div className="flex-1" />
          <Button variant="outline" size="sm" className="h-6 text-xs gap-1">
            <FileText className="w-3 h-3" />
            Nota
          </Button>
          <Button variant="secondary" size="sm" className="h-6 text-xs">
            Todos
          </Button>
          <Button variant="outline" size="sm" className="h-6 text-xs text-green-600">
            Qty &gt;0
          </Button>
          <Button variant="outline" size="sm" className="h-6 text-xs text-red-600">
            Qty &lt;0
          </Button>
          <Button variant="outline" size="sm" className="h-6 text-xs">
            &lt;Cost
          </Button>
          <Button variant="outline" size="sm" className="h-6 text-xs gap-1">
            <BarChart3 className="w-3 h-3" />
            Gráfico
          </Button>
          <Button variant="outline" size="sm" className="h-6 text-xs gap-1">
            <Eye className="w-3 h-3" />
            Visualização
          </Button>
        </div>

        <TabsContent value="lista" className="flex-1 m-0 p-2" onDoubleClick={handleDoubleClickProduct}>
          <AdvancedDataGrid 
            products={products}
            onSelectProduct={handleSelectProduct}
            selectedProductId={selectedProduct?.id}
            hideStock={isFilial}
          />
        </TabsContent>

        <TabsContent value="extracto" className="flex-1 m-0 p-4">
          <Card>
            <CardContent className="pt-6">
              <p className="text-muted-foreground text-center">Extracto do produto selecionado</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="mes" className="flex-1 m-0 p-4">
          <Card>
            <CardContent className="pt-6">
              <p className="text-muted-foreground text-center">Movimentos mensais</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="qtd-detalhada" className="flex-1 m-0 p-4 overflow-auto">
          <BranchStockDetail selectedProduct={selectedProduct} />
        </TabsContent>

        <TabsContent value="transferencia" className="flex-1 m-0 p-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center space-y-4">
                <ArrowRightLeft className="w-12 h-12 mx-auto text-muted-foreground" />
                <div>
                  <h3 className="font-semibold text-lg">Transferência de Stock</h3>
                  <p className="text-muted-foreground mb-4">Movimente produtos entre filiais e armazéns</p>
                </div>
                <Button onClick={() => navigate('/stock-transfer')}>
                  <ArrowRightLeft className="w-4 h-4 mr-2" />
                  Ir para Transferências
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="grafico" className="flex-1 m-0 p-4">
          <Card>
            <CardContent className="pt-6">
              <p className="text-muted-foreground text-center">Gráficos de movimentação</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="preco-compra" className="flex-1 m-0 p-4">
          <Card>
            <CardContent className="pt-6">
              <p className="text-muted-foreground text-center">Histórico de preços de compra</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="no-serie" className="flex-1 m-0 p-4">
          <Card>
            <CardContent className="pt-6">
              <p className="text-muted-foreground text-center">Números de série</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="info-produto" className="flex-1 m-0 p-4">
          {selectedProduct ? (
            <Card>
              <CardContent className="pt-6">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><strong>SKU:</strong> {selectedProduct.sku}</div>
                  <div><strong>Nome:</strong> {selectedProduct.name}</div>
                  <div><strong>Categoria:</strong> {selectedProduct.category}</div>
                  <div><strong>Preço:</strong> {selectedProduct.price.toLocaleString('pt-AO')} Kz</div>
                  <div><strong>Custo:</strong> {selectedProduct.cost.toLocaleString('pt-AO')} Kz</div>
                  <div><strong>Stock:</strong> {selectedProduct.stock} {selectedProduct.unit}</div>
                  <div><strong>IVA:</strong> {selectedProduct.taxRate}%</div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="pt-6">
                <p className="text-muted-foreground text-center">Selecione um produto para ver informações</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="cost-history" className="flex-1 m-0 p-4">
          <Card>
            <CardContent className="pt-6">
              <p className="text-muted-foreground text-center">Histórico de custos</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pedidos" className="flex-1 m-0 p-4">
          <Card>
            <CardContent className="pt-6">
              <p className="text-muted-foreground text-center">Pedidos relacionados</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="barcode-qty" className="flex-1 m-0 p-4">
          <Card>
            <CardContent className="pt-6">
              <p className="text-muted-foreground text-center">Quantidades por código de barras</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="vendas-mensais" className="flex-1 m-0 p-4">
          <Card>
            <CardContent className="pt-6">
              <p className="text-muted-foreground text-center">Vendas mensais do produto</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="auditoria" className="flex-1 m-0 p-4">
          <Card>
            <CardContent className="pt-6">
              <p className="text-muted-foreground text-center">Histórico de auditoria</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Status bar */}
      <div className="flex items-center justify-between px-3 py-1 bg-muted/50 border-t text-xs text-muted-foreground">
        <div className="flex items-center gap-4">
          <span className="text-red-600">Qtd &lt; 0</span>
          <span className="bg-yellow-200 text-yellow-800 px-2 rounded">Qtd Minima</span>
        </div>
        <span>{products.length} produtos</span>
      </div>

      <ProductDetailDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        product={selectedProduct}
        onSave={handleSaveProduct}
      />

      {/* Excel Import Dialog */}
      <ExcelImportDialog<ExcelProduct>
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        title="Importar Produtos"
        description="Importe produtos a partir de um ficheiro Excel ou CSV"
        parseFile={parseExcelFile}
        validateData={validateImportedProducts}
        onImport={handleImportProducts}
        downloadTemplate={downloadImportTemplate}
        columns={productImportColumns}
      />
    </div>
  );
}