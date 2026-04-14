import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useSuppliers } from '@/hooks/useERP';
import { Download, Printer, Truck, Search, Loader2 } from 'lucide-react';
import { format, parseISO, subMonths } from 'date-fns';
import { pt } from 'date-fns/locale';
import { exportToExcel } from '@/lib/excel';
import { api } from '@/lib/api/client';
import { getPurchaseInvoices, PurchaseInvoice } from '@/lib/purchaseInvoiceStorage';

interface StatementEntry {
  id: string;
  date: string;
  type: 'purchase' | 'payment' | 'credit_note' | 'debit_note' | 'advance';
  reference: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
}

export default function SupplierStatementReport() {
  const { suppliers } = useSuppliers();
  
  const [selectedSupplier, setSelectedSupplier] = useState<string>('');
  const [dateFrom, setDateFrom] = useState(format(subMonths(new Date(), 6), 'yyyy-MM-dd'));
  const [dateTo, setDateTo] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [statementEntries, setStatementEntries] = useState<StatementEntry[]>([]);
  const [currentBalance, setCurrentBalance] = useState(0);

  const selectedSupplierData = useMemo(() => {
    return suppliers.find(s => s.id === selectedSupplier);
  }, [suppliers, selectedSupplier]);

  // Fetch statement from backend + localStorage fallback
  useEffect(() => {
    if (!selectedSupplier) {
      setStatementEntries([]);
      setCurrentBalance(0);
      return;
    }

    const fetchStatement = async () => {
      setLoading(true);
      try {
        // 1) Try API (open_items + payments from DB)
        let apiEntries: Omit<StatementEntry, 'balance'>[] = [];
        let apiBalance = 0;

        try {
          const res = await api.payments.statement('supplier', selectedSupplier, dateFrom, dateTo);
          if (!res.error) {
            const data = res.data as any;
            const { openItems = [], payments = [], balance = { balance: 0 } } = data;
            apiBalance = parseFloat(balance.balance) || 0;

            for (const oi of openItems) {
              const docType = oi.document_type as string;
              let type: StatementEntry['type'] = 'purchase';
              let description = '';

              if (docType === 'invoice' || docType === 'purchase_invoice') {
                type = 'purchase';
                description = 'Fatura de Compra';
              } else if (docType === 'credit_note') {
                type = 'credit_note';
                description = 'Nota de Crédito';
              } else if (docType === 'debit_note') {
                type = 'debit_note';
                description = 'Nota de Débito';
              } else if (docType === 'advance') {
                type = 'advance';
                description = 'Adiantamento';
              } else {
                description = docType;
              }

              apiEntries.push({
                id: oi.id,
                date: oi.document_date,
                type,
                reference: oi.document_number,
                description,
                debit: !oi.is_debit ? oi.original_amount : 0,
                credit: oi.is_debit ? oi.original_amount : 0,
              });
            }

            for (const p of payments) {
              apiEntries.push({
                id: p.id,
                date: p.created_at,
                type: 'payment',
                reference: p.payment_number,
                description: `Pagamento - ${p.payment_method === 'cash' ? 'Numerário' : p.payment_method === 'transfer' ? 'Transferência' : p.payment_method === 'cheque' ? 'Cheque' : p.payment_method}`,
                debit: p.amount,
                credit: 0,
              });
            }
          }
        } catch (err) {
          console.warn('[SupplierStatement] API fetch failed, using localStorage:', err);
        }

        // 2) Also pull from localStorage purchase invoices (web fallback)
        const localInvoices = await getPurchaseInvoices();
        const supplierData = suppliers.find(s => s.id === selectedSupplier);
        const existingIds = new Set(apiEntries.map(e => e.id));

        for (const inv of localInvoices) {
          if (existingIds.has(inv.id)) continue; // skip duplicates
          // Match supplier by ID, NIF, or name
          const matches = supplierData && (
            inv.supplierAccountCode === supplierData.id ||
            inv.supplierNif === supplierData.nif ||
            inv.supplierName.trim().toLowerCase() === supplierData.name.trim().toLowerCase()
          );
          if (!matches) continue;
          // Date filter
          const invDate = inv.date || inv.createdAt;
          if (invDate < dateFrom || invDate > dateTo + 'T23:59:59') continue;

          apiEntries.push({
            id: inv.id,
            date: invDate,
            type: 'purchase',
            reference: inv.invoiceNumber,
            description: `Fatura de Compra ${inv.invoiceNumber}`,
            debit: 0,
            credit: inv.total,
          });
        }

        // Sort by date
        apiEntries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        // Calculate running balance
        let runningBalance = 0;
        const finalEntries: StatementEntry[] = apiEntries.map(e => {
          runningBalance += e.credit - e.debit;
          return { ...e, balance: runningBalance };
        });

        setStatementEntries(finalEntries);
        setCurrentBalance(apiBalance || runningBalance);
      } catch (err) {
        console.error('[SupplierStatement] Fetch error:', err);
        setStatementEntries([]);
      } finally {
        setLoading(false);
      }
    };

    fetchStatement();
  }, [selectedSupplier, dateFrom, dateTo, suppliers]);

  const totals = useMemo(() => {
    return statementEntries.reduce((acc, entry) => ({
      debit: acc.debit + entry.debit,
      credit: acc.credit + entry.credit,
    }), { debit: 0, credit: 0 });
  }, [statementEntries]);

  const filteredSuppliers = useMemo(() => {
    if (!searchTerm) return suppliers;
    const term = searchTerm.toLowerCase();
    return suppliers.filter(s => 
      s.name.toLowerCase().includes(term) || 
      s.nif.toLowerCase().includes(term)
    );
  }, [suppliers, searchTerm]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-AO', { 
      style: 'currency', 
      currency: 'AOA',
      minimumFractionDigits: 2 
    }).format(value);
  };

  const getTypeBadge = (type: StatementEntry['type']) => {
    switch (type) {
      case 'purchase': return <Badge>Compra</Badge>;
      case 'payment': return <Badge variant="secondary">Pagamento</Badge>;
      case 'credit_note': return <Badge variant="outline" className="text-green-600 border-green-600">NC</Badge>;
      case 'debit_note': return <Badge variant="outline" className="text-red-600 border-red-600">ND</Badge>;
      case 'advance': return <Badge variant="outline">Adiantamento</Badge>;
      default: return <Badge variant="outline">{type}</Badge>;
    }
  };

  const handleExport = () => {
    if (!selectedSupplierData) return;
    
    const data = statementEntries.map(entry => ({
      'Data': format(parseISO(entry.date), 'dd/MM/yyyy'),
      'Tipo': entry.type === 'purchase' ? 'Compra' : 
              entry.type === 'payment' ? 'Pagamento' :
              entry.type === 'credit_note' ? 'Nota Crédito' : 
              entry.type === 'debit_note' ? 'Nota Débito' : 'Adiantamento',
      'Referência': entry.reference,
      'Descrição': entry.description,
      'Débito': entry.debit,
      'Crédito': entry.credit,
      'Saldo': entry.balance,
    }));
    
    exportToExcel(data, `ContaCorrente_${selectedSupplierData.name}_${format(new Date(), 'yyyyMMdd')}`);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Truck className="w-5 h-5" />
            Conta Corrente - Fornecedor
          </CardTitle>
          <CardDescription>
            Todos os movimentos: compras, pagamentos, notas de crédito/débito e devoluções
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2">
              <Label>Fornecedor</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Pesquisar fornecedor..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 mb-2"
                />
              </div>
              <Select value={selectedSupplier} onValueChange={setSelectedSupplier}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um fornecedor" />
                </SelectTrigger>
                <SelectContent>
                  {filteredSuppliers.map(supplier => (
                    <SelectItem key={supplier.id} value={supplier.id}>
                      {supplier.name} ({supplier.nif})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Data Início</Label>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </div>
            <div>
              <Label>Data Fim</Label>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
          </div>
          
          {selectedSupplierData && (
            <div className="mt-4 p-4 bg-muted/50 rounded-lg">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Fornecedor</p>
                  <p className="font-semibold">{selectedSupplierData.name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">NIF</p>
                  <p className="font-semibold">{selectedSupplierData.nif}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Contacto</p>
                  <p className="font-semibold">{selectedSupplierData.contactPerson || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Prazo Pagamento</p>
                  <p className="font-semibold">{selectedSupplierData.paymentTerms.replace('_', ' ')}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Saldo Actual</p>
                  <p className={`font-semibold ${currentBalance > 0 ? 'text-orange-500' : 'text-green-500'}`}>
                    {formatCurrency(currentBalance)}
                  </p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedSupplier && (
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>Movimentos</CardTitle>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleExport}>
                  <Download className="w-4 h-4 mr-2" />
                  Excel
                </Button>
                <Button variant="outline" size="sm" onClick={() => window.print()}>
                  <Printer className="w-4 h-4 mr-2" />
                  Imprimir
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Referência</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead className="text-right">Débito (Pagto)</TableHead>
                    <TableHead className="text-right">Crédito (Compra)</TableHead>
                    <TableHead className="text-right">Saldo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {statementEntries.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        Nenhum movimento encontrado para o período seleccionado
                      </TableCell>
                    </TableRow>
                  ) : (
                    <>
                      {statementEntries.map((entry) => (
                        <TableRow key={entry.id}>
                          <TableCell>
                            {format(parseISO(entry.date.split('T')[0]), 'dd/MM/yyyy', { locale: pt })}
                          </TableCell>
                          <TableCell>{getTypeBadge(entry.type)}</TableCell>
                          <TableCell className="font-mono text-sm">{entry.reference}</TableCell>
                          <TableCell>{entry.description}</TableCell>
                          <TableCell className="text-right text-green-500">
                            {entry.debit > 0 ? formatCurrency(entry.debit) : '-'}
                          </TableCell>
                          <TableCell className="text-right text-orange-500">
                            {entry.credit > 0 ? formatCurrency(entry.credit) : '-'}
                          </TableCell>
                          <TableCell className={`text-right font-medium ${entry.balance > 0 ? 'text-orange-500' : 'text-green-500'}`}>
                            {formatCurrency(entry.balance)}
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="bg-muted/50 font-bold">
                        <TableCell colSpan={4}>TOTAIS</TableCell>
                        <TableCell className="text-right text-green-500">
                          {formatCurrency(totals.debit)}
                        </TableCell>
                        <TableCell className="text-right text-orange-500">
                          {formatCurrency(totals.credit)}
                        </TableCell>
                        <TableCell className={`text-right ${totals.credit - totals.debit > 0 ? 'text-orange-500' : 'text-green-500'}`}>
                          {formatCurrency(totals.credit - totals.debit)}
                        </TableCell>
                      </TableRow>
                    </>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
