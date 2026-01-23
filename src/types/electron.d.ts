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

export interface HotUpdateConfig {
  enabled: boolean;
  serverUrl: string;
  autoConnect?: boolean;
}

export interface WebappVersion {
  version: string;
  buildDate?: string;
  error?: string;
}

export interface AGTSignatureResult {
  success: boolean;
  hash?: string;
  shortHash?: string;
  signature?: string;
  algorithm?: string;
  error?: string;
}

export interface AGTTransmissionResult {
  success: boolean;
  agtCode?: string;
  agtStatus?: 'validated' | 'pending' | 'rejected' | 'error';
  validatedAt?: string;
  errorCode?: string;
  errorMessage?: string;
  retryable?: boolean;
}

export interface AGTStatusResult {
  success: boolean;
  invoiceNumber?: string;
  agtStatus?: 'validated' | 'pending' | 'rejected' | 'error';
  agtCode?: string;
  validatedAt?: string;
  errorMessage?: string;
}

export interface AGTVoidResult {
  success: boolean;
  agtStatus?: string;
  errorMessage?: string;
}

export interface AGTConfig {
  environment: 'production' | 'sandbox';
  softwareCertificate: string;
  companyNIF: string;
  apiKey: string;
}

export interface ElectronAPI {
  platform: string;
  isElectron: boolean;
  agt: {
    // Signing
    signInvoice: (invoiceData: any, keyAlias: string, passphrase: string) => Promise<AGTSignatureResult>;
    generateKeys: (keyAlias: string, passphrase: string) => Promise<{ success: boolean; publicKey?: string; privateKeyHash?: string; error?: string }>;
    listKeys: () => Promise<{ success: boolean; keys: string[]; error?: string }>;
    verifySignature: (invoiceData: any, signature: string, keyAlias: string) => Promise<{ success: boolean; valid: boolean; error?: string }>;
    calculateHash: (data: string) => Promise<{ success: boolean; hash?: string; error?: string }>;
    
    // AGT API Transmission
    transmitInvoice: (invoice: any, signature: any) => Promise<AGTTransmissionResult>;
    transmitWithRetry: (invoice: any, signature: any) => Promise<AGTTransmissionResult>;
    checkStatus: (invoiceNumber: string) => Promise<AGTStatusResult>;
    voidInvoice: (invoiceNumber: string, reason: string) => Promise<AGTVoidResult>;
    
    // Configuration
    configure: (config: AGTConfig) => Promise<{ success: boolean; error?: string }>;
    getConfig: () => Promise<{ success: boolean; config?: AGTConfig; error?: string }>;
  };
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
    getLocalIPs: () => Promise<string[]>;
  };
  hotUpdate?: {
    getConfig: () => Promise<{ success: boolean; config: HotUpdateConfig }>;
    setConfig: (config: Partial<HotUpdateConfig>) => Promise<{ success: boolean; config?: HotUpdateConfig; error?: string }>;
    checkServer: (serverUrl: string) => Promise<{ success: boolean; available: boolean; version?: WebappVersion; error?: string }>;
    reload: () => Promise<{ success: boolean; source?: string; error?: string }>;
    getSource: () => Promise<{ success: boolean; source: 'server' | 'local' | 'unknown'; url?: string }>;
  };
  database?: {
    create: (path: string) => Promise<{ success: boolean; error?: string }>;
    open: (path: string) => Promise<{ success: boolean; error?: string }>;
    query: (sql: string, params?: any[]) => Promise<{ success: boolean; data?: any[]; error?: string }>;
    execute: (sql: string, params?: any[]) => Promise<{ success: boolean; error?: string }>;
    backup: (destinationPath: string) => Promise<{ success: boolean; error?: string }>;
    getPath: () => Promise<string>;
  };
  app?: {
    getVersion: () => Promise<string>;
    getPlatform: () => Promise<string>;
    getDataPath: () => Promise<string>;
    isServer: () => Promise<boolean>;
    quit: () => void;
    restart: () => void;
  };
  setup?: {
    getConfig: () => Promise<{ success: boolean; config: SetupConfig }>;
    saveConfig: (config: Partial<SetupConfig>) => Promise<{ success: boolean; config?: SetupConfig; error?: string }>;
    isComplete: () => Promise<{ success: boolean; complete: boolean }>;
    reset: () => Promise<{ success: boolean; error?: string }>;
  };
}

export interface SetupConfig {
  setupComplete: boolean;
  role: 'server' | 'client' | null;
  serverConfig?: {
    databasePath: string;
    serverIp: string;
    serverPort: number;
    setupDate: string;
  };
  clientConfig?: {
    serverIp: string;
    serverPort: number;
    setupDate: string;
  };
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
