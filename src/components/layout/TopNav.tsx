// Kwanza ERP - Top Navigation
// Menu Bar → Tab Bar → Action Toolbar → Status Bar
import { useState, useEffect } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Branch, User } from '@/types/erp';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { 
  Building2, User as UserIcon, LogOut, Settings, Menu,
  LayoutDashboard, ShoppingCart, FileText, Package, Users,
  BarChart3, ArrowRightLeft, Calendar, Upload, Truck,
  ClipboardList, Tags, FileCheck, ChevronDown, Search,
  Plus, Pencil, Trash2, Filter, Download, FileSpreadsheet,
  RefreshCw, Save, Printer, X, Info, HelpCircle,
  Database, Calculator, Receipt, Factory, Import, UserCog,
  FolderOpen, BookOpen, Landmark, CreditCard, DollarSign,
  Shield, Wallet, PieChart, TrendingUp, Globe, Keyboard,
  Monitor,
} from 'lucide-react';
import { useTranslation } from '@/i18n';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';

interface TopNavProps {
  user: User | null;
  branches: Branch[];
  currentBranch: Branch | null;
  onBranchChange: (branch: Branch) => void;
  onLogout: () => void;
}

export function TopNav({ user, branches, currentBranch, onBranchChange, onLogout }: TopNavProps) {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [now, setNow] = useState(new Date());
  const [dbInfo, setDbInfo] = useState({ mode: '', path: '', ip: '' });

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30000);
    // Try to get DB status for status bar
    if (window.electronAPI?.db?.getStatus) {
      window.electronAPI.db.getStatus().then((s: any) => {
        setDbInfo({ mode: s.mode || '', path: s.path || '', ip: s.serverAddress || '' });
      }).catch(() => {});
    }
    return () => clearInterval(id);
  }, []);

  const formatDateTime = () => {
    const d = now;
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    const ss = String(d.getSeconds()).padStart(2, '0');
    return `${dd}/${mm}/${yyyy} ${hh}:${min}:${ss}`;
  };

  // ========== MENU BAR (Row 1) ==========
  const menuItems = [
    {
      label: 'Ficheiro',
      items: [
        { label: 'Abrir', icon: FolderOpen },
        { label: 'Guardar', icon: Save },
        { label: 'Imprimir', icon: Printer },
        { label: 'separator' },
        { label: 'Cópia de Segurança', icon: Database },
        { label: 'Importar', icon: Download },
        { label: 'separator' },
        { label: 'Sair', icon: LogOut, action: onLogout },
      ],
    },
    {
      label: 'Empresa',
      items: [
        { label: 'Filiais', icon: Building2, path: '/branches' },
        { label: 'Utilizadores', icon: UserCog, path: '/users' },
        { label: 'Configurações', icon: Settings, path: '/settings' },
      ],
    },
    {
      label: 'Invoicing',
      items: [
        { label: 'POS / Smart POS', icon: ShoppingCart, path: '/pos' },
        { label: 'Facturas', icon: FileText, path: '/invoices' },
        { label: 'Pro-forma', icon: ClipboardList, path: '/proforma' },
        { label: 'separator' },
        { label: 'Nota de Crédito', icon: CreditCard, path: '/fiscal-documents' },
        { label: 'Nota de Débito', icon: DollarSign, path: '/fiscal-documents' },
      ],
    },
    {
      label: 'Accounting',
      items: [
        { label: 'Recibo', icon: Receipt, path: '/invoices' },
        { label: 'Forma de Receber', icon: Wallet },
        { label: 'Valor Crédito', icon: CreditCard },
        { label: 'separator' },
        { label: 'Pagamento', icon: DollarSign, path: '/expenses' },
        { label: 'Pagamento por Cheque', icon: FileText },
        { label: 'separator' },
        { label: 'Multi Crédito', icon: Plus },
        { label: 'Multi Débito', icon: Plus },
        { label: 'Entrada do Diário', icon: BookOpen, path: '/chart-of-accounts' },
      ],
    },
    {
      label: 'Special Transactions',
      items: [
        { label: 'Transferência de Stock', icon: ArrowRightLeft, path: '/stock-transfer' },
        { label: 'Ajuste de Inventário', icon: RefreshCw, path: '/inventory' },
        { label: 'Devolução de Compra', icon: Truck },
      ],
    },
    {
      label: 'Relatórios Financeiros',
      items: [
        { label: 'Balancete', icon: PieChart, path: '/reports' },
        { label: 'Demonstração de Resultados', icon: TrendingUp, path: '/reports' },
        { label: 'Balanço', icon: BarChart3, path: '/reports' },
        { label: 'separator' },
        { label: 'Relatórios Diários', icon: Calendar, path: '/daily-reports' },
        { label: 'Extracto de Conta', icon: FileText, path: '/reports' },
      ],
    },
    {
      label: 'Relatórios de Stock',
      items: [
        { label: 'Movimento de Stock', icon: ArrowRightLeft, path: '/reports' },
        { label: 'Valorização de Stock', icon: DollarSign, path: '/reports' },
        { label: 'Stock por Filial', icon: Building2, path: '/reports' },
      ],
    },
    {
      label: 'Utilities',
      items: [
        { label: 'Modificar Senha Actual', icon: Shield },
        { label: 'Manutenção', icon: Settings },
        { label: 'Calculadora', icon: Calculator },
        { label: 'separator' },
        { label: 'Sincronização', icon: Upload, path: '/data-sync' },
      ],
    },
    {
      label: 'Ajuda',
      items: [
        { label: 'Sobre', icon: Info },
        { label: 'Ajuda', icon: HelpCircle },
      ],
    },
  ];

  // ========== MAIN TABS (Row 2) ==========
  const mainTabs = [
    { label: 'Inicio', path: '/', icon: LayoutDashboard },
    { label: 'Mapa De Contas', path: '/chart-of-accounts', icon: BookOpen },
    { label: 'Stock', path: '/inventory', icon: Package },
    { label: 'Diarios', path: '/journals', icon: Calendar },
    { label: 'Faturas / Vouchers', path: '/invoices', icon: FileText },
    { label: 'Produção', path: '/purchase-orders', icon: Factory },
    { label: 'Importação', path: '/suppliers', icon: Globe },
    { label: 'HR', path: '/users', icon: Users },
  ];

  // ========== ACTION TOOLBAR (Row 3) ==========
  const getActionButtons = () => {
    const p = location.pathname;

    if (p === '/' || p === '') return [];

    const base = [
      { label: 'Todos', icon: FolderOpen, variant: 'outline' as const },
      { label: 'Novo', icon: Plus, variant: 'default' as const },
      { label: 'Eliminar', icon: Trash2, variant: 'destructive' as const },
      { label: 'Editar', icon: Pencil, variant: 'outline' as const },
    ];

    if (p.includes('inventory') || p.includes('stock')) {
      return [
        ...base,
        { label: 'Transferência', icon: ArrowRightLeft, variant: 'outline' as const },
        { label: 'Ajustar Saída', icon: RefreshCw, variant: 'outline' as const },
        { label: 'Entrada Inventário', icon: Download, variant: 'outline' as const },
        { label: 'Qtd Mínima', icon: Filter, variant: 'outline' as const },
      ];
    }
    if (p.includes('chart-of-accounts')) {
      return [
        ...base,
        { label: 'Fatura De Venda', icon: FileText, variant: 'outline' as const },
        { label: 'Recibo', icon: Receipt, variant: 'outline' as const },
        { label: 'Pagamento', icon: DollarSign, variant: 'outline' as const },
        { label: 'Fatura de Compra', icon: Truck, variant: 'outline' as const },
        { label: 'Entrada do Diário', icon: BookOpen, variant: 'outline' as const },
      ];
    }
    if (p.includes('invoices') || p.includes('fiscal') || p.includes('proforma')) {
      return [
        ...base,
        { label: 'Imprimir', icon: Printer, variant: 'outline' as const },
        { label: 'AGT Send', icon: Upload, variant: 'outline' as const },
      ];
    }
    if (p.includes('pos')) {
      return [
        { label: 'Nova Venda', icon: Plus, variant: 'default' as const },
        { label: 'Guardar', icon: Save, variant: 'outline' as const },
        { label: 'Anular', icon: X, variant: 'destructive' as const },
      ];
    }
    return base;
  };

  const actionButtons = getActionButtons();

  return (
    <header className="border-b bg-card sticky top-0 z-50">
      {/* ====== ROW 1: Menu Bar ====== */}
      <div className="h-7 px-1 bg-gradient-to-b from-[hsl(var(--muted)/0.6)] to-[hsl(var(--muted))] hidden lg:flex items-center justify-between border-b text-xs">
        <div className="flex items-center">
          {/* Logo */}
          <div className="flex items-center gap-1.5 pr-3 border-r mr-1">
            <div className="w-5 h-5 rounded bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-[10px]">K</span>
            </div>
            <span className="font-bold text-xs italic text-primary">Kwanza ERP</span>
          </div>

          {menuItems.map((menu) => (
            <DropdownMenu key={menu.label}>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-5 px-2 text-[11px] font-normal hover:bg-accent/50">
                  {menu.label}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="min-w-[200px]">
                {menu.items.map((item, idx) =>
                  item.label === 'separator' ? (
                    <DropdownMenuSeparator key={idx} />
                  ) : (
                    <DropdownMenuItem
                      key={item.label}
                      onClick={() => {
                        if ((item as any).action) (item as any).action();
                        else if ((item as any).path) navigate((item as any).path);
                      }}
                      className="text-xs"
                    >
                      {item.icon && <item.icon className="w-3.5 h-3.5 mr-2" />}
                      {item.label}
                      {(item as any).shortcut && (
                        <span className="ml-auto text-muted-foreground text-[10px]">{(item as any).shortcut}</span>
                      )}
                    </DropdownMenuItem>
                  )
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          ))}
        </div>

        <div className="flex items-center gap-1.5">
          <div className="relative">
            <Search className="absolute left-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
            <Input
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-5 w-32 pl-6 text-[10px] rounded-sm"
            />
          </div>

          <Button variant="ghost" size="sm" className="h-5 px-1.5 text-[10px]" title="FTP">
            Ftp
          </Button>

          <LanguageSwitcher />

          <Select
            value={currentBranch?.id}
            onValueChange={(id) => {
              const branch = branches.find(b => b.id === id);
              if (branch) onBranchChange(branch);
            }}
          >
            <SelectTrigger className="h-5 w-[130px] text-[10px]">
              <Building2 className="w-3 h-3 mr-1" />
              <SelectValue placeholder="Filial" />
            </SelectTrigger>
            <SelectContent>
              {branches.map(branch => (
                <SelectItem key={branch.id} value={branch.id} className="text-xs">
                  {branch.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-5 px-1.5 text-[10px] gap-1">
                <UserIcon className="w-3 h-3" />
                {user?.name}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem className="text-xs">
                <Shield className="w-3.5 h-3.5 mr-2" />
                Perfil
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onLogout} className="text-destructive text-xs">
                <LogOut className="w-3.5 h-3.5 mr-2" />
                Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* ====== ROW 2: Main Tabs ====== */}
      <div className="h-8 px-1 bg-muted/30 hidden lg:flex items-end gap-0 border-b overflow-x-auto">
        {mainTabs.map((tab) => (
          <NavLink
            key={tab.path}
            to={tab.path}
            end={tab.path === '/'}
            className={({ isActive }) => cn(
              "flex items-center gap-1 px-3 py-1 text-[11px] font-medium border border-b-0 rounded-t-md transition-colors relative -mb-px",
              isActive
                ? "bg-background border-border text-primary z-10"
                : "bg-muted/50 border-transparent hover:bg-muted text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
          </NavLink>
        ))}
      </div>

      {/* ====== ROW 3: Action Toolbar ====== */}
      {actionButtons.length > 0 && (
        <div className="h-9 px-2 bg-gradient-to-b from-background to-muted/20 hidden lg:flex items-center gap-1 border-b overflow-x-auto">
          {actionButtons.map((btn, idx) => (
            <Button key={idx} variant={btn.variant} size="sm" className="h-6 text-[11px] gap-1 px-2">
              <btn.icon className="w-3 h-3" />
              {btn.label}
            </Button>
          ))}

          <div className="flex-1" />

          <Button variant="outline" size="sm" className="h-6 text-[10px] gap-1 px-2">
            <Filter className="w-3 h-3" />
            Filtro
          </Button>
          <Button variant="outline" size="sm" className="h-6 text-[10px] gap-1 px-2">
            <Download className="w-3 h-3" />
            Importar
          </Button>
          <Button variant="outline" size="sm" className="h-6 text-[10px] gap-1 px-2">
            <FileSpreadsheet className="w-3 h-3" />
            Excel
          </Button>
        </div>
      )}

      {/* ====== Mobile Header ====== */}
      <div className="h-11 px-3 flex lg:hidden items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded bg-primary flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-xs">K</span>
          </div>
          <span className="font-bold text-sm">Kwanza ERP</span>
        </div>
        <div className="flex items-center gap-1">
          <Select
            value={currentBranch?.id}
            onValueChange={(id) => {
              const branch = branches.find(b => b.id === id);
              if (branch) onBranchChange(branch);
            }}
          >
            <SelectTrigger className="h-7 w-[100px] text-[10px]">
              <Building2 className="w-3 h-3 mr-1" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {branches.map(branch => (
                <SelectItem key={branch.id} value={branch.id} className="text-xs">
                  {branch.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            <Menu className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Mobile Navigation */}
      {mobileMenuOpen && (
        <nav className="lg:hidden border-t bg-card p-2 max-h-[70vh] overflow-y-auto">
          <div className="grid grid-cols-4 gap-1.5">
            {mainTabs.map((tab) => (
              <NavLink
                key={tab.path}
                to={tab.path}
                onClick={() => setMobileMenuOpen(false)}
                className={({ isActive }) => cn(
                  "flex flex-col items-center gap-1 p-2 rounded text-[10px]",
                  isActive ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"
                )}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </NavLink>
            ))}
          </div>
          <div className="pt-2 mt-2 border-t flex items-center justify-between">
            <span className="text-xs text-muted-foreground">{user?.name}</span>
            <Button variant="ghost" size="sm" onClick={onLogout} className="text-destructive text-xs h-6">
              <LogOut className="w-3 h-3 mr-1" /> Sair
            </Button>
          </div>
        </nav>
      )}
    </header>
  );
}