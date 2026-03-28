// Minerva ERP-style Dashboard (Inicio)
// Flow diagram: Proforma → Fatura De Venda → Recibo → Pagamento → Extracto
// BI Sidebar: Balancete, Faturas, Vendas/Lucro, Compras, Charts, Stock
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBranchContext } from '@/contexts/BranchContext';
import { useTranslation } from '@/i18n';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  FileText, ShoppingCart, Package, BarChart3, TrendingUp,
  ArrowRight, ClipboardList, Receipt, DollarSign, FileCheck,
  PieChart, Truck, CheckCircle, Search,
} from 'lucide-react';

export default function Dashboard() {
  const navigate = useNavigate();
  const { currentBranch } = useBranchContext();
  const { language } = useTranslation();

  // Document flow steps (like Minerva's arrow diagram)
  const documentFlow = useMemo(() => [
    { label: 'Proforma', icon: ClipboardList, path: '/proforma', color: 'bg-muted' },
    { label: 'Fatura De\nVenda', icon: FileText, path: '/invoices', color: 'bg-muted' },
    { label: 'Recibo', icon: Receipt, path: '/invoices', color: 'bg-muted' },
    { label: 'Pagamento', icon: DollarSign, path: '/expenses', color: 'bg-muted' },
    { label: 'Extracto', icon: FileCheck, path: '/reports', color: 'bg-muted' },
  ], []);

  // BI Sidebar items
  const biItems = useMemo(() => [
    { label: 'Balancete', icon: PieChart, path: '/reports', color: 'from-blue-600 to-blue-500' },
    { label: 'Faturas', icon: FileText, path: '/invoices', color: 'from-green-600 to-green-500' },
    { label: 'Vendas/\nLucro', icon: TrendingUp, path: '/reports', color: 'from-amber-600 to-amber-500' },
    { label: 'Compras', icon: Truck, path: '/purchase-orders', color: 'from-purple-600 to-purple-500' },
    { label: 'Charts', icon: BarChart3, path: '/reports', color: 'from-red-600 to-red-500' },
    { label: 'Stock', icon: Package, path: '/inventory', color: 'from-teal-600 to-teal-500' },
  ], []);

  // Quick action buttons (left side)
  const quickActions = useMemo(() => [
    { label: 'Verificar de\nFatura', icon: CheckCircle, path: '/fiscal-documents' },
    { label: 'Check\nProforma', icon: Search, path: '/proforma' },
  ], []);

  return (
    <div className="h-full flex">
      {/* ====== MAIN CONTENT ====== */}
      <div className="flex-1 p-4 flex flex-col relative overflow-hidden">
        {/* Smart ERP Branding */}
        <div className="absolute top-3 left-3 flex items-center gap-2">
          <span className="text-xl font-bold italic text-primary/60">Smart ERP</span>
        </div>

        {/* Document Flow Diagram */}
        <div className="mt-12 mb-6">
          <div className="flex items-center justify-center gap-2 flex-wrap">
            {documentFlow.map((step, idx) => (
              <div key={step.label} className="flex items-center gap-2">
                <Button
                  variant="outline"
                  className="h-14 px-5 text-xs font-semibold bg-gradient-to-b from-muted to-muted/60 border-border shadow-sm hover:shadow-md transition-all skew-x-[-5deg]"
                  onClick={() => navigate(step.path)}
                >
                  <span className="skew-x-[5deg] text-center whitespace-pre-line leading-tight">
                    {step.label}
                  </span>
                </Button>
                {idx < documentFlow.length - 1 && (
                  <ArrowRight className="w-5 h-5 text-destructive flex-shrink-0" />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions (left side) */}
        <div className="absolute left-4 top-1/3 flex flex-col gap-2">
          {quickActions.map((action) => (
            <Button
              key={action.label}
              variant="outline"
              className="h-14 w-32 text-xs font-medium bg-muted/60 hover:bg-muted transition-all text-left justify-start"
              onClick={() => navigate(action.path)}
            >
              <span className="whitespace-pre-line leading-tight">{action.label}</span>
            </Button>
          ))}
        </div>

        {/* Center area: SMART POS branding + illustrations */}
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-6xl font-black text-primary/20 tracking-wider">SMART POS</h1>
            <div className="mt-8 flex items-center justify-center gap-8">
              {/* Growth chart illustration */}
              <div className="flex items-end gap-1">
                {[20, 35, 28, 45, 55, 70].map((h, i) => (
                  <div
                    key={i}
                    className="w-5 bg-primary/30 rounded-t"
                    style={{ height: `${h}px` }}
                  />
                ))}
              </div>
              {/* POS Machine illustration */}
              <div className="w-24 h-24 bg-destructive/20 rounded-lg flex items-center justify-center">
                <ShoppingCart className="w-12 h-12 text-destructive/40" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ====== BI SIDEBAR (Right) ====== */}
      <div className="hidden lg:flex w-44 flex-col bg-[hsl(var(--card))] border-l">
        <div className="p-2 border-b">
          <h3 className="font-bold text-sm text-center">BI</h3>
        </div>
        <div className="flex-1 flex flex-col gap-1 p-1.5">
          {biItems.map((item) => (
            <Button
              key={item.label}
              variant="ghost"
              className={`h-16 flex items-center gap-2 justify-start px-3 bg-gradient-to-r ${item.color} text-white hover:opacity-90 rounded-md transition-all`}
              onClick={() => navigate(item.path)}
            >
              <item.icon className="w-6 h-6 flex-shrink-0" />
              <span className="text-sm font-bold whitespace-pre-line leading-tight text-left">
                {item.label}
              </span>
            </Button>
          ))}
        </div>

        {/* Bottom section */}
        <div className="p-2 border-t">
          <Button
            variant="outline"
            className="w-full h-12 text-xs font-semibold flex items-center gap-1"
            onClick={() => navigate('/chart-of-accounts')}
          >
            <FileCheck className="w-4 h-4" />
            <span className="whitespace-pre-line leading-tight text-left">GESTOR DE\nCONTAS / SAF-T</span>
          </Button>
        </div>
      </div>
    </div>
  );
}