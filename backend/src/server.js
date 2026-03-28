// Kwanza ERP - Main Server (THE HEART)
// This runs on your main PC and all other computers connect to it

require('dotenv').config();
const express = require('express');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const os = require('os');
const db = require('./db');
const { DiscoveryBroadcaster } = require('./discovery');

const app = express();
const server = http.createServer(app);

// Server discovery broadcaster
const PORT = process.env.PORT || 3000;
const discoveryBroadcaster = new DiscoveryBroadcaster(PORT, {
  name: process.env.SERVER_NAME || 'Kwanza ERP Server',
  version: '1.0.0',
  branch: process.env.BRANCH_NAME || null
});

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
// HOT UPDATE: SERVE WEBAPP FILES
// ============================================
// The webapp folder contains the built frontend files
// To update all clients, just replace files in this folder
const webappPath = path.join(__dirname, '../webapp');
const fs = require('fs');

// Check if webapp folder exists, create if not
if (!fs.existsSync(webappPath)) {
  fs.mkdirSync(webappPath, { recursive: true });
  console.log('[WEBAPP] Created webapp folder at:', webappPath);
}

// Serve static files from webapp folder
app.use('/app', express.static(webappPath));

// Serve index.html for SPA routing (any /app/* route)
app.get('/app/*', (req, res) => {
  const indexPath = path.join(webappPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).json({ 
      error: 'Webapp not deployed',
      message: 'Place built files in backend/webapp folder'
    });
  }
});

// Webapp version endpoint
app.get('/api/webapp-version', (req, res) => {
  const versionPath = path.join(webappPath, 'version.json');
  if (fs.existsSync(versionPath)) {
    try {
      const version = JSON.parse(fs.readFileSync(versionPath, 'utf8'));
      res.json(version);
    } catch (e) {
      res.json({ version: 'unknown', error: e.message });
    }
  } else {
    res.json({ version: 'not-deployed' });
  }
});

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
  discoveryBroadcaster.setConnectedClients(io.sockets.sockets.size);
  
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
    discoveryBroadcaster.setConnectedClients(io.sockets.sockets.size);
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
const chartOfAccountsRoutes = require('./routes/chartOfAccounts');
const journalEntryRoutes = require('./routes/journalEntries');

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
app.use('/api/chart-of-accounts', chartOfAccountsRoutes(broadcastTable));
app.use('/api/journal-entries', journalEntryRoutes(broadcastTable));

// Health check with extended info
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    serverName: process.env.SERVER_NAME || 'Kwanza ERP Server',
    version: '1.0.0',
    connectedClients: io.sockets.sockets.size
  });
});

// Server info endpoint for discovery verification
app.get('/api/server-info', (req, res) => {
  const localIPs = discoveryBroadcaster.getLocalIPs();
  res.json({
    name: process.env.SERVER_NAME || 'Kwanza ERP Server',
    version: '1.0.0',
    port: PORT,
    hostname: os.hostname(),
    platform: os.platform(),
    connectedClients: io.sockets.sockets.size,
    localIPs,
    uptime: process.uptime()
  });
});

// ============================================
// START SERVER
// ============================================

server.listen(PORT, '0.0.0.0', async () => {
  const localIPs = discoveryBroadcaster.getLocalIPs();
  
  console.log('');
  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║           KWANZA ERP SERVER - THE HEART 💓                    ║');
  console.log('╠═══════════════════════════════════════════════════════════════╣');
  console.log(`║  Server running on port ${PORT}                                  ║`);
  console.log('║                                                               ║');
  console.log('║  Local IP addresses:                                          ║');
  localIPs.forEach(ip => {
    const line = `║    ${ip.name}: http://${ip.address}:${PORT}`;
    console.log(line.padEnd(64) + '║');
  });
  console.log('║                                                               ║');
  console.log('║  Auto-discovery: ENABLED (clients will find this server)      ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝');
  console.log('');
  
  // Start discovery broadcaster
  try {
    await discoveryBroadcaster.start();
  } catch (error) {
    console.error('[Discovery] Failed to start broadcaster:', error.message);
  }
});
