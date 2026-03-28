// Kwanza ERP Dashboard - Modern Design
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBranchContext } from '@/contexts/BranchContext';
import { useTranslation } from '@/i18n';
import { useCompanyLogo } from '@/hooks/useCompanyLogo';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  FileText, ShoppingCart, Package, BarChart3, TrendingUp,
  ArrowRight, ClipboardList, Receipt, DollarSign, FileCheck,
  PieChart, Truck, CheckCircle, Search, BookOpen, ArrowRightLeft,
  Users, Calendar,
} from 'lucide-react';

export default function Dashboard() {
  const navigate = useNavigate();
  const { currentBranch } = useBranchContext();
  const { language } = useTranslation();
  const { companyName, logo } = useCompanyLogo();

  // Document flow steps
  const documentFlow = useMemo(() => [
    { label: 'Proforma', icon: ClipboardList, path: '/proforma' },
    { label: 'Fatura De Venda', icon: FileText, path: '/invoices' },
    { label: 'Recibo', icon: Receipt, path: '/invoices' },
    { label: 'Pagamento', icon: DollarSign, path: '/expenses' },
    { label: 'Extracto', icon: FileCheck, path: '/extracto' },
  ], []);

  // Quick action grid
  const quickActions = useMemo(() => [
    { label: 'POS / Vendas', icon: ShoppingCart, path: '/pos', gradient: 'gradient-primary' },
    { label: 'Facturas', icon: FileText, path: '/invoices', gradient: 'gradient-accent' },
    { label: 'Inventário', icon: Package, path: '/inventory', gradient: 'gradient-success' },
    { label: 'Compras', icon: Truck, path: '/purchase-orders', gradient: 'gradient-warm' },
    { label: 'Clientes', icon: Users, path: '/clients', gradient: 'gradient-primary' },
    { label: 'Mapa De Contas', icon: BookOpen, path: '/chart-of-accounts', gradient: 'gradient-accent' },
    { label: 'Transferências', icon: ArrowRightLeft, path: '/stock-transfer', gradient: 'gradient-success' },
    { label: 'Relatórios', icon: BarChart3, path: '/reports', gradient: 'gradient-warm' },
  ], []);

  // BI Cards
  const biCards = useMemo(() => [
    { label: 'Balancete', icon: PieChart, path: '/reports', color: 'bg-primary/10 text-primary' },
    { label: 'Faturas', icon: FileText, path: '/invoices', color: 'bg-success/10 text-success' },
    { label: 'Vendas / Lucro', icon: TrendingUp, path: '/reports', color: 'bg-warning/10 text-warning' },
    { label: 'Compras', icon: Truck, path: '/purchase-orders', color: 'bg-info/10 text-info' },
    { label: 'Charts', icon: BarChart3, path: '/reports', color: 'bg-destructive/10 text-destructive' },
    { label: 'Stock', icon: Package, path: '/inventory', color: 'bg-primary/10 text-primary' },
  ], []);

  return (
    <div className="h-full flex flex-col lg:flex-row">
      {/* ====== MAIN CONTENT ====== */}
      <div className="flex-1 p-6 overflow-auto space-y-8">
        {/* Company Header */}
        <div className="flex items-center gap-3">
          {logo && (
            <img src={logo} alt={companyName} className="h-10 object-contain rounded-lg" />
          )}
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-gradient">{companyName}</h1>
            <p className="text-sm text-muted-foreground font-medium">
              {currentBranch?.name || 'Sede'} • {new Date().toLocaleDateString('pt-AO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
        </div>

        {/* Document Flow */}
        <Card className="shadow-card overflow-hidden">
          <CardContent className="p-5">
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-4">Fluxo Documental</h3>
            <div className="flex items-center justify-between gap-1 flex-wrap">
              {documentFlow.map((step, idx) => (
                <div key={step.label} className="flex items-center gap-2 flex-1 min-w-0">
                  <button
                    onClick={() => navigate(step.path)}
                    className="w-full group flex items-center gap-2.5 px-4 py-3 rounded-xl bg-accent/50 hover:bg-accent border border-transparent hover:border-primary/20 transition-all duration-200 hover:shadow-md"
                  >
                    <step.icon className="w-5 h-5 text-primary flex-shrink-0 group-hover:scale-110 transition-transform" />
                    <span className="text-xs font-semibold truncate">{step.label}</span>
                  </button>
                  {idx < documentFlow.length - 1 && (
                    <ArrowRight className="w-4 h-4 text-primary/40 flex-shrink-0" />
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions Grid */}
        <div>
          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-4">Acesso Rápido</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {quickActions.map((action) => (
              <button
                key={action.label}
                onClick={() => navigate(action.path)}
                className={`${action.gradient} p-5 rounded-2xl text-white shadow-card hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-200 group text-left`}
              >
                <action.icon className="w-7 h-7 mb-3 opacity-90 group-hover:scale-110 transition-transform" />
                <span className="text-sm font-bold">{action.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Quick Checks */}
        <div className="flex gap-3 flex-wrap">
          <Button variant="outline" className="rounded-xl gap-2 shadow-sm" onClick={() => navigate('/fiscal-documents')}>
            <CheckCircle className="w-4 h-4 text-success" />
            Verificar Fatura
          </Button>
          <Button variant="outline" className="rounded-xl gap-2 shadow-sm" onClick={() => navigate('/proforma')}>
            <Search className="w-4 h-4 text-info" />
            Check Proforma
          </Button>
          <Button variant="outline" className="rounded-xl gap-2 shadow-sm" onClick={() => navigate('/daily-reports')}>
            <Calendar className="w-4 h-4 text-warning" />
            Relatório Diário
          </Button>
        </div>
      </div>

      {/* ====== BI SIDEBAR (Right) ====== */}
      <div className="hidden lg:flex w-48 flex-col bg-card border-l">
        <div className="p-4 border-b">
          <h3 className="font-extrabold text-sm text-center tracking-tight">Business Intelligence</h3>
        </div>
        <div className="flex-1 flex flex-col gap-2 p-3">
          {biCards.map((item) => (
            <button
              key={item.label}
              onClick={() => navigate(item.path)}
              className={`flex items-center gap-3 px-4 py-4 rounded-xl ${item.color} hover:shadow-md transition-all duration-200 group text-left`}
            >
              <item.icon className="w-6 h-6 flex-shrink-0 group-hover:scale-110 transition-transform" />
              <span className="text-sm font-bold leading-tight">{item.label}</span>
            </button>
          ))}
        </div>

        <div className="p-3 border-t">
          <Button
            variant="outline"
            className="w-full h-12 text-xs font-bold gap-2 rounded-xl shadow-sm"
            onClick={() => navigate('/chart-of-accounts')}
          >
            <FileCheck className="w-4 h-4" />
            CONTAS / SAF-T
          </Button>
        </div>
      </div>
    </div>
  );
}
