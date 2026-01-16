import { useState, useMemo } from 'react';
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
import { ChevronDown, Filter, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ColumnFilter {
  value: string;
  type: 'all' | 'custom' | 'blanks' | 'nonblanks';
}

interface AdvancedDataGridProps {
  products: Product[];
  onSelectProduct: (product: Product) => void;
  selectedProductId?: string;
}

const COLUMNS = [
  { key: 'sku', label: 'Produto', width: 'w-24' },
  { key: 'name', label: 'Descrição', width: 'w-48' },
  { key: 'price', label: 'Preço', width: 'w-20', type: 'number' },
  { key: 'firstCost', label: 'Custo Inicial', width: 'w-24', type: 'number' },
  { key: 'lastCost', label: 'Últ. Custo', width: 'w-24', type: 'number' },
  { key: 'avgCost', label: 'Custo Médio', width: 'w-24', type: 'number' },
  { key: 'profitMargin', label: 'Lucro %', width: 'w-20', type: 'number', computed: true },
  { key: 'stock', label: 'Qty', width: 'w-16', type: 'number' },
  { key: 'taxRate', label: 'IVA %', width: 'w-16', type: 'number' },
  { key: 'unit', label: 'Unidade', width: 'w-16' },
  { key: 'category', label: 'Categoria', width: 'w-28' },
  { key: 'supplierName', label: 'Fornecedor', width: 'w-28' },
  { key: 'branchId', label: 'Filial', width: 'w-20' },
] as const;

type ColumnKey = typeof COLUMNS[number]['key'];

export function AdvancedDataGrid({ products, onSelectProduct, selectedProductId }: AdvancedDataGridProps) {
  const [columnFilters, setColumnFilters] = useState<Record<ColumnKey, ColumnFilter>>({} as Record<ColumnKey, ColumnFilter>);
  const [columnSearches, setColumnSearches] = useState<Record<ColumnKey, string>>({} as Record<ColumnKey, string>);
  const [sortColumn, setSortColumn] = useState<ColumnKey>('sku');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Get unique values for each column
  const uniqueValues = useMemo(() => {
    const values: Record<ColumnKey, Set<string>> = {} as Record<ColumnKey, Set<string>>;
    COLUMNS.forEach(col => {
      values[col.key] = new Set();
      products.forEach(p => {
        const val = String(p[col.key as keyof Product] ?? '');
        if (val) values[col.key].add(val);
      });
    });
    return values;
  }, [products]);

  // Filter and sort products
  const filteredProducts = useMemo(() => {
    let result = [...products];

    // Apply column filters
    Object.entries(columnFilters).forEach(([key, filter]) => {
      if (!filter || filter.type === 'all') return;
      
      result = result.filter(p => {
        const val = String(p[key as keyof Product] ?? '');
        
        switch (filter.type) {
          case 'blanks':
            return !val || val.trim() === '';
          case 'nonblanks':
            return val && val.trim() !== '';
          case 'custom':
            return val === filter.value;
          default:
            return true;
        }
      });
    });

    // Apply column searches
    Object.entries(columnSearches).forEach(([key, search]) => {
      if (!search) return;
      result = result.filter(p => {
        const val = String(p[key as keyof Product] ?? '').toLowerCase();
        return val.includes(search.toLowerCase());
      });
    });

    // Sort
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

  const handleSort = (column: ColumnKey) => {
    if (sortColumn === column) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const setFilter = (column: ColumnKey, filter: ColumnFilter) => {
    setColumnFilters(prev => ({ ...prev, [column]: filter }));
  };

  const clearFilter = (column: ColumnKey) => {
    setColumnFilters(prev => {
      const next = { ...prev };
      delete next[column];
      return next;
    });
  };

  const setSearch = (column: ColumnKey, value: string) => {
    setColumnSearches(prev => ({ ...prev, [column]: value }));
  };

  const hasActiveFilters = Object.keys(columnFilters).length > 0 || 
    Object.values(columnSearches).some(v => v);

  // Calculate profit margin based on average cost
  const calculateProfitMargin = (product: Product): number => {
    const cost = product.avgCost || product.lastCost || product.firstCost || product.cost || 0;
    if (cost <= 0 || product.price <= 0) return 0;
    return ((product.price - cost) / cost) * 100;
  };

  const formatValue = (product: Product, key: ColumnKey) => {
    // Handle computed columns
    if (key === 'profitMargin') {
      const margin = calculateProfitMargin(product);
      const color = margin > 0 ? 'text-green-600' : margin < 0 ? 'text-red-600' : '';
      return <span className={color}>{margin.toFixed(1)}%</span>;
    }
    
    const val = product[key as keyof Product];
    
    if (key === 'price' || key === 'firstCost' || key === 'lastCost' || key === 'avgCost') {
      return (val as number || 0).toLocaleString('pt-AO', { minimumFractionDigits: 2 });
    }
    if (key === 'taxRate') {
      return `${val}%`;
    }
    
    return String(val ?? '');
  };

  return (
    <div className="flex flex-col h-full border border-border rounded-lg bg-card overflow-hidden">
      {/* Info Bar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-muted/50 border-b text-xs">
        <span className="text-muted-foreground">
          Arraste uma coluna para agrupar
        </span>
        {hasActiveFilters && (
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-6 text-xs"
            onClick={() => {
              setColumnFilters({} as Record<ColumnKey, ColumnFilter>);
              setColumnSearches({} as Record<ColumnKey, string>);
            }}
          >
            <X className="w-3 h-3 mr-1" />
            Limpar Filtros
          </Button>
        )}
      </div>

      {/* Header with filters */}
      <div className="bg-muted border-b">
        {/* Column Headers with Filter Dropdowns */}
        <div className="flex">
          {COLUMNS.map(col => {
            const hasFilter = columnFilters[col.key] && columnFilters[col.key].type !== 'all';
            
            return (
              <div 
                key={col.key}
                className={cn(
                  "flex-shrink-0 border-r border-border",
                  col.width
                )}
              >
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button 
                      className={cn(
                        "w-full px-2 py-1.5 text-xs font-medium text-left flex items-center justify-between hover:bg-accent",
                        hasFilter && "bg-primary/10 text-primary"
                      )}
                      onClick={() => handleSort(col.key)}
                    >
                      <span className="truncate">{col.label}</span>
                      <div className="flex items-center gap-0.5">
                        {hasFilter && <Filter className="w-3 h-3" />}
                        <ChevronDown className="w-3 h-3" />
                      </div>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent 
                    align="start" 
                    className="w-48 bg-popover border border-border shadow-lg z-50"
                  >
                    <DropdownMenuItem onClick={() => setFilter(col.key, { value: '', type: 'all' })}>
                      (Todos)
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => {
                      const customVal = prompt('Valor personalizado:');
                      if (customVal !== null) {
                        setFilter(col.key, { value: customVal, type: 'custom' });
                      }
                    }}>
                      (Personalizado...)
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setFilter(col.key, { value: '', type: 'blanks' })}>
                      (Em branco)
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setFilter(col.key, { value: '', type: 'nonblanks' })}>
                      (Não em branco)
                    </DropdownMenuItem>
                    
                    {uniqueValues[col.key].size > 0 && (
                      <>
                        <DropdownMenuSeparator />
                        <div className="max-h-48 overflow-y-auto">
                          {Array.from(uniqueValues[col.key]).slice(0, 20).map(val => (
                            <DropdownMenuItem 
                              key={val}
                              onClick={() => setFilter(col.key, { value: val, type: 'custom' })}
                            >
                              {val}
                            </DropdownMenuItem>
                          ))}
                        </div>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            );
          })}
        </div>

        {/* Column Search Inputs */}
        <div className="flex border-t border-border">
          {COLUMNS.map(col => (
            <div 
              key={col.key}
              className={cn(
                "flex-shrink-0 border-r border-border",
                col.width
              )}
            >
              <Input
                placeholder=""
                value={columnSearches[col.key] || ''}
                onChange={(e) => setSearch(col.key, e.target.value)}
                className="h-7 rounded-none border-0 text-xs bg-background focus-visible:ring-0 focus-visible:ring-offset-0"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Data Rows */}
      <div className="flex-1 overflow-auto">
        {filteredProducts.map((product, idx) => (
          <div
            key={product.id}
            onClick={() => onSelectProduct(product)}
            className={cn(
              "flex border-b border-border cursor-pointer hover:bg-accent/50 transition-colors",
              selectedProductId === product.id && "bg-primary text-primary-foreground hover:bg-primary/90",
              idx % 2 === 1 && selectedProductId !== product.id && "bg-muted/30"
            )}
          >
            {COLUMNS.map(col => (
              <div 
                key={col.key}
                className={cn(
                  "flex-shrink-0 px-2 py-1.5 text-xs border-r border-border truncate",
                  col.width,
                  'type' in col && col.type === 'number' && "text-right font-mono"
                )}
              >
                {formatValue(product, col.key)}
              </div>
            ))}
          </div>
        ))}
        
        {filteredProducts.length === 0 && (
          <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
            Nenhum produto encontrado
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-muted/50 border-t text-xs text-muted-foreground">
        <div className="flex items-center gap-4">
          <span>{filteredProducts.length} de {products.length} produtos</span>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-5 w-5">
            <span className="text-xs">|◀</span>
          </Button>
          <Button variant="ghost" size="icon" className="h-5 w-5">
            <span className="text-xs">◀</span>
          </Button>
          <Button variant="ghost" size="icon" className="h-5 w-5">
            <span className="text-xs">▶</span>
          </Button>
          <Button variant="ghost" size="icon" className="h-5 w-5">
            <span className="text-xs">▶|</span>
          </Button>
        </div>
      </div>
    </div>
  );
}