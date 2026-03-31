/**
 * Kwanza ERP - Main Process
 * 
 * Architecture copied from PayrollAO (friendly-companion):
 * - IP file at C:\Kwanza ERP\IP determines mode
 * - Server mode: local SQLite DB path → opens DB, starts WebSocket server
 * - Client mode: server hostname/IP → connects via WebSocket
 * - Auto-updater via GitHub releases
 * - Multi-company support via companies.json registry
 * 
 * IP file format:
 *   Server: C:\Kwanza ERP\erp.db  (local path = server mode)
 *   Client: SERVIDOR or 10.0.0.5  (hostname/IP = client mode)
 */

const { app, BrowserWindow, Menu, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');

function requireRuntimeModule(moduleName) {
  const candidates = [
    () => require(moduleName),
    () => process.resourcesPath ? require(path.join(process.resourcesPath, 'runtime-deps', 'node_modules', moduleName)) : null,
    () => process.resourcesPath ? require(path.join(process.resourcesPath, 'app.asar.unpacked', 'node_modules', moduleName)) : null,
    () => process.resourcesPath ? require(path.join(process.resourcesPath, 'app', 'node_modules', moduleName)) : null,
    () => require(path.join(__dirname, '..', 'node_modules', moduleName)),
  ];

  let lastError = null;
  for (const load of candidates) {
    try {
      const mod = load();
      if (mod) return mod;
    } catch (error) {
      lastError = error;
    }
  }

  console.error(`[Startup] Failed to load runtime module "${moduleName}":`, lastError?.message || 'Unknown error');
  return null;
}

const wsModule = requireRuntimeModule('ws');

class MissingWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;

  constructor() {
    throw new Error('Missing "ws" module in this desktop build. Rebuild and reinstall the app.');
  }
}

class MissingWebSocketServer {
  constructor() {
    throw new Error('Missing "ws" module in this desktop build. Rebuild and reinstall the app.');
  }
}

const WebSocket = wsModule?.WebSocket || wsModule || MissingWebSocket;
const WebSocketServer = wsModule?.WebSocketServer || MissingWebSocketServer;

const updaterModule = requireRuntimeModule('electron-updater');

function createNoopAutoUpdater() {
  const fail = () => Promise.reject(new Error('Missing "electron-updater" module in this desktop build.'));
  return {
    autoDownload: false,
    autoInstallOnAppQuit: false,
    logger: console,
    checkForUpdates: fail,
    downloadUpdate: fail,
    quitAndInstall: () => {},
    on: () => {},
  };
}

const autoUpdater = updaterModule?.autoUpdater || createNoopAutoUpdater();

// ============= AUTO-UPDATER CONFIGURATION =============
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;
autoUpdater.logger = console;

// ============= CONFIGURATION =============
const INSTALL_DIR = 'C:\\Kwanza ERP';
const IP_FILE_PATH = path.join(INSTALL_DIR, 'IP');
const COMPANIES_FILE_PATH = path.join(INSTALL_DIR, 'companies.json');
const WS_PORT = 4546; // Different from PayrollAO to avoid conflict

// Ensure install directory exists
if (!fs.existsSync(INSTALL_DIR)) {
  try {
    fs.mkdirSync(INSTALL_DIR, { recursive: true });
  } catch (err) {
    console.error('Failed to create install directory:', err);
  }
}

// Create empty IP file if it doesn't exist
const DEFAULT_DB_PATH = path.join(INSTALL_DIR, 'erp.db');
if (!fs.existsSync(IP_FILE_PATH)) {
  try {
    fs.writeFileSync(IP_FILE_PATH, '', 'utf-8');
    console.log('Created empty IP file at:', IP_FILE_PATH);
  } catch (err) {
    console.error('Failed to create IP file:', err);
  }
}

// ============= GLOBALS =============
let mainWindow = null;
let splashWindow = null;
let purchaseInvoiceWindow = null;
let purchaseProductPickerWindow = null;
let resolveProductPickerSelection = null;
let db = null;
let dbPath = null;
let isServerMode = false;
let serverAddress = null;
let wss = null;
let wsClient = null;
let wsReconnectTimer = null;
let wsConnectingPromise = null;
const WS_RECONNECT_DELAY = 3000;
const companyDatabases = new Map();
const wsClientCompanies = new WeakMap();

// ============= COMPANY REGISTRY =============
function loadCompaniesRegistry() {
  try {
    if (fs.existsSync(COMPANIES_FILE_PATH)) {
      return JSON.parse(fs.readFileSync(COMPANIES_FILE_PATH, 'utf-8'));
    }
  } catch (e) {
    console.error('[Companies] Error loading registry:', e);
  }
  return [];
}

function saveCompaniesRegistry(companies) {
  try {
    fs.writeFileSync(COMPANIES_FILE_PATH, JSON.stringify(companies, null, 2), 'utf-8');
    return true;
  } catch (e) {
    console.error('[Companies] Error saving registry:', e);
    return false;
  }
}

function getCompanyDb(companyId) {
  if (!companyId) return db;
  const entry = companyDatabases.get(companyId);
  if (entry?.db) return entry.db;

  const companies = loadCompaniesRegistry();
  const company = companies.find(c => c.id === companyId);
  if (!company) return null;

  const fullPath = path.isAbsolute(company.dbFile)
    ? company.dbFile
    : path.join(INSTALL_DIR, company.dbFile);
  if (!fs.existsSync(fullPath)) return null;

  try {
    const companyDb = openDatabase(fullPath);
    runMigrationsOn(companyDb);
    companyDatabases.set(companyId, { db: companyDb, path: fullPath, name: company.name });
    console.log(`[Companies] Opened database for ${company.name}: ${fullPath}`);
    return companyDb;
  } catch (e) {
    console.error('[Companies] Error opening database:', e);
    return null;
  }
}

function createCompany(name) {
  try {
    const companies = loadCompaniesRegistry();
    const id = 'company-' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
    const safeName = name.replace(/[^a-zA-Z0-9_\-\s]/g, '').replace(/\s+/g, '_').toLowerCase();
    const dbFile = `erp-${safeName}.db`;
    const fullPath = path.join(INSTALL_DIR, dbFile);

    if (fs.existsSync(fullPath)) {
      return { success: false, error: 'Já existe uma base de dados com este nome' };
    }

    const result = createNewDatabaseInternal(fullPath);
    if (!result.success) return result;

    const companyDb = openDatabase(fullPath);
    runMigrationsOn(companyDb);
    companyDatabases.set(id, { db: companyDb, path: fullPath, name });

    companies.push({ id, name, dbFile });
    saveCompaniesRegistry(companies);

    console.log(`[Companies] Created new company: ${name} (${dbFile})`);
    return { success: true, company: { id, name, dbFile } };
  } catch (e) {
    console.error('[Companies] Error creating company:', e);
    return { success: false, error: e.message };
  }
}

function ensureCompaniesRegistry() {
  const companies = loadCompaniesRegistry();
  if (!dbPath) return companies;

  const activeServerPath = path.normalize(dbPath);
  const hasSamePath = (candidatePath) => {
    if (!candidatePath) return false;
    const resolved = path.isAbsolute(candidatePath)
      ? candidatePath
      : path.join(INSTALL_DIR, candidatePath);
    return path.normalize(resolved) === activeServerPath;
  };

  let changed = false;
  let defaultCompany = companies.find(c => c.id === 'company-default');

  if (!defaultCompany) {
    defaultCompany = { id: 'company-default', name: 'Empresa Principal', dbFile: dbPath };
    companies.unshift(defaultCompany);
    changed = true;
  } else if (!hasSamePath(defaultCompany.dbFile) || defaultCompany.name !== 'Empresa Principal') {
    defaultCompany.dbFile = dbPath;
    defaultCompany.name = 'Empresa Principal';
    changed = true;
  }

  companyDatabases.set('company-default', { db, path: dbPath, name: 'Empresa Principal' });
  if (changed) saveCompaniesRegistry(companies);
  return companies;
}

function runMigrationsOn(targetDb) {
  const originalDb = db;
  db = targetDb;
  try { runMigrations(); } finally { db = originalDb; }
}

// ============= IP FILE PARSING =============
function parseIPFile() {
  try {
    if (!fs.existsSync(IP_FILE_PATH)) {
      return { valid: false, error: 'IP file not found', path: null, isServer: false };
    }
    const content = fs.readFileSync(IP_FILE_PATH, 'utf-8').trim();
    if (!content) {
      return { valid: false, error: 'IP file is empty', path: null, isServer: false };
    }
    // Server mode - local path like C:\Kwanza ERP\erp.db
    if (/^[A-Za-z]:\\.+$/.test(content)) {
      return { valid: true, path: content, isServer: true };
    }
    // Client mode - hostname or IP
    const serverMatch = content.match(/^([A-Za-z0-9_\-\.]+)$/);
    if (serverMatch) {
      return { valid: true, path: null, isServer: false, serverAddress: serverMatch[1] };
    }
    return { valid: false, error: 'Invalid IP file format', path: null, isServer: false };
  } catch (error) {
    return { valid: false, error: error.message, path: null, isServer: false };
  }
}

// ============= WEBSOCKET SERVER (SERVER MODE) =============
const ERP_TABLES = [
  'users', 'user_permissions', 'user_sessions', 'branches', 'categories', 'products',
  'clients', 'suppliers',
  'chart_of_accounts', 'journal_entries', 'journal_entry_lines',
  'sales', 'sale_items', 'proformas', 'proforma_items',
  'purchase_orders', 'purchase_order_items',
  'credit_notes', 'credit_note_items', 'debit_notes', 'debit_note_items',
  'receipts', 'payments',
  'stock_movements', 'stock_transfers', 'stock_transfer_items',
  'invoices', 'daily_reports', 'caixas', 'caixa_transactions',
  'bank_accounts', 'bank_transactions', 'expenses',
  'settings', 'audit_logs'
];

function startWebSocketServer() {
  if (wss) return { success: true, port: WS_PORT };

  try {
    wss = new WebSocketServer({ port: WS_PORT, host: '0.0.0.0' });
    console.log(`✅ WebSocket server running on port ${WS_PORT}`);

    wss.on('connection', (ws, req) => {
      const clientIP = req.socket.remoteAddress;
      console.log(`[WS] Client connected from ${clientIP}`);

      ws.on('message', (raw) => {
        try {
          const msg = JSON.parse(raw.toString());
          console.log(`[WS] ← ${msg.action}(${msg.table || ''}) from ${clientIP}`);

          if (msg.action === 'listCompanies') {
            const companies = ensureCompaniesRegistry();
            ws.send(JSON.stringify({ success: true, data: companies, requestId: msg.requestId }));
            return;
          }
          if (msg.action === 'createCompany') {
            const result = createCompany(msg.name);
            ws.send(JSON.stringify({ ...result, requestId: msg.requestId }));
            return;
          }
          if (msg.action === 'setCompany') {
            wsClientCompanies.set(ws, msg.companyId);
            const targetDb = getCompanyDb(msg.companyId);
            if (targetDb) {
              for (const table of ERP_TABLES) {
                try {
                  const rows = dbGetAll(table, targetDb);
                  ws.send(JSON.stringify({ type: 'db-sync', table, rows, companyId: msg.companyId }));
                } catch (e) { /* table might not exist yet */ }
              }
            }
            ws.send(JSON.stringify({ success: true, requestId: msg.requestId }));
            return;
          }

          const response = handleDBRequest(msg);
          ws.send(JSON.stringify({ ...response, requestId: msg.requestId }));
        } catch (err) {
          ws.send(JSON.stringify({ success: false, error: err.message }));
        }
      });

      ws.on('close', () => console.log(`[WS] Client disconnected: ${clientIP}`));
      ws.on('error', (err) => console.log(`[WS] Client error: ${err.message}`));
    });

    wss.on('error', (err) => { console.error('[WS] Server error:', err); wss = null; });
    return { success: true, port: WS_PORT };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

function broadcastTableData(table, companyId = null, targetDb = null) {
  const database = targetDb || db;
  let rows = [];
  try { rows = dbGetAll(table, database); } catch (e) { return; }
  const message = JSON.stringify({ type: 'db-sync', table, rows, companyId });

  if (wss) {
    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        const clientCompany = wsClientCompanies.get(client);
        if (!companyId || !clientCompany || clientCompany === companyId) {
          client.send(message);
        }
      }
    });
  }
  mainWindow?.webContents.send('erp:sync', { table, rows, companyId });
}

function broadcastUpdate(table, action, id, companyId = null, targetDb = null) {
  if (table === 'all') {
    ERP_TABLES.forEach(t => broadcastTableData(t, companyId, targetDb));
    return;
  }
  broadcastTableData(table, companyId, targetDb);
}

// ============= WEBSOCKET CLIENT (CLIENT MODE) =============
function connectToServer() {
  if (wsClient && (wsClient.readyState === WebSocket.OPEN || wsClient.readyState === WebSocket.CONNECTING)) return;

  const url = `ws://${serverAddress}:${WS_PORT}`;
  console.log(`[WS] Connecting to server: ${url}`);

  try {
    wsClient = new WebSocket(url);

    wsClient.on('open', () => {
      console.log(`✅ Connected to ERP server: ${serverAddress}`);
      if (wsReconnectTimer) { clearTimeout(wsReconnectTimer); wsReconnectTimer = null; }
      try { mainWindow?.webContents.send('erp:updated', { table: 'all', action: 'connected' }); } catch (e) {}
    });

    wsClient.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'db-sync') {
          mainWindow?.webContents.send('erp:sync', { table: msg.table, rows: msg.rows, companyId: msg.companyId });
          return;
        }
        if (msg.type === 'db-updated') {
          mainWindow?.webContents.send('erp:updated', msg);
        }
      } catch (err) {}
    });

    wsClient.on('close', () => { wsClient = null; scheduleReconnect(); });
    wsClient.on('error', (err) => console.error('[WS] Connection error:', err.message));
  } catch (error) {
    scheduleReconnect();
  }
}

function scheduleReconnect() {
  if (wsReconnectTimer) return;
  wsReconnectTimer = setTimeout(() => {
    wsReconnectTimer = null;
    if (!isServerMode && serverAddress) connectToServer();
  }, WS_RECONNECT_DELAY);
}

function ensureClientConnected(timeoutMs = 10000) {
  if (wsClient && wsClient.readyState === WebSocket.OPEN) return Promise.resolve();
  if (!serverAddress) return Promise.reject(new Error('Server address not configured'));
  if (wsConnectingPromise) return wsConnectingPromise;

  if (!wsClient || wsClient.readyState !== WebSocket.CONNECTING) connectToServer();
  const socket = wsClient;

  wsConnectingPromise = new Promise((resolve, reject) => {
    if (!socket) { wsConnectingPromise = null; reject(new Error('WebSocket not initialized')); return; }
    const timer = setTimeout(() => { cleanup(); reject(new Error('Connection timeout')); }, timeoutMs);

    const onOpen = () => { cleanup(); resolve(); };
    const onClose = () => { cleanup(); reject(new Error('Connection closed')); };
    const onError = (err) => { cleanup(); reject(new Error(err?.message || 'Connection error')); };

    const cleanup = () => {
      clearTimeout(timer);
      try { socket.off('open', onOpen); socket.off('close', onClose); socket.off('error', onError); } catch (e) {}
      wsConnectingPromise = null;
    };

    if (socket.readyState === WebSocket.OPEN) { cleanup(); resolve(); return; }
    socket.on('open', onOpen);
    socket.on('close', onClose);
    socket.on('error', onError);
  });

  return wsConnectingPromise;
}

async function sendToServer(request) {
  await ensureClientConnected();
  return new Promise((resolve, reject) => {
    if (!wsClient || wsClient.readyState !== WebSocket.OPEN) { reject(new Error('Not connected')); return; }
    const requestId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
    const timeout = setTimeout(() => reject(new Error('Request timeout')), 30000);
    const handler = (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.requestId === requestId) { clearTimeout(timeout); wsClient.off('message', handler); resolve(msg); }
      } catch (err) {}
    };
    wsClient.on('message', handler);
    wsClient.send(JSON.stringify({ ...request, requestId }));
  });
}

// ============= DATABASE REQUEST HANDLER =============
function handleDBRequest(request) {
  const { action, table, id, data, sql, params, companyId } = request;
  const targetDb = companyId ? getCompanyDb(companyId) : db;
  if (!targetDb && companyId) return { success: false, error: `Company database not found: ${companyId}` };

  try {
    switch (action) {
      case 'ping': return { success: true, message: 'pong', isServer: true };
      case 'getAll': return { success: true, data: dbGetAll(table, targetDb) };
      case 'getById': return { success: true, data: dbGetById(table, id, targetDb) };
      case 'insert': return dbInsert(table, data, targetDb, companyId);
      case 'update': return dbUpdate(table, id, data, targetDb, companyId);
      case 'delete': return dbDelete(table, id, targetDb, companyId);
      case 'query':
        const result = dbQuery(sql, params || [], targetDb);
        return Array.isArray(result) ? { success: true, data: result } : result;
      case 'export': return { success: true, data: dbExportAll(targetDb) };
      case 'import': return dbImportAll(data, targetDb, companyId);
      default: return { success: false, error: `Unknown action: ${action}` };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// ============= DATABASE OPERATIONS =============
function openDatabase(filePath) {
  const Database = require('better-sqlite3');
  const database = new Database(filePath, { timeout: 30000 });
  database.pragma('journal_mode = WAL');
  database.pragma('busy_timeout = 30000');
  database.pragma('synchronous = NORMAL');
  return database;
}

function dbGetAll(table, targetDb = null) {
  const database = targetDb || db;
  if (!database) return [];
  try { return database.prepare(`SELECT * FROM ${table}`).all(); } catch (e) { return []; }
}

function dbGetById(table, id, targetDb = null) {
  const database = targetDb || db;
  if (!database) return null;
  try { return database.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id); } catch (e) { return null; }
}

function dbInsert(table, data, targetDb = null, companyId = null) {
  const database = targetDb || db;
  if (!database) return { success: false, error: 'Database not connected' };
  try {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const placeholders = keys.map(() => '?').join(', ');
    database.prepare(`INSERT OR REPLACE INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`).run(...values);
    database.pragma('wal_checkpoint(TRUNCATE)');
    // Audit trail - log every insert (except audit_logs itself to prevent recursion)
    if (table !== 'audit_logs' && table !== 'user_sessions') {
      try {
        const auditId = 'audit-' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
        database.prepare(
          `INSERT INTO audit_logs (id, action, entity_type, entity_id, new_value, timestamp) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`
        ).run(auditId, 'INSERT', table, data.id || '', JSON.stringify(data));
      } catch (e) { /* audit table might not exist yet */ }
    }
    broadcastUpdate(table, 'insert', data.id, companyId, database);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

function dbUpdate(table, id, data, targetDb = null, companyId = null) {
  const database = targetDb || db;
  if (!database) return { success: false, error: 'Database not connected' };
  try {
    // Capture previous value for audit
    let previousValue = null;
    if (table !== 'audit_logs' && table !== 'user_sessions') {
      try { previousValue = database.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id); } catch (e) {}
    }
    const updates = Object.keys(data).map(key => `${key} = ?`).join(', ');
    const values = [...Object.values(data), id];
    database.prepare(`UPDATE ${table} SET ${updates}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(...values);
    database.pragma('wal_checkpoint(TRUNCATE)');
    // Audit trail
    if (table !== 'audit_logs' && table !== 'user_sessions') {
      try {
        const auditId = 'audit-' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
        database.prepare(
          `INSERT INTO audit_logs (id, action, entity_type, entity_id, previous_value, new_value, timestamp) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`
        ).run(auditId, 'UPDATE', table, id, previousValue ? JSON.stringify(previousValue) : null, JSON.stringify(data));
      } catch (e) {}
    }
    broadcastUpdate(table, 'update', id, companyId, database);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

function dbDelete(table, id, targetDb = null, companyId = null) {
  const database = targetDb || db;
  if (!database) return { success: false, error: 'Database not connected' };
  try {
    // Capture value before delete for audit
    let previousValue = null;
    if (table !== 'audit_logs' && table !== 'user_sessions') {
      try { previousValue = database.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id); } catch (e) {}
    }
    database.prepare(`DELETE FROM ${table} WHERE id = ?`).run(id);
    database.pragma('wal_checkpoint(TRUNCATE)');
    // Audit trail
    if (table !== 'audit_logs' && table !== 'user_sessions') {
      try {
        const auditId = 'audit-' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
        database.prepare(
          `INSERT INTO audit_logs (id, action, entity_type, entity_id, previous_value, timestamp) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`
        ).run(auditId, 'DELETE', table, id, previousValue ? JSON.stringify(previousValue) : null);
      } catch (e) {}
    }
    broadcastUpdate(table, 'delete', id, companyId, database);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

function dbQuery(sql, params = [], targetDb = null) {
  const database = targetDb || db;
  if (!database) return { success: false, error: 'Database not connected' };
  try {
    const stmt = database.prepare(sql);
    return sql.trim().toUpperCase().startsWith('SELECT') ? stmt.all(...params) : stmt.run(...params);
  } catch (error) {
    return { success: false, error: error.message };
  }
}

function dbExportAll(targetDb = null) {
  const database = targetDb || db;
  if (!database) return null;
  const data = { exportedAt: new Date().toISOString() };
  for (const table of ERP_TABLES) {
    try { data[table] = dbGetAll(table, database); } catch (e) { data[table] = []; }
  }
  return data;
}

function dbImportAll(data, targetDb = null, companyId = null) {
  const database = targetDb || db;
  if (!database) return { success: false, error: 'Database not connected' };
  try {
    database.exec('BEGIN TRANSACTION');
    for (const table of ERP_TABLES) {
      if (data[table] && Array.isArray(data[table])) {
        database.exec(`DELETE FROM ${table}`);
        for (const row of data[table]) {
          const keys = Object.keys(row);
          const values = Object.values(row);
          const placeholders = keys.map(() => '?').join(', ');
          database.prepare(`INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`).run(...values);
        }
      }
    }
    database.exec('COMMIT');
    broadcastUpdate('all', 'import', null, companyId, database);
    return { success: true };
  } catch (error) {
    try { database.exec('ROLLBACK'); } catch (e) {}
    return { success: false, error: error.message };
  }
}

// ============= DATABASE SCHEMA =============
function createNewDatabaseInternal(targetPath) {
  try {
    const parentDir = path.dirname(targetPath);
    if (!fs.existsSync(parentDir)) fs.mkdirSync(parentDir, { recursive: true });

    const Database = require('better-sqlite3');
    const newDb = new Database(targetPath);
    newDb.pragma('journal_mode = WAL');
    newDb.pragma('busy_timeout = 30000');
    newDb.pragma('synchronous = NORMAL');

    newDb.exec(`
      -- ==================== USERS & AUTH ====================
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        name TEXT,
        role TEXT DEFAULT 'cashier',
        branch_id TEXT,
        custom_permissions TEXT,
        is_active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      -- ==================== BRANCHES ====================
      CREATE TABLE IF NOT EXISTS branches (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        code TEXT UNIQUE,
        address TEXT,
        phone TEXT,
        email TEXT,
        province TEXT,
        city TEXT,
        is_main INTEGER DEFAULT 0,
        is_active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      -- ==================== CATEGORIES ====================
      CREATE TABLE IF NOT EXISTS categories (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        parent_id TEXT,
        is_active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      -- ==================== PRODUCTS ====================
      CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY,
        sku TEXT,
        barcode TEXT,
        name TEXT NOT NULL,
        description TEXT,
        category_id TEXT,
        unit TEXT DEFAULT 'un',
        price REAL DEFAULT 0,
        price_2 REAL DEFAULT 0,
        price_3 REAL DEFAULT 0,
        price_4 REAL DEFAULT 0,
        cost REAL DEFAULT 0,
        first_cost REAL DEFAULT 0,
        last_cost REAL DEFAULT 0,
        weighted_avg_cost REAL DEFAULT 0,
        stock REAL DEFAULT 0,
        min_stock REAL DEFAULT 0,
        max_stock REAL DEFAULT 0,
        branch_id TEXT,
        supplier_id TEXT,
        supplier_name TEXT,
        tax_rate REAL DEFAULT 14,
        is_active INTEGER DEFAULT 1,
        image TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      -- ==================== CLIENTS ====================
      CREATE TABLE IF NOT EXISTS clients (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        nif TEXT,
        email TEXT,
        phone TEXT,
        address TEXT,
        city TEXT,
        province TEXT,
        credit_limit REAL DEFAULT 0,
        balance REAL DEFAULT 0,
        notes TEXT,
        is_active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      -- ==================== SUPPLIERS ====================
      CREATE TABLE IF NOT EXISTS suppliers (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        nif TEXT,
        email TEXT,
        phone TEXT,
        address TEXT,
        city TEXT,
        province TEXT,
        contact_person TEXT,
        payment_terms TEXT,
        balance REAL DEFAULT 0,
        notes TEXT,
        is_active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      -- ==================== SALES ====================
      CREATE TABLE IF NOT EXISTS sales (
        id TEXT PRIMARY KEY,
        invoice_number TEXT,
        invoice_type TEXT DEFAULT 'FT',
        branch_id TEXT,
        client_id TEXT,
        client_name TEXT,
        client_nif TEXT,
        subtotal REAL DEFAULT 0,
        tax_amount REAL DEFAULT 0,
        discount REAL DEFAULT 0,
        total REAL DEFAULT 0,
        amount_paid REAL DEFAULT 0,
        change_amount REAL DEFAULT 0,
        payment_method TEXT DEFAULT 'cash',
        status TEXT DEFAULT 'completed',
        cashier_id TEXT,
        cashier_name TEXT,
        caixa_id TEXT,
        notes TEXT,
        agt_hash TEXT,
        agt_signature TEXT,
        agt_code TEXT,
        synced_to_main INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS sale_items (
        id TEXT PRIMARY KEY,
        sale_id TEXT NOT NULL,
        product_id TEXT,
        product_name TEXT,
        sku TEXT,
        quantity REAL DEFAULT 0,
        unit_price REAL DEFAULT 0,
        cost_at_sale REAL DEFAULT 0,
        discount REAL DEFAULT 0,
        tax_rate REAL DEFAULT 14,
        tax_amount REAL DEFAULT 0,
        total REAL DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      -- ==================== PURCHASE ORDERS ====================
      CREATE TABLE IF NOT EXISTS purchase_orders (
        id TEXT PRIMARY KEY,
        po_number TEXT,
        supplier_id TEXT,
        supplier_name TEXT,
        branch_id TEXT,
        subtotal REAL DEFAULT 0,
        freight REAL DEFAULT 0,
        other_costs REAL DEFAULT 0,
        tax_amount REAL DEFAULT 0,
        total REAL DEFAULT 0,
        status TEXT DEFAULT 'draft',
        expected_date TEXT,
        received_date TEXT,
        received_by TEXT,
        notes TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS purchase_order_items (
        id TEXT PRIMARY KEY,
        po_id TEXT NOT NULL,
        product_id TEXT,
        product_name TEXT,
        sku TEXT,
        quantity_ordered REAL DEFAULT 0,
        quantity_received REAL DEFAULT 0,
        unit_cost REAL DEFAULT 0,
        freight_allocation REAL DEFAULT 0,
        effective_cost REAL DEFAULT 0,
        tax_rate REAL DEFAULT 14,
        total REAL DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      -- ==================== STOCK MOVEMENTS ====================
      CREATE TABLE IF NOT EXISTS stock_movements (
        id TEXT PRIMARY KEY,
        product_id TEXT NOT NULL,
        product_name TEXT,
        sku TEXT,
        branch_id TEXT,
        type TEXT NOT NULL,
        quantity REAL DEFAULT 0,
        reason TEXT,
        reference_id TEXT,
        reference_number TEXT,
        cost_at_time REAL DEFAULT 0,
        notes TEXT,
        created_by TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      -- ==================== STOCK TRANSFERS ====================
      CREATE TABLE IF NOT EXISTS stock_transfers (
        id TEXT PRIMARY KEY,
        transfer_number TEXT,
        from_branch_id TEXT,
        to_branch_id TEXT,
        status TEXT DEFAULT 'pending',
        requested_by TEXT,
        approved_by TEXT,
        received_by TEXT,
        requested_at TEXT DEFAULT CURRENT_TIMESTAMP,
        approved_at TEXT,
        received_at TEXT,
        notes TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS stock_transfer_items (
        id TEXT PRIMARY KEY,
        transfer_id TEXT NOT NULL,
        product_id TEXT,
        product_name TEXT,
        sku TEXT,
        quantity REAL DEFAULT 0,
        received_quantity REAL DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      -- ==================== INVOICES (FISCAL) ====================
      CREATE TABLE IF NOT EXISTS invoices (
        id TEXT PRIMARY KEY,
        invoice_number TEXT,
        type TEXT DEFAULT 'FT',
        sale_id TEXT,
        client_id TEXT,
        client_name TEXT,
        client_nif TEXT,
        subtotal REAL DEFAULT 0,
        tax_amount REAL DEFAULT 0,
        total REAL DEFAULT 0,
        status TEXT DEFAULT 'issued',
        agt_hash TEXT,
        agt_signature TEXT,
        agt_code TEXT,
        agt_status TEXT,
        pdf_path TEXT,
        notes TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      -- ==================== DAILY REPORTS ====================
      CREATE TABLE IF NOT EXISTS daily_reports (
        id TEXT PRIMARY KEY,
        date TEXT,
        branch_id TEXT,
        branch_name TEXT,
        total_sales REAL DEFAULT 0,
        total_transactions INTEGER DEFAULT 0,
        cash_total REAL DEFAULT 0,
        card_total REAL DEFAULT 0,
        transfer_total REAL DEFAULT 0,
        tax_collected REAL DEFAULT 0,
        opening_balance REAL DEFAULT 0,
        closing_balance REAL DEFAULT 0,
        status TEXT DEFAULT 'open',
        closed_by TEXT,
        closed_at TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      -- ==================== CAIXA (CASH BOX) ====================
      CREATE TABLE IF NOT EXISTS caixas (
        id TEXT PRIMARY KEY,
        name TEXT,
        branch_id TEXT,
        opened_by TEXT,
        closed_by TEXT,
        opening_balance REAL DEFAULT 0,
        closing_balance REAL DEFAULT 0,
        cash_sales REAL DEFAULT 0,
        card_sales REAL DEFAULT 0,
        transfer_sales REAL DEFAULT 0,
        withdrawals REAL DEFAULT 0,
        deposits REAL DEFAULT 0,
        status TEXT DEFAULT 'open',
        opened_at TEXT DEFAULT CURRENT_TIMESTAMP,
        closed_at TEXT,
        notes TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS caixa_transactions (
        id TEXT PRIMARY KEY,
        caixa_id TEXT NOT NULL,
        type TEXT NOT NULL,
        amount REAL DEFAULT 0,
        description TEXT,
        reference_id TEXT,
        created_by TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      -- ==================== BANK ACCOUNTS ====================
      CREATE TABLE IF NOT EXISTS bank_accounts (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        bank_name TEXT,
        account_number TEXT,
        iban TEXT,
        branch_id TEXT,
        currency TEXT DEFAULT 'AOA',
        balance REAL DEFAULT 0,
        is_active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS bank_transactions (
        id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL,
        type TEXT NOT NULL,
        amount REAL DEFAULT 0,
        description TEXT,
        reference TEXT,
        balance_after REAL DEFAULT 0,
        created_by TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      -- ==================== EXPENSES ====================
      CREATE TABLE IF NOT EXISTS expenses (
        id TEXT PRIMARY KEY,
        description TEXT NOT NULL,
        category TEXT,
        amount REAL DEFAULT 0,
        branch_id TEXT,
        payment_method TEXT,
        status TEXT DEFAULT 'draft',
        approved_by TEXT,
        approved_at TEXT,
        paid_at TEXT,
        receipt_path TEXT,
        notes TEXT,
        created_by TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      -- ==================== SETTINGS ====================
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      -- ==================== USER PERMISSIONS ====================
      CREATE TABLE IF NOT EXISTS user_permissions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        permission TEXT NOT NULL,
        granted INTEGER DEFAULT 1,
        granted_by TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, permission)
      );

      -- ==================== USER SESSIONS ====================
      CREATE TABLE IF NOT EXISTS user_sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        user_name TEXT,
        login_at TEXT DEFAULT CURRENT_TIMESTAMP,
        logout_at TEXT,
        ip_address TEXT,
        computer_name TEXT,
        branch_id TEXT,
        is_active INTEGER DEFAULT 1
      );

      -- ==================== CHART OF ACCOUNTS ====================
      CREATE TABLE IF NOT EXISTS chart_of_accounts (
        id TEXT PRIMARY KEY,
        account_number TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        type TEXT NOT NULL, -- asset, liability, equity, revenue, expense
        category TEXT, -- Clientes, Fornecedores, Caixa, Bancos, Ativos, Recebimentos, Custos, Funcionarios, Capital
        parent_id TEXT,
        currency TEXT DEFAULT 'KZ',
        is_active INTEGER DEFAULT 1,
        balance REAL DEFAULT 0,
        debit_total REAL DEFAULT 0,
        credit_total REAL DEFAULT 0,
        notes TEXT,
        created_by TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      -- ==================== JOURNAL ENTRIES ====================
      CREATE TABLE IF NOT EXISTS journal_entries (
        id TEXT PRIMARY KEY,
        entry_number TEXT,
        date TEXT NOT NULL,
        type TEXT DEFAULT 'VENDA', -- VENDA, COMPRA, RECIBO, PAGAMENTO, AJUSTE, ABERTURA
        reference TEXT,
        reference_id TEXT,
        description TEXT,
        currency TEXT DEFAULT 'KZ',
        exchange_rate REAL DEFAULT 1,
        total_debit REAL DEFAULT 0,
        total_credit REAL DEFAULT 0,
        is_balanced INTEGER DEFAULT 1,
        status TEXT DEFAULT 'posted', -- draft, posted, reversed
        branch_id TEXT,
        created_by TEXT,
        user_name TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS journal_entry_lines (
        id TEXT PRIMARY KEY,
        journal_entry_id TEXT NOT NULL,
        account_id TEXT NOT NULL,
        account_number TEXT,
        account_name TEXT,
        debit REAL DEFAULT 0,
        credit REAL DEFAULT 0,
        description TEXT,
        project TEXT,
        department TEXT,
        contact TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      -- ==================== PROFORMAS ====================
      CREATE TABLE IF NOT EXISTS proformas (
        id TEXT PRIMARY KEY,
        proforma_number TEXT,
        client_id TEXT,
        client_name TEXT,
        client_nif TEXT,
        branch_id TEXT,
        account_id TEXT,
        subtotal REAL DEFAULT 0,
        tax_amount REAL DEFAULT 0,
        discount REAL DEFAULT 0,
        total REAL DEFAULT 0,
        currency TEXT DEFAULT 'KZ',
        status TEXT DEFAULT 'draft', -- draft, sent, converted, cancelled
        converted_to_sale_id TEXT,
        valid_until TEXT,
        notes TEXT,
        created_by TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS proforma_items (
        id TEXT PRIMARY KEY,
        proforma_id TEXT NOT NULL,
        product_id TEXT,
        product_name TEXT,
        description TEXT,
        quantity REAL DEFAULT 0,
        unit_price REAL DEFAULT 0,
        discount REAL DEFAULT 0,
        tax_rate REAL DEFAULT 14,
        tax_amount REAL DEFAULT 0,
        total REAL DEFAULT 0,
        branch_id TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      -- ==================== CREDIT NOTES ====================
      CREATE TABLE IF NOT EXISTS credit_notes (
        id TEXT PRIMARY KEY,
        document_number TEXT,
        branch_id TEXT,
        original_invoice_id TEXT,
        original_invoice_number TEXT,
        client_id TEXT,
        client_name TEXT,
        client_nif TEXT,
        reason TEXT,
        reason_description TEXT,
        subtotal REAL DEFAULT 0,
        tax_amount REAL DEFAULT 0,
        total REAL DEFAULT 0,
        status TEXT DEFAULT 'draft',
        agt_hash TEXT,
        created_by TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS credit_note_items (
        id TEXT PRIMARY KEY,
        credit_note_id TEXT NOT NULL,
        product_id TEXT,
        product_name TEXT,
        quantity REAL DEFAULT 0,
        unit_price REAL DEFAULT 0,
        tax_rate REAL DEFAULT 14,
        tax_amount REAL DEFAULT 0,
        total REAL DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      -- ==================== DEBIT NOTES ====================
      CREATE TABLE IF NOT EXISTS debit_notes (
        id TEXT PRIMARY KEY,
        document_number TEXT,
        branch_id TEXT,
        original_invoice_id TEXT,
        original_invoice_number TEXT,
        client_id TEXT,
        client_name TEXT,
        client_nif TEXT,
        reason TEXT,
        reason_description TEXT,
        subtotal REAL DEFAULT 0,
        tax_amount REAL DEFAULT 0,
        total REAL DEFAULT 0,
        status TEXT DEFAULT 'draft',
        agt_hash TEXT,
        created_by TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS debit_note_items (
        id TEXT PRIMARY KEY,
        debit_note_id TEXT NOT NULL,
        description TEXT,
        quantity REAL DEFAULT 0,
        unit_price REAL DEFAULT 0,
        tax_rate REAL DEFAULT 14,
        tax_amount REAL DEFAULT 0,
        total REAL DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      -- ==================== RECEIPTS (Recibos) ====================
      CREATE TABLE IF NOT EXISTS receipts (
        id TEXT PRIMARY KEY,
        receipt_number TEXT,
        invoice_id TEXT,
        invoice_number TEXT,
        client_id TEXT,
        client_name TEXT,
        amount REAL DEFAULT 0,
        payment_method TEXT DEFAULT 'cash',
        bank_account_id TEXT,
        reference TEXT,
        branch_id TEXT,
        notes TEXT,
        created_by TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      -- ==================== PAYMENTS (Pagamentos) ====================
      CREATE TABLE IF NOT EXISTS payments (
        id TEXT PRIMARY KEY,
        payment_number TEXT,
        supplier_id TEXT,
        supplier_name TEXT,
        purchase_order_id TEXT,
        po_number TEXT,
        amount REAL DEFAULT 0,
        payment_method TEXT DEFAULT 'cash',
        bank_account_id TEXT,
        cheque_number TEXT,
        reference TEXT,
        branch_id TEXT,
        notes TEXT,
        created_by TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      -- ==================== AUDIT LOG (Enhanced) ====================
      CREATE TABLE IF NOT EXISTS audit_logs (
        id TEXT PRIMARY KEY,
        timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
        action TEXT NOT NULL,
        user_id TEXT,
        user_name TEXT,
        entity_type TEXT,
        entity_id TEXT,
        previous_value TEXT,
        new_value TEXT,
        ip_address TEXT,
        computer_name TEXT,
        branch_id TEXT,
        session_id TEXT
      );

      -- ==================== INDEXES ====================
      CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);
      CREATE INDEX IF NOT EXISTS idx_journal_entries_date ON journal_entries(date);
      CREATE INDEX IF NOT EXISTS idx_journal_entry_lines_journal ON journal_entry_lines(journal_entry_id);
      CREATE INDEX IF NOT EXISTS idx_chart_of_accounts_number ON chart_of_accounts(account_number);
      CREATE INDEX IF NOT EXISTS idx_chart_of_accounts_category ON chart_of_accounts(category);
      CREATE INDEX IF NOT EXISTS idx_proformas_client ON proformas(client_id);
      CREATE INDEX IF NOT EXISTS idx_receipts_invoice ON receipts(invoice_id);
      CREATE INDEX IF NOT EXISTS idx_payments_supplier ON payments(supplier_id);
      CREATE INDEX IF NOT EXISTS idx_user_permissions_user ON user_permissions(user_id);
      CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON user_sessions(user_id);
      CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
      CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
      CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(created_at);
      CREATE INDEX IF NOT EXISTS idx_sales_branch ON sales(branch_id);

      -- ==================== DEFAULT DATA ====================
      INSERT OR IGNORE INTO users (id, username, password, name, role) 
      VALUES ('user-admin', 'admin', 'admin123', 'Administrador', 'admin');

      INSERT OR IGNORE INTO users (id, username, password, name, role)
      VALUES ('user-caixa1', 'caixa1', 'caixa123', 'Caixa 1', 'cashier');

      INSERT OR IGNORE INTO branches (id, name, code, is_main) 
      VALUES ('branch-main', 'Sede Principal', 'SEDE', 1);

      -- Default Chart of Accounts (Angolan standard)
      INSERT OR IGNORE INTO chart_of_accounts (id, account_number, name, type, category) VALUES
        ('coa-11', '11', 'Caixa', 'asset', 'Caixa'),
        ('coa-12', '12', 'Depósitos à Ordem', 'asset', 'Bancos'),
        ('coa-21', '21', 'Clientes', 'asset', 'Clientes'),
        ('coa-22', '22', 'Fornecedores', 'liability', 'Fornecedores'),
        ('coa-31', '31', 'Compras', 'expense', 'Custos'),
        ('coa-32', '32', 'Mercadorias', 'asset', 'Ativos'),
        ('coa-34', '34', 'IVA', 'liability', 'Custos'),
        ('coa-43', '43', 'Activos Tangíveis', 'asset', 'Ativos'),
        ('coa-51', '51', 'Capital Social', 'equity', 'Capital'),
        ('coa-61', '61', 'CMVMC', 'expense', 'Custos'),
        ('coa-62', '62', 'Fornecimentos e Serviços', 'expense', 'Custos'),
        ('coa-63', '63', 'Gastos com Pessoal', 'expense', 'Funcionarios'),
        ('coa-69', '69', 'Outros Gastos', 'expense', 'Custos'),
        ('coa-71', '71', 'Vendas', 'revenue', 'Recebimentos'),
        ('coa-72', '72', 'Prestação de Serviços', 'revenue', 'Recebimentos'),
        ('coa-78', '78', 'Outros Rendimentos', 'revenue', 'Recebimentos'),
        ('coa-81', '81', 'Resultado Líquido', 'equity', 'Capital');

      -- Default permissions for admin
      INSERT OR IGNORE INTO user_permissions (id, user_id, permission, granted, granted_by) VALUES
        ('perm-admin-all', 'user-admin', 'all', 1, 'system');
    `);

    newDb.close();
    return { success: true };
  } catch (error) {
    console.error('[DB] Error creating database:', error);
    return { success: false, error: error.message };
  }
}

// ============= MIGRATIONS =============
function runMigrations() {
  if (!db) return;

  const migrate = (sql) => { try { db.exec(sql); } catch (e) { /* already applied */ } };

  // Migration 1: Add new tables for existing databases upgraded from older versions
  migrate(`CREATE TABLE IF NOT EXISTS user_permissions (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL, permission TEXT NOT NULL,
    granted INTEGER DEFAULT 1, granted_by TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, permission)
  )`);
  migrate(`CREATE TABLE IF NOT EXISTS user_sessions (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL, user_name TEXT,
    login_at TEXT DEFAULT CURRENT_TIMESTAMP, logout_at TEXT,
    ip_address TEXT, computer_name TEXT, branch_id TEXT, is_active INTEGER DEFAULT 1
  )`);
  migrate(`CREATE TABLE IF NOT EXISTS chart_of_accounts (
    id TEXT PRIMARY KEY, account_number TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
    type TEXT NOT NULL, category TEXT, parent_id TEXT, currency TEXT DEFAULT 'KZ',
    is_active INTEGER DEFAULT 1, balance REAL DEFAULT 0, debit_total REAL DEFAULT 0,
    credit_total REAL DEFAULT 0, notes TEXT, created_by TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);
  migrate(`CREATE TABLE IF NOT EXISTS journal_entries (
    id TEXT PRIMARY KEY, entry_number TEXT, date TEXT NOT NULL, type TEXT DEFAULT 'VENDA',
    reference TEXT, reference_id TEXT, description TEXT, currency TEXT DEFAULT 'KZ',
    exchange_rate REAL DEFAULT 1, total_debit REAL DEFAULT 0, total_credit REAL DEFAULT 0,
    is_balanced INTEGER DEFAULT 1, status TEXT DEFAULT 'posted', branch_id TEXT,
    created_by TEXT, user_name TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);
  migrate(`CREATE TABLE IF NOT EXISTS journal_entry_lines (
    id TEXT PRIMARY KEY, journal_entry_id TEXT NOT NULL, account_id TEXT NOT NULL,
    account_number TEXT, account_name TEXT, debit REAL DEFAULT 0, credit REAL DEFAULT 0,
    description TEXT, project TEXT, department TEXT, contact TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);
  migrate(`CREATE TABLE IF NOT EXISTS proformas (
    id TEXT PRIMARY KEY, proforma_number TEXT, client_id TEXT, client_name TEXT,
    client_nif TEXT, branch_id TEXT, account_id TEXT, subtotal REAL DEFAULT 0,
    tax_amount REAL DEFAULT 0, discount REAL DEFAULT 0, total REAL DEFAULT 0,
    currency TEXT DEFAULT 'KZ', status TEXT DEFAULT 'draft', converted_to_sale_id TEXT,
    valid_until TEXT, notes TEXT, created_by TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);
  migrate(`CREATE TABLE IF NOT EXISTS proforma_items (
    id TEXT PRIMARY KEY, proforma_id TEXT NOT NULL, product_id TEXT, product_name TEXT,
    description TEXT, quantity REAL DEFAULT 0, unit_price REAL DEFAULT 0,
    discount REAL DEFAULT 0, tax_rate REAL DEFAULT 14, tax_amount REAL DEFAULT 0,
    total REAL DEFAULT 0, branch_id TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);
  migrate(`CREATE TABLE IF NOT EXISTS credit_notes (
    id TEXT PRIMARY KEY, document_number TEXT, branch_id TEXT, original_invoice_id TEXT,
    original_invoice_number TEXT, client_id TEXT, client_name TEXT, client_nif TEXT,
    reason TEXT, reason_description TEXT, subtotal REAL DEFAULT 0, tax_amount REAL DEFAULT 0,
    total REAL DEFAULT 0, status TEXT DEFAULT 'draft', agt_hash TEXT, created_by TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);
  migrate(`CREATE TABLE IF NOT EXISTS credit_note_items (
    id TEXT PRIMARY KEY, credit_note_id TEXT NOT NULL, product_id TEXT, product_name TEXT,
    quantity REAL DEFAULT 0, unit_price REAL DEFAULT 0, tax_rate REAL DEFAULT 14,
    tax_amount REAL DEFAULT 0, total REAL DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);
  migrate(`CREATE TABLE IF NOT EXISTS debit_notes (
    id TEXT PRIMARY KEY, document_number TEXT, branch_id TEXT, original_invoice_id TEXT,
    original_invoice_number TEXT, client_id TEXT, client_name TEXT, client_nif TEXT,
    reason TEXT, reason_description TEXT, subtotal REAL DEFAULT 0, tax_amount REAL DEFAULT 0,
    total REAL DEFAULT 0, status TEXT DEFAULT 'draft', agt_hash TEXT, created_by TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);
  migrate(`CREATE TABLE IF NOT EXISTS debit_note_items (
    id TEXT PRIMARY KEY, debit_note_id TEXT NOT NULL, description TEXT,
    quantity REAL DEFAULT 0, unit_price REAL DEFAULT 0, tax_rate REAL DEFAULT 14,
    tax_amount REAL DEFAULT 0, total REAL DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);
  migrate(`CREATE TABLE IF NOT EXISTS receipts (
    id TEXT PRIMARY KEY, receipt_number TEXT, invoice_id TEXT, invoice_number TEXT,
    client_id TEXT, client_name TEXT, amount REAL DEFAULT 0, payment_method TEXT DEFAULT 'cash',
    bank_account_id TEXT, reference TEXT, branch_id TEXT, notes TEXT, created_by TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);
  migrate(`CREATE TABLE IF NOT EXISTS payments (
    id TEXT PRIMARY KEY, payment_number TEXT, supplier_id TEXT, supplier_name TEXT,
    purchase_order_id TEXT, po_number TEXT, amount REAL DEFAULT 0,
    payment_method TEXT DEFAULT 'cash', bank_account_id TEXT, cheque_number TEXT,
    reference TEXT, branch_id TEXT, notes TEXT, created_by TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);

  // Migration 2: Add missing columns to audit_logs
  migrate(`ALTER TABLE audit_logs ADD COLUMN computer_name TEXT`);
  migrate(`ALTER TABLE audit_logs ADD COLUMN branch_id TEXT`);
  migrate(`ALTER TABLE audit_logs ADD COLUMN session_id TEXT`);

  // Migration 3: Add missing columns to products
  migrate(`ALTER TABLE products ADD COLUMN price_2 REAL DEFAULT 0`);
  migrate(`ALTER TABLE products ADD COLUMN price_3 REAL DEFAULT 0`);
  migrate(`ALTER TABLE products ADD COLUMN price_4 REAL DEFAULT 0`);
  migrate(`ALTER TABLE products ADD COLUMN first_cost REAL DEFAULT 0`);
  migrate(`ALTER TABLE products ADD COLUMN supplier_name TEXT`);

  // Migration 4: Add caixa1 default user
  migrate(`INSERT OR IGNORE INTO users (id, username, password, name, role) VALUES ('user-caixa1', 'caixa1', 'caixa123', 'Caixa 1', 'cashier')`);

  // Migration 4: Default chart of accounts
  const defaultAccounts = [
    ['coa-11', '11', 'Caixa', 'asset', 'Caixa'],
    ['coa-12', '12', 'Depósitos à Ordem', 'asset', 'Bancos'],
    ['coa-21', '21', 'Clientes', 'asset', 'Clientes'],
    ['coa-22', '22', 'Fornecedores', 'liability', 'Fornecedores'],
    ['coa-31', '31', 'Compras', 'expense', 'Custos'],
    ['coa-32', '32', 'Mercadorias', 'asset', 'Ativos'],
    ['coa-34', '34', 'IVA', 'liability', 'Custos'],
    ['coa-43', '43', 'Activos Tangíveis', 'asset', 'Ativos'],
    ['coa-51', '51', 'Capital Social', 'equity', 'Capital'],
    ['coa-61', '61', 'CMVMC', 'expense', 'Custos'],
    ['coa-62', '62', 'Fornecimentos e Serviços', 'expense', 'Custos'],
    ['coa-63', '63', 'Gastos com Pessoal', 'expense', 'Funcionarios'],
    ['coa-69', '69', 'Outros Gastos', 'expense', 'Custos'],
    ['coa-71', '71', 'Vendas', 'revenue', 'Recebimentos'],
    ['coa-72', '72', 'Prestação de Serviços', 'revenue', 'Recebimentos'],
    ['coa-78', '78', 'Outros Rendimentos', 'revenue', 'Recebimentos'],
    ['coa-81', '81', 'Resultado Líquido', 'equity', 'Capital'],
  ];
  for (const [id, num, name, type, cat] of defaultAccounts) {
    migrate(`INSERT OR IGNORE INTO chart_of_accounts (id, account_number, name, type, category) VALUES ('${id}', '${num}', '${name}', '${type}', '${cat}')`);
  }

  // Indexes
  migrate(`CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id)`);
  migrate(`CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id)`);
  migrate(`CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp)`);
  migrate(`CREATE INDEX IF NOT EXISTS idx_journal_entries_date ON journal_entries(date)`);
  migrate(`CREATE INDEX IF NOT EXISTS idx_journal_entry_lines_journal ON journal_entry_lines(journal_entry_id)`);
  migrate(`CREATE INDEX IF NOT EXISTS idx_chart_of_accounts_number ON chart_of_accounts(account_number)`);
  migrate(`CREATE INDEX IF NOT EXISTS idx_chart_of_accounts_category ON chart_of_accounts(category)`);
  migrate(`CREATE INDEX IF NOT EXISTS idx_user_permissions_user ON user_permissions(user_id)`);

  console.log('[Migrations] All migrations applied successfully');
}

// ============= DATABASE INITIALIZATION =============
function initDatabase() {
  const ipConfig = parseIPFile();
  if (!ipConfig.valid) {
    console.log('IP file not configured:', ipConfig.error);
    return { success: false, error: ipConfig.error, needsConfig: true };
  }

  if (!ipConfig.isServer) {
    isServerMode = false;
    serverAddress = ipConfig.serverAddress;
    dbPath = null;
    console.log('CLIENT MODE: Will connect to', serverAddress);
    connectToServer();
    return { success: true, mode: 'client', serverAddress };
  }

  // Server mode
  dbPath = ipConfig.path;
  isServerMode = true;
  serverAddress = null;

  if (!fs.existsSync(dbPath)) {
    console.log('Database not found at:', dbPath, '- Creating automatically...');
    const createResult = createNewDatabaseInternal(dbPath);
    if (!createResult.success) return { success: false, error: createResult.error };
    console.log('Database created successfully at:', dbPath);
  }

  try {
    if (db) { try { db.close(); } catch (e) {} db = null; }
    db = openDatabase(dbPath);
    runMigrations();
    ensureCompaniesRegistry();
    startWebSocketServer();
    console.log('SERVER MODE: Connected to database at:', dbPath);
    return { success: true, mode: 'server', path: dbPath, wsPort: WS_PORT };
  } catch (error) {
    console.error('Error initializing database:', error);
    return { success: false, error: error.message };
  }
}

// ============= WINDOW CREATION =============
function createSplashWindow() {
  splashWindow = new BrowserWindow({
    width: 500, height: 350, frame: false, transparent: true,
    alwaysOnTop: true, resizable: false, skipTaskbar: true,
    icon: path.join(__dirname, '../public/icon.png'),
    webPreferences: { nodeIntegration: false, contextIsolation: true }
  });
  splashWindow.loadFile(path.join(__dirname, 'splash.html'));
  splashWindow.center();
}

function resolveRendererIndexPath() {
  const possiblePaths = [
    path.join(__dirname, '../dist/index.html'),
    path.join(process.resourcesPath, 'app/dist/index.html'),
    path.join(app.getAppPath(), 'dist/index.html'),
  ];

  for (const possiblePath of possiblePaths) {
    try {
      if (fs.existsSync(possiblePath)) {
        return possiblePath;
      }
    } catch (error) {
      // ignore and keep trying
    }
  }

  return possiblePaths[0];
}

function loadRendererRoute(targetWindow, route = '/') {
  const isDev = process.env.NODE_ENV === 'development' || process.env.ELECTRON_DEV === 'true';
  const normalizedRoute = route.startsWith('/') ? route : `/${route}`;

  if (isDev) {
    targetWindow.loadURL(`http://localhost:5173/#${normalizedRoute}`);
    return;
  }

  const indexPath = resolveRendererIndexPath();
  targetWindow.loadFile(indexPath, { hash: normalizedRoute });
}

function resolvePendingProductPicker(payload) {
  if (!resolveProductPickerSelection) return;
  resolveProductPickerSelection(payload);
  resolveProductPickerSelection = null;
}

function openPurchaseInvoiceWindow() {
  if (purchaseInvoiceWindow && !purchaseInvoiceWindow.isDestroyed()) {
    purchaseInvoiceWindow.show();
    purchaseInvoiceWindow.focus();
    return { success: true };
  }

  purchaseInvoiceWindow = new BrowserWindow({
    width: 1500,
    height: 920,
    minWidth: 1180,
    minHeight: 760,
    parent: mainWindow && !mainWindow.isDestroyed() ? mainWindow : undefined,
    modal: false,
    skipTaskbar: true,
    icon: path.join(__dirname, '../public/icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs')
    },
    autoHideMenuBar: false,
    show: false,
  });

  loadRendererRoute(purchaseInvoiceWindow, '/purchase-invoices-window?mode=create&standalone=1');

  purchaseInvoiceWindow.once('ready-to-show', () => {
    purchaseInvoiceWindow.show();
    purchaseInvoiceWindow.focus();
  });

  purchaseInvoiceWindow.on('closed', () => {
    purchaseInvoiceWindow = null;
  });

  return { success: true };
}

function openPurchaseProductPickerWindow(parentWindow) {
  if (purchaseProductPickerWindow && !purchaseProductPickerWindow.isDestroyed()) {
    purchaseProductPickerWindow.show();
    purchaseProductPickerWindow.focus();
    return Promise.resolve({ success: false, error: 'Janela de seleção já está aberta' });
  }

  return new Promise((resolve) => {
    resolveProductPickerSelection = resolve;

    purchaseProductPickerWindow = new BrowserWindow({
      width: 1180,
      height: 760,
      minWidth: 980,
      minHeight: 620,
      parent: parentWindow && !parentWindow.isDestroyed() ? parentWindow : (mainWindow || undefined),
      modal: true,
      icon: path.join(__dirname, '../public/icon.png'),
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload.cjs')
      },
      autoHideMenuBar: false,
      show: false,
    });

    loadRendererRoute(purchaseProductPickerWindow, '/purchase-invoices-window?mode=product-picker&standalone=1');

    purchaseProductPickerWindow.once('ready-to-show', () => {
      purchaseProductPickerWindow.show();
      purchaseProductPickerWindow.focus();
    });

    purchaseProductPickerWindow.on('closed', () => {
      purchaseProductPickerWindow = null;
      resolvePendingProductPicker({ success: false, cancelled: true });
    });
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400, height: 900, minWidth: 1024, minHeight: 768,
    icon: path.join(__dirname, '../public/icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs')
    },
    autoHideMenuBar: false,
    show: false
  });

  // Menu
  const menuTemplate = [
    { label: 'Kwanza ERP', submenu: [
      { label: 'About', role: 'about' },
      { type: 'separator' },
      { label: 'Quit', accelerator: 'CmdOrCtrl+Q', click: () => app.quit() }
    ]},
    { label: 'Edit', submenu: [
      { role: 'undo' }, { role: 'redo' }, { type: 'separator' },
      { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }
    ]},
    { label: 'View', submenu: [
      { role: 'reload' }, { role: 'forceReload' }, { role: 'toggleDevTools' },
      { type: 'separator' }, { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' },
      { type: 'separator' }, { role: 'togglefullscreen' }
    ]},
    { label: 'Window', submenu: [{ role: 'minimize' }, { role: 'close' }] }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(menuTemplate));

  const isDev = process.env.NODE_ENV === 'development' || process.env.ELECTRON_DEV === 'true';
  loadRendererRoute(mainWindow, '/');
  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.once('ready-to-show', () => {
    setTimeout(() => {
      if (splashWindow) { splashWindow.close(); splashWindow = null; }
      mainWindow.show();
      mainWindow.focus();
    }, 1500);
  });

  mainWindow.on('closed', () => { mainWindow = null; });
}

// ============= APP LIFECYCLE =============
app.whenReady().then(() => {
  createSplashWindow();
  createWindow();

  // Initialize database based on IP file
  const dbResult = initDatabase();
  console.log('[Init] Database result:', dbResult);

  // Check for updates (production only)
  const isDev = process.env.NODE_ENV === 'development' || process.env.ELECTRON_DEV === 'true';
  if (!isDev) {
    setTimeout(() => {
      autoUpdater.checkForUpdates().catch(err => console.log('[AutoUpdater] Check failed:', err.message));
    }, 3000);
  }
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
app.on('web-contents-created', (event, contents) => {
  contents.setWindowOpenHandler(() => ({ action: 'deny' }));
});

// Cleanup on quit
app.on('before-quit', () => {
  if (wss) { wss.close(); wss = null; }
  if (wsClient) { wsClient.close(); wsClient = null; }
  if (wsReconnectTimer) { clearTimeout(wsReconnectTimer); }
  if (purchaseProductPickerWindow && !purchaseProductPickerWindow.isDestroyed()) {
    purchaseProductPickerWindow.destroy();
    purchaseProductPickerWindow = null;
  }
  if (purchaseInvoiceWindow && !purchaseInvoiceWindow.isDestroyed()) {
    purchaseInvoiceWindow.destroy();
    purchaseInvoiceWindow = null;
  }
  resolvePendingProductPicker({ success: false, cancelled: true });
  // Close all company databases
  for (const [, entry] of companyDatabases) {
    try { entry.db?.close(); } catch (e) {}
  }
  if (db) { try { db.close(); } catch (e) {} }
});

// ============= IPC HANDLERS =============

// IP file operations
ipcMain.handle('ipfile:read', () => {
  try {
    return fs.existsSync(IP_FILE_PATH) ? fs.readFileSync(IP_FILE_PATH, 'utf-8') : '';
  } catch (e) { return ''; }
});

ipcMain.handle('ipfile:write', (_, content) => {
  try {
    fs.writeFileSync(IP_FILE_PATH, content, 'utf-8');
    return { success: true };
  } catch (e) { return { success: false, error: e.message }; }
});

ipcMain.handle('ipfile:parse', () => parseIPFile());

// Company management
ipcMain.handle('company:list', () => {
  if (isServerMode) return ensureCompaniesRegistry();
  return sendToServer({ action: 'listCompanies' }).then(r => r.data || []).catch(() => []);
});

ipcMain.handle('company:create', (_, name) => {
  if (isServerMode) return createCompany(name);
  return sendToServer({ action: 'createCompany', name });
});

ipcMain.handle('company:setActive', (_, companyId) => {
  if (isServerMode) {
    const targetDb = getCompanyDb(companyId);
    if (!targetDb) return { success: false, error: 'Company not found' };
    // Send all table data for this company to renderer
    for (const table of ERP_TABLES) {
      try {
        const rows = dbGetAll(table, targetDb);
        mainWindow?.webContents.send('erp:sync', { table, rows, companyId });
      } catch (e) {}
    }
    return { success: true };
  }
  return sendToServer({ action: 'setCompany', companyId });
});

// Database operations (transparently routed)
ipcMain.handle('db:getStatus', () => ({
  success: true,
  mode: isServerMode ? 'server' : (serverAddress ? 'client' : 'unconfigured'),
  path: dbPath,
  serverAddress,
  wsPort: WS_PORT,
  connected: isServerMode ? !!db : (wsClient?.readyState === WebSocket.OPEN),
}));

ipcMain.handle('db:init', () => initDatabase());

ipcMain.handle('db:getAll', async (_, table, companyId) => {
  if (isServerMode) {
    const targetDb = companyId ? getCompanyDb(companyId) : db;
    return { success: true, data: dbGetAll(table, targetDb) };
  }
  return sendToServer({ action: 'getAll', table, companyId });
});

ipcMain.handle('db:getById', async (_, table, id, companyId) => {
  if (isServerMode) {
    const targetDb = companyId ? getCompanyDb(companyId) : db;
    return { success: true, data: dbGetById(table, id, targetDb) };
  }
  return sendToServer({ action: 'getById', table, id, companyId });
});

ipcMain.handle('db:insert', async (_, table, data, companyId) => {
  if (isServerMode) {
    const targetDb = companyId ? getCompanyDb(companyId) : db;
    return dbInsert(table, data, targetDb, companyId);
  }
  return sendToServer({ action: 'insert', table, data, companyId });
});

ipcMain.handle('db:update', async (_, table, id, data, companyId) => {
  if (isServerMode) {
    const targetDb = companyId ? getCompanyDb(companyId) : db;
    return dbUpdate(table, id, data, targetDb, companyId);
  }
  return sendToServer({ action: 'update', table, id, data, companyId });
});

ipcMain.handle('db:delete', async (_, table, id, companyId) => {
  if (isServerMode) {
    const targetDb = companyId ? getCompanyDb(companyId) : db;
    return dbDelete(table, id, targetDb, companyId);
  }
  return sendToServer({ action: 'delete', table, id, companyId });
});

ipcMain.handle('db:query', async (_, sql, params, companyId) => {
  if (isServerMode) {
    const targetDb = companyId ? getCompanyDb(companyId) : db;
    const result = dbQuery(sql, params || [], targetDb);
    return Array.isArray(result) ? { success: true, data: result } : result;
  }
  return sendToServer({ action: 'query', sql, params, companyId });
});

ipcMain.handle('db:export', async (_, companyId) => {
  if (isServerMode) {
    const targetDb = companyId ? getCompanyDb(companyId) : db;
    return { success: true, data: dbExportAll(targetDb) };
  }
  return sendToServer({ action: 'export', companyId });
});

ipcMain.handle('db:import', async (_, data, companyId) => {
  if (isServerMode) {
    const targetDb = companyId ? getCompanyDb(companyId) : db;
    return dbImportAll(data, targetDb, companyId);
  }
  return sendToServer({ action: 'import', data, companyId });
});

ipcMain.handle('db:create', async () => {
  if (dbPath && !fs.existsSync(dbPath)) {
    return createNewDatabaseInternal(dbPath);
  }
  return { success: true, message: 'Database already exists' };
});

ipcMain.handle('db:testConnection', async () => {
  if (isServerMode) return { success: !!db, mode: 'server' };
  try {
    const result = await sendToServer({ action: 'ping' });
    return { success: result.success, mode: 'client' };
  } catch (e) { return { success: false, mode: 'client', error: e.message }; }
});

// Network info
ipcMain.handle('network:getLocalIPs', () => {
  const ips = [];
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) ips.push(iface.address);
    }
  }
  return ips;
});

ipcMain.handle('network:getInstallPath', () => INSTALL_DIR);
ipcMain.handle('network:getIPFilePath', () => IP_FILE_PATH);
ipcMain.handle('network:getComputerName', () => os.hostname());

// Purchase windows
ipcMain.handle('purchase:openCreateWindow', () => {
  return openPurchaseInvoiceWindow();
});

ipcMain.handle('purchase:openProductPicker', (event) => {
  const parentWindow = BrowserWindow.fromWebContents(event.sender) || mainWindow;
  return openPurchaseProductPickerWindow(parentWindow);
});

ipcMain.handle('purchase:selectProduct', (_, product) => {
  if (!product || !product.id) {
    return { success: false, error: 'Produto inválido' };
  }

  resolvePendingProductPicker({ success: true, product });

  if (purchaseProductPickerWindow && !purchaseProductPickerWindow.isDestroyed()) {
    purchaseProductPickerWindow.close();
  }

  return { success: true };
});

ipcMain.handle('window:closeCurrent', (event) => {
  const senderWindow = BrowserWindow.fromWebContents(event.sender);
  if (senderWindow && !senderWindow.isDestroyed()) {
    senderWindow.close();
  }
  return { success: true };
});

// Print support
ipcMain.handle('print:html', async (_, html, options = {}) => {
  try {
    const printWin = new BrowserWindow({ show: false, webPreferences: { nodeIntegration: false } });
    await printWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    await new Promise(resolve => setTimeout(resolve, 500));
    await printWin.webContents.print({ silent: options.silent || false, printBackground: true });
    printWin.close();
    return { success: true };
  } catch (e) { return { success: false, error: e.message }; }
});

// App controls
ipcMain.handle('app:relaunch', () => { app.relaunch(); app.exit(0); });
ipcMain.handle('app:version', () => app.getVersion());

// Auto-updater
ipcMain.handle('updater:check', async () => {
  try { await autoUpdater.checkForUpdates(); return { success: true }; }
  catch (e) { return { success: false, error: e.message }; }
});
ipcMain.handle('updater:download', async () => {
  try { await autoUpdater.downloadUpdate(); return { success: true }; }
  catch (e) { return { success: false, error: e.message }; }
});
ipcMain.handle('updater:install', () => { autoUpdater.quitAndInstall(); return { success: true }; });
ipcMain.handle('updater:getVersion', () => app.getVersion());

// Auto-updater events → renderer
autoUpdater.on('checking-for-update', () => {
  mainWindow?.webContents.send('updater:status', { status: 'checking' });
});
autoUpdater.on('update-available', (info) => {
  mainWindow?.webContents.send('updater:status', { status: 'available', version: info.version });
});
autoUpdater.on('update-not-available', () => {
  mainWindow?.webContents.send('updater:status', { status: 'not-available' });
});
autoUpdater.on('download-progress', (progress) => {
  mainWindow?.webContents.send('updater:status', { status: 'downloading', progress: progress.percent });
});
autoUpdater.on('update-downloaded', (info) => {
  mainWindow?.webContents.send('updater:status', { status: 'downloaded', version: info.version });
});
autoUpdater.on('error', (err) => {
  mainWindow?.webContents.send('updater:status', { status: 'error', error: err.message });
});

// AGT signing (simplified - crypto only, no external modules needed)
ipcMain.handle('agt:calculate-hash', (_, { data }) => ({
  success: true,
  hash: crypto.createHash('sha256').update(data).digest('hex')
}));

console.log('🏢 Kwanza ERP - Main process loaded');
console.log(`📁 Install directory: ${INSTALL_DIR}`);
console.log(`📄 IP file: ${IP_FILE_PATH}`);
