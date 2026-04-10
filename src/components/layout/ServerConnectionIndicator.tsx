import { useState, useEffect, useCallback } from 'react';
import { getApiUrl } from '@/lib/api/config';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Database, Server, RefreshCw, CheckCircle2, XCircle, Container } from 'lucide-react';
import { cn } from '@/lib/utils';

interface HealthData {
  status: string;
  serverName: string;
  version: string;
  connectedClients: number;
  database: {
    connected: boolean;
    latency: number | null;
    version: string | null;
    database: string | null;
    serverAddr: string | null;
    serverPort: number | null;
    serverTime: string | null;
  };
  system: {
    hostname: string;
    platform: string;
    uptime: number;
    nodeVersion: string;
  };
}

export function ServerConnectionIndicator() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [backendReachable, setBackendReachable] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const checkHealth = useCallback(async () => {
    setIsChecking(true);
    try {
      const apiUrl = getApiUrl();
      const parsedUrl = (() => {
        try { return new URL(apiUrl); } catch { return new URL(`http://${apiUrl.replace(/^https?:\/\//, '')}`); }
      })();

      const response = await fetch(`${parsedUrl.origin}/api/health`, {
        signal: AbortSignal.timeout(5000),
      });

      if (response.ok) {
        const data = await response.json();
        setHealth(data);
        setBackendReachable(true);
      } else {
        setBackendReachable(false);
        setHealth(null);
      }
    } catch {
      setBackendReachable(false);
      setHealth(null);
    } finally {
      setIsChecking(false);
      setLastChecked(new Date());
    }
  }, []);

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 15000);
    return () => clearInterval(interval);
  }, [checkHealth]);

  const dbConnected = health?.database?.connected ?? false;
  const allGood = backendReachable && dbConnected;

  const formatUptime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={checkHealth}
            disabled={isChecking}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-xs font-medium transition-all",
              allGood
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                : backendReachable
                  ? "border-orange-500/30 bg-orange-500/10 text-orange-700 dark:text-orange-400"
                  : "border-destructive/30 bg-destructive/10 text-destructive"
            )}
          >
            {isChecking ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <>
                {/* Docker/Container icon */}
                <Container className={cn("w-3.5 h-3.5", allGood ? "text-emerald-500" : backendReachable ? "text-orange-500" : "text-destructive")} />
                
                {/* Status dot */}
                <span className={cn(
                  "w-1.5 h-1.5 rounded-full",
                  allGood ? "bg-emerald-500 animate-pulse" : backendReachable ? "bg-orange-500" : "bg-destructive"
                )} />

                {/* DB icon */}
                <Database className={cn("w-3.5 h-3.5", dbConnected ? "text-emerald-500" : "text-destructive")} />
              </>
            )}

            <span className="hidden sm:inline">
              {isChecking ? 'A verificar...' : allGood ? 'Conectado' : backendReachable ? 'DB Offline' : 'Desconectado'}
            </span>

            {health?.database?.latency != null && (
              <span className="text-[10px] opacity-70">{health.database.latency}ms</span>
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-sm p-0 overflow-hidden">
          <div className="p-3 space-y-3">
            {/* Header */}
            <div className="flex items-center gap-2">
              <Server className="w-4 h-4" />
              <span className="font-semibold text-sm">Estado da Conexão</span>
            </div>

            {/* Backend Status */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5">
                  <Server className="w-3 h-3" />
                  Servidor (Backend)
                </span>
                {backendReachable ? (
                  <Badge variant="outline" className="text-[10px] border-emerald-500/50 text-emerald-600">
                    <CheckCircle2 className="w-3 h-3 mr-1" /> Online
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px] border-destructive/50 text-destructive">
                    <XCircle className="w-3 h-3 mr-1" /> Offline
                  </Badge>
                )}
              </div>

              {/* Docker/PostgreSQL Status */}
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5">
                  <Container className="w-3 h-3" />
                  Docker → PostgreSQL
                </span>
                {dbConnected ? (
                  <Badge variant="outline" className="text-[10px] border-emerald-500/50 text-emerald-600">
                    <CheckCircle2 className="w-3 h-3 mr-1" /> Conectado
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px] border-destructive/50 text-destructive">
                    <XCircle className="w-3 h-3 mr-1" /> Desconectado
                  </Badge>
                )}
              </div>
            </div>

            {/* Details when connected */}
            {health && (
              <div className="border-t pt-2 space-y-1 text-[11px] text-muted-foreground">
                {health.database.database && (
                  <p><strong>Base de dados:</strong> {health.database.database}</p>
                )}
                {health.database.serverAddr && (
                  <p><strong>PostgreSQL:</strong> {health.database.serverAddr}:{health.database.serverPort}</p>
                )}
                {health.database.latency != null && (
                  <p><strong>Latência:</strong> {health.database.latency}ms</p>
                )}
                {health.system && (
                  <>
                    <p><strong>Host:</strong> {health.system.hostname} ({health.system.platform})</p>
                    <p><strong>Uptime:</strong> {formatUptime(health.system.uptime)}</p>
                  </>
                )}
                <p><strong>Clientes conectados:</strong> {health.connectedClients}</p>
              </div>
            )}

            {!backendReachable && (
              <div className="border-t pt-2 text-[11px] text-muted-foreground space-y-1">
                <p className="font-medium text-destructive">Servidor não acessível</p>
                <p>Verifique se o Docker Desktop está a correr e o container está ativo.</p>
                <p className="font-mono text-[10px] bg-muted p-1 rounded">docker compose up -d</p>
              </div>
            )}

            {backendReachable && !dbConnected && (
              <div className="border-t pt-2 text-[11px] text-muted-foreground space-y-1">
                <p className="font-medium text-orange-600">Backend online mas PostgreSQL inacessível</p>
                <p>Verifique se o container PostgreSQL está ativo no Docker Desktop.</p>
              </div>
            )}

            {lastChecked && (
              <p className="text-[10px] text-muted-foreground/60 pt-1">
                Última verificação: {lastChecked.toLocaleTimeString()} · Clique para atualizar
              </p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
