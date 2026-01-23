import { useState, useEffect } from 'react';
import { useTranslation } from '@/i18n';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { 
  Settings as SettingsIcon, 
  RefreshCw, 
  Download, 
  CheckCircle2, 
  AlertCircle,
  Monitor,
  Info,
  Loader2
} from 'lucide-react';
import { CompanySettingsDialog } from '@/components/settings/CompanySettingsDialog';
import { NetworkSettingsCard } from '@/components/settings/NetworkSettingsCard';
import { HotUpdateSettingsCard } from '@/components/settings/HotUpdateSettingsCard';
import type { UpdateStatus } from '@/types/electron';

export default function Settings() {
  const { t } = useTranslation();
  const [appVersion, setAppVersion] = useState<string>('');
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [companySettingsOpen, setCompanySettingsOpen] = useState(false);
  
  const isElectron = !!window.electronAPI?.isElectron;

  useEffect(() => {
    // Get app version on mount
    if (isElectron) {
      // In Electron, IPC returns { version: string } from app:version.
      // Defensive parsing avoids crashing React by rendering an object.
      window.electronAPI?.updater.getVersion().then((v: any) => {
        const version = typeof v === 'string' ? v : v?.version;
        setAppVersion(typeof version === 'string' ? version : '');
      });
      
      // Listen for update status changes
      const unsubscribe = window.electronAPI?.updater.onUpdateStatus((data) => {
        setUpdateStatus(data);
        
        if (data.status === 'checking') {
          setIsChecking(true);
        } else {
          setIsChecking(false);
        }
        
        if (data.status === 'downloading') {
          setIsDownloading(true);
        } else if (data.status === 'downloaded' || data.status === 'error') {
          setIsDownloading(false);
        }
      });
      
      return () => unsubscribe?.();
    }
  }, [isElectron]);

  const handleCheckForUpdates = async () => {
    if (!isElectron) return;
    
    setIsChecking(true);
    setUpdateStatus(null);
    
    try {
      await window.electronAPI?.updater.checkForUpdates();
    } catch (error) {
      setUpdateStatus({ status: 'error', error: 'Failed to check for updates' });
      setIsChecking(false);
    }
  };

  const handleDownloadUpdate = async () => {
    if (!isElectron) return;
    
    setIsDownloading(true);
    try {
      await window.electronAPI?.updater.downloadUpdate();
    } catch (error) {
      setUpdateStatus({ status: 'error', error: 'Failed to download update' });
      setIsDownloading(false);
    }
  };

  const handleInstallUpdate = async () => {
    if (!isElectron) return;
    await window.electronAPI?.updater.installUpdate();
  };

  const getStatusBadge = () => {
    if (!updateStatus) return null;
    
    switch (updateStatus.status) {
      case 'checking':
        return <Badge variant="secondary" className="gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Checking...</Badge>;
      case 'available':
        return <Badge variant="default" className="gap-1 bg-primary"><Download className="w-3 h-3" /> Update Available: v{updateStatus.version}</Badge>;
      case 'not-available':
        return <Badge variant="outline" className="gap-1 text-green-600 border-green-600"><CheckCircle2 className="w-3 h-3" /> Up to date</Badge>;
      case 'downloading':
        return <Badge variant="secondary" className="gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Downloading...</Badge>;
      case 'downloaded':
        return <Badge variant="default" className="gap-1 bg-green-600"><CheckCircle2 className="w-3 h-3" /> Ready to Install</Badge>;
      case 'error':
        return <Badge variant="destructive" className="gap-1"><AlertCircle className="w-3 h-3" /> Error</Badge>;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t.nav.settings}</h1>
          <p className="text-muted-foreground">
            Manage application settings and preferences
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Application Info Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="w-5 h-5" />
              Application Information
            </CardTitle>
            <CardDescription>
              Version details and system information
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Application</span>
              <span className="font-medium">Kwanza ERP</span>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Developer</span>
              <span className="font-medium">Hassan Merhi</span>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Version</span>
              <Badge variant="outline">{appVersion || 'Web Version'}</Badge>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Platform</span>
              <div className="flex items-center gap-2">
                <Monitor className="w-4 h-4" />
                <span className="font-medium capitalize">
                  {isElectron ? window.electronAPI?.platform : 'Web Browser'}
                </span>
              </div>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Environment</span>
              <Badge variant={isElectron ? 'default' : 'secondary'}>
                {isElectron ? 'Desktop App' : 'Web App'}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Updates Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="w-5 h-5" />
              Software Updates
            </CardTitle>
            <CardDescription>
              Check for and install application updates
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!isElectron ? (
              <div className="p-4 rounded-lg bg-muted/50 text-center">
                <p className="text-sm text-muted-foreground">
                  Auto-updates are only available in the desktop application.
                </p>
              </div>
            ) : (
              <>
                {/* Update Status */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Status</span>
                  {getStatusBadge() || <Badge variant="outline">Not checked</Badge>}
                </div>

                {/* Download Progress */}
                {updateStatus?.status === 'downloading' && updateStatus.progress !== undefined && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>Downloading update...</span>
                      <span>{Math.round(updateStatus.progress)}%</span>
                    </div>
                    <Progress value={updateStatus.progress} className="h-2" />
                  </div>
                )}

                {/* Error Message */}
                {updateStatus?.status === 'error' && updateStatus.error && (
                  <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                    {updateStatus.error}
                  </div>
                )}

                <Separator />

                {/* Action Buttons */}
                <div className="flex flex-col gap-2">
                  {updateStatus?.status === 'downloaded' ? (
                    <Button onClick={handleInstallUpdate} className="w-full gap-2">
                      <Download className="w-4 h-4" />
                      Install Update & Restart
                    </Button>
                  ) : updateStatus?.status === 'available' ? (
                    <Button 
                      onClick={handleDownloadUpdate} 
                      disabled={isDownloading}
                      className="w-full gap-2"
                    >
                      {isDownloading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Download className="w-4 h-4" />
                      )}
                      Download Update
                    </Button>
                  ) : (
                    <Button 
                      onClick={handleCheckForUpdates} 
                      disabled={isChecking}
                      variant="outline"
                      className="w-full gap-2"
                    >
                      {isChecking ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <RefreshCw className="w-4 h-4" />
                      )}
                      Check for Updates
                    </Button>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Company Settings Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <SettingsIcon className="w-5 h-5" />
              Company Settings
            </CardTitle>
            <CardDescription>
              Configure company information for invoices and documents
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={() => setCompanySettingsOpen(true)}>
              <SettingsIcon className="w-4 h-4 mr-2" />
              Open Company Settings
            </Button>
            <CompanySettingsDialog 
              open={companySettingsOpen} 
              onOpenChange={setCompanySettingsOpen} 
            />
          </CardContent>
        </Card>

        {/* Network Settings Card */}
        <NetworkSettingsCard />

        {/* Hot Update Settings Card */}
        <HotUpdateSettingsCard />
      </div>
    </div>
  );
}
