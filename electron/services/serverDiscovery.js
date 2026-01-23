// Kwanza ERP - Server Discovery Service
// Uses UDP broadcast to discover Kwanza ERP servers on local network

const dgram = require('dgram');
const os = require('os');

const DISCOVERY_PORT = 41234;
const DISCOVERY_MESSAGE = 'KWANZA_ERP_DISCOVER';
const DISCOVERY_RESPONSE = 'KWANZA_ERP_SERVER';

class ServerDiscovery {
  constructor() {
    this.socket = null;
    this.discoveredServers = new Map();
    this.isScanning = false;
    this.listeners = new Set();
  }

  // Get all local IP addresses (non-internal IPv4)
  getLocalIPs() {
    const addresses = [];
    const interfaces = os.networkInterfaces();
    
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name]) {
        // Skip internal and non-IPv4 addresses
        if (iface.internal || iface.family !== 'IPv4') continue;
        addresses.push(iface.address);
      }
    }
    
    return addresses;
  }

  // Get all local network broadcast addresses
  getBroadcastAddresses() {
    const addresses = [];
    const interfaces = os.networkInterfaces();
    
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name]) {
        // Skip internal and non-IPv4 addresses
        if (iface.internal || iface.family !== 'IPv4') continue;
        
        // Calculate broadcast address
        const ip = iface.address.split('.').map(Number);
        const netmask = iface.netmask.split('.').map(Number);
        const broadcast = ip.map((octet, i) => (octet | (~netmask[i] & 255)));
        addresses.push(broadcast.join('.'));
      }
    }
    
    // Also add common broadcast address
    addresses.push('255.255.255.255');
    
    return [...new Set(addresses)];
  }

  // Start scanning for servers
  startDiscovery(timeout = 5000) {
    return new Promise((resolve, reject) => {
      if (this.isScanning) {
        resolve([...this.discoveredServers.values()]);
        return;
      }

      this.isScanning = true;
      this.discoveredServers.clear();
      
      try {
        this.socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });
        
        this.socket.on('error', (err) => {
          console.error('[Discovery] Socket error:', err.message);
          this.cleanup();
          reject(err);
        });

        this.socket.on('message', (msg, rinfo) => {
          try {
            const data = msg.toString();
            if (data.startsWith(DISCOVERY_RESPONSE)) {
              const serverInfo = JSON.parse(data.substring(DISCOVERY_RESPONSE.length + 1));
              const serverId = `${rinfo.address}:${serverInfo.port}`;
              
              if (!this.discoveredServers.has(serverId)) {
                const server = {
                  id: serverId,
                  ip: rinfo.address,
                  port: serverInfo.port,
                  name: serverInfo.name || 'Kwanza ERP Server',
                  version: serverInfo.version || 'Unknown',
                  branch: serverInfo.branch || null,
                  connectedClients: serverInfo.connectedClients || 0,
                  discoveredAt: new Date().toISOString()
                };
                
                this.discoveredServers.set(serverId, server);
                this.notifyListeners('discovered', server);
                console.log('[Discovery] Found server:', serverId);
              }
            }
          } catch (e) {
            // Ignore malformed responses
          }
        });

        this.socket.bind(0, () => {
          this.socket.setBroadcast(true);
          
          const message = Buffer.from(DISCOVERY_MESSAGE);
          const broadcastAddresses = this.getBroadcastAddresses();
          
          console.log('[Discovery] Broadcasting to:', broadcastAddresses);
          
          // Send discovery packet to all broadcast addresses
          broadcastAddresses.forEach(address => {
            this.socket.send(message, 0, message.length, DISCOVERY_PORT, address, (err) => {
              if (err) {
                console.error(`[Discovery] Send error to ${address}:`, err.message);
              }
            });
          });
          
          // Also try common local IPs directly
          const commonSubnets = ['192.168.1', '192.168.0', '10.0.0', '172.16.0'];
          commonSubnets.forEach(subnet => {
            for (let i = 1; i <= 254; i++) {
              const ip = `${subnet}.${i}`;
              this.socket.send(message, 0, message.length, DISCOVERY_PORT, ip);
            }
          });
        });

        // Set timeout for discovery
        setTimeout(() => {
          this.cleanup();
          const servers = [...this.discoveredServers.values()];
          console.log(`[Discovery] Scan complete. Found ${servers.length} server(s)`);
          resolve(servers);
        }, timeout);

      } catch (error) {
        this.cleanup();
        reject(error);
      }
    });
  }

  // Stop scanning
  stopDiscovery() {
    this.cleanup();
  }

  cleanup() {
    this.isScanning = false;
    if (this.socket) {
      try {
        this.socket.close();
      } catch (e) {
        // Ignore
      }
      this.socket = null;
    }
  }

  // Subscribe to discovery events
  onDiscovery(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  notifyListeners(event, data) {
    this.listeners.forEach(cb => {
      try {
        cb(event, data);
      } catch (e) {
        console.error('[Discovery] Listener error:', e);
      }
    });
  }

  // Get cached servers
  getCachedServers() {
    return [...this.discoveredServers.values()];
  }
}

// Singleton instance
const serverDiscovery = new ServerDiscovery();

module.exports = { serverDiscovery, DISCOVERY_PORT, DISCOVERY_MESSAGE, DISCOVERY_RESPONSE };
