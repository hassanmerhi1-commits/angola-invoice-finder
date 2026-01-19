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
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Building2, User as UserIcon, LogOut, Settings, Menu, Wifi, WifiOff, Database } from 'lucide-react';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { useTranslation } from '@/i18n';
import { useRealtimeStatus } from '@/lib/realtime/store';

interface HeaderProps {
  user: User | null;
  branches: Branch[];
  currentBranch: Branch | null;
  onBranchChange: (branch: Branch) => void;
  onLogout: () => void;
  onMenuClick?: () => void;
}

export function Header({
  user,
  branches,
  currentBranch,
  onBranchChange,
  onLogout,
  onMenuClick,
}: HeaderProps) {
  const { t } = useTranslation();
  const { isConnected, mode } = useRealtimeStatus();
  
  return (
    <header className="h-16 border-b bg-card px-4 flex items-center justify-between">
      <div className="flex items-center gap-4">
        {onMenuClick && (
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={onMenuClick}>
            <Menu className="w-5 h-5" />
          </Button>
        )}
        
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-lg">K</span>
          </div>
          <div className="hidden sm:block">
            <h1 className="font-bold text-lg leading-none">Kwanza ERP</h1>
            <p className="text-xs text-muted-foreground">Management System</p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Connection Status Indicator */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-colors ${
                mode === 'realtime' && isConnected
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                  : mode === 'realtime' && !isConnected
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400'
                  : 'bg-muted border-border text-muted-foreground'
              }`}>
                {mode === 'realtime' ? (
                  isConnected ? (
                    <Wifi className="w-4 h-4" />
                  ) : (
                    <WifiOff className="w-4 h-4 animate-pulse" />
                  )
                ) : (
                  <Database className="w-4 h-4" />
                )}
                <span className="text-xs font-medium hidden md:inline">
                  {mode === 'realtime' 
                    ? (isConnected ? 'Conectado' : 'Reconectando...')
                    : 'Modo Local'
                  }
                </span>
                <span className={`w-2 h-2 rounded-full ${
                  mode === 'realtime' && isConnected
                    ? 'bg-emerald-500 animate-pulse'
                    : mode === 'realtime' && !isConnected
                    ? 'bg-amber-500 animate-ping'
                    : 'bg-muted-foreground'
                }`} />
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-xs">
              {mode === 'realtime' ? (
                isConnected ? (
                  <p>Conectado ao servidor em tempo real. Todas as alterações são sincronizadas instantaneamente.</p>
                ) : (
                  <p>Tentando reconectar ao servidor... As alterações serão sincronizadas quando a conexão for restabelecida.</p>
                )
              ) : (
                <p>Modo local ativo. Configure o IP do servidor nas Configurações para habilitar sincronização em rede.</p>
              )}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* Language Switcher */}
        <LanguageSwitcher />
        {/* Branch Selector */}
        <Select
          value={currentBranch?.id}
          onValueChange={(id) => {
            const branch = branches.find(b => b.id === id);
            if (branch) onBranchChange(branch);
          }}
        >
          <SelectTrigger className="w-[180px] hidden sm:flex">
            <Building2 className="w-4 h-4 mr-2" />
            <SelectValue placeholder={t.nav.dashboard} />
          </SelectTrigger>
          <SelectContent>
            {branches.map(branch => (
              <SelectItem key={branch.id} value={branch.id}>
                <div className="flex items-center gap-2">
                  <span>{branch.name}</span>
                  {branch.isMain && (
                    <Badge variant="secondary" className="text-[10px]">Sede</Badge>
                  )}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="gap-2">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <UserIcon className="w-4 h-4 text-primary" />
              </div>
              <span className="hidden sm:inline">{user?.name}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div>
                <p className="font-medium">{user?.name}</p>
                <p className="text-xs text-muted-foreground">{user?.email}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <Settings className="w-4 h-4 mr-2" />
              {t.nav.settings}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onLogout} className="text-destructive">
              <LogOut className="w-4 h-4 mr-2" />
              {t.nav.logout}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
