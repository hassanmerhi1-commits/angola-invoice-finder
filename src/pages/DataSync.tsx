import { useState, useRef } from 'react';
import { useBranches, useDataSync, useAuth } from '@/hooks/useERP';
import { SyncPackage } from '@/types/erp';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Download, Upload, Mail, HardDrive, FileJson, CheckCircle, AlertCircle, Building } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';

export default function DataSync() {
  const { user } = useAuth();
  const { branches, currentBranch } = useBranches();
  const { exportData, importData, downloadSyncPackage, sendSyncPackageByEmail } = useDataSync();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [dateFrom, setDateFrom] = useState(new Date().toISOString().split('T')[0]);
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);
  const [selectedBranch, setSelectedBranch] = useState(currentBranch?.id || '');
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [syncPackage, setSyncPackage] = useState<SyncPackage | null>(null);
  const [importResult, setImportResult] = useState<{ salesImported: number; reportsImported: number } | null>(null);

  const isMainOffice = currentBranch?.isMain;

  const handleExport = () => {
    const branchId = isMainOffice ? selectedBranch : currentBranch?.id;
    if (!branchId) {
      toast({
        title: 'Erro',
        description: 'Selecione uma filial',
        variant: 'destructive',
      });
      return;
    }

    const pkg = exportData(branchId, dateFrom, dateTo);
    setSyncPackage(pkg);
    
    toast({
      title: 'Pacote preparado',
      description: `${pkg.sales.length} vendas e ${pkg.dailyReports.length} relatórios prontos para exportar`,
    });
  };

  const handleDownload = () => {
    if (syncPackage) {
      downloadSyncPackage(syncPackage);
      toast({
        title: 'Download iniciado',
        description: 'O ficheiro JSON foi descarregado',
      });
    }
  };

  const handleSendEmail = () => {
    if (syncPackage && email) {
      sendSyncPackageByEmail(syncPackage, email);
      toast({
        title: 'Email preparado',
        description: 'O seu cliente de email foi aberto com o ficheiro em anexo',
      });
      setEmailDialogOpen(false);
      setEmail('');
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const pkg = JSON.parse(content) as SyncPackage;
        
        // Validate package structure
        if (!pkg.id || !pkg.branchId || !pkg.sales) {
          throw new Error('Formato de ficheiro inválido');
        }

        const result = importData(pkg);
        setImportResult(result);
        
        toast({
          title: 'Importação concluída',
          description: `${result.salesImported} vendas e ${result.reportsImported} relatórios importados`,
        });
      } catch (error) {
        toast({
          title: 'Erro na importação',
          description: 'Ficheiro inválido ou corrompido',
          variant: 'destructive',
        });
      }
    };
    reader.readAsText(file);
    
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">Sincronização de Dados</h1>
          <p className="text-muted-foreground">Exportar e importar dados entre filiais e sede</p>
        </div>
      </div>

      {/* Info Alert */}
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Sistema Offline-First</AlertTitle>
        <AlertDescription>
          Cada filial trabalha com dados locais. No final do dia, exporte os dados e envie para a sede 
          via pen drive ou email. A sede pode então importar os dados de todas as filiais.
        </AlertDescription>
      </Alert>

      <Tabs defaultValue={isMainOffice ? 'import' : 'export'} className="space-y-4">
        <TabsList>
          <TabsTrigger value="export">
            <Download className="w-4 h-4 mr-2" />
            Exportar Dados
          </TabsTrigger>
          {isMainOffice && (
            <TabsTrigger value="import">
              <Upload className="w-4 h-4 mr-2" />
              Importar Dados
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="export" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Exportar Dados de Vendas</CardTitle>
              <CardDescription>
                Prepare um pacote de dados para enviar para a sede
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {isMainOffice && (
                  <div className="space-y-2">
                    <Label>Filial</Label>
                    <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a filial" />
                      </SelectTrigger>
                      <SelectContent>
                        {branches.map(branch => (
                          <SelectItem key={branch.id} value={branch.id}>
                            {branch.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="space-y-2">
                  <Label>Data Inicial</Label>
                  <Input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Data Final</Label>
                  <Input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                  />
                </div>
              </div>

              <Button onClick={handleExport}>
                <FileJson className="w-4 h-4 mr-2" />
                Preparar Pacote
              </Button>
            </CardContent>
          </Card>

          {syncPackage && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  Pacote Preparado
                </CardTitle>
                <CardDescription>
                  Pronto para download ou envio por email
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-muted p-4 rounded-lg">
                    <p className="text-sm text-muted-foreground">Filial</p>
                    <p className="font-medium">{syncPackage.branchName}</p>
                  </div>
                  <div className="bg-muted p-4 rounded-lg">
                    <p className="text-sm text-muted-foreground">Período</p>
                    <p className="font-medium">
                      {format(new Date(syncPackage.dateRange.from), 'dd/MM', { locale: pt })} - 
                      {format(new Date(syncPackage.dateRange.to), 'dd/MM', { locale: pt })}
                    </p>
                  </div>
                  <div className="bg-muted p-4 rounded-lg">
                    <p className="text-sm text-muted-foreground">Vendas</p>
                    <p className="font-medium">{syncPackage.sales.length}</p>
                  </div>
                  <div className="bg-muted p-4 rounded-lg">
                    <p className="text-sm text-muted-foreground">Relatórios</p>
                    <p className="font-medium">{syncPackage.dailyReports.length}</p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <Button onClick={handleDownload}>
                    <HardDrive className="w-4 h-4 mr-2" />
                    Descarregar (Pen Drive)
                  </Button>
                  <Button variant="outline" onClick={() => setEmailDialogOpen(true)}>
                    <Mail className="w-4 h-4 mr-2" />
                    Enviar por Email
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {isMainOffice && (
          <TabsContent value="import" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building className="w-5 h-5" />
                  Importar Dados das Filiais
                </CardTitle>
                <CardDescription>
                  Carregue os ficheiros JSON recebidos das filiais
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="border-2 border-dashed rounded-lg p-8 text-center">
                  <Upload className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-lg font-medium mb-2">Carregar Ficheiro de Sincronização</p>
                  <p className="text-sm text-muted-foreground mb-4">
                    Arraste e solte ou clique para selecionar o ficheiro JSON
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json"
                    onChange={handleFileSelect}
                    className="hidden"
                    id="file-upload"
                  />
                  <Button onClick={() => fileInputRef.current?.click()}>
                    <Upload className="w-4 h-4 mr-2" />
                    Selecionar Ficheiro
                  </Button>
                </div>

                {importResult && (
                  <Alert className="bg-green-50 border-green-200">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <AlertTitle className="text-green-800">Importação Concluída</AlertTitle>
                    <AlertDescription className="text-green-700">
                      Foram importadas {importResult.salesImported} vendas e {importResult.reportsImported} relatórios diários.
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>

            {/* Import Instructions */}
            <Card>
              <CardHeader>
                <CardTitle>Instruções de Importação</CardTitle>
              </CardHeader>
              <CardContent>
                <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
                  <li>Receba o ficheiro JSON da filial (via pen drive ou email)</li>
                  <li>Clique em "Selecionar Ficheiro" e escolha o ficheiro recebido</li>
                  <li>O sistema irá validar e importar os dados automaticamente</li>
                  <li>Vendas duplicadas serão ignoradas (baseado no ID)</li>
                  <li>Os relatórios diários serão consolidados</li>
                </ol>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      {/* Email Dialog */}
      <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enviar por Email</DialogTitle>
            <DialogDescription>
              O ficheiro será descarregado e o seu cliente de email será aberto
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email da Sede</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="sede@kwanzaerp.ao"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEmailDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSendEmail} disabled={!email}>
              <Mail className="w-4 h-4 mr-2" />
              Enviar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
