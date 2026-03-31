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
import { CompanyLogo } from '@/components/layout/CompanyLogo';
import { NotificationBell } from '@/components/layout/NotificationBell';
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
        
        <CompanyLogo size="md" />
      </div>

      <div className="flex items-center gap-3">
        {/* PayrollAO-style Connection Status Indicator */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => checkStatus()}
                disabled={isChecking}
                className="flex items-center gap-1 px-3 py-1.5 rounded-md border bg-card text-xs font-medium"
              >
                {/* Database icon */}
                <Database className={`w-4 h-4 ${dbStatus.isConnected ? 'text-emerald-500' : 'text-muted-foreground'}`} />
                
                {/* Connection dot */}
                <span className={`w-1.5 h-1.5 rounded-full ${dbStatus.isConnected ? 'bg-emerald-500' : 'bg-muted-foreground'}`} />
                
                {/* Role icon and label */}
                {dbStatus.mode === 'client' ? (
                  <>
                    <Monitor className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Cliente</span>
                  </>
                ) : dbStatus.mode === 'server' ? (
                  <>
                    <Server className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Servidor</span>
                  </>
                ) : (
                  <>
                    <span className="text-muted-foreground">—</span>
                  </>
                )}
                
                {/* Separator */}
                <span className="text-muted-foreground mx-1">|</span>
                
                {/* Status */}
                {isChecking ? (
                  <RefreshCw className="w-4 h-4 animate-spin text-muted-foreground" />
                ) : dbStatus.isConnected ? (
                  <span className="text-emerald-600">Online</span>
                ) : (
                  <>
                    <svg className="w-4 h-4 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 010 12.728M5.636 18.364a9 9 0 010-12.728M15.536 8.464a5 5 0 010 7.072M8.464 15.536a5 5 0 010-7.072" />
                      <line x1="4" y1="4" x2="20" y2="20" strokeWidth={2} />
                    </svg>
                    <span className="text-orange-500">Offline</span>
                  </>
                )}
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
