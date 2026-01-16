const { contextBridge, ipcRenderer } = require('electron');

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
    calculateHash: (data) => ipcRenderer.invoke('agt:calculate-hash', { data })
  }
});

// Log that we're running in Electron
console.log('🖥️ Kwanza ERP running in Electron desktop mode');
console.log('🔐 AGT cryptographic services available via electronAPI.agt');
