import { useState, useMemo, useRef, useEffect } from 'react';
import { Product } from '@/types/erp';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ChevronDown, ChevronUp, Filter, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ColumnFilter {
  value: string;
  type: 'all' | 'custom' | 'blanks' | 'nonblanks';
}

interface ColumnDef {
  key: string;
  label: string;
  minWidth: number;
  type?: string;
  computed?: boolean;
}

interface AdvancedDataGridProps {
  products: Product[];
  onSelectProduct: (product: Product) => void;
  onDoubleClickProduct?: (product: Product) => void;
  selectedProductId?: string;
  hideStock?: boolean;
  isHeadOffice?: boolean;
  branches?: any[];
  allBranchProducts?: Record<string, Product[]>;
}

const COLUMNS: ColumnDef[] = [
  { key: 'sku', label: 'Produto', minWidth: 100 },
  { key: 'name', label: 'Descrição', minWidth: 180 },
  { key: 'category', label: 'Categoria', minWidth: 120 },
  { key: 'supplierName', label: 'Fornecedor', minWidth: 120 },
  { key: 'price', label: 'Preço s/IVA', minWidth: 100, type: 'number' },
  { key: 'priceWithIVA', label: 'Preço c/IVA', minWidth: 100, type: 'number', computed: true },
  { key: 'firstCost', label: 'Custo Inicial', minWidth: 100, type: 'number' },
  { key: 'lastCost', label: 'Últ. Custo', minWidth: 100, type: 'number' },
  { key: 'avgCost', label: 'Custo Médio', minWidth: 100, type: 'number' },
  { key: 'profitMargin', label: 'Lucro %', minWidth: 80, type: 'number', computed: true },
  { key: 'stock', label: 'Qty Total', minWidth: 80, type: 'number' },
  { key: 'taxRate', label: 'IVA %', minWidth: 70, type: 'number' },
  { key: 'unit', label: 'Unidade', minWidth: 80 },
];

export function AdvancedDataGrid({ 
  products, onSelectProduct, onDoubleClickProduct, selectedProductId, hideStock = false,
  isHeadOffice = false, allBranchProducts = {}
}: AdvancedDataGridProps) {
  const [columnFilters, setColumnFilters] = useState<Record<string, ColumnFilter>>({});
  const [columnSearches, setColumnSearches] = useState<Record<string, string>>({});
  const [sortColumn, setSortColumn] = useState<string>('sku');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [customFilterCol, setCustomFilterCol] = useState<string | null>(null);
  const [customFilterValue, setCustomFilterValue] = useState('');
  const customInputRef = useRef<HTMLInputElement>(null);

  const visibleColumns = useMemo(() => {
    if (hideStock) return COLUMNS.filter(c => c.key !== 'stock');
    return COLUMNS;
  }, [hideStock]);

  useEffect(() => {
    if (customFilterCol && customInputRef.current) {
      customInputRef.current.focus();
    }
  }, [customFilterCol]);

  // Filter and sort
  const filteredProducts = useMemo(() => {
    let result = [...products];

    Object.entries(columnFilters).forEach(([key, filter]) => {
      if (!filter || filter.type === 'all') return;
      result = result.filter(p => {
        const val = String(p[key as keyof Product] ?? '');
        switch (filter.type) {
          case 'blanks': return !val || val.trim() === '';
          case 'nonblanks': return val && val.trim() !== '';
          case 'custom': return val.toLowerCase().includes(filter.value.toLowerCase());
          default: return true;
        }
      });
    });

    Object.entries(columnSearches).forEach(([key, search]) => {
      if (!search) return;
      result = result.filter(p => {
        const val = String(p[key as keyof Product] ?? '').toLowerCase();
        return val.includes(search.toLowerCase());
      });
    });

    result.sort((a, b) => {
      const aVal = a[sortColumn as keyof Product];
      const bVal = b[sortColumn as keyof Product];
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      }
      const aStr = String(aVal ?? '');
      const bStr = String(bVal ?? '');
      return sortDirection === 'asc' ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
    });

    return result;
  }, [products, columnFilters, columnSearches, sortColumn, sortDirection]);

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const setFilter = (column: string, filter: ColumnFilter) => {
    setColumnFilters(prev => ({ ...prev, [column]: filter }));
  };

  const hasActiveFilters = Object.keys(columnFilters).length > 0 || 
    Object.values(columnSearches).some(v => v);

  const calculateProfitMargin = (product: Product): number => {
    const cost = product.avgCost || product.lastCost || product.firstCost || product.cost || 0;
    if (cost <= 0 || product.price <= 0) return 0;
    return ((product.price - cost) / cost) * 100;
  };

  const getStockTotal = (product: Product): number => {
    if (isHeadOffice && Object.keys(allBranchProducts).length > 0) {
      let total = 0;
      Object.values(allBranchProducts).forEach(prods => {
        const match = prods.find(p => p.sku === product.sku || p.id === product.id);
        if (match) total += match.stock || 0;
      });
      return total;
    }
    return product.stock || 0;
  };

  const formatValue = (product: Product, key: string) => {
    if (key === 'priceWithIVA') {
      const taxRate = product.taxRate || 0;
      const val = product.price * (1 + taxRate / 100);
      return (val || 0).toLocaleString('pt-AO', { minimumFractionDigits: 2 });
    }
    if (key === 'profitMargin') {
      const margin = calculateProfitMargin(product);
      const color = margin > 0 ? 'text-green-600' : margin < 0 ? 'text-red-600' : '';
      return <span className={color}>{margin.toFixed(1)}%</span>;
    }
    if (key === 'stock') {
      const qty = getStockTotal(product);
      return <span className={cn("font-semibold", qty <= 0 ? 'text-destructive' : qty <= 10 ? 'text-amber-600' : '')}>{qty}</span>;
    }
    const val = product[key as keyof Product];
    if (key === 'price' || key === 'firstCost' || key === 'lastCost' || key === 'avgCost') {
      return (val as number || 0).toLocaleString('pt-AO', { minimumFractionDigits: 2 });
    }
    if (key === 'taxRate') return `${val}%`;
    return String(val ?? '');
  };

  const uniqueValues = useMemo(() => {
    const values: Record<string, string[]> = {};
    visibleColumns.forEach(col => {
      if (col.computed) return;
      const set = new Set<string>();
      products.forEach(p => {
        const v = String(p[col.key as keyof Product] ?? '');
        if (v) set.add(v);
      });
      values[col.key] = Array.from(set).sort().slice(0, 20);
    });
    return values;
  }, [products, visibleColumns]);

  const applyCustomFilter = () => {
    if (customFilterCol && customFilterValue) {
      setFilter(customFilterCol, { value: customFilterValue, type: 'custom' });
    }
    setCustomFilterCol(null);
    setCustomFilterValue('');
  };

  return (
    <div className="flex flex-col h-full border border-border rounded-lg bg-card overflow-hidden">
      {/* Info Bar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-muted/50 border-b text-xs">
        <span className="text-muted-foreground">
          {filteredProducts.length} de {products.length} produtos
        </span>
        {hasActiveFilters && (
          <Button 
            variant="ghost" size="sm" className="h-6 text-xs"
            onClick={() => { setColumnFilters({}); setColumnSearches({}); }}
          >
            <X className="w-3 h-3 mr-1" />
            Limpar Filtros
          </Button>
        )}
      </div>

      {/* Custom filter inline dialog */}
      {customFilterCol && (
        <div className="flex items-center gap-2 px-3 py-2 bg-primary/5 border-b text-xs">
          <span className="text-muted-foreground">Filtro personalizado para <strong>{visibleColumns.find(c => c.key === customFilterCol)?.label}</strong>:</span>
          <Input
            ref={customInputRef}
            value={customFilterValue}
            onChange={e => setCustomFilterValue(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') applyCustomFilter(); if (e.key === 'Escape') { setCustomFilterCol(null); setCustomFilterValue(''); } }}
            className="h-6 w-48 text-xs"
            placeholder="Contém..."
          />
          <Button size="sm" className="h-6 text-xs" onClick={applyCustomFilter}>Aplicar</Button>
          <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => { setCustomFilterCol(null); setCustomFilterValue(''); }}>
            <X className="w-3 h-3" />
          </Button>
        </div>
      )}

      {/* Scrollable grid */}
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse" style={{ minWidth: visibleColumns.reduce((s, c) => s + c.minWidth, 0) }}>
          <thead className="sticky top-0 z-10 bg-muted">
            {/* Column headers */}
            <tr>
              {visibleColumns.map(col => {
                const hasFilter = columnFilters[col.key] && columnFilters[col.key].type !== 'all';
                const isSorted = sortColumn === col.key;
                return (
                  <th
                    key={col.key}
                    style={{ minWidth: col.minWidth }}
                    className="border-r border-b border-border p-0"
                  >
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          className={cn(
                            "w-full px-2 py-1.5 text-xs font-medium text-left flex items-center justify-between hover:bg-accent",
                            hasFilter && "bg-primary/10 text-primary"
                          )}
                        >
                          <span className="truncate">{col.label}</span>
                          <div className="flex items-center gap-0.5">
                            {hasFilter && <Filter className="w-3 h-3" />}
                            {isSorted ? (sortDirection === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />) : <ChevronDown className="w-3 h-3 opacity-30" />}
                          </div>
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="w-48 bg-popover border border-border shadow-lg z-50">
                        <DropdownMenuItem onClick={() => handleSort(col.key)}>
                          {isSorted && sortDirection === 'asc' ? '↓ Ordenar Desc' : '↑ Ordenar Asc'}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => setFilter(col.key, { value: '', type: 'all' })}>
                          (Todos)
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => { setCustomFilterCol(col.key); setCustomFilterValue(''); }}>
                          (Personalizado...)
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setFilter(col.key, { value: '', type: 'blanks' })}>
                          (Em branco)
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setFilter(col.key, { value: '', type: 'nonblanks' })}>
                          (Não em branco)
                        </DropdownMenuItem>
                        {uniqueValues[col.key]?.length > 0 && (
                          <>
                            <DropdownMenuSeparator />
                            <div className="max-h-48 overflow-y-auto">
                              {uniqueValues[col.key].map(val => (
                                <DropdownMenuItem key={val} onClick={() => setFilter(col.key, { value: val, type: 'custom' })}>
                                  {val}
                                </DropdownMenuItem>
                              ))}
                            </div>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </th>
                );
              })}
            </tr>
            {/* Per-column search */}
            <tr>
              {visibleColumns.map(col => (
                <th key={col.key} style={{ minWidth: col.minWidth }} className="border-r border-b border-border p-0">
                  <Input
                    placeholder=""
                    value={columnSearches[col.key] || ''}
                    onChange={e => setColumnSearches(prev => ({ ...prev, [col.key]: e.target.value }))}
                    className="h-7 rounded-none border-0 text-xs bg-background focus-visible:ring-0 focus-visible:ring-offset-0"
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredProducts.map((product, idx) => (
              <tr
                key={product.id}
                onClick={() => onSelectProduct(product)}
                onDoubleClick={() => onDoubleClickProduct?.(product)}
                className={cn(
                  "cursor-pointer hover:bg-accent/50 transition-colors",
                  selectedProductId === product.id && "bg-primary text-primary-foreground hover:bg-primary/90",
                  idx % 2 === 1 && selectedProductId !== product.id && "bg-muted/30"
                )}
              >
                {visibleColumns.map(col => (
                  <td
                    key={col.key}
                    style={{ minWidth: col.minWidth }}
                    className={cn(
                      "px-2 py-1.5 text-xs border-r border-border truncate",
                      col.type === 'number' && "text-right font-mono"
                    )}
                  >
                    {formatValue(product, col.key)}
                  </td>
                ))}
              </tr>
            ))}
            {filteredProducts.length === 0 && (
              <tr>
                <td colSpan={visibleColumns.length} className="text-center py-8 text-muted-foreground text-sm">
                  Nenhum produto encontrado
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
