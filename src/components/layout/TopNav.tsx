// Top Navigation Bar with horizontal menu
import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Branch, User } from '@/types/erp';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
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
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from '@/components/ui/navigation-menu';
import { Badge } from '@/components/ui/badge';
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navGroups = [
    {
      label: 'Sales',
      items: [
        { icon: LayoutDashboard, label: t.nav.dashboard, path: '/' },
        { icon: ShoppingCart, label: t.nav.pos, path: '/pos' },
        { icon: FileText, label: t.nav.invoices, path: '/invoices' },
        { icon: FileCheck, label: t.nav.fiscalDocuments, path: '/fiscal-documents' },
      ],
    },
    {
      label: 'Inventory',
      items: [
        { icon: Package, label: t.nav.inventory, path: '/inventory' },
        { icon: Tags, label: t.nav.categories, path: '/categories' },
        { icon: ArrowRightLeft, label: t.stockTransfer.title, path: '/stock-transfer' },
      ],
    },
    {
      label: 'Purchasing',
      items: [
        { icon: Truck, label: t.nav.suppliers, path: '/suppliers' },
        { icon: ClipboardList, label: t.nav.purchaseOrders, path: '/purchase-orders' },
      ],
    },
    {
      label: 'Reports',
      items: [
        { icon: Calendar, label: t.nav.dailyReports, path: '/daily-reports' },
        { icon: BarChart3, label: 'Reports', path: '/reports' },
        { icon: Upload, label: t.nav.dataSync, path: '/data-sync' },
      ],
    },
    {
      label: 'Admin',
      items: [
        { icon: Users, label: t.nav.clients, path: '/clients' },
        { icon: Shield, label: 'User Management', path: '/users' },
        { icon: Building2, label: 'Branches', path: '/branches' },
        { icon: Settings, label: t.nav.settings, path: '/settings' },
      ],
    },
  ];
  
  return (
    <header className="border-b bg-card sticky top-0 z-50">
      {/* Main Header Row */}
      <div className="h-14 px-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-lg">K</span>
            </div>
            <div className="hidden sm:block">
              <h1 className="font-bold text-base leading-none">Kwanza ERP</h1>
            </div>
          </div>

          {/* Branch Selector */}
          <Select
            value={currentBranch?.id}
            onValueChange={(id) => {
              const branch = branches.find(b => b.id === id);
              if (branch) onBranchChange(branch);
            }}
          >
            <SelectTrigger className="w-[160px] h-9 text-sm">
              <Building2 className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Select branch" />
            </SelectTrigger>
            <SelectContent>
              {branches.map(branch => (
                <SelectItem key={branch.id} value={branch.id}>
                  <div className="flex items-center gap-2">
                    <span>{branch.name}</span>
                    {branch.isMain && (
                      <Badge variant="secondary" className="text-[10px]">HQ</Badge>
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          {/* Mobile menu button */}
          <Button 
            variant="ghost" 
            size="icon" 
            className="lg:hidden"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            <Menu className="w-5 h-5" />
          </Button>

          {/* Language Switcher */}
          <LanguageSwitcher />

          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="gap-2 h-9">
                <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                  <UserIcon className="w-4 h-4 text-primary" />
                </div>
                <span className="hidden sm:inline text-sm">{user?.name}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div>
                  <p className="font-medium">{user?.name}</p>
                  <p className="text-xs text-muted-foreground capitalize">{user?.role}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <NavLink to="/settings" className="cursor-pointer">
                  <Settings className="w-4 h-4 mr-2" />
                  {t.nav.settings}
                </NavLink>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onLogout} className="text-destructive cursor-pointer">
                <LogOut className="w-4 h-4 mr-2" />
                {t.nav.logout}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Navigation Row - Desktop */}
      <nav className="h-10 px-4 hidden lg:flex items-center gap-1 border-t bg-muted/30">
        {navGroups.map((group) => (
          <DropdownMenu key={group.label}>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 text-sm gap-1">
                {group.label}
                <ChevronDown className="w-3 h-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              {group.items.map((item) => (
                <DropdownMenuItem key={item.path} asChild>
                  <NavLink 
                    to={item.path} 
                    className={({ isActive }) => cn(
                      "flex items-center gap-2 cursor-pointer w-full",
                      isActive && "bg-primary/10 text-primary"
                    )}
                  >
                    <item.icon className="w-4 h-4" />
                    {item.label}
                  </NavLink>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ))}
        
        {/* Quick access links */}
        <div className="ml-auto flex items-center gap-1">
          <NavLink to="/pos">
            {({ isActive }) => (
              <Button 
                variant={isActive ? "secondary" : "ghost"} 
                size="sm" 
                className="h-8 text-sm"
              >
                <ShoppingCart className="w-4 h-4 mr-1" />
                POS
              </Button>
            )}
          </NavLink>
          <NavLink to="/">
            {({ isActive }) => (
              <Button 
                variant={isActive ? "secondary" : "ghost"} 
                size="sm" 
                className="h-8 text-sm"
              >
                <LayoutDashboard className="w-4 h-4 mr-1" />
                Dashboard
              </Button>
            )}
          </NavLink>
        </div>
      </nav>

      {/* Mobile Navigation */}
      {mobileMenuOpen && (
        <nav className="lg:hidden border-t bg-card p-4 space-y-4">
          {navGroups.map((group) => (
            <div key={group.label}>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                {group.label}
              </p>
              <div className="grid grid-cols-2 gap-2">
                {group.items.map((item) => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className={({ isActive }) => cn(
                      "flex items-center gap-2 px-3 py-2 rounded-md text-sm",
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-muted"
                    )}
                  >
                    <item.icon className="w-4 h-4" />
                    {item.label}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>
      )}
    </header>
  );
}
