// Run database migrations in order
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const db = require('../db');

const MIGRATIONS = [
  '001_initial_schema.sql',
  '002_agt_compliance.sql',
  '003_chart_of_accounts.sql',
  '004_purchase_order_freight.sql',
  '005_transaction_engine.sql',
  '006_tax_engine.sql',
  '007_enterprise_controls.sql',
  '008_multi_currency.sql',
  '009_seed_data.sql',
];

async function runMigrations() {
  console.log('[MIGRATE] Starting database migrations...');
  
  try {
    for (const file of MIGRATIONS) {
      const sqlFile = path.join(__dirname, file);
      if (!fs.existsSync(sqlFile)) {
        console.warn(`[MIGRATE] ⚠ Skipping ${file} (not found)`);
        continue;
      }
      const sql = fs.readFileSync(sqlFile, 'utf8');
      await db.query(sql);
      console.log(`[MIGRATE] ✅ ${file} applied`);
    }
    
    console.log('[MIGRATE] ✅ All migrations completed successfully!');
    console.log('[MIGRATE] Database is ready.');
    process.exit(0);
  } catch (error) {
    console.error('[MIGRATE ERROR]', error.message);
    process.exit(1);
  }
}

runMigrations();
