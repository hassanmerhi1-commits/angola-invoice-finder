import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Server, Monitor, Wifi, CheckCircle, XCircle, Loader2, FolderOpen, Network } from 'lucide-react';
import { toast } from 'sonner';

type SetupMode = 'select' | 'server-setup' | 'client-setup' | 'complete';

interface ServerInfo {
  ip: string;
  port: number;
  name: string;
  version: string;
}

export default function Setup() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<SetupMode>('select');
  const [selectedRole, setSelectedRole] = useState<'server' | 'client' | null>(null);
  const [isCreatingDatabase, setIsCreatingDatabase] = useState(false);
  const [databasePath, setDatabasePath] = useState('C:\\kwanza erp\\database.sqlite');
  const [serverIp, setServerIp] = useState('');
  const [serverPort, setServerPort] = useState('3000');
  const [isScanning, setIsScanning] = useState(false);
  const [discoveredServers, setDiscoveredServers] = useState<ServerInfo[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [detectedIp, setDetectedIp] = useState<string>('');
  const [setupProgress, setSetupProgress] = useState(0);

  // Check if setup is already complete
  useEffect(() => {
    const setupComplete = localStorage.getItem('kwanza_setup_complete');
    if (setupComplete === 'true') {
      navigate('/login');
    }
  }, [navigate]);

  // Auto-detect server IP when in server mode
  useEffect(() => {
    if (mode === 'server-setup') {
      detectLocalIp();
    }
  }, [mode]);

  const detectLocalIp = async () => {
    try {
      // Try Electron API first
      if (window.electronAPI?.discovery?.getLocalIPs) {
        const ips = await window.electronAPI.discovery.getLocalIPs();
        if (ips && ips.length > 0) {
          setDetectedIp(ips[0]);
          return;
        }
      }
      // Fallback: Use WebRTC to detect local IP
      const pc = new RTCPeerConnection({ iceServers: [] });
      pc.createDataChannel('');
      
      pc.onicecandidate = (e) => {
        if (e.candidate) {
          const match = e.candidate.candidate.match(/([0-9]{1,3}\.){3}[0-9]{1,3}/);
          if (match) {
            const ip = match[0];
            if (!ip.startsWith('127.')) {
              setDetectedIp(ip);
              pc.close();
            }
          }
        }
      };
      
      await pc.createOffer().then(offer => pc.setLocalDescription(offer));
      
      // Timeout after 5 seconds
      setTimeout(() => {
        if (!detectedIp) {
          setDetectedIp('192.168.1.x');
        }
        pc.close();
      }, 5000);
    } catch (error) {
      console.error('Failed to detect IP:', error);
      setDetectedIp('192.168.1.x');
    }
  };

  const handleRoleSelect = (role: 'server' | 'client') => {
    setSelectedRole(role);
    setMode(role === 'server' ? 'server-setup' : 'client-setup');
  };

  const createServerDatabase = async () => {
    setIsCreatingDatabase(true);
    setSetupProgress(0);

    try {
      // Step 1: Create folder structure
      setSetupProgress(20);
      await new Promise(resolve => setTimeout(resolve, 500));

      // Step 2: Initialize database
      setSetupProgress(40);
      
      if (window.electronAPI?.database?.create) {
        await window.electronAPI.database.create(databasePath);
      } else {
        // Simulate for web preview - store config in localStorage
        console.log('Creating database at:', databasePath);
      }
      
      await new Promise(resolve => setTimeout(resolve, 500));

      // Step 3: Run migrations
      setSetupProgress(60);
      await new Promise(resolve => setTimeout(resolve, 500));

      // Step 4: Start server
      setSetupProgress(80);
      await new Promise(resolve => setTimeout(resolve, 500));

      // Step 5: Complete
      setSetupProgress(100);

      // Save configuration
      const serverConfig = {
        role: 'server',
        databasePath,
        serverIp: detectedIp,
        serverPort: 3000,
        setupDate: new Date().toISOString()
      };
      
      localStorage.setItem('kwanza_server_config', JSON.stringify(serverConfig));
      localStorage.setItem('kwanza_setup_complete', 'true');
      localStorage.setItem('kwanza_is_server', 'true');
      
      toast.success('Server setup complete!', {
        description: `Database created. Other computers can connect to ${detectedIp}:3000`
      });

      setMode('complete');
    } catch (error) {
      console.error('Failed to create database:', error);
      toast.error('Failed to create database', {
        description: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      setIsCreatingDatabase(false);
    }
  };

  const scanForServers = async () => {
    setIsScanning(true);
    setDiscoveredServers([]);

    try {
      if (window.electronAPI?.discovery?.scan) {
        // Use Electron's UDP discovery
        const result = await window.electronAPI.discovery.scan();
        if (result.success && result.servers) {
          setDiscoveredServers(result.servers.map(s => ({
            ip: s.ip,
            port: s.port,
            name: s.name,
            version: s.version
          })));
        }
      } else {
        // Simulate discovery for web preview
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Check common local IPs
        const testIps = ['192.168.1.1', '192.168.0.1', '192.168.1.100'];
        const found: ServerInfo[] = [];
        
        for (const ip of testIps) {
          try {
            const response = await fetch(`http://${ip}:3000/api/health`, {
              signal: AbortSignal.timeout(1000)
            });
            if (response.ok) {
              const data = await response.json();
              found.push({
                ip,
                port: 3000,
                name: data.serverName || 'Kwanza ERP Server',
                version: data.version || '1.0.0'
              });
            }
          } catch {
            // Server not found at this IP
          }
        }
        
        setDiscoveredServers(found);
      }
    } catch (error) {
      console.error('Scan failed:', error);
    } finally {
      setIsScanning(false);
    }
  };

  const testConnection = async () => {
    if (!serverIp) {
      toast.error('Please enter server IP address');
      return;
    }

    setConnectionStatus('testing');

    try {
      const response = await fetch(`http://${serverIp}:${serverPort}/api/health`, {
        signal: AbortSignal.timeout(5000)
      });

      if (response.ok) {
        setConnectionStatus('success');
        toast.success('Connected to server!');
      } else {
        throw new Error('Server responded with error');
      }
    } catch (error) {
      setConnectionStatus('error');
      toast.error('Cannot connect to server', {
        description: 'Make sure the server is running and the IP is correct'
      });
    }
  };

  const connectToServer = () => {
    if (connectionStatus !== 'success') {
      toast.error('Please test the connection first');
      return;
    }

    // Save client configuration
    const clientConfig = {
      role: 'client',
      serverIp,
      serverPort: parseInt(serverPort),
      setupDate: new Date().toISOString()
    };

    localStorage.setItem('kwanza_client_config', JSON.stringify(clientConfig));
    localStorage.setItem('kwanza_setup_complete', 'true');
    localStorage.setItem('kwanza_is_server', 'false');
    localStorage.setItem('kwanza_api_url', `http://${serverIp}:${serverPort}`);
    localStorage.setItem('kwanza_force_api', 'true');

    toast.success('Client setup complete!', {
      description: `Connected to server at ${serverIp}:${serverPort}`
    });

    setMode('complete');
  };

  const selectDiscoveredServer = (server: ServerInfo) => {
    setServerIp(server.ip);
    setServerPort(server.port.toString());
    setConnectionStatus('idle');
  };

  const finishSetup = () => {
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/80 via-primary to-primary/60 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-primary-foreground mb-2">Kwanza ERP</h1>
          <p className="text-primary-foreground/80">First Time Setup</p>
        </div>

        {/* Mode Selection */}
        {mode === 'select' && (
          <Card className="border-0 shadow-2xl">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl">How will this computer be used?</CardTitle>
              <CardDescription>
                Choose whether this computer will be the main server or a client workstation
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <Button
                variant="outline"
                className="h-auto p-6 flex flex-col items-center gap-4 hover:border-primary hover:bg-primary/5 transition-all"
                onClick={() => handleRoleSelect('server')}
              >
                <Server className="h-16 w-16 text-primary" />
                <div className="text-center">
                  <div className="font-semibold text-lg">Server</div>
                  <div className="text-sm text-muted-foreground mt-1">
                    Main computer that stores the database.
                    Other computers will connect to this one.
                  </div>
                </div>
                <Badge variant="secondary">Recommended for main office</Badge>
              </Button>

              <Button
                variant="outline"
                className="h-auto p-6 flex flex-col items-center gap-4 hover:border-primary hover:bg-primary/5 transition-all"
                onClick={() => handleRoleSelect('client')}
              >
                <Monitor className="h-16 w-16 text-primary" />
                <div className="text-center">
                  <div className="font-semibold text-lg">Client</div>
                  <div className="text-sm text-muted-foreground mt-1">
                    Workstation that connects to the server.
                    Data is stored on the server computer.
                  </div>
                </div>
                <Badge variant="secondary">For additional computers</Badge>
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Server Setup */}
        {mode === 'server-setup' && (
          <Card className="border-0 shadow-2xl">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Server className="h-6 w-6 text-primary" />
                <CardTitle>Server Setup</CardTitle>
              </div>
              <CardDescription>
                Configure this computer as the main database server
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Database Path */}
              <div className="space-y-2">
                <Label htmlFor="dbPath">Database Location</Label>
                <div className="flex gap-2">
                  <Input
                    id="dbPath"
                    value={databasePath}
                    onChange={(e) => setDatabasePath(e.target.value)}
                    placeholder="C:\kwanza erp\database.sqlite"
                  />
                  <Button variant="outline" size="icon">
                    <FolderOpen className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  The database file will be created at this location
                </p>
              </div>

              {/* Detected IP */}
              <div className="space-y-2">
                <Label>Server IP Address (Auto-Detected)</Label>
                <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                  <Network className="h-5 w-5 text-primary" />
                  <span className="font-mono text-lg">
                    {detectedIp || 'Detecting...'}
                  </span>
                  <Badge variant="outline" className="ml-auto">
                    Port: 3000
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Other computers will use this IP to connect: <strong>{detectedIp}:3000</strong>
                </p>
              </div>

              {/* Progress */}
              {isCreatingDatabase && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Setting up database...</span>
                    <span>{setupProgress}%</span>
                  </div>
                  <Progress value={setupProgress} />
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setMode('select')}
                  disabled={isCreatingDatabase}
                >
                  Back
                </Button>
                <Button
                  className="flex-1"
                  onClick={createServerDatabase}
                  disabled={isCreatingDatabase || !detectedIp}
                >
                  {isCreatingDatabase ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating Database...
                    </>
                  ) : (
                    <>
                      <Server className="mr-2 h-4 w-4" />
                      Create Database & Start Server
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Client Setup */}
        {mode === 'client-setup' && (
          <Card className="border-0 shadow-2xl">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Monitor className="h-6 w-6 text-primary" />
                <CardTitle>Client Setup</CardTitle>
              </div>
              <CardDescription>
                Connect this computer to an existing Kwanza ERP server
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Auto Discovery */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Find Server Automatically</Label>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={scanForServers}
                    disabled={isScanning}
                  >
                    {isScanning ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Scanning...
                      </>
                    ) : (
                      <>
                        <Wifi className="mr-2 h-4 w-4" />
                        Scan Network
                      </>
                    )}
                  </Button>
                </div>

                {discoveredServers.length > 0 && (
                  <div className="space-y-2">
                    {discoveredServers.map((server, index) => (
                      <Button
                        key={index}
                        variant="outline"
                        className="w-full justify-start h-auto p-3"
                        onClick={() => selectDiscoveredServer(server)}
                      >
                        <Server className="mr-3 h-5 w-5 text-primary" />
                        <div className="text-left">
                          <div className="font-medium">{server.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {server.ip}:{server.port} • v{server.version}
                          </div>
                        </div>
                      </Button>
                    ))}
                  </div>
                )}

                {isScanning && discoveredServers.length === 0 && (
                  <div className="text-center py-4 text-muted-foreground">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                    Searching for servers on the network...
                  </div>
                )}
              </div>

              {/* Manual Entry */}
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">
                    Or enter manually
                  </span>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="md:col-span-2 space-y-2">
                  <Label htmlFor="serverIp">Server IP Address</Label>
                  <Input
                    id="serverIp"
                    value={serverIp}
                    onChange={(e) => {
                      setServerIp(e.target.value);
                      setConnectionStatus('idle');
                    }}
                    placeholder="192.168.1.100"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="serverPort">Port</Label>
                  <Input
                    id="serverPort"
                    value={serverPort}
                    onChange={(e) => {
                      setServerPort(e.target.value);
                      setConnectionStatus('idle');
                    }}
                    placeholder="3000"
                  />
                </div>
              </div>

              {/* Connection Test */}
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={testConnection}
                  disabled={connectionStatus === 'testing' || !serverIp}
                >
                  {connectionStatus === 'testing' ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Testing...
                    </>
                  ) : (
                    'Test Connection'
                  )}
                </Button>

                {connectionStatus === 'success' && (
                  <Badge className="bg-primary text-primary-foreground">
                    <CheckCircle className="mr-1 h-3 w-3" />
                    Connected
                  </Badge>
                )}

                {connectionStatus === 'error' && (
                  <Badge variant="destructive">
                    <XCircle className="mr-1 h-3 w-3" />
                    Failed
                  </Badge>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setMode('select')}
                >
                  Back
                </Button>
                <Button
                  className="flex-1"
                  onClick={connectToServer}
                  disabled={connectionStatus !== 'success'}
                >
                  <Monitor className="mr-2 h-4 w-4" />
                  Connect to Server
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Setup Complete */}
        {mode === 'complete' && (
          <Card className="border-0 shadow-2xl">
            <CardContent className="py-12 text-center">
              <CheckCircle className="h-16 w-16 text-primary mx-auto mb-4" />
              <h2 className="text-2xl font-bold mb-2">Setup Complete!</h2>
              <p className="text-muted-foreground mb-6">
                {selectedRole === 'server' 
                  ? `Server is ready. Other computers can connect to ${detectedIp}:3000`
                  : `Connected to server at ${serverIp}:${serverPort}`
                }
              </p>
              <Button size="lg" onClick={finishSetup}>
                Continue to Login
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
