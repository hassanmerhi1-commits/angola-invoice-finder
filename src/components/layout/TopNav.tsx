// Top Navigation Bar matching Smart ERP design
// Menu Bar + Tab Navigation + Action Toolbar
import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
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
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { 
  Building2, 
  User as UserIcon, 
  LogOut, 
  Settings, 
  Menu,
  LayoutDashboard,
  ShoppingCart,
  FileText,
  Package,
  Users,
  BarChart3,
  ArrowRightLeft,
  Calendar,
  Upload,
  Truck,
  ClipboardList,
  Tags,
  FileCheck,
  Shield,
  ChevronDown,
  Search,
  Plus,
  Pencil,
  Trash2,
  Filter,
  Download,
  FileSpreadsheet,
  RefreshCw,
  Save,
  Printer,
  X,
  Info,
  HelpCircle,
  Database,
  Calculator,
  Receipt,
  Factory,
  Import,
  UserCog,
  FolderOpen,
} from 'lucide-react';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { useTranslation } from '@/i18n';

interface TopNavProps {
  user: User | null;
  branches: Branch[];
  currentBranch: Branch | null;
  onBranchChange: (branch: Branch) => void;
  onLogout: () => void;
}

export function TopNav({
  user,
  branches,
  currentBranch,
  onBranchChange,
  onLogout,
}: TopNavProps) {
  const { t } = useTranslation();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Menu bar items (dropdowns)
  const menuItems = [
    {
      label: 'File',
      items: [
        { label: 'New', icon: Plus },
        { label: 'Save', icon: Save },
        { label: 'Print', icon: Printer },
        { label: 'separator' },
        { label: 'Exit', icon: LogOut, action: onLogout },
      ],
    },
    {
      label: 'Company',
      items: [
        { label: 'Branches', icon: Building2, path: '/branches' },
        { label: 'Users', icon: UserCog, path: '/users' },
        { label: 'Settings', icon: Settings, path: '/settings' },
      ],
    },
    {
      label: 'Invoicing',
      items: [
        { label: 'POS', icon: ShoppingCart, path: '/pos' },
        { label: 'Invoices', icon: FileText, path: '/invoices' },
        { label: 'Fiscal Documents', icon: FileCheck, path: '/fiscal-documents' },
      ],
    },
    {
      label: 'Accounting',
      items: [
        { label: 'Daily Reports', icon: Calendar, path: '/daily-reports' },
        { label: 'Reports', icon: BarChart3, path: '/reports' },
      ],
    },
    {
      label: 'Stock',
      items: [
        { label: 'Inventory', icon: Package, path: '/inventory' },
        { label: 'Categories', icon: Tags, path: '/categories' },
        { label: 'Stock Transfer', icon: ArrowRightLeft, path: '/stock-transfer' },
      ],
    },
    {
      label: 'Utilities',
      items: [
        { label: 'Data Sync', icon: Upload, path: '/data-sync' },
        { label: 'Import/Export', icon: FileSpreadsheet },
      ],
    },
    {
      label: 'Help',
      items: [
        { label: 'About', icon: Info },
        { label: 'Help', icon: HelpCircle },
      ],
    },
  ];

  // Main tabs (like Smart ERP's Inicio, Mapa De Contas, Stock, etc.)
  const mainTabs = [
    { label: 'Home', path: '/', icon: LayoutDashboard },
    { label: 'POS', path: '/pos', icon: ShoppingCart },
    { label: 'Stock', path: '/inventory', icon: Package },
    { label: 'Invoices', path: '/invoices', icon: FileText },
    { label: 'Fiscal', path: '/fiscal-documents', icon: FileCheck },
    { label: 'Purchasing', path: '/purchase-orders', icon: ClipboardList },
    { label: 'Suppliers', path: '/suppliers', icon: Truck },
    { label: 'Clients', path: '/clients', icon: Users },
    { label: 'Reports', path: '/daily-reports', icon: Calendar },
  ];

  // Context-specific action buttons based on current route
  const getActionButtons = () => {
    const path = location.pathname;
    
    const commonButtons = [
      { label: 'All', icon: FolderOpen, variant: 'default' as const },
      { label: 'New', icon: Plus, variant: 'default' as const },
      { label: 'Edit', icon: Pencil, variant: 'outline' as const },
      { label: 'Delete', icon: Trash2, variant: 'destructive' as const },
    ];

    if (path.includes('inventory') || path.includes('stock')) {
      return [
        ...commonButtons,
        { label: 'Transfer', icon: ArrowRightLeft, variant: 'outline' as const },
        { label: 'Adjust', icon: RefreshCw, variant: 'outline' as const },
        { label: 'Import', icon: Download, variant: 'outline' as const },
        { label: 'Export', icon: FileSpreadsheet, variant: 'outline' as const },
      ];
    }
    
    if (path.includes('invoices') || path.includes('fiscal')) {
      return [
        ...commonButtons,
        { label: 'Print', icon: Printer, variant: 'outline' as const },
        { label: 'Export', icon: FileSpreadsheet, variant: 'outline' as const },
      ];
    }

    if (path.includes('pos')) {
      return [
        { label: 'New Sale', icon: Plus, variant: 'default' as const },
        { label: 'Hold', icon: Save, variant: 'outline' as const },
        { label: 'Recall', icon: RefreshCw, variant: 'outline' as const },
        { label: 'Void', icon: X, variant: 'destructive' as const },
      ];
    }

    return commonButtons;
  };

  const actionButtons = getActionButtons();

  return (
    <header className="border-b bg-card sticky top-0 z-50">
      {/* Row 1: Menu Bar */}
      <div className="h-8 px-2 bg-gradient-to-b from-muted/50 to-muted hidden lg:flex items-center justify-between border-b text-sm">
        <div className="flex items-center">
          {/* Logo */}
          <div className="flex items-center gap-2 pr-4 border-r mr-2">
            <div className="w-6 h-6 rounded bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-xs">K</span>
            </div>
            <span className="font-semibold text-sm">Kwanza ERP</span>
          </div>

          {/* Menu Items */}
          {menuItems.map((menu) => (
            <DropdownMenu key={menu.label}>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-6 px-2 text-xs">
                  {menu.label}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="min-w-[160px]">
                {menu.items.map((item, idx) => 
                  item.label === 'separator' ? (
                    <DropdownMenuSeparator key={idx} />
                  ) : (
                    <DropdownMenuItem 
                      key={item.label} 
                      asChild={!!item.path}
                      onClick={item.action}
                      className="text-sm"
                    >
                      {item.path ? (
                        <NavLink to={item.path} className="flex items-center gap-2">
                          {item.icon && <item.icon className="w-4 h-4" />}
                          {item.label}
                        </NavLink>
                      ) : (
                        <span className="flex items-center gap-2">
                          {item.icon && <item.icon className="w-4 h-4" />}
                          {item.label}
                        </span>
                      )}
                    </DropdownMenuItem>
                  )
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          ))}
        </div>

        {/* Right side: Search, Branch, User */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
            <Input 
              placeholder="Search..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-6 w-40 pl-7 text-xs"
            />
          </div>
          
          <LanguageSwitcher />
          
          <Select
            value={currentBranch?.id}
            onValueChange={(id) => {
              const branch = branches.find(b => b.id === id);
              if (branch) onBranchChange(branch);
            }}
          >
            <SelectTrigger className="h-6 w-[140px] text-xs">
              <Building2 className="w-3 h-3 mr-1" />
              <SelectValue placeholder="Branch" />
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
              <Button variant="ghost" size="sm" className="h-6 px-2 text-xs gap-1">
                <UserIcon className="w-3 h-3" />
                {user?.name}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onLogout} className="text-destructive">
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Row 2: Main Tabs */}
      <div className="h-9 px-2 bg-muted/30 hidden lg:flex items-center gap-1 border-b overflow-x-auto">
        {mainTabs.map((tab) => (
          <NavLink
            key={tab.path}
            to={tab.path}
            className={({ isActive }) => cn(
              "flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-t-md border-b-2 transition-colors",
              isActive 
                ? "bg-background border-primary text-primary" 
                : "border-transparent hover:bg-muted hover:text-foreground text-muted-foreground"
            )}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </NavLink>
        ))}
      </div>

      {/* Row 3: Action Toolbar */}
      <div className="h-10 px-2 bg-gradient-to-b from-background to-muted/20 hidden lg:flex items-center gap-1 border-b overflow-x-auto">
        {actionButtons.map((btn, idx) => (
          <Button
            key={idx}
            variant={btn.variant}
            size="sm"
            className="h-7 text-xs gap-1"
          >
            <btn.icon className="w-3.5 h-3.5" />
            {btn.label}
          </Button>
        ))}
        
        <div className="flex-1" />
        
        {/* Right side action buttons */}
        <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
          <Filter className="w-3.5 h-3.5" />
          Filter
        </Button>
        <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
          <Download className="w-3.5 h-3.5" />
          Import
        </Button>
        <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
          <FileSpreadsheet className="w-3.5 h-3.5" />
          Excel
        </Button>
      </div>

      {/* Mobile Header */}
      <div className="h-12 px-3 flex lg:hidden items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded bg-primary flex items-center justify-center">
            <span className="text-primary-foreground font-bold">K</span>
          </div>
          <span className="font-semibold">Kwanza ERP</span>
        </div>
        
        <div className="flex items-center gap-2">
          <Select
            value={currentBranch?.id}
            onValueChange={(id) => {
              const branch = branches.find(b => b.id === id);
              if (branch) onBranchChange(branch);
            }}
          >
            <SelectTrigger className="h-8 w-[120px] text-xs">
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
          
          <Button 
            variant="ghost" 
            size="icon"
            className="h-8 w-8"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            <Menu className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* Mobile Navigation */}
      {mobileMenuOpen && (
        <nav className="lg:hidden border-t bg-card p-3 space-y-3 max-h-[70vh] overflow-y-auto">
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Search..." 
              className="pl-9"
            />
          </div>
          
          <div className="grid grid-cols-3 gap-2">
            {mainTabs.map((tab) => (
              <NavLink
                key={tab.path}
                to={tab.path}
                onClick={() => setMobileMenuOpen(false)}
                className={({ isActive }) => cn(
                  "flex flex-col items-center gap-1 p-3 rounded-lg text-xs",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted hover:bg-muted/80"
                )}
              >
                <tab.icon className="w-5 h-5" />
                {tab.label}
              </NavLink>
            ))}
          </div>

          <div className="pt-3 border-t flex items-center justify-between">
            <div className="flex items-center gap-2">
              <UserIcon className="w-4 h-4" />
              <span className="text-sm">{user?.name}</span>
            </div>
            <Button variant="ghost" size="sm" onClick={onLogout} className="text-destructive">
              <LogOut className="w-4 h-4 mr-1" />
              Logout
            </Button>
          </div>
        </nav>
      )}
    </header>
  );
}
