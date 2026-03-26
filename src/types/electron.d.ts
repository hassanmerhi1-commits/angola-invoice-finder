// Shared Electron API type definitions - Kwanza ERP
// Matches preload.cjs API exactly

export interface ElectronAPI {
  platform: string;
  isElectron: boolean;

  // IP file operations
  ipfile: {
    read: () => Promise<string>;
    write: (content: string) => Promise<{ success: boolean; error?: string }>;
    parse: () => Promise<IPFileConfig>;
  };

  // Company management
  company: {
    list: () => Promise<CompanyInfo[]>;
    create: (name: string) => Promise<{ success: boolean; company?: CompanyInfo; error?: string }>;
    setActive: (companyId: string) => Promise<{ success: boolean; error?: string }>;
  };

  // Database operations
  db: {
    getStatus: () => Promise<DBStatus>;
    create: () => Promise<{ success: boolean; error?: string }>;
    init: () => Promise<{ success: boolean; mode?: string; error?: string }>;
    getAll: (table: string, companyId?: string) => Promise<{ success: boolean; data: any[] }>;
    getById: (table: string, id: string, companyId?: string) => Promise<{ success: boolean; data: any }>;
    insert: (table: string, data: any, companyId?: string) => Promise<{ success: boolean; error?: string }>;
    update: (table: string, id: string, data: any, companyId?: string) => Promise<{ success: boolean; error?: string }>;
    delete: (table: string, id: string, companyId?: string) => Promise<{ success: boolean; error?: string }>;
    query: (sql: string, params?: any[], companyId?: string) => Promise<{ success: boolean; data?: any[]; error?: string }>;
    export: (companyId?: string) => Promise<{ success: boolean; data?: any }>;
    import: (data: any, companyId?: string) => Promise<{ success: boolean; error?: string }>;
    testConnection: () => Promise<{ success: boolean; mode?: string; error?: string }>;
  };

  // Real-time sync
  onDatabaseUpdate: (callback: (data: { table: string; action: string }) => void) => void;
  onDatabaseSync: (callback: (data: { table: string; rows: any[]; companyId?: string }) => void) => void;

  // Network
  network: {
    getLocalIPs: () => Promise<string[]>;
    getInstallPath: () => Promise<string>;
    getIPFilePath: () => Promise<string>;
    getComputerName: () => Promise<string>;
  };

  // Printing
  print: {
    html: (html: string, options?: { silent?: boolean }) => Promise<{ success: boolean; error?: string }>;
  };

  // App
  app: {
    relaunch: () => Promise<void>;
    getVersion: () => Promise<string>;
  };

  // Auto-updater
  updater: {
    check: () => Promise<{ success: boolean; error?: string }>;
    download: () => Promise<{ success: boolean; error?: string }>;
    install: () => Promise<{ success: boolean }>;
    getVersion: () => Promise<string>;
    onStatus: (callback: (data: UpdateStatus) => void) => void;
  };

  // AGT
  agt: {
    calculateHash: (data: string) => Promise<{ success: boolean; hash?: string }>;
  };
}

export interface IPFileConfig {
  valid: boolean;
  error?: string;
  path: string | null;
  isServer: boolean;
  serverAddress?: string;
}

export interface DBStatus {
  success: boolean;
  mode: 'server' | 'client' | 'unconfigured';
  path: string | null;
  serverAddress: string | null;
  wsPort: number;
  connected: boolean;
}

export interface CompanyInfo {
  id: string;
  name: string;
  dbFile: string;
}

export interface UpdateStatus {
  status: 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error';
  version?: string;
  progress?: number;
  error?: string;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}