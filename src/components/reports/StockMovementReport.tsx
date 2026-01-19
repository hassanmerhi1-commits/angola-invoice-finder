/**
 * Stock Movement Report
 * Shows inventory entries and exits
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Download, Printer, ArrowDownCircle, ArrowUpCircle, FileSpreadsheet, Package } from 'lucide-react';
import { useBranches, useSales, useProducts } from '@/hooks/useERP';

interface StockMovement {
  id: string;
  date: string;
  type: 'entry' | 'exit' | 'adjustment' | 'transfer';
  documentRef: string;
  productSku: string;
  productName: string;
  quantity: number;
  unitCost: number;
  totalValue: number;
  source?: string;
  destination?: string;
  notes?: string;
}

export default function StockMovementReport() {
  const { currentBranch } = useBranches();
  const { sales } = useSales(currentBranch?.id);
  const { products } = useProducts(currentBranch?.id);
  
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setDate(1);
    return date.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [movementType, setMovementType] = useState('all');
  const [selectedProduct, setSelectedProduct] = useState('all');

  // Generate movements from sales
  const movements: StockMovement[] = [];
  
  // Exit movements from sales
  sales.forEach(sale => {
    sale.items.forEach(item => {
      movements.push({
        id: `${sale.id}-${item.productId}`,
        date: sale.createdAt,
        type: 'exit',
        documentRef: sale.invoiceNumber,
        productSku: item.productId.slice(0, 8).toUpperCase(),
        productName: item.productName,
        quantity: -item.quantity,
        unitCost: item.unitPrice * 0.7, // Estimated cost
        totalValue: item.subtotal * 0.7,
        destination: 'Venda',
        notes: `Venda ${sale.invoiceNumber}`,
      });
    });
  });

  // Add some mock entry movements
  products.slice(0, 5).forEach((product, idx) => {
    const entryDate = new Date();
    entryDate.setDate(entryDate.getDate() - idx * 3);
    movements.push({
      id: `entry-${product.id}`,
      date: entryDate.toISOString(),
      type: 'entry',
      documentRef: `FT-C${(idx + 1).toString().padStart(4, '0')}`,
      productSku: product.sku,
      productName: product.name,
      quantity: Math.floor(Math.random() * 100) + 20,
      unitCost: product.cost,
      totalValue: product.cost * (Math.floor(Math.random() * 100) + 20),
      source: 'Compra',
      notes: 'Reposição de stock',
    });
  });

  // Sort by date descending
  movements.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Filter
  let filteredMovements = movements;
  if (movementType !== 'all') {
    filteredMovements = filteredMovements.filter(m => m.type === movementType);
  }
  if (selectedProduct !== 'all') {
    filteredMovements = filteredMovements.filter(m => m.productSku === selectedProduct);
  }
  filteredMovements = filteredMovements.filter(m => {
    const date = new Date(m.date);
    return date >= new Date(startDate) && date <= new Date(endDate + 'T23:59:59');
  });

  // Totals
  const totals = filteredMovements.reduce(
    (acc, m) => ({
      entries: acc.entries + (m.quantity > 0 ? m.quantity : 0),
      exits: acc.exits + (m.quantity < 0 ? Math.abs(m.quantity) : 0),
      entryValue: acc.entryValue + (m.quantity > 0 ? m.totalValue : 0),
      exitValue: acc.exitValue + (m.quantity < 0 ? m.totalValue : 0),
    }),
    { entries: 0, exits: 0, entryValue: 0, exitValue: 0 }
  );

  const formatMoney = (value: number) => value.toLocaleString('pt-AO', { minimumFractionDigits: 2 });

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'entry': return 'Entrada';
      case 'exit': return 'Saída';
      case 'adjustment': return 'Ajuste';
      case 'transfer': return 'Transferência';
      default: return type;
    }
  };

  const getTypeBadge = (type: string, quantity: number) => {
    if (type === 'entry' || quantity > 0) {
      return (
        <Badge className="bg-green-100 text-green-800 flex items-center gap-1 w-fit">
          <ArrowDownCircle className="w-3 h-3" />
          Entrada
        </Badge>
      );
    }
    return (
      <Badge className="bg-red-100 text-red-800 flex items-center gap-1 w-fit">
        <ArrowUpCircle className="w-3 h-3" />
        Saída
      </Badge>
    );
  };

  const handlePrint = () => window.print();

  const handleExportExcel = () => {
    const headers = ['Data', 'Tipo', 'Documento', 'SKU', 'Produto', 'Qtd', 'Custo Unit.', 'Valor Total'];
    const rows = filteredMovements.map(m => [
      new Date(m.date).toLocaleDateString('pt-AO'),
      getTypeLabel(m.type),
      m.documentRef,
      m.productSku,
      m.productName,
      m.quantity,
      m.unitCost,
      m.totalValue,
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `movimentos_stock_${startDate}_${endDate}.csv`;
    a.click();
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Package className="w-5 h-5" />
            Movimentos de Stock
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-1">
              <Label className="text-xs">Data Início</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-8 w-40"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Data Fim</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-8 w-40"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Tipo</Label>
              <Select value={movementType} onValueChange={setMovementType}>
                <SelectTrigger className="h-8 w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="entry">Entradas</SelectItem>
                  <SelectItem value="exit">Saídas</SelectItem>
                  <SelectItem value="adjustment">Ajustes</SelectItem>
                  <SelectItem value="transfer">Transferências</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 ml-auto">
              <Button variant="outline" size="sm" onClick={handlePrint}>
                <Printer className="w-4 h-4 mr-2" />
                Imprimir
              </Button>
              <Button variant="outline" size="sm" onClick={handleExportExcel}>
                <FileSpreadsheet className="w-4 h-4 mr-2" />
                Excel
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <ArrowDownCircle className="w-5 h-5 text-green-500" />
              <p className="text-sm text-muted-foreground">Entradas</p>
            </div>
            <p className="text-2xl font-bold text-green-600">{totals.entries}</p>
            <p className="text-sm text-muted-foreground">{formatMoney(totals.entryValue)} Kz</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <ArrowUpCircle className="w-5 h-5 text-red-500" />
              <p className="text-sm text-muted-foreground">Saídas</p>
            </div>
            <p className="text-2xl font-bold text-red-600">{totals.exits}</p>
            <p className="text-sm text-muted-foreground">{formatMoney(totals.exitValue)} Kz</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Saldo Movimento</p>
            <p className={`text-2xl font-bold ${totals.entries - totals.exits >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {totals.entries - totals.exits > 0 ? '+' : ''}{totals.entries - totals.exits}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Total Movimentos</p>
            <p className="text-2xl font-bold">{filteredMovements.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Movements Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Data/Hora</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Documento</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead className="text-right">Quantidade</TableHead>
                  <TableHead className="text-right">Custo Unit.</TableHead>
                  <TableHead className="text-right">Valor Total</TableHead>
                  <TableHead>Origem/Destino</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMovements.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      Nenhum movimento encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredMovements.map((movement) => (
                    <TableRow key={movement.id}>
                      <TableCell className="text-sm">
                        {new Date(movement.date).toLocaleDateString('pt-AO')}<br />
                        <span className="text-xs text-muted-foreground">
                          {new Date(movement.date).toLocaleTimeString('pt-AO', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </TableCell>
                      <TableCell>{getTypeBadge(movement.type, movement.quantity)}</TableCell>
                      <TableCell className="font-mono text-sm">{movement.documentRef}</TableCell>
                      <TableCell className="font-mono text-sm">{movement.productSku}</TableCell>
                      <TableCell>{movement.productName}</TableCell>
                      <TableCell className={`text-right font-mono font-medium ${movement.quantity > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {movement.quantity > 0 ? '+' : ''}{movement.quantity}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {formatMoney(movement.unitCost)} Kz
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatMoney(movement.totalValue)} Kz
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {movement.source || movement.destination || '-'}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
