const { contextBridge, ipcRenderer } = require('electron');

// Auto-updater events
ipcRenderer.on('update-status', (event, data) => {
  window.dispatchEvent(new CustomEvent('electron-update-status', { detail: data }));
});

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // App info
  platform: process.platform,
  isElectron: true,
  
  // Window controls
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),
  
  // File operations (for future use with exports/imports)
  onFileDrop: (callback) => ipcRenderer.on('file-dropped', callback),
  
  // ==================== AGT Services ====================
  agt: {
    // Sign invoice with RSA-SHA256
    signInvoice: (invoiceData, keyAlias, passphrase) => 
      ipcRenderer.invoke('agt:sign-invoice', { invoiceData, keyAlias, passphrase }),
    
    // Generate new RSA key pair
    generateKeys: (keyAlias, passphrase) =>
      ipcRenderer.invoke('agt:generate-keys', { keyAlias, passphrase }),
    
    // List available signing keys
    listKeys: () => ipcRenderer.invoke('agt:list-keys'),
    
    // Verify signature
    verifySignature: (invoiceData, signature, keyAlias) =>
      ipcRenderer.invoke('agt:verify-signature', { invoiceData, signature, keyAlias }),
    
    // Calculate SHA-256 hash
    calculateHash: (data) => ipcRenderer.invoke('agt:calculate-hash', { data }),
    
    // AGT API Transmission
    transmitInvoice: (invoice, signature) =>
      ipcRenderer.invoke('agt:transmit-invoice', { invoice, signature }),
    
    transmitWithRetry: (invoice, signature) =>
      ipcRenderer.invoke('agt:transmit-with-retry', { invoice, signature }),
    
    checkStatus: (invoiceNumber) =>
      ipcRenderer.invoke('agt:check-status', { invoiceNumber }),
    
    voidInvoice: (invoiceNumber, reason) =>
      ipcRenderer.invoke('agt:void-invoice', { invoiceNumber, reason }),
    
    // Configuration
    configure: (config) =>
      ipcRenderer.invoke('agt:configure', { config }),
    
    getConfig: () =>
      ipcRenderer.invoke('agt:get-config')
  },
  
  // ==================== Auto-Updater ====================
  updater: {
    // Check for updates
    checkForUpdates: () => ipcRenderer.invoke('updater:check'),
    
    // Download available update
    downloadUpdate: () => ipcRenderer.invoke('updater:download'),
    
    // Install update and restart
    installUpdate: () => ipcRenderer.invoke('updater:install'),
    
    // Get current app version
    getVersion: () => ipcRenderer.invoke('app:version'),
    
    // Listen for update status changes
    onUpdateStatus: (callback) => {
      const handler = (event) => callback(event.detail);
      window.addEventListener('electron-update-status', handler);
      return () => window.removeEventListener('electron-update-status', handler);
    }
  },
  
  // ==================== Server Discovery ====================
  discovery: {
    // Scan for servers on local network
    scan: (timeout = 5000) => ipcRenderer.invoke('discovery:scan', { timeout }),
    
    // Stop scanning
    stop: () => ipcRenderer.invoke('discovery:stop'),
    
    // Get cached servers from last scan
    getCached: () => ipcRenderer.invoke('discovery:cached')
  },
  
  // ==================== Hot Update ====================
  hotUpdate: {
    // Get current hot update configuration
    getConfig: () => ipcRenderer.invoke('hotupdate:get-config'),
    
    // Save hot update configuration
    setConfig: (config) => ipcRenderer.invoke('hotupdate:set-config', { config }),
    
    // Check if update server is available
    checkServer: (serverUrl) => ipcRenderer.invoke('hotupdate:check-server', { serverUrl }),
    
    // Reload app from server (apply update)
    reload: () => ipcRenderer.invoke('hotupdate:reload'),
    
    // Get current load source (server or local)
    getSource: () => ipcRenderer.invoke('hotupdate:get-source')
  }
});

// Log that we're running in Electron
console.log('🖥️ Kwanza ERP running in Electron desktop mode');
console.log('🔐 AGT cryptographic services available via electronAPI.agt');
console.log('🔄 Auto-updater available via electronAPI.updater');
console.log('🔍 Server discovery available via electronAPI.discovery');
console.log('🔥 Hot update available via electronAPI.hotUpdate');
