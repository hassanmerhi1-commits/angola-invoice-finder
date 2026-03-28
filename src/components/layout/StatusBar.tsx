// Kwanza ERP Status Bar - Bottom of screen
// Shows: IP:DB_PATH@USER | Version | Date/Time | Keyboard shortcuts
import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useERP';
import { useBranchContext } from '@/contexts/BranchContext';
import { Database, Wifi, WifiOff, Monitor, Keyboard } from 'lucide-react';
import * as storage from '@/lib/storage';

export function StatusBar() {
  const { user } = useAuth();
  const { currentBranch } = useBranchContext();
  const [now, setNow] = useState(new Date());
  const [dbStatus, setDbStatus] = useState({ mode: '', path: '', serverAddress: '', connected: false });
  const [version, setVersion] = useState('2025 R7');

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);

    // Get DB status
    if (window.electronAPI?.db?.getStatus) {
      window.electronAPI.db.getStatus().then((s: any) => {
        setDbStatus({
          mode: s.mode || 'web',
          path: s.path || '',
          serverAddress: s.serverAddress || '',
          connected: s.connected || false,
        });
      }).catch(() => {});
    } else {
      setDbStatus({ mode: 'demo', path: 'localStorage', serverAddress: '', connected: true });
    }

    if (window.electronAPI?.app?.getVersion) {
      window.electronAPI.app.getVersion().then((v: string) => setVersion(v)).catch(() => {});
    }

    return () => clearInterval(timer);
  }, []);

  const formatDate = () => {
    const d = now;
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    const ss = String(d.getSeconds()).padStart(2, '0');
    return `${dd}/${mm}/${yyyy} ${hh}:${min}:${ss}`;
  };

  // Build status text: "Kwanza ERP : IP:DB_PATH@USER"
  const getConnectionInfo = () => {
    if (dbStatus.mode === 'server') {
      return `${dbStatus.path}@${user?.name || 'Unknown'}`;
    }
    if (dbStatus.mode === 'client') {
      return `${dbStatus.serverAddress}@${user?.name || 'Unknown'}`;
    }
    return `Demo Mode@${user?.name || 'Unknown'}`;
  };

  return (
    <div className="h-6 bg-muted/80 border-t flex items-center justify-between px-2 text-[10px] text-muted-foreground select-none">
      {/* Left: Keyboard shortcuts hint */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1">
          <Keyboard className="w-3 h-3" />
          <span>Ctrl + F5 para Reconectar</span>
        </div>
        <span>Ctrl + Alt + D para Conceber</span>
      </div>

      {/* Center: Version & Connection */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1">
          {dbStatus.connected ? (
            <Wifi className="w-3 h-3 text-primary" />
          ) : (
            <WifiOff className="w-3 h-3 text-destructive" />
          )}
          <span className="font-medium">{getConnectionInfo()}</span>
        </div>
        <span className="px-2 py-0.5 bg-primary/20 text-primary rounded text-[9px] font-bold">
          Full Version ERP {version}
        </span>
        <span>{formatDate()}</span>
      </div>

      {/* Right: Branch + Credits */}
      <div className="flex items-center gap-2">
        {currentBranch && (
          <span className="flex items-center gap-1">
            <Database className="w-3 h-3" />
            {currentBranch.name}
          </span>
        )}
        <span className="italic opacity-60">By Hassan Merhi</span>
      </div>
    </div>
  );
}