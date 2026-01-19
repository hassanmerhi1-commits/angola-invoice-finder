const { app, BrowserWindow, Menu, ipcMain, dialog } = require('electron');
const path = require('path');
const crypto = require('crypto');

// Handle creating/removing shortcuts on Windows when installing/uninstalling
// This module is optional - only used when installed via Squirrel installer
// Note: electron-squirrel-startup is NOT needed for NSIS installers (which we use)
// It's only for Squirrel.Windows installers. We safely skip this check.
const handleSquirrelStartup = () => {
  try {
    // Check if module exists before requiring
    const modulePath = require.resolve('electron-squirrel-startup');
    if (modulePath && require('electron-squirrel-startup')) {
      return true;
    }
  } catch (e) {
    // Module not available - this is expected for NSIS installers
    // Silently continue without error
  }
  return false;
};

if (handleSquirrelStartup()) {
  app.quit();
}

// Auto-updater (only in production)
let autoUpdater = null;
const isDev = process.env.NODE_ENV === 'development' || process.env.ELECTRON_DEV === 'true';

if (!isDev) {
  try {
    autoUpdater = require('electron-updater').autoUpdater;
    
    // Configure auto-updater
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = true;
    
    // Logging
    autoUpdater.logger = require('electron-log');
    autoUpdater.logger.transports.file.level = 'info';
  } catch (e) {
    console.log('[AutoUpdater] Not available:', e.message);
  }
}

// AGT Services (lazy loaded)
let agtServices = null;
function getAGTServices() {
  if (!agtServices) {
    try {
      agtServices = require('./services');
    } catch (e) {
      console.error('[AGT] Services not available:', e.message);
    }
  }
  return agtServices;
}

let mainWindow;

function createWindow() {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 768,
    icon: path.join(__dirname, '../public/favicon.ico'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    autoHideMenuBar: false,
    show: false // Don't show until ready
  });

  // Create application menu
  const menuTemplate = [
    {
      label: 'Kwanza ERP',
      submenu: [
        { label: 'About', role: 'about' },
        { type: 'separator' },
        { label: 'Quit', accelerator: 'CmdOrCtrl+Q', click: () => app.quit() }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { label: 'Undo', accelerator: 'CmdOrCtrl+Z', role: 'undo' },
        { label: 'Redo', accelerator: 'Shift+CmdOrCtrl+Z', role: 'redo' },
        { type: 'separator' },
        { label: 'Cut', accelerator: 'CmdOrCtrl+X', role: 'cut' },
        { label: 'Copy', accelerator: 'CmdOrCtrl+C', role: 'copy' },
        { label: 'Paste', accelerator: 'CmdOrCtrl+V', role: 'paste' },
        { label: 'Select All', accelerator: 'CmdOrCtrl+A', role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { label: 'Reload', accelerator: 'CmdOrCtrl+R', role: 'reload' },
        { label: 'Force Reload', accelerator: 'CmdOrCtrl+Shift+R', role: 'forceReload' },
        { label: 'Toggle DevTools', accelerator: 'F12', role: 'toggleDevTools' },
        { type: 'separator' },
        { label: 'Actual Size', accelerator: 'CmdOrCtrl+0', role: 'resetZoom' },
        { label: 'Zoom In', accelerator: 'CmdOrCtrl+Plus', role: 'zoomIn' },
        { label: 'Zoom Out', accelerator: 'CmdOrCtrl+-', role: 'zoomOut' },
        { type: 'separator' },
        { label: 'Fullscreen', accelerator: 'F11', role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { label: 'Minimize', accelerator: 'CmdOrCtrl+M', role: 'minimize' },
        { label: 'Close', accelerator: 'CmdOrCtrl+W', role: 'close' }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(menuTemplate);
  Menu.setApplicationMenu(menu);

  // Determine what to load
  const isDev = process.env.NODE_ENV === 'development' || process.env.ELECTRON_DEV === 'true';
  
  if (isDev) {
    // Development: load from Vite dev server
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    // Production: load built files
    // In packaged app, __dirname is inside app.asar, so we need to check multiple paths
    const possiblePaths = [
      path.join(__dirname, '../dist/index.html'),           // Development build
      path.join(process.resourcesPath, 'app/dist/index.html'),  // Packaged (asar)
      path.join(app.getAppPath(), 'dist/index.html'),       // Alternative packaged path
    ];
    
    const fs = require('fs');
    let indexPath = possiblePaths[0]; // Default
    
    for (const p of possiblePaths) {
      try {
        if (fs.existsSync(p)) {
          indexPath = p;
          console.log('[Electron] Loading from:', p);
          break;
        }
      } catch (e) {
        // Continue to next path
      }
    }
    
    mainWindow.loadFile(indexPath);
  }

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
  });

  // Handle window closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// App ready
app.whenReady().then(() => {
  createWindow();
  
  // Check for updates after window is ready (production only)
  if (autoUpdater) {
    setTimeout(() => {
      autoUpdater.checkForUpdates().catch(err => {
        console.log('[AutoUpdater] Update check failed:', err.message);
      });
    }, 3000); // Wait 3 seconds before checking
  }
});

// Quit when all windows are closed (except on macOS)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// On macOS, re-create window when dock icon is clicked
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Security: Prevent new window creation
app.on('web-contents-created', (event, contents) => {
  contents.setWindowOpenHandler(() => {
    return { action: 'deny' };
  });
});

// ==================== IPC HANDLERS FOR AGT SERVICES ====================

// Sign invoice with RSA-SHA256
ipcMain.handle('agt:sign-invoice', async (event, { invoiceData, keyAlias, passphrase }) => {
  const services = getAGTServices();
  if (!services) {
    return { success: false, error: 'AGT services not available' };
  }
  
  try {
    const result = services.signInvoice(invoiceData, keyAlias, passphrase);
    return { success: true, ...result };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Generate RSA key pair
ipcMain.handle('agt:generate-keys', async (event, { keyAlias, passphrase }) => {
  const services = getAGTServices();
  if (!services) {
    return { success: false, error: 'AGT services not available' };
  }
  
  try {
    const result = services.generateKeyPair(keyAlias, passphrase);
    return { 
      success: true, 
      publicKey: result.publicKey,
      privateKeyHash: result.privateKeyHash
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// List available keys
ipcMain.handle('agt:list-keys', async () => {
  const services = getAGTServices();
  if (!services) {
    return { success: false, keys: [] };
  }
  
  try {
    return { success: true, keys: services.listKeys() };
  } catch (error) {
    return { success: false, error: error.message, keys: [] };
  }
});

// Verify signature
ipcMain.handle('agt:verify-signature', async (event, { invoiceData, signature, keyAlias }) => {
  const services = getAGTServices();
  if (!services) {
    return { success: false, valid: false };
  }
  
  try {
    const valid = services.verifySignature(invoiceData, signature, keyAlias);
    return { success: true, valid };
  } catch (error) {
    return { success: false, error: error.message, valid: false };
  }
});

// Calculate hash
ipcMain.handle('agt:calculate-hash', async (event, { data }) => {
  return { 
    hash: crypto.createHash('sha256').update(data).digest('hex')
  };
});

// ==================== AUTO-UPDATER EVENTS ====================

if (autoUpdater) {
  autoUpdater.on('checking-for-update', () => {
    console.log('[AutoUpdater] Checking for updates...');
    if (mainWindow) {
      mainWindow.webContents.send('update-status', { status: 'checking' });
    }
  });

  autoUpdater.on('update-available', (info) => {
    console.log('[AutoUpdater] Update available:', info.version);
    if (mainWindow) {
      mainWindow.webContents.send('update-status', { 
        status: 'available', 
        version: info.version,
        releaseNotes: info.releaseNotes
      });
    }
    
    // Show dialog to user
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Atualização Disponível',
      message: `Uma nova versão (${info.version}) está disponível.`,
      detail: 'Deseja baixar a atualização agora?',
      buttons: ['Baixar', 'Mais tarde'],
      defaultId: 0,
      cancelId: 1
    }).then(({ response }) => {
      if (response === 0) {
        autoUpdater.downloadUpdate();
      }
    });
  });

  autoUpdater.on('update-not-available', () => {
    console.log('[AutoUpdater] No updates available');
    if (mainWindow) {
      mainWindow.webContents.send('update-status', { status: 'not-available' });
    }
  });

  autoUpdater.on('download-progress', (progress) => {
    console.log(`[AutoUpdater] Download progress: ${progress.percent.toFixed(1)}%`);
    if (mainWindow) {
      mainWindow.webContents.send('update-status', { 
        status: 'downloading', 
        percent: progress.percent,
        bytesPerSecond: progress.bytesPerSecond,
        transferred: progress.transferred,
        total: progress.total
      });
    }
  });

  autoUpdater.on('update-downloaded', (info) => {
    console.log('[AutoUpdater] Update downloaded:', info.version);
    if (mainWindow) {
      mainWindow.webContents.send('update-status', { 
        status: 'downloaded', 
        version: info.version 
      });
    }
    
    // Show dialog to restart
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Atualização Pronta',
      message: 'A atualização foi baixada.',
      detail: 'Reinicie o aplicativo para aplicar a atualização.',
      buttons: ['Reiniciar Agora', 'Mais tarde'],
      defaultId: 0,
      cancelId: 1
    }).then(({ response }) => {
      if (response === 0) {
        autoUpdater.quitAndInstall(false, true);
      }
    });
  });

  autoUpdater.on('error', (error) => {
    console.error('[AutoUpdater] Error:', error.message);
    if (mainWindow) {
      mainWindow.webContents.send('update-status', { 
        status: 'error', 
        message: error.message 
      });
    }
  });
}

// ==================== IPC HANDLERS FOR AUTO-UPDATE ====================

// Check for updates manually
ipcMain.handle('updater:check', async () => {
  if (!autoUpdater) {
    return { success: false, error: 'Auto-updater not available in development' };
  }
  
  try {
    const result = await autoUpdater.checkForUpdates();
    return { success: true, updateInfo: result?.updateInfo };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Download update
ipcMain.handle('updater:download', async () => {
  if (!autoUpdater) {
    return { success: false, error: 'Auto-updater not available' };
  }
  
  try {
    await autoUpdater.downloadUpdate();
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Install update and restart
ipcMain.handle('updater:install', async () => {
  if (!autoUpdater) {
    return { success: false, error: 'Auto-updater not available' };
  }
  
  autoUpdater.quitAndInstall(false, true);
  return { success: true };
});

// Get current app version
ipcMain.handle('app:version', async () => {
  return { version: app.getVersion() };
});

// ==================== IPC HANDLERS FOR SERVER DISCOVERY ====================

// Discover servers on local network
ipcMain.handle('discovery:scan', async (event, { timeout }) => {
  const services = getAGTServices();
  if (!services || !services.serverDiscovery) {
    return { success: false, servers: [], error: 'Discovery service not available' };
  }
  
  try {
    const servers = await services.serverDiscovery.startDiscovery(timeout || 5000);
    return { success: true, servers };
  } catch (error) {
    return { success: false, servers: [], error: error.message };
  }
});

// Stop discovery scan
ipcMain.handle('discovery:stop', async () => {
  const services = getAGTServices();
  if (services && services.serverDiscovery) {
    services.serverDiscovery.stopDiscovery();
  }
  return { success: true };
});

// Get cached discovered servers
ipcMain.handle('discovery:cached', async () => {
  const services = getAGTServices();
  if (!services || !services.serverDiscovery) {
    return { success: false, servers: [] };
  }
  
  return { 
    success: true, 
    servers: services.serverDiscovery.getCachedServers() 
  };
});
