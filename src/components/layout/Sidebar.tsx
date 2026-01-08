import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/utils';
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
} from 'lucide-react';

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
  { icon: ShoppingCart, label: 'POS / Caixa', path: '/pos' },
  { icon: FileText, label: 'Facturas', path: '/invoices' },
  { icon: Package, label: 'Inventário', path: '/inventory' },
  { icon: Tags, label: 'Categorias', path: '/categories' },
  { icon: Truck, label: 'Fornecedores', path: '/suppliers' },
  { icon: ClipboardList, label: 'Encomendas', path: '/purchase-orders' },
  { icon: Calendar, label: 'Relatórios Diários', path: '/daily-reports' },
  { icon: ArrowRightLeft, label: 'Transferências', path: '/stock-transfer' },
  { icon: Users, label: 'Clientes', path: '/clients' },
  { icon: Upload, label: 'Sincronização', path: '/data-sync' },
  { icon: Building2, label: 'Filiais', path: '/branches' },
  { icon: BarChart3, label: 'Relatórios', path: '/reports' },
  { icon: Settings, label: 'Configurações', path: '/settings' },
];

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
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
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-lg">K</span>
            </div>
            <div>
              <h1 className="font-bold text-lg leading-none">Kwanza ERP</h1>
              <p className="text-xs text-muted-foreground">Sistema de Gestão</p>
            </div>
          </div>
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
