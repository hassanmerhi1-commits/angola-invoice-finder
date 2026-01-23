// Kwanza ERP - SQLite Database Service
// Manages the local SQLite database for server mode

const path = require('path');
const fs = require('fs');

let Database = null;
let db = null;

// Try to load better-sqlite3
function loadSqlite() {
  if (Database) return true;
  
  try {
    Database = require('better-sqlite3');
    return true;
  } catch (e) {
    console.log('[Database] better-sqlite3 not available, using fallback');
    return false;
  }
}

// Get the default database path
function getDefaultDatabasePath() {
  const isWindows = process.platform === 'win32';
  if (isWindows) {
    return 'C:\\kwanza erp\\database.sqlite';
  } else {
    return path.join(require('os').homedir(), 'kwanza-erp', 'database.sqlite');
  }
}

// Ensure directory exists
function ensureDirectory(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// Create the database with initial schema
async function createDatabase(dbPath) {
  try {
    if (!loadSqlite()) {
      return { success: false, error: 'SQLite not available. Please install better-sqlite3.' };
    }

    ensureDirectory(dbPath);
    
    // Create/open the database
    db = new Database(dbPath);
    
    // Enable WAL mode for better performance
    db.pragma('journal_mode = WAL');
    
    // Create tables
    const schema = `
      -- Users table
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT DEFAULT 'cashier',
        branch_id TEXT,
        is_active INTEGER DEFAULT 1,
        permissions TEXT DEFAULT '{}',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      -- Branches table
      CREATE TABLE IF NOT EXISTS branches (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        code TEXT UNIQUE NOT NULL,
        address TEXT,
        phone TEXT,
        is_main INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      -- Products table
      CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        sku TEXT UNIQUE NOT NULL,
        barcode TEXT,
        category_id TEXT,
        price REAL NOT NULL DEFAULT 0,
        cost REAL DEFAULT 0,
        stock INTEGER DEFAULT 0,
        min_stock INTEGER DEFAULT 5,
        unit TEXT DEFAULT 'un',
        tax_rate REAL DEFAULT 14,
        is_active INTEGER DEFAULT 1,
        branch_id TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      -- Categories table
      CREATE TABLE IF NOT EXISTS categories (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        code TEXT UNIQUE NOT NULL,
        description TEXT,
        color TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      -- Sales table
      CREATE TABLE IF NOT EXISTS sales (
        id TEXT PRIMARY KEY,
        invoice_number TEXT UNIQUE NOT NULL,
        branch_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        client_id TEXT,
        items TEXT NOT NULL,
        subtotal REAL NOT NULL,
        tax_amount REAL NOT NULL,
        discount REAL DEFAULT 0,
        total REAL NOT NULL,
        payment_method TEXT NOT NULL,
        amount_paid REAL NOT NULL,
        change_amount REAL DEFAULT 0,
        status TEXT DEFAULT 'completed',
        agt_hash TEXT,
        agt_signature TEXT,
        agt_code TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      -- Clients table
      CREATE TABLE IF NOT EXISTS clients (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        nif TEXT,
        email TEXT,
        phone TEXT,
        address TEXT,
        credit_limit REAL DEFAULT 0,
        balance REAL DEFAULT 0,
        is_active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      -- Suppliers table
      CREATE TABLE IF NOT EXISTS suppliers (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        nif TEXT,
        email TEXT,
        phone TEXT,
        address TEXT,
        contact_person TEXT,
        payment_terms TEXT,
        is_active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      -- Stock Transfers table
      CREATE TABLE IF NOT EXISTS stock_transfers (
        id TEXT PRIMARY KEY,
        transfer_number TEXT UNIQUE NOT NULL,
        from_branch_id TEXT NOT NULL,
        to_branch_id TEXT NOT NULL,
        items TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        requested_by TEXT NOT NULL,
        approved_by TEXT,
        received_by TEXT,
        notes TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      -- Purchase Orders table
      CREATE TABLE IF NOT EXISTS purchase_orders (
        id TEXT PRIMARY KEY,
        order_number TEXT UNIQUE NOT NULL,
        supplier_id TEXT NOT NULL,
        branch_id TEXT NOT NULL,
        items TEXT NOT NULL,
        subtotal REAL NOT NULL,
        tax_amount REAL NOT NULL,
        total REAL NOT NULL,
        status TEXT DEFAULT 'draft',
        expected_date TEXT,
        received_date TEXT,
        created_by TEXT NOT NULL,
        approved_by TEXT,
        notes TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      -- Daily Reports table
      CREATE TABLE IF NOT EXISTS daily_reports (
        id TEXT PRIMARY KEY,
        branch_id TEXT NOT NULL,
        date TEXT NOT NULL,
        opening_balance REAL DEFAULT 0,
        closing_balance REAL,
        total_sales REAL DEFAULT 0,
        total_transactions INTEGER DEFAULT 0,
        cash_sales REAL DEFAULT 0,
        card_sales REAL DEFAULT 0,
        transfer_sales REAL DEFAULT 0,
        is_closed INTEGER DEFAULT 0,
        closed_by TEXT,
        closed_at TEXT,
        notes TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(branch_id, date)
      );

      -- Stock Movements table
      CREATE TABLE IF NOT EXISTS stock_movements (
        id TEXT PRIMARY KEY,
        product_id TEXT NOT NULL,
        branch_id TEXT NOT NULL,
        movement_type TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        reference_type TEXT,
        reference_id TEXT,
        notes TEXT,
        created_by TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      -- Settings table
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      -- Create default admin user
      INSERT OR IGNORE INTO users (id, email, name, password_hash, role, is_active)
      VALUES ('admin-001', 'admin@kwanzaerp.ao', 'Administrador', 'admin123', 'admin', 1);

      -- Create default branch
      INSERT OR IGNORE INTO branches (id, name, code, address, is_main)
      VALUES ('branch-001', 'Sede Principal', 'SEDE', 'Luanda, Angola', 1);
    `;

    // Execute schema
    db.exec(schema);
    
    console.log('[Database] Created successfully at:', dbPath);
    
    return { success: true };
  } catch (error) {
    console.error('[Database] Create error:', error);
    return { success: false, error: error.message };
  }
}

// Open existing database
async function openDatabase(dbPath) {
  try {
    if (!loadSqlite()) {
      return { success: false, error: 'SQLite not available' };
    }

    if (!fs.existsSync(dbPath)) {
      return { success: false, error: 'Database file not found' };
    }

    db = new Database(dbPath, { readonly: false });
    db.pragma('journal_mode = WAL');
    
    console.log('[Database] Opened:', dbPath);
    
    return { success: true };
  } catch (error) {
    console.error('[Database] Open error:', error);
    return { success: false, error: error.message };
  }
}

// Execute a query (SELECT)
function query(sql, params = []) {
  try {
    if (!db) {
      return { success: false, error: 'Database not open' };
    }

    const stmt = db.prepare(sql);
    const rows = stmt.all(...params);
    
    return { success: true, data: rows };
  } catch (error) {
    console.error('[Database] Query error:', error);
    return { success: false, error: error.message };
  }
}

// Execute a statement (INSERT, UPDATE, DELETE)
function execute(sql, params = []) {
  try {
    if (!db) {
      return { success: false, error: 'Database not open' };
    }

    const stmt = db.prepare(sql);
    const result = stmt.run(...params);
    
    return { success: true, changes: result.changes, lastInsertRowid: result.lastInsertRowid };
  } catch (error) {
    console.error('[Database] Execute error:', error);
    return { success: false, error: error.message };
  }
}

// Backup database
function backup(destinationPath) {
  try {
    if (!db) {
      return { success: false, error: 'Database not open' };
    }

    ensureDirectory(destinationPath);
    db.backup(destinationPath);
    
    console.log('[Database] Backup created:', destinationPath);
    
    return { success: true };
  } catch (error) {
    console.error('[Database] Backup error:', error);
    return { success: false, error: error.message };
  }
}

// Get current database path
function getPath() {
  return db ? db.name : null;
}

// Close database
function close() {
  if (db) {
    db.close();
    db = null;
  }
}

module.exports = {
  createDatabase,
  openDatabase,
  query,
  execute,
  backup,
  getPath,
  close,
  getDefaultDatabasePath
};
