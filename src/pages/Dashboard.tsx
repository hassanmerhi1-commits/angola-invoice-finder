import { useEffect, useMemo, useState } from 'react';
import { useBranchContext } from '@/contexts/BranchContext';
import { useTranslation } from '@/i18n';
import { Button } from '@/components/ui/button';
import {
  ShoppingCart,
  Package,
  FileText,
  Users,
  MapPin,
  Camera,
  BarChart3,
  Truck,
} from 'lucide-react';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { useDailyWallpaper } from '@/hooks/useDailyWallpaper';
import { useNavigate } from 'react-router-dom';

export default function Dashboard() {
  const { language } = useTranslation();
  const { currentBranch } = useBranchContext();
  const wallpaper = useDailyWallpaper();
  const navigate = useNavigate();

  const [now, setNow] = useState(() => new Date());
  const dateLocale = language === 'pt' ? pt : undefined;

  useEffect(() => {
    console.log('[Dashboard] minimal-home mounted');
    const id = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const quickActions = useMemo(
    () => [
      {
        icon: ShoppingCart,
        label: language === 'pt' ? 'Ponto de Venda' : 'Point of Sale',
        path: '/pos',
      },
      {
        icon: FileText,
        label: language === 'pt' ? 'Facturas' : 'Invoices',
        path: '/invoices',
      },
      {
        icon: Package,
        label: language === 'pt' ? 'Inventário' : 'Inventory',
        path: '/inventory',
      },
      {
        icon: Users,
        label: language === 'pt' ? 'Clientes' : 'Clients',
        path: '/clients',
      },
      {
        icon: Truck,
        label: language === 'pt' ? 'Fornecedores' : 'Suppliers',
        path: '/suppliers',
      },
      {
        icon: BarChart3,
        label: language === 'pt' ? 'Relatórios' : 'Reports',
        path: '/reports',
      },
    ],
    [language]
  );

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Background Wallpaper */}
      <div
        className="fixed inset-0 bg-cover bg-center bg-no-repeat transition-all duration-1000 scale-105"
        style={{ backgroundImage: `url(${wallpaper.image})` }}
      />

      {/* Overlay for readability (keeps wallpaper visible) */}
      <div className="fixed inset-0 bg-gradient-to-t from-background/70 via-transparent to-background/30" />

      {/* Content */}
      <div className="relative flex flex-col min-h-screen p-6">
        {/* Top row */}
        <div className="flex items-start justify-between gap-4">
          {/* Date & Time */}
          <div className="backdrop-blur-md bg-card/35 rounded-2xl px-6 py-4 border border-border/40 shadow-2xl">
            <div className="text-5xl font-bold text-foreground tracking-tight">
              {format(now, 'HH:mm')}
            </div>
            <div className="text-lg text-foreground/80 mt-1 capitalize">
              {format(now, "EEEE, dd 'de' MMMM", { locale: dateLocale })}
            </div>
            {currentBranch && (
              <div className="flex items-center gap-2 mt-2 text-sm text-foreground/60">
                <MapPin className="h-3.5 w-3.5" />
                {currentBranch.name}
              </div>
            )}
          </div>

          {/* Wallpaper Info */}
          <div className="backdrop-blur-md bg-card/35 rounded-2xl px-4 py-3 border border-border/40 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-primary/15">
                <Camera className="h-5 w-5 text-primary" />
              </div>
              <div>
                <div className="font-semibold text-foreground">{wallpaper.name}</div>
                <div className="flex items-center gap-1 text-sm text-foreground/60">
                  <MapPin className="h-3 w-3" />
                  {wallpaper.location}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1" />

        {/* Quick Actions */}
        <div className="backdrop-blur-md bg-card/35 rounded-3xl p-6 border border-border/40 shadow-2xl">
          <div className="text-sm font-medium text-foreground/60 mb-4 uppercase tracking-wider">
            {language === 'pt' ? 'Acesso Rápido' : 'Quick Access'}
          </div>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
            {quickActions.map((action) => (
              <Button
                key={action.path}
                variant="ghost"
                className="h-auto flex-col gap-3 py-5 px-4 rounded-2xl bg-card/45 hover:bg-card/70 border border-border/30 hover:border-border/60 transition-all duration-300 hover:scale-[1.03] hover:shadow-xl group"
                onClick={() => navigate(action.path)}
              >
                <div className="p-3 rounded-xl bg-gradient-to-br from-primary to-primary/70 shadow-lg group-hover:shadow-xl transition-shadow">
                  <action.icon className="h-6 w-6 text-primary-foreground" />
                </div>
                <span className="text-xs font-medium text-foreground/80 group-hover:text-foreground text-center leading-tight">
                  {action.label}
                </span>
              </Button>
            ))}
          </div>
        </div>

        {/* Description */}
        <div className="text-center mt-4 text-xs text-foreground/40">{wallpaper.description}</div>
      </div>
    </div>
  );
}
