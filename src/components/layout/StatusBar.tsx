// Kwanza ERP Status Bar - Modern
import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useERP';
import { useBranchContext } from '@/contexts/BranchContext';
import { Database, Wifi, WifiOff, Keyboard } from 'lucide-react';

export function StatusBar() {
  const { user } = useAuth();
  const { currentBranch } = useBranchContext();
  const [now, setNow] = useState(new Date());
  const [dbStatus, setDbStatus] = useState({ mode: '', path: '', serverAddress: '', connected: false });
  const [version, setVersion] = useState('2025 R7');

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);

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

  const getConnectionInfo = () => {
    if (dbStatus.mode === 'server') return `${dbStatus.path}@${user?.name || 'Unknown'}`;
    if (dbStatus.mode === 'client') return `${dbStatus.serverAddress}@${user?.name || 'Unknown'}`;
    return `Demo@${user?.name || 'Unknown'}`;
  };

  return (
    <div className="h-7 bg-sidebar text-sidebar-foreground/70 flex items-center justify-between px-3 text-[10px] font-medium select-none">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <Keyboard className="w-3 h-3" />
          <span>Ctrl+F5 Reconectar</span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          {dbStatus.connected ? (
            <Wifi className="w-3 h-3 text-success" />
          ) : (
            <WifiOff className="w-3 h-3 text-destructive" />
          )}
          <span>{getConnectionInfo()}</span>
        </div>
        <span className="px-2 py-0.5 rounded-full bg-sidebar-primary/20 text-sidebar-primary text-[9px] font-bold">
          ERP {version}
        </span>
        <span className="font-mono">{formatDate()}</span>
      </div>

      <div className="flex items-center gap-3">
        {currentBranch && (
          <span className="flex items-center gap-1">
            <Database className="w-3 h-3" />
            {currentBranch.name}
          </span>
        )}
        <span className="opacity-50">By Hassan Merhi</span>
      </div>
    </div>
  );
}
