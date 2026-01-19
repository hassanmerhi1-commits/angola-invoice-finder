// Shared Electron API type definitions

export interface DiscoveredServer {
  id: string;
  ip: string;
  port: number;
  name: string;
  version: string;
  branch?: string;
  connectedClients: number;
  hostname?: string;
  discoveredAt: string;
}

export interface UpdateStatus {
  status: 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error';
  version?: string;
  progress?: number;
  error?: string;
}

export interface ElectronAPI {
  platform: string;
  isElectron: boolean;
  updater: {
    checkForUpdates: () => Promise<{ success: boolean; error?: string }>;
    downloadUpdate: () => Promise<{ success: boolean; error?: string }>;
    installUpdate: () => Promise<{ success: boolean; error?: string }>;
    getVersion: () => Promise<string>;
    onUpdateStatus: (callback: (data: UpdateStatus) => void) => () => void;
  };
  discovery?: {
    scan: (timeout?: number) => Promise<{ success: boolean; servers: DiscoveredServer[]; error?: string }>;
    stop: () => Promise<{ success: boolean }>;
    getCached: () => Promise<{ success: boolean; servers: DiscoveredServer[] }>;
  };
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
