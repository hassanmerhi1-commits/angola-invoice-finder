import { useBranches } from '@/hooks/useERP';
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
  Calculator,
} from 'lucide-react';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { useDailyWallpaper } from '@/hooks/useDailyWallpaper';
import { useNavigate } from 'react-router-dom';

export default function Dashboard() {
  const { t, language } = useTranslation();
  const { currentBranch } = useBranches();
  const wallpaper = useDailyWallpaper();
  const navigate = useNavigate();

  const dateLocale = language === 'pt' ? pt : undefined;
  const now = new Date();

  const quickActions = [
    { 
      icon: ShoppingCart, 
      label: language === 'pt' ? 'Ponto de Venda' : 'Point of Sale',
      path: '/pos',
      gradient: 'from-emerald-500 to-green-600'
    },
    { 
      icon: FileText, 
      label: language === 'pt' ? 'Facturas' : 'Invoices',
      path: '/invoices',
      gradient: 'from-blue-500 to-indigo-600'
    },
    { 
      icon: Package, 
      label: language === 'pt' ? 'Inventário' : 'Inventory',
      path: '/inventory',
      gradient: 'from-orange-500 to-amber-600'
    },
    { 
      icon: Users, 
      label: language === 'pt' ? 'Clientes' : 'Clients',
      path: '/clients',
      gradient: 'from-purple-500 to-violet-600'
    },
    { 
      icon: Truck, 
      label: language === 'pt' ? 'Fornecedores' : 'Suppliers',
      path: '/suppliers',
      gradient: 'from-rose-500 to-pink-600'
    },
    { 
      icon: BarChart3, 
      label: language === 'pt' ? 'Relatórios' : 'Reports',
      path: '/reports',
      gradient: 'from-cyan-500 to-teal-600'
    },
  ];

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Background Wallpaper - Full visibility */}
      <div 
        className="fixed inset-0 bg-cover bg-center bg-no-repeat transition-all duration-1000 scale-105"
        style={{ backgroundImage: `url(${wallpaper.image})` }}
      />
      
      {/* Subtle gradient overlay - less opacity to show wallpaper */}
      <div className="fixed inset-0 bg-gradient-to-t from-background/70 via-transparent to-background/30" />
      
      {/* Content */}
      <div className="relative flex flex-col min-h-screen p-6">
        
        {/* Top Section - Date & Branch */}
        <div className="flex items-start justify-between">
          {/* Date & Time */}
          <div className="backdrop-blur-md bg-background/40 rounded-2xl px-6 py-4 border border-white/10 shadow-2xl">
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

          {/* Wallpaper Info Badge */}
          <div className="backdrop-blur-md bg-background/40 rounded-2xl px-4 py-3 border border-white/10 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-primary/20">
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

        {/* Spacer to push quick actions to bottom */}
        <div className="flex-1" />

        {/* Bottom Section - Quick Actions */}
        <div className="backdrop-blur-md bg-background/40 rounded-3xl p-6 border border-white/10 shadow-2xl">
          <div className="text-sm font-medium text-foreground/60 mb-4 uppercase tracking-wider">
            {language === 'pt' ? 'Acesso Rápido' : 'Quick Access'}
          </div>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
            {quickActions.map((action) => (
              <Button
                key={action.path}
                variant="ghost"
                className="h-auto flex-col gap-3 py-5 px-4 rounded-2xl bg-background/50 hover:bg-background/80 border border-white/5 hover:border-white/20 transition-all duration-300 hover:scale-105 hover:shadow-xl group"
                onClick={() => navigate(action.path)}
              >
                <div className={`p-3 rounded-xl bg-gradient-to-br ${action.gradient} shadow-lg group-hover:shadow-xl transition-shadow`}>
                  <action.icon className="h-6 w-6 text-white" />
                </div>
                <span className="text-xs font-medium text-foreground/80 group-hover:text-foreground text-center leading-tight">
                  {action.label}
                </span>
              </Button>
            ))}
          </div>
        </div>

        {/* Wallpaper description - subtle at the very bottom */}
        <div className="text-center mt-4 text-xs text-foreground/40">
          {wallpaper.description}
        </div>
      </div>
    </div>
  );
}
