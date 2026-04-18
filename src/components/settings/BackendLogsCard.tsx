import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileText, FolderOpen, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

/**
 * Phase 6 — Backend Logs settings card.
 *
 * Surfaces the backend log directory (rotating daily, 30-day retention) and a
 * one-click "Open Logs Folder" button using shell.openPath via IPC.
 *
 * Hidden in non-Electron environments (web preview), where there is no
 * spawned backend and no log files exist.
 */
export function BackendLogsCard() {
  const [logDir, setLogDir] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);
  const isElectron = !!window.electronAPI?.isElectron;
  const hasApi = !!window.electronAPI?.backend?.getLogDir;

  useEffect(() => {
    if (!hasApi) return;
    let cancelled = false;
    (async () => {
      try {
        const dir = await window.electronAPI!.backend!.getLogDir!();
        if (!cancelled) setLogDir(dir);
      } catch {
        if (!cancelled) setLogDir(null);
      }
    })();
    return () => { cancelled = true; };
  }, [hasApi]);

  if (!isElectron) return null;

  const handleOpen = async () => {
    if (!hasApi) return;
    setOpening(true);
    try {
      const result = await window.electronAPI!.backend!.openLogDir!();
      if (!result.success) {
        toast.error('Could not open logs folder', { description: result.error });
      }
    } catch (e) {
      toast.error('Could not open logs folder', {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setOpening(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          <CardTitle>Backend Logs</CardTitle>
          <Badge variant="secondary" className="ml-auto">30-day retention</Badge>
        </div>
        <CardDescription>
          The Express backend writes stdout, stderr and lifecycle events to a daily
          log file. Useful when reporting issues to support.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border bg-muted/40 p-3">
          <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
            Log directory
          </div>
          {logDir ? (
            <code className="block text-xs font-mono break-all text-foreground">
              {logDir}
            </code>
          ) : (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <AlertCircle className="h-3.5 w-3.5" />
              Not initialized yet — restart the app
            </div>
          )}
        </div>
        <div className="text-xs text-muted-foreground">
          Files are named <code className="font-mono">backend-YYYY-MM-DD.log</code>.
          Older than 30 days are removed automatically.
        </div>
        <Button onClick={handleOpen} disabled={!logDir || opening} className="w-full">
          <FolderOpen className="mr-2 h-4 w-4" />
          {opening ? 'Opening…' : 'Open Logs Folder'}
        </Button>
      </CardContent>
    </Card>
  );
}
