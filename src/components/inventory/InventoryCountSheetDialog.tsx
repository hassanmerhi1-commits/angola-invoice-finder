import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Printer, FileSpreadsheet, Download } from 'lucide-react';
import { Product, Branch } from '@/types/erp';
import { getCompanySettings } from '@/lib/companySettings';
import * as XLSX from 'xlsx';

// Generate count sheet number
function generateCountNumber(branchCode: string): string {
  const date = format(new Date(), 'yyyyMMdd');
  const seq = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `INV-${branchCode || 'XX'}-${date}-${seq}`;
}

interface InventoryCountSheetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: Product[];
  branch: Branch | null;
  categories: string[];
}

export function InventoryCountSheetDialog({
  open,
  onOpenChange,
  products,
  branch,
  categories,
}: InventoryCountSheetDialogProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [includeInactive, setIncludeInactive] = useState(false);
  const [hideSystemStock, setHideSystemStock] = useState(false);
  const [countedBy, setCountedBy] = useState('');

  const company = getCompanySettings();
  
  // Generate count number
  const countNumber = useMemo(() => 
    generateCountNumber(branch?.code || ''),
    [branch?.code]
  );

  // Filter products
  const filteredProducts = products.filter(p => {
    if (!includeInactive && !p.isActive) return false;
    if (selectedCategory !== 'all' && p.category !== selectedCategory) return false;
    return true;
  }).sort((a, b) => a.sku.localeCompare(b.sku));

  // Calculate stock value totals
  const stockTotals = useMemo(() => {
    const totalUnits = filteredProducts.reduce((sum, p) => sum + p.stock, 0);
    const totalCostValue = filteredProducts.reduce((sum, p) => sum + (p.stock * (p.cost || 0)), 0);
    const totalSaleValue = filteredProducts.reduce((sum, p) => sum + (p.stock * (p.price || 0)), 0);
    return { totalUnits, totalCostValue, totalSaleValue };
  }, [filteredProducts]);

  const formatCurrency = (value: number) => 
    new Intl.NumberFormat('pt-AO', { style: 'currency', currency: 'AOA' }).format(value);

  const handlePrint = () => {
    const printContent = generatePrintContent();
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.onload = () => {
        printWindow.print();
      };
    }
  };

  const handleExportExcel = () => {
    const data = filteredProducts.map((p, idx) => ({
      '#': idx + 1,
      'Código': p.sku,
      'Código Barras': p.barcode || '',
      'Descrição': p.name,
      'Categoria': p.category,
      'Unidade': p.unit,
      'Stock Sistema': hideSystemStock ? '' : p.stock,
      'Custo Un.': p.cost || 0,
      'Valor Stock (Custo)': hideSystemStock ? '' : (p.stock * (p.cost || 0)),
      'Contagem Física': '',
      'Diferença': '',
      'Observações': '',
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Contagem');

    // Set column widths
    ws['!cols'] = [
      { wch: 5 },  // #
      { wch: 15 }, // Código
      { wch: 15 }, // Código Barras
      { wch: 40 }, // Descrição
      { wch: 15 }, // Categoria
      { wch: 8 },  // Unidade
      { wch: 12 }, // Stock Sistema
      { wch: 12 }, // Custo Un.
      { wch: 15 }, // Valor Stock
      { wch: 15 }, // Contagem Física
      { wch: 12 }, // Diferença
      { wch: 20 }, // Observações
    ];

    const dateStr = format(new Date(), 'yyyy-MM-dd');
    XLSX.writeFile(wb, `${countNumber}_${branch?.code || 'geral'}_${dateStr}.xlsx`);
  };

  const generatePrintContent = () => {
    const dateStr = format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: pt });
    const timeStr = format(new Date(), 'HH:mm');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Folha de Contagem - ${countNumber}</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          body {
            font-family: Arial, sans-serif;
            font-size: 10px;
            line-height: 1.3;
            padding: 10mm;
          }
          .header {
            text-align: center;
            margin-bottom: 15px;
            border-bottom: 2px solid #333;
            padding-bottom: 10px;
          }
          .company-name {
            font-size: 16px;
            font-weight: bold;
            margin-bottom: 3px;
          }
          .company-info {
            font-size: 9px;
            color: #555;
          }
          .title {
            font-size: 14px;
            font-weight: bold;
            margin-top: 10px;
            text-transform: uppercase;
          }
          .meta-info {
            display: flex;
            justify-content: space-between;
            margin: 10px 0;
            font-size: 10px;
            padding: 8px;
            background: #f5f5f5;
            border-radius: 4px;
          }
          .meta-item {
            display: flex;
            gap: 5px;
          }
          .meta-label {
            font-weight: bold;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 10px;
          }
          th, td {
            border: 1px solid #333;
            padding: 4px 6px;
            text-align: left;
          }
          th {
            background: #333;
            color: white;
            font-weight: bold;
            font-size: 9px;
            text-transform: uppercase;
          }
          td {
            font-size: 9px;
          }
          tr:nth-child(even) {
            background: #f9f9f9;
          }
          .col-num {
            width: 30px;
            text-align: center;
          }
          .col-sku {
            width: 80px;
          }
          .col-barcode {
            width: 90px;
            font-family: monospace;
          }
          .col-name {
            min-width: 180px;
          }
          .col-category {
            width: 80px;
          }
          .col-unit {
            width: 40px;
            text-align: center;
          }
          .col-stock {
            width: 60px;
            text-align: center;
            font-weight: bold;
          }
          .col-cost {
            width: 70px;
            text-align: right;
            font-family: monospace;
          }
          .col-value {
            width: 90px;
            text-align: right;
            font-family: monospace;
            font-weight: bold;
          }
          .col-count {
            width: 80px;
            text-align: center;
            background: #fffde7 !important;
          }
          .col-diff {
            width: 60px;
            text-align: center;
            background: #fff3e0 !important;
          }
          .col-obs {
            width: 100px;
          }
          .count-number {
            font-size: 12px;
            font-weight: bold;
            color: #333;
            font-family: monospace;
            background: #f0f0f0;
            padding: 4px 8px;
            border-radius: 4px;
          }
          .value-summary {
            margin-top: 15px;
            padding: 15px;
            background: #e8f5e9;
            border-radius: 4px;
            border: 1px solid #4caf50;
          }
          .value-row {
            display: flex;
            justify-content: space-between;
            margin: 5px 0;
            font-size: 12px;
          }
          .value-label {
            font-weight: 500;
          }
          .value-amount {
            font-family: monospace;
            font-weight: bold;
          }
          .footer {
            margin-top: 20px;
            padding-top: 15px;
            border-top: 1px solid #ccc;
          }
          .signatures {
            display: flex;
            justify-content: space-between;
            margin-top: 40px;
          }
          .signature-box {
            width: 45%;
            text-align: center;
          }
          .signature-line {
            border-top: 1px solid #333;
            margin-top: 40px;
            padding-top: 5px;
            font-size: 9px;
          }
          .summary {
            margin-top: 15px;
            padding: 10px;
            background: #f5f5f5;
            border-radius: 4px;
          }
          .summary-row {
            display: flex;
            justify-content: space-between;
            margin: 3px 0;
            font-size: 10px;
          }
          .page-break {
            page-break-after: always;
          }
          @media print {
            body {
              padding: 5mm;
            }
            .no-print {
              display: none;
            }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="company-name">${company.name}</div>
          <div class="company-info">
            NIF: ${company.nif} | ${company.address}, ${company.city}
            ${company.phone ? ` | Tel: ${company.phone}` : ''}
          </div>
          <div class="title">Folha de Contagem de Inventário</div>
          <div class="count-number">Nº: ${countNumber}</div>
        </div>

        <div class="meta-info">
          <div class="meta-item">
            <span class="meta-label">Filial:</span>
            <span>${branch?.name || 'Todas'} ${branch?.code ? `(${branch.code})` : ''}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">Data:</span>
            <span>${dateStr} às ${timeStr}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">Categoria:</span>
            <span>${selectedCategory === 'all' ? 'Todas' : selectedCategory}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">Total Itens:</span>
            <span>${filteredProducts.length}</span>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th class="col-num">#</th>
              <th class="col-sku">Código</th>
              <th class="col-barcode">Cód. Barras</th>
              <th class="col-name">Descrição do Produto</th>
              <th class="col-category">Categoria</th>
              <th class="col-unit">Un.</th>
              ${!hideSystemStock ? '<th class="col-stock">Stock<br/>Sistema</th>' : ''}
              ${!hideSystemStock ? '<th class="col-cost">Custo Un.</th>' : ''}
              ${!hideSystemStock ? '<th class="col-value">Valor Stock</th>' : ''}
              <th class="col-count">Contagem<br/>Física</th>
              <th class="col-diff">Diferença</th>
              <th class="col-obs">Observações</th>
            </tr>
          </thead>
          <tbody>
            ${filteredProducts.map((p, idx) => `
              <tr>
                <td class="col-num">${idx + 1}</td>
                <td class="col-sku">${p.sku}</td>
                <td class="col-barcode">${p.barcode || '-'}</td>
                <td class="col-name">${p.name}</td>
                <td class="col-category">${p.category}</td>
                <td class="col-unit">${p.unit}</td>
                ${!hideSystemStock ? `<td class="col-stock">${p.stock}</td>` : ''}
                ${!hideSystemStock ? `<td class="col-cost">${(p.cost || 0).toFixed(2)}</td>` : ''}
                ${!hideSystemStock ? `<td class="col-value">${(p.stock * (p.cost || 0)).toLocaleString('pt-AO', { minimumFractionDigits: 2 })}</td>` : ''}
                <td class="col-count"></td>
                <td class="col-diff"></td>
                <td class="col-obs"></td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="footer">
          ${!hideSystemStock ? `
          <div class="value-summary">
            <div class="value-row">
              <span class="value-label">Total de produtos listados:</span>
              <span class="value-amount">${filteredProducts.length}</span>
            </div>
            <div class="value-row">
              <span class="value-label">Stock total no sistema:</span>
              <span class="value-amount">${stockTotals.totalUnits.toLocaleString('pt-AO')} unidades</span>
            </div>
            <div class="value-row">
              <span class="value-label">Valor total do stock (Custo):</span>
              <span class="value-amount" style="color: #2e7d32; font-size: 14px;">${formatCurrency(stockTotals.totalCostValue)}</span>
            </div>
            <div class="value-row">
              <span class="value-label">Valor total do stock (Venda):</span>
              <span class="value-amount" style="color: #1565c0; font-size: 14px;">${formatCurrency(stockTotals.totalSaleValue)}</span>
            </div>
          </div>
          ` : `
          <div class="summary">
            <div class="summary-row">
              <span>Total de produtos listados:</span>
              <strong>${filteredProducts.length}</strong>
            </div>
          </div>
          `}
          </div>

          <div class="signatures">
            <div class="signature-box">
              <div class="signature-line">
                Contado por: ${countedBy || '________________________'}
              </div>
            </div>
            <div class="signature-box">
              <div class="signature-line">
                Conferido por: ________________________
              </div>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5" />
            Folha de Contagem de Inventário
          </DialogTitle>
          <DialogDescription>
            Gere uma folha para contagem física do stock com colunas para preenchimento manual
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Branch Info */}
          <div className="p-3 bg-muted rounded-lg">
            <Label className="text-xs text-muted-foreground">Filial</Label>
            <p className="font-medium">{branch?.name || 'Todas as Filiais'}</p>
            {branch?.code && <p className="text-sm text-muted-foreground">Código: {branch.code}</p>}
          </div>

          {/* Category Filter */}
          <div className="space-y-2">
            <Label>Categoria</Label>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar categoria" />
              </SelectTrigger>
              <SelectContent className="bg-background border shadow-lg z-50">
                <SelectItem value="all">Todas as Categorias</SelectItem>
                {categories.map(cat => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Counted By */}
          <div className="space-y-2">
            <Label>Contado por (opcional)</Label>
            <Input
              placeholder="Nome do responsável pela contagem"
              value={countedBy}
              onChange={(e) => setCountedBy(e.target.value)}
            />
          </div>

          {/* Options */}
          <div className="space-y-3">
            <Label>Opções</Label>
            <div className="flex items-center gap-2">
              <Checkbox
                id="hideStock"
                checked={hideSystemStock}
                onCheckedChange={(checked) => setHideSystemStock(checked === true)}
              />
              <label htmlFor="hideStock" className="text-sm cursor-pointer">
                Ocultar stock do sistema (contagem cega)
              </label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="includeInactive"
                checked={includeInactive}
                onCheckedChange={(checked) => setIncludeInactive(checked === true)}
              />
              <label htmlFor="includeInactive" className="text-sm cursor-pointer">
                Incluir produtos inactivos
              </label>
            </div>
          </div>

          {/* Preview Info */}
          <div className="p-4 bg-primary/5 rounded-lg border border-primary/20 space-y-2">
            <div className="flex justify-between text-sm">
              <span>Nº Contagem:</span>
              <strong className="font-mono">{countNumber}</strong>
            </div>
            <div className="flex justify-between text-sm">
              <span>Total de produtos:</span>
              <strong>{filteredProducts.length}</strong>
            </div>
            {!hideSystemStock && (
              <>
                <div className="flex justify-between text-sm">
                  <span>Stock total no sistema:</span>
                  <strong>{stockTotals.totalUnits.toLocaleString('pt-AO')} un.</strong>
                </div>
                <div className="flex justify-between text-sm pt-2 border-t">
                  <span>Valor do stock (Custo):</span>
                  <strong className="text-emerald-600">{formatCurrency(stockTotals.totalCostValue)}</strong>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Valor do stock (Venda):</span>
                  <strong className="text-blue-600">{formatCurrency(stockTotals.totalSaleValue)}</strong>
                </div>
              </>
            )}
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button variant="outline" onClick={handleExportExcel}>
            <Download className="w-4 h-4 mr-2" />
            Exportar Excel
          </Button>
          <Button onClick={handlePrint}>
            <Printer className="w-4 h-4 mr-2" />
            Imprimir Folha
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
