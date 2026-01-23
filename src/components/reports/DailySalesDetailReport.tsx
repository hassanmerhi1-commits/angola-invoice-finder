import { useState, useRef } from 'react';
import { useBranchContext } from '@/contexts/BranchContext';
import { useSales, useProducts } from '@/hooks/useERP';
import { Sale, SaleItem, Product } from '@/types/erp';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Printer, FileDown, Eye, TrendingUp, DollarSign, Package } from 'lucide-react';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';

interface SaleItemDetail extends SaleItem {
  cost: number;
  profit: number;
  profitMargin: number;
  subtotalWithoutIVA: number;
  ivaAmount: number;
}

interface DailySalesDetailReportProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: string;
  branchId?: string;
  branchName?: string;
}

export function DailySalesDetailReport({ 
  open, 
  onOpenChange, 
  date, 
  branchId,
  branchName 
}: DailySalesDetailReportProps) {
  const { currentBranch } = useBranchContext();
  const { sales } = useSales(branchId || currentBranch?.id);
  const { products } = useProducts(branchId || currentBranch?.id);
  const printRef = useRef<HTMLDivElement>(null);

  // Filter sales for the selected date
  const daySales = sales.filter(sale => {
    const saleDate = new Date(sale.createdAt).toISOString().split('T')[0];
    return saleDate === date;
  });

  // Create product cost lookup
  const productCostMap = new Map<string, number>();
  products.forEach(p => {
    productCostMap.set(p.id, p.avgCost || p.cost || 0);
  });

  // Process all sale items with cost and profit calculations
  const processedItems: SaleItemDetail[] = [];
  daySales.forEach(sale => {
    sale.items.forEach(item => {
      const cost = productCostMap.get(item.productId) || 0;
      const totalCost = cost * item.quantity;
      const subtotalWithoutIVA = item.subtotal / (1 + item.taxRate / 100);
      const ivaAmount = item.subtotal - subtotalWithoutIVA;
      const profit = subtotalWithoutIVA - totalCost;
      const profitMargin = subtotalWithoutIVA > 0 ? (profit / subtotalWithoutIVA) * 100 : 0;

      processedItems.push({
        ...item,
        cost: totalCost,
        profit,
        profitMargin,
        subtotalWithoutIVA,
        ivaAmount,
      });
    });
  });

  // Aggregate by product
  const aggregatedByProduct = new Map<string, {
    sku: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    cost: number;
    subtotalWithoutIVA: number;
    ivaAmount: number;
    subtotalWithIVA: number;
    profit: number;
    taxRate: number;
  }>();

  processedItems.forEach(item => {
    const existing = aggregatedByProduct.get(item.productId);
    if (existing) {
      existing.quantity += item.quantity;
      existing.cost += item.cost;
      existing.subtotalWithoutIVA += item.subtotalWithoutIVA;
      existing.ivaAmount += item.ivaAmount;
      existing.subtotalWithIVA += item.subtotal;
      existing.profit += item.profit;
    } else {
      aggregatedByProduct.set(item.productId, {
        sku: item.sku,
        productName: item.productName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        cost: item.cost,
        subtotalWithoutIVA: item.subtotalWithoutIVA,
        ivaAmount: item.ivaAmount,
        subtotalWithIVA: item.subtotal,
        profit: item.profit,
        taxRate: item.taxRate,
      });
    }
  });

  const aggregatedItems = Array.from(aggregatedByProduct.values()).sort((a, b) => 
    b.subtotalWithIVA - a.subtotalWithIVA
  );

  // Calculate totals
  const totals = {
    quantity: aggregatedItems.reduce((sum, item) => sum + item.quantity, 0),
    cost: aggregatedItems.reduce((sum, item) => sum + item.cost, 0),
    subtotalWithoutIVA: aggregatedItems.reduce((sum, item) => sum + item.subtotalWithoutIVA, 0),
    ivaAmount: aggregatedItems.reduce((sum, item) => sum + item.ivaAmount, 0),
    subtotalWithIVA: aggregatedItems.reduce((sum, item) => sum + item.subtotalWithIVA, 0),
    profit: aggregatedItems.reduce((sum, item) => sum + item.profit, 0),
  };

  const profitMargin = totals.subtotalWithoutIVA > 0 
    ? (totals.profit / totals.subtotalWithoutIVA) * 100 
    : 0;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-AO', { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    }).format(value);
  };

  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Relatório de Vendas - ${format(new Date(date), 'dd/MM/yyyy')}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { 
            font-family: Arial, sans-serif; 
            font-size: 10pt;
            padding: 20px;
            color: #000;
          }
          .header { text-align: center; margin-bottom: 20px; }
          .header h1 { font-size: 16pt; margin-bottom: 5px; }
          .header p { font-size: 10pt; color: #666; }
          .summary-cards { 
            display: flex; 
            gap: 10px; 
            margin-bottom: 20px;
            flex-wrap: wrap;
          }
          .summary-card { 
            border: 1px solid #ddd; 
            padding: 10px; 
            flex: 1;
            min-width: 120px;
            text-align: center;
          }
          .summary-card .label { font-size: 8pt; color: #666; }
          .summary-card .value { font-size: 12pt; font-weight: bold; }
          table { 
            width: 100%; 
            border-collapse: collapse; 
            margin-top: 10px;
            font-size: 9pt;
          }
          th, td { 
            border: 1px solid #ddd; 
            padding: 6px 8px; 
            text-align: left;
          }
          th { 
            background: #f5f5f5; 
            font-weight: bold;
            font-size: 8pt;
          }
          .text-right { text-align: right; }
          .text-center { text-align: center; }
          tfoot td { 
            font-weight: bold; 
            background: #f9f9f9;
          }
          .profit-positive { color: #16a34a; }
          .profit-negative { color: #dc2626; }
          .section-title { 
            font-size: 11pt; 
            font-weight: bold; 
            margin: 20px 0 10px 0;
            padding-bottom: 5px;
            border-bottom: 2px solid #000;
          }
          .footer { 
            margin-top: 30px; 
            text-align: center; 
            font-size: 8pt; 
            color: #666;
          }
          @media print {
            body { padding: 0; }
            @page { margin: 15mm; }
          }
        </style>
      </head>
      <body>
        ${printContent.innerHTML}
        <div class="footer">
          <p>Gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: pt })}</p>
          <p>Kwanza ERP - Sistema de Gestão Empresarial</p>
        </div>
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  const handleSavePDF = () => {
    // Use print dialog with PDF option
    handlePrint();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Relatório Detalhado de Vendas</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handlePrint}>
                <Printer className="w-4 h-4 mr-2" />
                Imprimir
              </Button>
              <Button variant="outline" size="sm" onClick={handleSavePDF}>
                <FileDown className="w-4 h-4 mr-2" />
                Guardar PDF
              </Button>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div ref={printRef}>
          {/* Header */}
          <div className="header text-center mb-6">
            <h1 className="text-xl font-bold">RELATÓRIO DETALHADO DE VENDAS</h1>
            <p className="text-muted-foreground">
              Data: {format(new Date(date), "dd 'de' MMMM 'de' yyyy", { locale: pt })}
            </p>
            <p className="text-muted-foreground">
              Filial: {branchName || currentBranch?.name}
            </p>
          </div>

          {/* Summary Cards */}
          <div className="summary-cards grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardContent className="pt-4">
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Vendas (s/ IVA)</p>
                  <p className="text-lg font-bold">{formatCurrency(totals.subtotalWithoutIVA)} Kz</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">IVA Total</p>
                  <p className="text-lg font-bold">{formatCurrency(totals.ivaAmount)} Kz</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Total (c/ IVA)</p>
                  <p className="text-lg font-bold">{formatCurrency(totals.subtotalWithIVA)} Kz</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Lucro Bruto</p>
                  <p className={`text-lg font-bold ${totals.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(totals.profit)} Kz
                  </p>
                  <p className="text-xs text-muted-foreground">({profitMargin.toFixed(1)}% margem)</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Additional Summary */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  <Package className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Itens Vendidos</p>
                    <p className="text-lg font-bold">{totals.quantity}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Custo Total</p>
                    <p className="text-lg font-bold">{formatCurrency(totals.cost)} Kz</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Transações</p>
                    <p className="text-lg font-bold">{daySales.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Separator className="my-4" />

          {/* Detailed Items Table */}
          <div className="section-title font-bold text-lg mb-2 border-b-2 border-foreground pb-1">
            Detalhes por Produto
          </div>

          {aggregatedItems.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhuma venda encontrada para esta data
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">Código</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead className="text-center">Qtd</TableHead>
                  <TableHead className="text-right">P. Unit.</TableHead>
                  <TableHead className="text-right">Custo</TableHead>
                  <TableHead className="text-right">Subtotal (s/ IVA)</TableHead>
                  <TableHead className="text-center">IVA %</TableHead>
                  <TableHead className="text-right">IVA (Kz)</TableHead>
                  <TableHead className="text-right">Total (c/ IVA)</TableHead>
                  <TableHead className="text-right">Lucro</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {aggregatedItems.map((item, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="font-mono text-sm">{item.sku}</TableCell>
                    <TableCell className="font-medium">{item.productName}</TableCell>
                    <TableCell className="text-center">{item.quantity}</TableCell>
                    <TableCell className="text-right">{formatCurrency(item.unitPrice)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(item.cost)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(item.subtotalWithoutIVA)}</TableCell>
                    <TableCell className="text-center">{item.taxRate}%</TableCell>
                    <TableCell className="text-right">{formatCurrency(item.ivaAmount)}</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(item.subtotalWithIVA)}</TableCell>
                    <TableCell className={`text-right font-medium ${item.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(item.profit)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={2} className="font-bold">TOTAIS</TableCell>
                  <TableCell className="text-center font-bold">{totals.quantity}</TableCell>
                  <TableCell></TableCell>
                  <TableCell className="text-right font-bold">{formatCurrency(totals.cost)}</TableCell>
                  <TableCell className="text-right font-bold">{formatCurrency(totals.subtotalWithoutIVA)}</TableCell>
                  <TableCell></TableCell>
                  <TableCell className="text-right font-bold">{formatCurrency(totals.ivaAmount)}</TableCell>
                  <TableCell className="text-right font-bold">{formatCurrency(totals.subtotalWithIVA)}</TableCell>
                  <TableCell className={`text-right font-bold ${totals.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(totals.profit)}
                  </TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          )}

          <Separator className="my-4" />

          {/* Sales by Transaction */}
          <div className="section-title font-bold text-lg mb-2 border-b-2 border-foreground pb-1">
            Vendas por Transação
          </div>

          {daySales.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhuma transação encontrada
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Factura</TableHead>
                  <TableHead>Hora</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Pagamento</TableHead>
                  <TableHead className="text-right">Subtotal (s/ IVA)</TableHead>
                  <TableHead className="text-right">IVA</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {daySales.map(sale => {
                  const saleSubtotal = sale.items.reduce((sum, item) => 
                    sum + (item.subtotal / (1 + item.taxRate / 100)), 0);
                  const saleIVA = sale.total - saleSubtotal;
                  
                  return (
                    <TableRow key={sale.id}>
                      <TableCell className="font-mono">{sale.invoiceNumber}</TableCell>
                      <TableCell>{format(new Date(sale.createdAt), 'HH:mm')}</TableCell>
                      <TableCell>{sale.customerName || 'Consumidor Final'}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {sale.paymentMethod === 'cash' ? 'Numerário' :
                           sale.paymentMethod === 'card' ? 'Cartão' :
                           sale.paymentMethod === 'transfer' ? 'Transferência' : sale.paymentMethod}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">{formatCurrency(saleSubtotal)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(saleIVA)}</TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(sale.total)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={4} className="font-bold">TOTAL</TableCell>
                  <TableCell className="text-right font-bold">{formatCurrency(totals.subtotalWithoutIVA)}</TableCell>
                  <TableCell className="text-right font-bold">{formatCurrency(totals.ivaAmount)}</TableCell>
                  <TableCell className="text-right font-bold">{formatCurrency(totals.subtotalWithIVA)}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
