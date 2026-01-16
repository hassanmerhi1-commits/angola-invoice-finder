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
});

// Log that we're running in Electron
console.log('🖥️ Kwanza ERP running in Electron desktop mode');
