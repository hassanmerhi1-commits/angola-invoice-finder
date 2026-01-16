// Kwanza ERP - Main Server (THE HEART)
// This runs on your main PC and all other computers connect to it

require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const db = require('./db');

const app = express();
const server = http.createServer(app);

// Socket.io for real-time sync
const io = new Server(server, {
  cors: {
    origin: '*', // Allow all origins on local network
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  }
});

// Middleware
app.use(cors());
app.use(express.json());

// ============================================
// REAL-TIME SYNC LOGIC
// ============================================

// Broadcast full table to ALL connected clients
async function broadcastTable(tableName) {
  try {
    const result = await db.query(`SELECT * FROM ${tableName} ORDER BY created_at DESC`);
    io.emit('table_sync', { table: tableName, data: result.rows });
    console.log(`[SYNC] Broadcast ${tableName}: ${result.rows.length} rows`);
  } catch (error) {
    console.error(`[SYNC ERROR] ${tableName}:`, error.message);
  }
}

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log(`[CONNECTED] Client: ${socket.id}`);
  
  // Send current state of all tables when client connects
  socket.on('request_sync', async () => {
    console.log(`[SYNC REQUEST] from ${socket.id}`);
    await broadcastTable('branches');
    await broadcastTable('products');
    await broadcastTable('sales');
    await broadcastTable('users');
    await broadcastTable('clients');
    await broadcastTable('categories');
    await broadcastTable('suppliers');
    await broadcastTable('daily_reports');
    await broadcastTable('stock_transfers');
    await broadcastTable('purchase_orders');
  });

  socket.on('disconnect', () => {
    console.log(`[DISCONNECTED] Client: ${socket.id}`);
  });
});

// ============================================
// API ROUTES
// ============================================

// Import routes
const authRoutes = require('./routes/auth');
const agtRoutes = require('./routes/agt');
const branchRoutes = require('./routes/branches');
const productRoutes = require('./routes/products');
const salesRoutes = require('./routes/sales');
const clientRoutes = require('./routes/clients');
const categoryRoutes = require('./routes/categories');
const supplierRoutes = require('./routes/suppliers');
const dailyReportRoutes = require('./routes/dailyReports');
const stockTransferRoutes = require('./routes/stockTransfers');
const purchaseOrderRoutes = require('./routes/purchaseOrders');

// Use routes
app.use('/api/auth', authRoutes);
app.use('/api/agt', agtRoutes(broadcastTable));
app.use('/api/branches', branchRoutes(broadcastTable));
app.use('/api/products', productRoutes(broadcastTable));
app.use('/api/sales', salesRoutes(broadcastTable));
app.use('/api/clients', clientRoutes(broadcastTable));
app.use('/api/categories', categoryRoutes(broadcastTable));
app.use('/api/suppliers', supplierRoutes(broadcastTable));
app.use('/api/daily-reports', dailyReportRoutes(broadcastTable));
app.use('/api/stock-transfers', stockTransferRoutes(broadcastTable));
app.use('/api/purchase-orders', purchaseOrderRoutes(broadcastTable));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ============================================
// START SERVER
// ============================================

const PORT = process.env.PORT || 3000;

server.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║           KWANZA ERP SERVER - THE HEART 💓                    ║');
  console.log('╠═══════════════════════════════════════════════════════════════╣');
  console.log(`║  Server running on port ${PORT}                                  ║`);
  console.log('║                                                               ║');
  console.log('║  Other computers can connect to:                              ║');
  console.log(`║  http://YOUR_LOCAL_IP:${PORT}                                    ║`);
  console.log('║                                                               ║');
  console.log('║  To find your IP, run: ipconfig (Windows) or ifconfig (Linux) ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝');
  console.log('');
});
