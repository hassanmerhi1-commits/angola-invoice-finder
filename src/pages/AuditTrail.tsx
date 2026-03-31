import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Shield, Search, Eye, FileText, User, Clock, Database,
  AlertTriangle, CheckCircle, XCircle, Printer, Download, LogIn, LogOut, Edit
} from 'lucide-react';

const ACTION_CONFIG: Record<string, { icon: any; label: string; color: string }> = {
  create: { icon: FileText, label: 'Criação', color: 'text-green-600' },
  update: { icon: Edit, label: 'Alteração', color: 'text-blue-600' },
  delete: { icon: XCircle, label: 'Eliminação', color: 'text-destructive' },
  status_change: { icon: AlertTriangle, label: 'Mudança Estado', color: 'text-orange-500' },
  approve: { icon: CheckCircle, label: 'Aprovação', color: 'text-green-600' },
  reject: { icon: XCircle, label: 'Rejeição', color: 'text-destructive' },
  void: { icon: XCircle, label: 'Anulação', color: 'text-destructive' },
  print: { icon: Printer, label: 'Impressão', color: 'text-muted-foreground' },
  export: { icon: Download, label: 'Exportação', color: 'text-muted-foreground' },
  login: { icon: LogIn, label: 'Login', color: 'text-green-600' },
  logout: { icon: LogOut, label: 'Logout', color: 'text-muted-foreground' },
};

// Demo data
const DEMO_AUDIT_LOG = [
  { id: '1', table_name: 'sales', action: 'create', user_name: 'Admin', description: 'Venda FT SEDE/20260331/0001 criada - 45.000 Kz', created_at: new Date().toISOString() },
  { id: '2', table_name: 'products', action: 'update', user_name: 'Admin', description: 'Produto "Arroz 25kg" - preço alterado de 3.500 para 3.800 Kz', created_at: new Date(Date.now() - 3600000).toISOString() },
  { id: '3', table_name: 'purchase_orders', action: 'approve', user_name: 'Director', description: 'OC-20260331-0003 aprovada - 1.200.000 Kz', created_at: new Date(Date.now() - 7200000).toISOString() },
  { id: '4', table_name: 'sales', action: 'void', user_name: 'Admin', description: 'Factura FT SEDE/20260330/0012 anulada - motivo: erro de cliente', created_at: new Date(Date.now() - 14400000).toISOString() },
  { id: '5', table_name: 'users', action: 'login', user_name: 'Operador1', description: 'Login no terminal POS - Filial Sede', created_at: new Date(Date.now() - 21600000).toISOString() },
  { id: '6', table_name: 'stock_movements', action: 'create', user_name: 'Admin', description: 'Ajuste de stock: Óleo Fula 5L - entrada +50 unidades', created_at: new Date(Date.now() - 28800000).toISOString() },
  { id: '7', table_name: 'payments', action: 'create', user_name: 'Admin', description: 'Recebimento REC202603310001 - Cliente ABC - 120.000 Kz', created_at: new Date(Date.now() - 36000000).toISOString() },
  { id: '8', table_name: 'products', action: 'delete', user_name: 'Admin', description: 'Produto "Teste" eliminado do catálogo', created_at: new Date(Date.now() - 43200000).toISOString() },
  { id: '9', table_name: 'journal_entries', action: 'create', user_name: 'Sistema', description: 'Lançamento VD202603310001 - Venda automática', created_at: new Date(Date.now() - 50000000).toISOString() },
  { id: '10', table_name: 'accounting_periods', action: 'status_change', user_name: 'Director', description: 'Período Fevereiro 2026 fechado', created_at: new Date(Date.now() - 86400000).toISOString() },
];

export default function AuditTrail() {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterAction, setFilterAction] = useState<string>('all');
  const [filterTable, setFilterTable] = useState<string>('all');
  const [auditLog] = useState(DEMO_AUDIT_LOG);
  const [selectedEntry, setSelectedEntry] = useState<any>(null);

  const filteredLog = auditLog.filter(entry => {
    if (filterAction !== 'all' && entry.action !== filterAction) return false;
    if (filterTable !== 'all' && entry.table_name !== filterTable) return false;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      return entry.description?.toLowerCase().includes(q) ||
             entry.user_name?.toLowerCase().includes(q) ||
             entry.table_name?.toLowerCase().includes(q);
    }
    return true;
  });

  const uniqueTables = [...new Set(auditLog.map(e => e.table_name))].sort();

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Trilha de Auditoria
            </h1>
            <p className="text-sm text-muted-foreground">Registo completo de todas as operações do sistema (AGT Compliance)</p>
          </div>
          <Button variant="outline" size="sm" className="gap-1.5">
            <Download className="w-3.5 h-3.5" /> Exportar
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3 p-4">
        {[
          { label: 'Total Registos', value: auditLog.length, color: 'text-primary' },
          { label: 'Criações', value: auditLog.filter(e => e.action === 'create').length, color: 'text-green-600' },
          { label: 'Alterações', value: auditLog.filter(e => e.action === 'update').length, color: 'text-blue-600' },
          { label: 'Anulações', value: auditLog.filter(e => e.action === 'void' || e.action === 'delete').length, color: 'text-destructive' },
        ].map((stat, i) => (
          <Card key={i}>
            <CardContent className="py-3 px-4">
              <p className="text-xs text-muted-foreground">{stat.label}</p>
              <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 px-4 pb-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input placeholder="Pesquisar..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
            className="h-8 text-sm pl-8" />
        </div>
        <Select value={filterAction} onValueChange={setFilterAction}>
          <SelectTrigger className="w-36 h-8 text-xs">
            <SelectValue placeholder="Acção" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas Acções</SelectItem>
            {Object.entries(ACTION_CONFIG).map(([key, config]) => (
              <SelectItem key={key} value={key}>{config.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterTable} onValueChange={setFilterTable}>
          <SelectTrigger className="w-40 h-8 text-xs">
            <SelectValue placeholder="Tabela" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas Tabelas</SelectItem>
            {uniqueTables.map(t => (
              <SelectItem key={t} value={t}>{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Log Table */}
      <div className="flex-1 overflow-auto px-4 pb-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-40">Data/Hora</TableHead>
              <TableHead className="w-24">Acção</TableHead>
              <TableHead className="w-32">Tabela</TableHead>
              <TableHead className="w-28">Utilizador</TableHead>
              <TableHead>Descrição</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredLog.map(entry => {
              const config = ACTION_CONFIG[entry.action] || { icon: FileText, label: entry.action, color: 'text-muted-foreground' };
              const Icon = config.icon;
              return (
                <TableRow key={entry.id} className="cursor-pointer hover:bg-accent/50"
                  onClick={() => setSelectedEntry(entry)}>
                  <TableCell className="text-xs text-muted-foreground font-mono">
                    {new Date(entry.created_at).toLocaleString('pt-AO')}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <Icon className={`w-3.5 h-3.5 ${config.color}`} />
                      <span className="text-xs">{config.label}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px] font-mono">{entry.table_name}</Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    <div className="flex items-center gap-1.5">
                      <User className="w-3 h-3 text-muted-foreground" />
                      {entry.user_name}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{entry.description}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>

        {filteredLog.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <Shield className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Nenhum registo de auditoria encontrado</p>
          </div>
        )}
      </div>
    </div>
  );
}
