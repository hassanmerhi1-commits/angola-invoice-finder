// Run database migrations
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const db = require('../db');

async function runMigrations() {
  console.log('[MIGRATE] Starting database migrations...');
  
  try {
    const sqlFile = path.join(__dirname, '001_initial_schema.sql');
    const sql = fs.readFileSync(sqlFile, 'utf8');
    
    await db.query(sql);
    
    console.log('[MIGRATE] ✅ All migrations completed successfully!');
    console.log('[MIGRATE] Database is ready.');
    process.exit(0);
  } catch (error) {
    console.error('[MIGRATE ERROR]', error.message);
    process.exit(1);
  }
}

runMigrations();
