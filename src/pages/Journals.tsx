import { useState, useMemo } from 'react';
import { useTranslation } from '@/i18n';
import { useBranchContext } from '@/contexts/BranchContext';
import { useAuth } from '@/hooks/useERP';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import {
  Plus, Search, Edit2, Trash2, RefreshCw, FileText,
  Calendar, Eye, Printer, Download, CheckCircle, XCircle,
  Filter, ChevronLeft, ChevronRight
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

// Mock journal entries for now - will come from DB
interface JournalLine {
  id: string;
  accountCode: string;
  accountName: string;
  description: string;
  debit: number;
  credit: number;
}

interface JournalEntry {
  id: string;
  entryNumber: string;
  date: string;
  type: 'venda' | 'compra' | 'recibo' | 'pagamento' | 'ajuste' | 'abertura' | 'fecho';
  currency: string;
  description: string;
  totalDebit: number;
  totalCredit: number;
  isPosted: boolean;
  createdBy: string;
  lines: JournalLine[];
}

const ENTRY_TYPES = [
  { value: 'venda', label: 'Venda', color: 'text-blue-600' },
  { value: 'compra', label: 'Compra', color: 'text-orange-600' },
  { value: 'recibo', label: 'Recibo', color: 'text-green-600' },
  { value: 'pagamento', label: 'Pagamento', color: 'text-red-600' },
  { value: 'ajuste', label: 'Ajuste', color: 'text-purple-600' },
  { value: 'abertura', label: 'Abertura', color: 'text-muted-foreground' },
  { value: 'fecho', label: 'Fecho', color: 'text-muted-foreground' },
];

// Generate sample journal entries from localStorage sales data
function useJournalEntries() {
  const [entries, setEntries] = useState<JournalEntry[]>(() => {
    try {
      const salesData = localStorage.getItem('kwanzaerp_sales');
      const sales = salesData ? JSON.parse(salesData) : [];
      return sales.slice(0, 50).map((sale: any, idx: number) => ({
        id: sale.id || `je_${idx}`,
        entryNumber: `DI-${String(idx + 1).padStart(4, '0')}`,
        date: sale.createdAt || new Date().toISOString(),
        type: 'venda' as const,
        currency: 'AOA',
        description: `Venda ${sale.invoiceNumber || ''}`.trim(),
        totalDebit: sale.total || 0,
        totalCredit: sale.total || 0,
        isPosted: true,
        createdBy: sale.cashierName || 'Sistema',
        lines: [
          { id: `${sale.id}_1`, accountCode: '1.1.1', accountName: 'Caixa', description: 'Recebimento', debit: sale.total || 0, credit: 0 },
          { id: `${sale.id}_2`, accountCode: '7.1.1', accountName: 'Vendas de Mercadorias', description: sale.invoiceNumber || '', debit: 0, credit: (sale.subtotal || sale.total || 0) },
          ...(sale.taxAmount ? [{ id: `${sale.id}_3`, accountCode: '2.4.3', accountName: 'IVA a Pagar', description: 'IVA', debit: 0, credit: sale.taxAmount }] : []),
        ],
      }));
    } catch {
      return [];
    }
  });

  return { entries, refetch: () => {} };
}

export default function Journals() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { currentBranch } = useBranchContext();
  const { entries, refetch } = useJournalEntries();

  const [activeTab, setActiveTab] = useState('diarios');
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [viewEntryOpen, setViewEntryOpen] = useState(false);

  // Filter entries
  const filteredEntries = useMemo(() => {
    return entries.filter(e => {
      const matchesSearch = !searchTerm ||
        e.entryNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        e.description.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = filterType === 'all' || e.type === filterType;
      const matchesDateFrom = !dateFrom || e.date >= dateFrom;
      const matchesDateTo = !dateTo || e.date <= dateTo + 'T23:59:59';
      return matchesSearch && matchesType && matchesDateFrom && matchesDateTo;
    });
  }, [entries, searchTerm, filterType, dateFrom, dateTo]);

  // Totals
  const totals = useMemo(() => {
    return filteredEntries.reduce((acc, e) => ({
      debit: acc.debit + e.totalDebit,
      credit: acc.credit + e.totalCredit,
    }), { debit: 0, credit: 0 });
  }, [filteredEntries]);

  const selectedEntry = entries.find(e => e.id === selectedEntryId);

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Toolbar */}
      <div className="flex items-center gap-1 px-2 py-1 bg-muted/50 border-b flex-wrap">
        <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
          <Plus className="w-3 h-3" /> Novo Lançamento
        </Button>
        <Button variant="outline" size="sm" className="h-7 text-xs gap-1" disabled={!selectedEntry}
          onClick={() => { setViewEntryOpen(true); }}>
          <Eye className="w-3 h-3" /> Ver
        </Button>
        <div className="w-px h-5 bg-border mx-1" />
        {/* Date filters */}
        <span className="text-xs text-muted-foreground">De:</span>
        <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="h-7 text-xs w-32" />
        <span className="text-xs text-muted-foreground">Até:</span>
        <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="h-7 text-xs w-32" />
        <div className="w-px h-5 bg-border mx-1" />
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="h-7 text-xs w-28"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {ENTRY_TYPES.map(t => (
              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="icon" className="h-7 w-7" onClick={refetch}><RefreshCw className="w-3 h-3" /></Button>
        <div className="flex-1" />
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
          <Input placeholder="Pesquisar..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="h-7 text-xs pl-7 w-40" />
        </div>
      </div>

      {/* Sub-tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <TabsList className="w-full justify-start rounded-none border-b bg-muted/30 h-auto p-0">
          {['Diários', 'Balancete', 'Auditoria', 'Cashiers'].map((label, i) => {
            const key = ['diarios', 'balancete', 'auditoria', 'cashiers'][i];
            return (
              <TabsTrigger key={key} value={key}
                className="text-xs rounded-none border-b-2 border-transparent data-[state=active]:border-primary px-4 py-1.5">
                {label}
              </TabsTrigger>
            );
          })}
        </TabsList>

        <TabsContent value="diarios" className="flex-1 m-0 overflow-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted/60 border-b sticky top-0 z-10">
              <tr>
                <th className="px-3 py-2 text-left font-semibold w-24">Data</th>
                <th className="px-3 py-2 text-left font-semibold w-16">Tipo</th>
                <th className="px-3 py-2 text-center font-semibold w-12">Moeda</th>
                <th className="px-3 py-2 text-left font-semibold w-24">Nº Lançamento</th>
                <th className="px-3 py-2 text-left font-semibold">Descrição</th>
                <th className="px-3 py-2 text-right font-semibold w-28">Débito</th>
                <th className="px-3 py-2 text-right font-semibold w-28">Crédito</th>
                <th className="px-3 py-2 text-left font-semibold w-20">Utilizador</th>
                <th className="px-3 py-2 text-center font-semibold w-12">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {filteredEntries.map(entry => {
                const typeConfig = ENTRY_TYPES.find(t => t.value === entry.type);
                return (
                  <tr key={entry.id}
                    className={cn("cursor-pointer hover:bg-accent/50 transition-colors",
                      selectedEntryId === entry.id && "bg-primary/15")}
                    onClick={() => setSelectedEntryId(entry.id)}
                    onDoubleClick={() => { setSelectedEntryId(entry.id); setViewEntryOpen(true); }}>
                    <td className="px-3 py-1.5 text-muted-foreground">
                      {new Date(entry.date).toLocaleDateString('pt-AO')}
                    </td>
                    <td className={cn("px-3 py-1.5 font-medium", typeConfig?.color)}>
                      {typeConfig?.label || entry.type}
                    </td>
                    <td className="px-3 py-1.5 text-center text-muted-foreground">{entry.currency}</td>
                    <td className="px-3 py-1.5 font-mono">{entry.entryNumber}</td>
                    <td className="px-3 py-1.5">{entry.description}</td>
                    <td className="px-3 py-1.5 text-right font-mono">{entry.totalDebit.toLocaleString('pt-AO')}</td>
                    <td className="px-3 py-1.5 text-right font-mono">{entry.totalCredit.toLocaleString('pt-AO')}</td>
                    <td className="px-3 py-1.5 text-muted-foreground">{entry.createdBy}</td>
                    <td className="px-3 py-1.5 text-center">
                      {entry.isPosted ? (
                        <CheckCircle className="w-3.5 h-3.5 text-green-500 inline" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5 text-muted-foreground inline" />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-muted/80 border-t-2 border-primary/30">
              <tr className="font-bold text-xs">
                <td className="px-3 py-2" colSpan={5}>TOTAL ({filteredEntries.length} lançamentos)</td>
                <td className="px-3 py-2 text-right font-mono text-green-600">{totals.debit.toLocaleString('pt-AO')} Kz</td>
                <td className="px-3 py-2 text-right font-mono text-red-600">{totals.credit.toLocaleString('pt-AO')} Kz</td>
                <td colSpan={2}></td>
              </tr>
            </tfoot>
          </table>
          {filteredEntries.length === 0 && (
            <div className="text-center py-12 text-muted-foreground text-sm">Nenhum lançamento encontrado</div>
          )}
        </TabsContent>

        <TabsContent value="balancete" className="flex-1 m-0 p-4">
          <Card><CardContent className="pt-6 text-center text-muted-foreground">
            <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>Balancete será gerado a partir dos lançamentos</p>
            <p className="text-xs mt-1">Seleccione um período e clique em Gerar</p>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="auditoria" className="flex-1 m-0 p-4">
          <Card><CardContent className="pt-6 text-center text-muted-foreground">
            <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>Auditoria - Registo de todas as alterações</p>
            <p className="text-xs mt-1">Histórico completo de quem fez o quê e quando</p>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="cashiers" className="flex-1 m-0 p-4">
          <Card><CardContent className="pt-6 text-center text-muted-foreground">
            <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>Cashiers - Resumo por operador</p>
            <p className="text-xs mt-1">Vendas e recebimentos por caixa</p>
          </CardContent></Card>
        </TabsContent>
      </Tabs>

      {/* View Entry Dialog */}
      <Dialog open={viewEntryOpen} onOpenChange={setViewEntryOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Lançamento {selectedEntry?.entryNumber}</DialogTitle>
          </DialogHeader>
          {selectedEntry && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div><span className="text-muted-foreground">Data:</span> {new Date(selectedEntry.date).toLocaleDateString('pt-AO')}</div>
                <div><span className="text-muted-foreground">Tipo:</span> {ENTRY_TYPES.find(t => t.value === selectedEntry.type)?.label}</div>
                <div><span className="text-muted-foreground">Utilizador:</span> {selectedEntry.createdBy}</div>
              </div>
              <div className="text-sm"><span className="text-muted-foreground">Descrição:</span> {selectedEntry.description}</div>
              <table className="w-full text-xs border">
                <thead className="bg-muted/60">
                  <tr>
                    <th className="px-3 py-2 text-left">Conta</th>
                    <th className="px-3 py-2 text-left">Nome</th>
                    <th className="px-3 py-2 text-left">Descrição</th>
                    <th className="px-3 py-2 text-right">Débito</th>
                    <th className="px-3 py-2 text-right">Crédito</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {selectedEntry.lines.map(line => (
                    <tr key={line.id}>
                      <td className="px-3 py-1.5 font-mono">{line.accountCode}</td>
                      <td className="px-3 py-1.5">{line.accountName}</td>
                      <td className="px-3 py-1.5 text-muted-foreground">{line.description}</td>
                      <td className="px-3 py-1.5 text-right font-mono">{line.debit ? line.debit.toLocaleString('pt-AO') : ''}</td>
                      <td className="px-3 py-1.5 text-right font-mono">{line.credit ? line.credit.toLocaleString('pt-AO') : ''}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-muted/60 font-bold">
                  <tr>
                    <td className="px-3 py-2" colSpan={3}>TOTAL</td>
                    <td className="px-3 py-2 text-right font-mono">{selectedEntry.totalDebit.toLocaleString('pt-AO')}</td>
                    <td className="px-3 py-2 text-right font-mono">{selectedEntry.totalCredit.toLocaleString('pt-AO')}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
