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
import { Building2, User as UserIcon, LogOut, Settings, Menu, Database, Server, Monitor, RefreshCw } from 'lucide-react';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { useTranslation } from '@/i18n';
import { useDatabaseStatus } from '@/hooks/useDatabaseStatus';

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
  const { status: dbStatus, isChecking, checkStatus } = useDatabaseStatus();
  
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
        {/* Database Connection Status Indicator */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => checkStatus()}
                disabled={isChecking}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all hover:shadow-sm ${
                  dbStatus.isConnected
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                    : dbStatus.mode === 'unknown'
                    ? 'bg-muted border-border text-muted-foreground'
                    : 'bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400'
                }`}
              >
                {isChecking ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : dbStatus.mode === 'server' ? (
                  <Server className="w-4 h-4" />
                ) : dbStatus.mode === 'client' ? (
                  <Monitor className="w-4 h-4" />
                ) : (
                  <Database className="w-4 h-4" />
                )}
                <span className="text-xs font-medium hidden md:inline">
                  {dbStatus.mode === 'server' 
                    ? (dbStatus.isConnected ? 'Servidor' : 'DB Offline')
                    : dbStatus.mode === 'client'
                    ? (dbStatus.isConnected ? 'Conectado' : 'Desconectado')
                    : 'Não configurado'
                  }
                </span>
                <span className={`w-2 h-2 rounded-full ${
                  dbStatus.isConnected
                    ? 'bg-emerald-500'
                    : dbStatus.mode === 'unknown'
                    ? 'bg-muted-foreground'
                    : 'bg-red-500 animate-pulse'
                }`} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-xs p-3">
              <div className="space-y-2">
                <div className="flex items-center gap-2 font-medium">
                  {dbStatus.mode === 'server' ? (
                    <>
                      <Server className="w-4 h-4" />
                      <span>Modo Servidor</span>
                    </>
                  ) : dbStatus.mode === 'client' ? (
                    <>
                      <Monitor className="w-4 h-4" />
                      <span>Modo Cliente</span>
                    </>
                  ) : (
                    <>
                      <Database className="w-4 h-4" />
                      <span>Não Configurado</span>
                    </>
                  )}
                </div>
                {dbStatus.mode === 'server' && (
                  <div className="text-xs space-y-1">
                    <p><strong>Status:</strong> {dbStatus.isConnected ? 'Base de dados ativa' : 'Base de dados offline'}</p>
                    {dbStatus.databasePath && (
                      <p className="text-muted-foreground truncate"><strong>Path:</strong> {dbStatus.databasePath}</p>
                    )}
                    {dbStatus.serverIp && (
                      <p><strong>IP:</strong> {dbStatus.serverIp}:{dbStatus.serverPort}</p>
                    )}
                  </div>
                )}
                {dbStatus.mode === 'client' && (
                  <div className="text-xs space-y-1">
                    <p><strong>Status:</strong> {dbStatus.isConnected ? 'Conectado ao servidor' : 'Servidor não acessível'}</p>
                    {dbStatus.serverIp && (
                      <p><strong>Servidor:</strong> {dbStatus.serverIp}:{dbStatus.serverPort}</p>
                    )}
                  </div>
                )}
                {dbStatus.mode === 'unknown' && (
                  <p className="text-xs text-muted-foreground">
                    Execute a configuração inicial para configurar o sistema.
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  Clique para verificar conexão
                </p>
              </div>
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
