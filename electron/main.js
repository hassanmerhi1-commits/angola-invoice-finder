const { app, BrowserWindow, Menu, ipcMain } = require('electron');
const path = require('path');
const crypto = require('crypto');

// Handle creating/removing shortcuts on Windows when installing/uninstalling
if (require('electron-squirrel-startup')) {
  app.quit();
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
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
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
app.whenReady().then(createWindow);

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
