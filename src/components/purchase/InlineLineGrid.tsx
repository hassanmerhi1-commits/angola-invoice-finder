import { useState, useRef, useCallback, useEffect } from 'react';
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
      if (direction === 'right' && fieldIdx < EDITABLE_FIELDS.length - 1) {
        setTimeout(() => startEdit(row, EDITABLE_FIELDS[fieldIdx + 1]), 0);
      } else if (row < lines.length - 1) {
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
      case 'Tab': e.preventDefault(); moveToNextCell(row, field, e.shiftKey ? 'left' : 'right'); break;
      case 'Enter': e.preventDefault(); moveToNextCell(row, field, 'down'); break;
      case 'Escape': cancelEdit(); break;
      case 'ArrowUp': e.preventDefault(); moveToNextCell(row, field, 'up'); break;
      case 'ArrowDown': e.preventDefault(); moveToNextCell(row, field, 'down'); break;
    }
  }, [editCell, moveToNextCell, cancelEdit]);

  // F2 = product picker
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'F2') { e.preventDefault(); onOpenProductPicker(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onOpenProductPicker]);

  const fmt = (n: number) => n.toLocaleString('pt-AO', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

  const renderCell = (row: number, field: EditableField, value: number) => {
    const isEditing = editCell?.row === row && editCell?.field === field;

    if (isEditing) {
      return (
        <td className="px-0.5 py-0 border-r border-border/50" onKeyDown={handleKeyDown}>
          <input
            ref={inputRef}
            type="number"
            step="any"
            value={editValue}
            onChange={e => setEditValue(e.target.value)}
            onBlur={commitEdit}
            className="w-full h-[22px] px-1 text-right text-[11px] font-mono bg-primary/10 border border-primary rounded-sm outline-none"
          />
        </td>
      );
    }

    return (
      <td
        className={cn(
          'px-1 py-0 text-right font-mono text-[11px] border-r border-border/50 cursor-pointer',
          'hover:bg-accent/40 transition-colors duration-50',
          selectedRow === row && 'bg-primary/5'
        )}
        onClick={() => startEdit(row, field)}
      >
        {field === 'ivaRate' ? `${value}` : fmt(value)}
      </td>
    );
  };

  return (
    <div className="border border-border rounded-md overflow-hidden bg-card flex flex-col shadow-sm">
      {/* Toolbar */}
      <div className="flex items-center gap-1.5 px-2 py-1 bg-muted/50 border-b border-border/50 shrink-0">
        <Button variant="outline" size="sm" className="h-6 gap-1 text-[10px] px-2.5 hover:bg-primary/10 transition-colors duration-150" onClick={onOpenProductPicker}>
          <Plus className="h-3 w-3" /> Inserir
        </Button>
        <Button variant="ghost" size="sm" className="h-6 gap-1 text-[10px] px-2.5 hover:bg-accent/60 transition-colors duration-150" onClick={onOpenProductPicker}>
          <Search className="h-3 w-3" /> Encontrar
        </Button>
        <span className="text-[8px] text-muted-foreground ml-auto font-mono">F2 pesquisar | Tab navegar | Enter próxima linha</span>
      </div>

      {/* Grid */}
      <div className="overflow-auto flex-1">
        <table className="w-full border-collapse text-[10px]">
          <thead className="sticky top-0 z-10">
            <tr className="bg-muted/80 text-muted-foreground font-semibold text-[9px]">
              <th className="w-5 px-0.5 py-0.5 text-center border-r border-border/50">#</th>
              <th className="w-16 px-1 py-0.5 text-left border-r border-border/50">Código</th>
              <th className="min-w-[120px] px-1 py-0.5 text-left border-r border-border/50">Descrição</th>
              <th className="w-12 px-0.5 py-0.5 text-right border-r border-border/50">Qtd</th>
              <th className="w-8 px-0.5 py-0.5 text-right border-r border-border/50">Emb</th>
              <th className="w-16 px-0.5 py-0.5 text-right border-r border-border/50">Preço</th>
              <th className="w-10 px-0.5 py-0.5 text-right border-r border-border/50">D%</th>
              <th className="w-8 px-0.5 py-0.5 text-right border-r border-border/50">D2%</th>
              <th className="w-12 px-0.5 py-0.5 text-right border-r border-border/50">TotQtd</th>
              <th className="w-20 px-0.5 py-0.5 text-right border-r border-border/50">Total</th>
              <th className="w-8 px-0.5 py-0.5 text-right border-r border-border/50">IVA</th>
              <th className="w-18 px-0.5 py-0.5 text-right border-r border-border/50">Preço IVA</th>
              {/* Price levels */}
              <th className="w-16 px-0.5 py-0.5 text-right border-r border-border/50">Preço 1</th>
              <th className="w-16 px-0.5 py-0.5 text-right border-r border-border/50">Preço 2</th>
              <th className="w-16 px-0.5 py-0.5 text-right border-r border-border/50">Preço 3</th>
              <th className="w-16 px-0.5 py-0.5 text-right border-r border-border/50">Preço 4</th>
              {/* Costs */}
              <th className="w-16 px-0.5 py-0.5 text-right border-r border-border/50">Últ.Custo</th>
              <th className="w-16 px-0.5 py-0.5 text-right border-r border-border/50">C.Médio</th>
              {/* Info */}
              <th className="w-12 px-0.5 py-0.5 text-left border-r border-border/50">Armaz</th>
              <th className="w-10 px-0.5 py-0.5 text-right border-r border-border/50">Stock</th>
              <th className="w-8 px-0.5 py-0.5 text-center border-r border-border/50">Un</th>
              <th className="w-16 px-0.5 py-0.5 text-left border-r border-border/50">Barcode</th>
              <th className="w-5 px-0 py-0.5" />
            </tr>
          </thead>
          <tbody>
            {lines.map((line, idx) => {
              const isSelected = selectedRow === idx;
              const priceIVA = line.totalWithIva / (line.totalQty || 1);

              return (
                <tr
                  key={line.id}
                  className={cn(
                    'h-[22px] border-b border-border/30 transition-colors duration-50 cursor-default',
                    isSelected ? 'bg-primary/10' : 'hover:bg-accent/20',
                    idx % 2 === 1 && !isSelected && 'bg-muted/10'
                  )}
                  onClick={() => setSelectedRow(idx)}
                >
                  <td className="px-0.5 text-center text-muted-foreground border-r border-border/50 font-mono text-[9px]">{idx + 1}</td>
                  <td className="px-1 font-mono border-r border-border/50 truncate text-[9px]">{line.productCode}</td>
                  <td className="px-1 border-r border-border/50 truncate max-w-[120px] text-[10px]" title={line.description}>{line.description}</td>
                  {renderCell(idx, 'quantity', line.quantity)}
                  {renderCell(idx, 'packaging', line.packaging)}
                  {renderCell(idx, 'unitPrice', line.unitPrice)}
                  {renderCell(idx, 'discountPct', line.discountPct)}
                  {renderCell(idx, 'discountPct2', line.discountPct2)}
                  <td className="px-1 text-right font-mono border-r border-border/50">{fmt(line.totalQty)}</td>
                  <td className="px-1 text-right font-mono font-semibold border-r border-border/50">{fmt(line.total)}</td>
                  {renderCell(idx, 'ivaRate', line.ivaRate)}
                  <td className="px-1 text-right font-mono border-r border-border/50">{fmt(priceIVA)}</td>
                  {/* Price levels — read-only */}
                  <td className="px-1 text-right font-mono border-r border-border/50 text-muted-foreground">{fmt(line.price1 || 0)}</td>
                  <td className="px-1 text-right font-mono border-r border-border/50 text-muted-foreground">{fmt(line.price2 || 0)}</td>
                  <td className="px-1 text-right font-mono border-r border-border/50 text-muted-foreground">{fmt(line.price3 || 0)}</td>
                  <td className="px-1 text-right font-mono border-r border-border/50 text-muted-foreground">{fmt(line.price4 || 0)}</td>
                  {/* Costs — read-only */}
                  <td className="px-1 text-right font-mono border-r border-border/50 text-amber-500/80">{fmt(line.lastCost || 0)}</td>
                  <td className="px-1 text-right font-mono border-r border-border/50 text-amber-500/80">{fmt(line.avgCost || 0)}</td>
                  {/* Info */}
                  <td className="px-0.5 border-r border-border/50 text-[8px] truncate">{line.warehouseName || warehouseName}</td>
                  <td className="px-1 text-right font-mono border-r border-border/50">{line.currentStock ?? 0}</td>
                  <td className="px-0.5 text-center border-r border-border/50 text-[9px]">{line.unit || 'UN'}</td>
                  <td className="px-0.5 border-r border-border/50 font-mono text-[8px] truncate">{line.barcode || '—'}</td>
                  <td className="px-0 text-center">
                    <button
                      className="p-0.5 rounded hover:bg-destructive/10"
                      onClick={e => { e.stopPropagation(); onRemoveLine(idx); }}
                    >
                      <Trash2 className="h-2.5 w-2.5 text-destructive/70 hover:text-destructive" />
                    </button>
                  </td>
                </tr>
              );
            })}
            {lines.length === 0 && (
              <tr>
                <td colSpan={23} className="text-center py-6 text-muted-foreground text-xs">
                  Clique em "Inserir" ou pressione <kbd className="px-1 py-0.5 bg-muted rounded text-[10px] font-mono border">F2</kbd> para adicionar produtos
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Bottom info */}
      {lines.length > 0 && (
        <div className="flex items-center justify-between px-2 py-1 bg-muted/40 border-t border-border/50 text-[10px] font-mono text-muted-foreground shrink-0">
          <span className="bg-accent/40 px-1.5 py-0.5 rounded text-[9px]">{lines.length} produto{lines.length !== 1 ? 's' : ''}</span>
          <div className="flex gap-4">
            <span>Qtd: <strong className="text-foreground">{lines.reduce((s, l) => s + l.totalQty, 0)}</strong></span>
            <span>Base: <strong className="text-foreground">{fmt(lines.reduce((s, l) => s + l.total, 0))}</strong></span>
            <span>c/IVA: <strong className="text-foreground">{fmt(lines.reduce((s, l) => s + l.totalWithIva, 0))}</strong></span>
          </div>
        </div>
      )}
    </div>
  );
}
