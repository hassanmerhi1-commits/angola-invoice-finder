import { useState, useEffect, useCallback } from 'react';

export interface DatabaseStatus {
  isConnected: boolean;
  isServer: boolean;
  databasePath: string | null;
  serverIp: string | null;
  serverPort: number;
  mode: 'server' | 'client' | 'local' | 'unknown';
  lastChecked: Date | null;
}

export function useDatabaseStatus() {
  const [status, setStatus] = useState<DatabaseStatus>({
    isConnected: false,
    isServer: false,
    databasePath: null,
    serverIp: null,
    serverPort: 3000,
    mode: 'unknown',
    lastChecked: null,
  });
  const [isChecking, setIsChecking] = useState(false);

  const checkStatus = useCallback(async () => {
    setIsChecking(true);
    
    try {
      // Check if running in Electron
      const isElectron = !!window.electronAPI?.isElectron;
      
      // Get stored config
      const setupComplete = localStorage.getItem('kwanza_setup_complete') === 'true';
      const isServerMode = localStorage.getItem('kwanza_is_server') === 'true';
      
      if (!setupComplete) {
        setStatus({
          isConnected: false,
          isServer: false,
          databasePath: null,
          serverIp: null,
          serverPort: 3000,
          mode: 'unknown',
          lastChecked: new Date(),
        });
        return;
      }

      if (isServerMode) {
        // Server mode - check SQLite database
        const serverConfig = localStorage.getItem('kwanza_server_config');
        const config = serverConfig ? JSON.parse(serverConfig) : null;
        
        let dbPath = config?.databasePath || null;
        let connected = false;
        
        if (isElectron && window.electronAPI?.database?.getPath) {
          try {
            dbPath = await window.electronAPI.database.getPath();
            // Try a simple query to verify connection
            const result = await window.electronAPI.database?.query?.('SELECT 1 as test');
            connected = result?.success === true;
          } catch {
            connected = false;
          }
        } else {
          // Web preview - simulate connection
          connected = true;
        }
        
        setStatus({
          isConnected: connected,
          isServer: true,
          databasePath: dbPath,
          serverIp: config?.serverIp || null,
          serverPort: config?.serverPort || 3000,
          mode: 'server',
          lastChecked: new Date(),
        });
      } else {
        // Client mode - check connection to server
        const clientConfig = localStorage.getItem('kwanza_client_config');
        const config = clientConfig ? JSON.parse(clientConfig) : null;
        
        const serverIp = config?.serverIp || localStorage.getItem('kwanza_api_url')?.replace('http://', '').split(':')[0];
        const serverPort = config?.serverPort || 3000;
        
        let connected = false;
        
        if (serverIp) {
          try {
            const response = await fetch(`http://${serverIp}:${serverPort}/api/health`, {
              signal: AbortSignal.timeout(3000)
            });
            connected = response.ok;
          } catch {
            connected = false;
          }
        }
        
        setStatus({
          isConnected: connected,
          isServer: false,
          databasePath: null,
          serverIp,
          serverPort,
          mode: 'client',
          lastChecked: new Date(),
        });
      }
    } catch (error) {
      console.error('Failed to check database status:', error);
      setStatus(prev => ({
        ...prev,
        isConnected: false,
        lastChecked: new Date(),
      }));
    } finally {
      setIsChecking(false);
    }
  }, []);

  // Check status on mount and periodically
  useEffect(() => {
    checkStatus();
    
    const interval = setInterval(checkStatus, 30000); // Check every 30 seconds
    
    return () => clearInterval(interval);
  }, [checkStatus]);

  return { status, isChecking, checkStatus };
}
