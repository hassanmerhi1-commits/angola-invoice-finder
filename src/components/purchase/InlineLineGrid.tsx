import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { PurchaseInvoiceLine, calculateLine } from '@/lib/purchaseInvoiceStorage';
import { Button } from '@/components/ui/button';
import { Trash2, Plus, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

interface InlineLineGridProps {
  lines: PurchaseInvoiceLine[];
  onLinesChange: (lines: PurchaseInvoiceLine[]) => void;
  onOpenProductPicker: () => void;
  onRemoveLine: (idx: number) => void;
  freightAllocations?: Record<string, number>;
  warehouseName?: string;
}

type EditableField = 'quantity' | 'packaging' | 'unitPrice' | 'discountPct' | 'discountPct2' | 'ivaRate';

const EDITABLE_FIELDS: EditableField[] = ['quantity', 'packaging', 'unitPrice', 'discountPct', 'discountPct2', 'ivaRate'];

const FIELD_LABELS: Record<EditableField, string> = {
  quantity: 'Qtd',
  packaging: 'Emb.',
  unitPrice: 'Preço',
  discountPct: 'Desc%',
  discountPct2: '%2',
  ivaRate: 'IVA%',
};

export function InlineLineGrid({
  lines,
  onLinesChange,
  onOpenProductPicker,
  onRemoveLine,
  freightAllocations = {},
  warehouseName = '',
}: InlineLineGridProps) {
  const [selectedRow, setSelectedRow] = useState<number>(-1);
  const [editCell, setEditCell] = useState<{ row: number; field: EditableField } | null>(null);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  // Focus input when edit cell changes
  useEffect(() => {
    if (editCell && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editCell]);

  const startEdit = useCallback((row: number, field: EditableField) => {
    const line = lines[row];
    if (!line) return;
    setSelectedRow(row);
    setEditCell({ row, field });
    setEditValue(String(line[field] ?? 0));
  }, [lines]);

  const commitEdit = useCallback(() => {
    if (!editCell) return;
    const { row, field } = editCell;
    const numVal = parseFloat(editValue) || 0;
    const updated = [...lines];
    const line = { ...updated[row], [field]: numVal };
    updated[row] = calculateLine(line);
    onLinesChange(updated);
    setEditCell(null);
  }, [editCell, editValue, lines, onLinesChange]);

  const cancelEdit = useCallback(() => {
    setEditCell(null);
  }, []);

  const moveToNextCell = useCallback((row: number, field: EditableField, direction: 'right' | 'down' | 'left' | 'up') => {
    commitEdit();

    const fieldIdx = EDITABLE_FIELDS.indexOf(field);

    if (direction === 'right' || direction === 'down') {
      // Try next field in same row
      if (direction === 'right' && fieldIdx < EDITABLE_FIELDS.length - 1) {
        setTimeout(() => startEdit(row, EDITABLE_FIELDS[fieldIdx + 1]), 0);
      }
      // Move to next row, first editable field
      else if (row < lines.length - 1) {
        setTimeout(() => startEdit(row + 1, direction === 'down' ? field : EDITABLE_FIELDS[0]), 0);
      }
    } else if (direction === 'left' || direction === 'up') {
      if (direction === 'left' && fieldIdx > 0) {
        setTimeout(() => startEdit(row, EDITABLE_FIELDS[fieldIdx - 1]), 0);
      } else if (row > 0) {
        setTimeout(() => startEdit(row - 1, direction === 'up' ? field : EDITABLE_FIELDS[EDITABLE_FIELDS.length - 1]), 0);
      }
    }
  }, [commitEdit, startEdit, lines.length]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!editCell) return;
    const { row, field } = editCell;

    switch (e.key) {
      case 'Tab':
        e.preventDefault();
        moveToNextCell(row, field, e.shiftKey ? 'left' : 'right');
        break;
      case 'Enter':
        e.preventDefault();
        moveToNextCell(row, field, 'down');
        break;
      case 'Escape':
        cancelEdit();
        break;
      case 'ArrowUp':
        e.preventDefault();
        moveToNextCell(row, field, 'up');
        break;
      case 'ArrowDown':
        e.preventDefault();
        moveToNextCell(row, field, 'down');
        break;
    }
  }, [editCell, moveToNextCell, cancelEdit]);

  // F2 shortcut to open product picker
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        onOpenProductPicker();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onOpenProductPicker]);

  const fmtNum = (n: number) => n.toLocaleString('pt-AO', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

  const renderCell = (row: number, field: EditableField, value: number, width: string) => {
    const isEditing = editCell?.row === row && editCell?.field === field;

    if (isEditing) {
      return (
        <td
          className={cn('px-1 py-0 border-r border-border', width)}
          onKeyDown={handleKeyDown}
        >
          <input
            ref={inputRef}
            type="number"
            step="any"
            value={editValue}
            onChange={e => setEditValue(e.target.value)}
            onBlur={commitEdit}
            className="w-full h-[26px] px-1 text-right text-xs font-mono bg-primary/10 border border-primary rounded-sm outline-none focus:ring-1 focus:ring-primary"
          />
        </td>
      );
    }

    return (
      <td
        className={cn(
          'px-1.5 py-0 text-right font-mono text-xs border-r border-border cursor-pointer',
          'hover:bg-accent/50 transition-colors duration-75',
          width,
          selectedRow === row && 'bg-primary/5'
        )}
        onClick={() => startEdit(row, field)}
        onDoubleClick={() => startEdit(row, field)}
      >
        {field === 'ivaRate' ? `${value}` : fmtNum(value)}
      </td>
    );
  };

  return (
    <div className="border border-border rounded-lg overflow-hidden bg-card" ref={gridRef}>
      {/* Toolbar */}
      <div className="flex items-center gap-1 px-2 py-1.5 bg-muted/50 border-b border-border">
        <Button variant="outline" size="sm" className="h-7 gap-1 text-xs" onClick={onOpenProductPicker}>
          <Plus className="h-3.5 w-3.5" /> Inserir Produto
        </Button>
        <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={onOpenProductPicker}>
          <Search className="h-3.5 w-3.5" /> Encontrar
        </Button>
        <span className="text-[10px] text-muted-foreground ml-auto">F2 para pesquisar</span>
        {lines.length > 0 && (
          <span className="text-[10px] font-mono text-muted-foreground">
            {lines.length} {lines.length === 1 ? 'linha' : 'linhas'}
          </span>
        )}
      </div>

      {/* Grid */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="bg-muted/80 text-muted-foreground font-semibold">
              <th className="w-7 px-1 py-1.5 text-center border-r border-border">#</th>
              <th className="w-24 px-1.5 py-1.5 text-left border-r border-border">Produto</th>
              <th className="min-w-[180px] px-1.5 py-1.5 text-left border-r border-border">Descrição</th>
              <th className="w-16 px-1 py-1.5 text-right border-r border-border">Qtd</th>
              <th className="w-12 px-1 py-1.5 text-right border-r border-border">Emb.</th>
              <th className="w-24 px-1 py-1.5 text-right border-r border-border">Preço</th>
              <th className="w-14 px-1 py-1.5 text-right border-r border-border">Desc%</th>
              <th className="w-12 px-1 py-1.5 text-right border-r border-border">%2</th>
              <th className="w-16 px-1 py-1.5 text-right border-r border-border">Total QTD</th>
              <th className="w-28 px-1 py-1.5 text-right border-r border-border">Total</th>
              <th className="w-12 px-1 py-1.5 text-right border-r border-border">IVA</th>
              <th className="w-24 px-1 py-1.5 text-right border-r border-border">Preço IVA</th>
              <th className="w-20 px-1.5 py-1.5 text-left border-r border-border">Armazém</th>
              <th className="w-16 px-1 py-1.5 text-right border-r border-border">Qtd Atual</th>
              <th className="w-14 px-1 py-1.5 text-center border-r border-border">Un.</th>
              <th className="w-24 px-1 py-1.5 text-left border-r border-border">Bar</th>
              <th className="w-7 px-0 py-1.5" />
            </tr>
          </thead>
          <tbody>
            {lines.map((line, idx) => {
              const isSelected = selectedRow === idx;
              const freightPerUnit = freightAllocations[line.productId] || 0;
              const priceIVA = line.totalWithIva / (line.totalQty || 1);

              return (
                <tr
                  key={line.id}
                  className={cn(
                    'h-[28px] border-b border-border transition-colors duration-75 cursor-default',
                    isSelected
                      ? 'bg-primary/10 text-primary-foreground dark:bg-primary/20'
                      : 'hover:bg-accent/30',
                    idx % 2 === 1 && !isSelected && 'bg-muted/20'
                  )}
                  onClick={() => setSelectedRow(idx)}
                >
                  {/* # */}
                  <td className="px-1 text-center text-muted-foreground border-r border-border font-mono">
                    {idx + 1}
                  </td>

                  {/* Produto */}
                  <td className="px-1.5 font-mono border-r border-border truncate">
                    {line.productCode}
                  </td>

                  {/* Descrição */}
                  <td className="px-1.5 border-r border-border truncate max-w-[180px]" title={line.description}>
                    {line.description}
                  </td>

                  {/* Editable: Qtd */}
                  {renderCell(idx, 'quantity', line.quantity, 'w-16')}

                  {/* Editable: Embalagem */}
                  {renderCell(idx, 'packaging', line.packaging, 'w-12')}

                  {/* Editable: Preço */}
                  {renderCell(idx, 'unitPrice', line.unitPrice, 'w-24')}

                  {/* Editable: Desc% */}
                  {renderCell(idx, 'discountPct', line.discountPct, 'w-14')}

                  {/* Editable: %2 */}
                  {renderCell(idx, 'discountPct2', line.discountPct2, 'w-12')}

                  {/* Total QTD (computed) */}
                  <td className="px-1.5 text-right font-mono border-r border-border">
                    {fmtNum(line.totalQty)}
                  </td>

                  {/* Total (computed) */}
                  <td className="px-1.5 text-right font-mono font-semibold border-r border-border">
                    {fmtNum(line.total)}
                  </td>

                  {/* Editable: IVA% */}
                  {renderCell(idx, 'ivaRate', line.ivaRate, 'w-12')}

                  {/* Preço IVA (computed) */}
                  <td className="px-1.5 text-right font-mono border-r border-border">
                    {fmtNum(priceIVA)}
                  </td>

                  {/* Armazém */}
                  <td className="px-1.5 border-r border-border text-[10px] truncate">
                    {line.warehouseName || warehouseName}
                  </td>

                  {/* Qtd Atual */}
                  <td className="px-1.5 text-right font-mono border-r border-border">
                    {line.currentStock ?? 0}
                  </td>

                  {/* Unidade */}
                  <td className="px-1 text-center border-r border-border">
                    {line.unit || 'UN'}
                  </td>

                  {/* Barcode */}
                  <td className="px-1.5 border-r border-border font-mono text-[10px] truncate">
                    {line.barcode || '—'}
                  </td>

                  {/* Delete */}
                  <td className="px-0 text-center">
                    <button
                      className="p-0.5 rounded hover:bg-destructive/10 transition-colors"
                      onClick={e => { e.stopPropagation(); onRemoveLine(idx); }}
                    >
                      <Trash2 className="h-3 w-3 text-destructive/70 hover:text-destructive" />
                    </button>
                  </td>
                </tr>
              );
            })}
            {lines.length === 0 && (
              <tr>
                <td colSpan={17} className="text-center py-10 text-muted-foreground">
                  <div className="flex flex-col items-center gap-2">
                    <span className="text-sm">Clique em "Inserir Produto" ou pressione <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono border">F2</kbd></span>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Bottom info bar */}
      {lines.length > 0 && (
        <div className="flex items-center justify-between px-3 py-1.5 bg-muted/30 border-t border-border text-[11px] font-mono text-muted-foreground">
          <span>{lines.length} produto{lines.length !== 1 ? 's' : ''}</span>
          <div className="flex gap-4">
            <span>Total Qtd: <strong className="text-foreground">{lines.reduce((s, l) => s + l.totalQty, 0).toLocaleString('pt-AO')}</strong></span>
            <span>Base: <strong className="text-foreground">{lines.reduce((s, l) => s + l.total, 0).toLocaleString('pt-AO')}</strong></span>
            <span>c/IVA: <strong className="text-foreground">{lines.reduce((s, l) => s + l.totalWithIva, 0).toLocaleString('pt-AO')}</strong></span>
          </div>
        </div>
      )}
    </div>
  );
}
