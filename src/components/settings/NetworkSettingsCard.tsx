import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { 
  Network, 
  Wifi, 
  WifiOff, 
  CheckCircle2, 
  XCircle, 
  Loader2,
  Server,
  Globe,
  RefreshCw
} from 'lucide-react';
import { getApiUrl, setApiUrl, isLocalNetworkMode, setForceApiMode } from '@/lib/api/config';
import { toast } from 'sonner';

interface ConnectionTestResult {
  success: boolean;
  latency?: number;
  serverInfo?: {
    status: string;
    timestamp: string;
  };
  error?: string;
}

export function NetworkSettingsCard() {
  const [serverUrl, setServerUrl] = useState('');
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<ConnectionTestResult | null>(null);
  const [isNetworkMode, setIsNetworkMode] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    const currentUrl = getApiUrl();
    setServerUrl(currentUrl);
    setIsNetworkMode(isLocalNetworkMode());
  }, []);

  const handleUrlChange = (value: string) => {
    setServerUrl(value);
    setHasChanges(true);
    setTestResult(null);
  };

  const testConnection = async () => {
    if (!serverUrl) {
      toast.error('Por favor, insira o endereço do servidor');
      return;
    }

    setIsTestingConnection(true);
    setTestResult(null);

    const startTime = Date.now();

    try {
      // Normalize URL
      let url = serverUrl.trim();
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'http://' + url;
      }
      
      // Remove trailing slash
      url = url.replace(/\/$/, '');

      const response = await fetch(`${url}/api/health`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(5000), // 5 second timeout
      });

      const latency = Date.now() - startTime;

      if (response.ok) {
        const data = await response.json();
        setTestResult({
          success: true,
          latency,
          serverInfo: data,
        });
        toast.success(`Conexão bem-sucedida! Latência: ${latency}ms`);
      } else {
        setTestResult({
          success: false,
          error: `Servidor respondeu com erro: ${response.status}`,
        });
        toast.error('Falha na conexão com o servidor');
      }
    } catch (error: any) {
      const latency = Date.now() - startTime;
      let errorMessage = 'Não foi possível conectar ao servidor';
      
      if (error.name === 'TimeoutError' || error.name === 'AbortError') {
        errorMessage = 'Tempo limite de conexão excedido (5s)';
      } else if (error.message?.includes('Failed to fetch')) {
        errorMessage = 'Servidor não encontrado ou inacessível';
      }

      setTestResult({
        success: false,
        latency,
        error: errorMessage,
      });
      toast.error(errorMessage);
    } finally {
      setIsTestingConnection(false);
    }
  };

  const saveSettings = () => {
    if (!testResult?.success) {
      toast.error('Por favor, teste a conexão antes de salvar');
      return;
    }

    // Normalize URL before saving
    let url = serverUrl.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'http://' + url;
    }
    url = url.replace(/\/$/, '');

    setApiUrl(url);
    // Page will reload automatically
  };

  const toggleNetworkMode = (enabled: boolean) => {
    setForceApiMode(enabled);
    // Page will reload automatically
  };

  const resetToDefault = () => {
    setServerUrl('http://localhost:3000');
    setHasChanges(true);
    setTestResult(null);
    toast.info('Endereço resetado para padrão. Teste a conexão e salve.');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Network className="w-5 h-5" />
          Configurações de Rede
        </CardTitle>
        <CardDescription>
          Configure a conexão com o servidor central para sincronização em tempo real
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Current Mode */}
        <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
          <div className="flex items-center gap-3">
            {isNetworkMode ? (
              <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
                <Server className="w-5 h-5 text-emerald-600" />
              </div>
            ) : (
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                <Globe className="w-5 h-5 text-muted-foreground" />
              </div>
            )}
            <div>
              <p className="font-medium">
                {isNetworkMode ? 'Modo Rede' : 'Modo Local'}
              </p>
              <p className="text-sm text-muted-foreground">
                {isNetworkMode 
                  ? 'Conectado ao servidor central' 
                  : 'Usando armazenamento local (demo)'
                }
              </p>
            </div>
          </div>
          <Badge variant={isNetworkMode ? 'default' : 'secondary'}>
            {isNetworkMode ? 'Ativo' : 'Offline'}
          </Badge>
        </div>

        <Separator />

        {/* Server URL Input */}
        <div className="space-y-3">
          <Label htmlFor="server-url">Endereço do Servidor</Label>
          <div className="flex gap-2">
            <Input
              id="server-url"
              placeholder="http://192.168.1.50:3000"
              value={serverUrl}
              onChange={(e) => handleUrlChange(e.target.value)}
              className="flex-1"
            />
            <Button
              variant="outline"
              size="icon"
              onClick={resetToDefault}
              title="Resetar para padrão"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Insira o IP do servidor principal (ex: http://192.168.1.50:3000)
          </p>
        </div>

        {/* Test Connection Button */}
        <Button
          variant="outline"
          onClick={testConnection}
          disabled={isTestingConnection || !serverUrl}
          className="w-full gap-2"
        >
          {isTestingConnection ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Testando conexão...
            </>
          ) : (
            <>
              <Wifi className="w-4 h-4" />
              Testar Conexão
            </>
          )}
        </Button>

        {/* Test Result */}
        {testResult && (
          <div className={`p-4 rounded-lg border ${
            testResult.success 
              ? 'bg-emerald-500/10 border-emerald-500/30' 
              : 'bg-destructive/10 border-destructive/30'
          }`}>
            <div className="flex items-start gap-3">
              {testResult.success ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5" />
              ) : (
                <XCircle className="w-5 h-5 text-destructive mt-0.5" />
              )}
              <div className="flex-1 space-y-1">
                <p className={`font-medium ${
                  testResult.success ? 'text-emerald-600' : 'text-destructive'
                }`}>
                  {testResult.success ? 'Conexão bem-sucedida!' : 'Falha na conexão'}
                </p>
                {testResult.success ? (
                  <div className="text-sm text-muted-foreground space-y-1">
                    <p>Latência: {testResult.latency}ms</p>
                    {testResult.serverInfo && (
                      <p>Servidor: {testResult.serverInfo.status}</p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-destructive/80">
                    {testResult.error}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        <Separator />

        {/* Save Button */}
        <Button
          onClick={saveSettings}
          disabled={!testResult?.success || !hasChanges}
          className="w-full gap-2"
        >
          {testResult?.success && hasChanges ? (
            <>
              <CheckCircle2 className="w-4 h-4" />
              Salvar e Conectar
            </>
          ) : (
            <>
              <WifiOff className="w-4 h-4" />
              Teste a conexão primeiro
            </>
          )}
        </Button>

        {/* Force API Mode Toggle (for development) */}
        <div className="pt-4 border-t">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Forçar Modo API</p>
              <p className="text-xs text-muted-foreground">
                Usar API mesmo em localhost (para testes)
              </p>
            </div>
            <Switch
              checked={isNetworkMode}
              onCheckedChange={toggleNetworkMode}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
