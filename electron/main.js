const { app, BrowserWindow, Menu, ipcMain, dialog } = require('electron');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');

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

// ==================== HOT UPDATE CONFIGURATION ====================
// The app can load from:
// 1. Local files (fallback) - dist/index.html
// 2. Server URL (hot update) - http://server:port/app
// Config is stored in userData folder

const configPath = path.join(app.getPath('userData'), 'hot-update-config.json');
const setupConfigPath = path.join(app.getPath('userData'), 'setup-config.json');

// ==================== SETUP CONFIGURATION ====================
// Store setup state in userData so it persists across all build types
function loadSetupConfig() {
  try {
    if (fs.existsSync(setupConfigPath)) {
      return JSON.parse(fs.readFileSync(setupConfigPath, 'utf8'));
    }
  } catch (e) {
    console.log('[Setup] Config load error:', e.message);
  }
  return { 
    setupComplete: false,
    role: null, // 'server' or 'client'
    serverConfig: null,
    clientConfig: null
  };
}

function saveSetupConfig(config) {
  try {
    fs.writeFileSync(setupConfigPath, JSON.stringify(config, null, 2));
    console.log('[Setup] Config saved:', config);
  } catch (e) {
    console.error('[Setup] Config save error:', e.message);
  }
}

let setupConfig = loadSetupConfig();

function loadHotUpdateConfig() {
  try {
    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }
  } catch (e) {
    console.log('[HotUpdate] Config load error:', e.message);
  }
  return { 
    enabled: false, 
    serverUrl: '',
    autoConnect: false
  };
}

function saveHotUpdateConfig(config) {
  try {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    console.log('[HotUpdate] Config saved:', config);
  } catch (e) {
    console.error('[HotUpdate] Config save error:', e.message);
  }
}

let hotUpdateConfig = loadHotUpdateConfig();

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
let splashWindow;

function createSplashWindow() {
  splashWindow = new BrowserWindow({
    width: 500,
    height: 350,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    icon: path.join(__dirname, '../public/icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  splashWindow.loadFile(path.join(__dirname, 'splash.html'));
  splashWindow.center();
}

function createWindow() {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 768,
    icon: path.join(__dirname, '../public/icon.png'),
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
    // Production: Check for hot update server first
    hotUpdateConfig = loadHotUpdateConfig();
    
    if (hotUpdateConfig.enabled && hotUpdateConfig.serverUrl) {
      // HOT UPDATE MODE: Load from server
      const serverAppUrl = `${hotUpdateConfig.serverUrl}/app`;
      console.log('[HotUpdate] Loading from server:', serverAppUrl);
      
      mainWindow.loadURL(serverAppUrl).catch((err) => {
        console.error('[HotUpdate] Server load failed, falling back to local:', err.message);
        loadLocalFiles();
      });
    } else {
      // LOCAL MODE: Load built files
      loadLocalFiles();
    }
  }
  
  function loadLocalFiles() {
    // In packaged app, __dirname is inside app.asar, so we need to check multiple paths
    const possiblePaths = [
      path.join(__dirname, '../dist/index.html'),           // Development build
      path.join(process.resourcesPath, 'app/dist/index.html'),  // Packaged (asar)
      path.join(app.getAppPath(), 'dist/index.html'),       // Alternative packaged path
    ];
    
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
    // Add a small delay for polish, then close splash and show main window
    setTimeout(() => {
      if (splashWindow) {
        splashWindow.close();
        splashWindow = null;
      }
      mainWindow.show();
      mainWindow.focus();
    }, 1500);
  });

  // Handle window closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// App ready
app.whenReady().then(() => {
  // Show splash screen first
  createSplashWindow();
  
  // Then create main window
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
    success: true,
    hash: crypto.createHash('sha256').update(data).digest('hex')
  };
});

// ==================== AGT API TRANSMISSION HANDLERS ====================

let agtClient = null;
let agtConfig = {
  environment: 'sandbox',
  softwareCertificate: '',
  companyNIF: '',
  apiKey: ''
};

// Configure AGT client
ipcMain.handle('agt:configure', async (event, { config }) => {
  try {
    const { AGTClient, validateConfig } = require('./services/agtClient');
    
    // Validate config
    const validation = validateConfig(config);
    if (!validation.valid) {
      return { success: false, error: validation.errors.join(', ') };
    }
    
    agtConfig = { ...agtConfig, ...config };
    agtClient = new AGTClient(agtConfig);
    
    console.log('[AGT] Client configured for', config.environment);
    return { success: true };
  } catch (error) {
    console.error('[AGT] Configure error:', error);
    return { success: false, error: error.message };
  }
});

// Get current AGT config
ipcMain.handle('agt:get-config', async () => {
  return { 
    success: true, 
    config: {
      environment: agtConfig.environment,
      softwareCertificate: agtConfig.softwareCertificate ? '****' : '',
      companyNIF: agtConfig.companyNIF,
      apiKey: agtConfig.apiKey ? '****' : ''
    }
  };
});

// Transmit invoice to AGT
ipcMain.handle('agt:transmit-invoice', async (event, { invoice, signature }) => {
  try {
    if (!agtClient) {
      // Auto-initialize with default config if not configured
      const { AGTClient } = require('./services/agtClient');
      agtClient = new AGTClient(agtConfig);
    }
    
    console.log('[AGT] Transmitting invoice:', invoice.invoiceNumber);
    const result = await agtClient.transmitInvoice(invoice, signature);
    
    return {
      success: result.success,
      agtCode: result.agtCode,
      agtStatus: result.agtStatus,
      validatedAt: result.validatedAt,
      errorCode: result.errorCode,
      errorMessage: result.errorMessage,
      retryable: result.retryable
    };
  } catch (error) {
    console.error('[AGT] Transmit error:', error);
    return { 
      success: false, 
      agtStatus: 'error',
      errorMessage: error.message,
      retryable: true
    };
  }
});

// Transmit with retry
ipcMain.handle('agt:transmit-with-retry', async (event, { invoice, signature }) => {
  try {
    if (!agtClient) {
      const { AGTClient } = require('./services/agtClient');
      agtClient = new AGTClient(agtConfig);
    }
    
    console.log('[AGT] Transmitting with retry:', invoice.invoiceNumber);
    const result = await agtClient.transmitWithRetry(invoice, signature);
    
    return {
      success: result.success,
      agtCode: result.agtCode,
      agtStatus: result.agtStatus,
      validatedAt: result.validatedAt,
      errorCode: result.errorCode,
      errorMessage: result.errorMessage || result.message
    };
  } catch (error) {
    console.error('[AGT] Transmit with retry error:', error);
    return { 
      success: false, 
      agtStatus: 'error',
      errorMessage: error.message
    };
  }
});

// Check invoice status at AGT
ipcMain.handle('agt:check-status', async (event, { invoiceNumber }) => {
  try {
    if (!agtClient) {
      const { AGTClient } = require('./services/agtClient');
      agtClient = new AGTClient(agtConfig);
    }
    
    console.log('[AGT] Checking status:', invoiceNumber);
    const result = await agtClient.checkStatus(invoiceNumber);
    
    return {
      success: true,
      invoiceNumber: result.invoiceNumber,
      agtStatus: result.agtStatus,
      agtCode: result.agtCode,
      validatedAt: result.validatedAt,
      errorMessage: result.errorMessage
    };
  } catch (error) {
    console.error('[AGT] Check status error:', error);
    return { 
      success: false, 
      invoiceNumber,
      agtStatus: 'error',
      errorMessage: error.message
    };
  }
});

// Void invoice at AGT
ipcMain.handle('agt:void-invoice', async (event, { invoiceNumber, reason }) => {
  try {
    if (!agtClient) {
      const { AGTClient } = require('./services/agtClient');
      agtClient = new AGTClient(agtConfig);
    }
    
    console.log('[AGT] Voiding invoice:', invoiceNumber);
    const result = await agtClient.voidInvoice(invoiceNumber, reason);
    
    return {
      success: result.success,
      agtStatus: result.agtStatus,
      errorMessage: result.errorMessage
    };
  } catch (error) {
    console.error('[AGT] Void error:', error);
    return { 
      success: false, 
      errorMessage: error.message
    };
  }
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

// ==================== IPC HANDLERS FOR HOT UPDATE ====================

// Get current hot update config
ipcMain.handle('hotupdate:get-config', async () => {
  hotUpdateConfig = loadHotUpdateConfig();
  return { success: true, config: hotUpdateConfig };
});

// Save hot update config
ipcMain.handle('hotupdate:set-config', async (event, { config }) => {
  try {
    hotUpdateConfig = { ...hotUpdateConfig, ...config };
    saveHotUpdateConfig(hotUpdateConfig);
    return { success: true, config: hotUpdateConfig };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Check if server is available and get webapp version
ipcMain.handle('hotupdate:check-server', async (event, { serverUrl }) => {
  try {
    const http = require('http');
    const https = require('https');
    const url = new URL(`${serverUrl}/api/webapp-version`);
    const client = url.protocol === 'https:' ? https : http;
    
    return new Promise((resolve) => {
      const req = client.get(url, { timeout: 5000 }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const version = JSON.parse(data);
            resolve({ success: true, available: true, version });
          } catch (e) {
            resolve({ success: true, available: true, version: { version: 'unknown' } });
          }
        });
      });
      
      req.on('error', (err) => {
        resolve({ success: false, available: false, error: err.message });
      });
      
      req.on('timeout', () => {
        req.destroy();
        resolve({ success: false, available: false, error: 'Connection timeout' });
      });
    });
  } catch (error) {
    return { success: false, available: false, error: error.message };
  }
});

// Reload app from server (apply hot update)
ipcMain.handle('hotupdate:reload', async () => {
  try {
    hotUpdateConfig = loadHotUpdateConfig();
    
    if (hotUpdateConfig.enabled && hotUpdateConfig.serverUrl && mainWindow) {
      const serverAppUrl = `${hotUpdateConfig.serverUrl}/app`;
      console.log('[HotUpdate] Reloading from server:', serverAppUrl);
      await mainWindow.loadURL(serverAppUrl);
      return { success: true, source: 'server' };
    } else if (mainWindow) {
      mainWindow.reload();
      return { success: true, source: 'local' };
    }
    
    return { success: false, error: 'No window available' };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Get current load source
ipcMain.handle('hotupdate:get-source', async () => {
  if (mainWindow) {
    const url = mainWindow.webContents.getURL();
    const isFromServer = url.startsWith('http') && !url.includes('localhost:5173');
    return { 
      success: true, 
      source: isFromServer ? 'server' : 'local',
      url 
    };
  }
  return { success: false, source: 'unknown' };
});

// ==================== DATABASE IPC ====================
const database = require('./services/database');

ipcMain.handle('database:create', async (event, { path }) => {
  return await database.createDatabase(path);
});

ipcMain.handle('database:open', async (event, { path }) => {
  return await database.openDatabase(path);
});

ipcMain.handle('database:query', async (event, { sql, params }) => {
  return database.query(sql, params);
});

ipcMain.handle('database:execute', async (event, { sql, params }) => {
  return database.execute(sql, params);
});

ipcMain.handle('database:backup', async (event, { destinationPath }) => {
  return database.backup(destinationPath);
});

ipcMain.handle('database:get-path', async () => {
  return database.getPath();
});

// ==================== DISCOVERY IPC ====================
ipcMain.handle('discovery:local-ips', async () => {
  return serverDiscovery.getLocalIPs();
});

ipcMain.handle('app:is-server', async () => {
  setupConfig = loadSetupConfig();
  return setupConfig.role === 'server';
});

// ==================== SETUP CONFIG IPC ====================
ipcMain.handle('setup:get-config', async () => {
  setupConfig = loadSetupConfig();
  return { success: true, config: setupConfig };
});

ipcMain.handle('setup:save-config', async (event, { config }) => {
  try {
    setupConfig = { ...setupConfig, ...config };
    saveSetupConfig(setupConfig);
    return { success: true, config: setupConfig };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('setup:is-complete', async () => {
  setupConfig = loadSetupConfig();
  return { success: true, complete: setupConfig.setupComplete };
});

ipcMain.handle('setup:reset', async () => {
  try {
    setupConfig = { 
      setupComplete: false,
      role: null,
      serverConfig: null,
      clientConfig: null
    };
    saveSetupConfig(setupConfig);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});
