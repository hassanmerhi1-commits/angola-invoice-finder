// PostgreSQL Database Connection
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Test connection
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('[DB ERROR] Cannot connect to PostgreSQL:', err.message);
  } else {
    console.log('[DB] Connected to PostgreSQL at', res.rows[0].now);
  }
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool
};
