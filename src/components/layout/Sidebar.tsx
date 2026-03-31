import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/i18n';
import { CompanyLogo } from '@/components/layout/CompanyLogo';
import {
  LayoutDashboard,
  ShoppingCart,
  FileText,
  Package,
  Users,
  Building2,
  BarChart3,
  Settings,
  ArrowRightLeft,
  Calendar,
  Upload,
  Truck,
  ClipboardList,
  Tags,
  FileCheck,
  Shield,
  BookOpen,
  FileEdit,
  Receipt,
  Landmark,
  Wallet,
  CreditCard,
  CalendarCheck,
} from 'lucide-react';

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { t } = useTranslation();

  const navItems = [
    { icon: LayoutDashboard, label: t.nav.dashboard, path: '/' },
    { icon: ShoppingCart, label: t.nav.pos, path: '/pos' },
    { icon: FileText, label: t.nav.invoices, path: '/invoices' },
    { icon: FileEdit, label: 'Pro Forma', path: '/proforma' },
    { icon: FileCheck, label: t.nav.fiscalDocuments, path: '/fiscal-documents' },
    { icon: Package, label: t.nav.inventory, path: '/inventory' },
    { icon: Tags, label: t.nav.categories, path: '/categories' },
    { icon: Truck, label: t.nav.suppliers, path: '/suppliers' },
    { icon: ClipboardList, label: t.nav.purchaseOrders, path: '/purchase-orders' },
    { icon: FileText, label: 'Fatura de Compra', path: '/purchase-invoices' },
    { icon: Calendar, label: t.nav.dailyReports, path: '/daily-reports' },
    { icon: ArrowRightLeft, label: t.stockTransfer.title, path: '/stock-transfer' },
    { icon: Users, label: t.nav.clients, path: '/clients' },
    { icon: Wallet, label: 'Caixa', path: '/caixa' },
    { icon: Receipt, label: 'Despesas', path: '/expenses' },
    { icon: Landmark, label: 'Contas Bancárias', path: '/bank-accounts' },
    { icon: Upload, label: t.nav.dataSync, path: '/data-sync' },
    { icon: CreditCard, label: 'Pagamentos', path: '/payments' },
    { icon: BookOpen, label: t.nav.chartOfAccounts, path: '/chart-of-accounts' },
    { icon: CalendarCheck, label: 'Períodos', path: '/accounting-periods' },
    { icon: Shield, label: 'User Management', path: '/users' },
    { icon: Building2, label: 'Branches', path: '/branches' },
    { icon: BarChart3, label: 'Reports', path: '/reports' },
    { icon: Settings, label: t.nav.settings, path: '/settings' },
  ];

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={cn(
          "fixed lg:static inset-y-0 left-0 z-50 w-64 bg-card border-r transform transition-transform duration-200 lg:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="h-16 border-b flex items-center px-4 lg:hidden">
          <CompanyLogo size="md" />
        </div>

        <nav className="p-4 space-y-1">
          {navItems.map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={onClose}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )
              }
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>
    </>
  );
}
