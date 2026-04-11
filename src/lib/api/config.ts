// API Configuration
// Change this to your server's local IP address

// Default to localhost for development
// In production, change to your server IP like: http://192.168.1.50:3000
const DEFAULT_API_URL = 'http://localhost:3000';

// Get API URL from localStorage or use default
export function getApiUrl(): string {
  if (typeof window !== 'undefined') {
    const savedUrl = localStorage.getItem('kwanza_api_url');
    if (savedUrl) return savedUrl;
  }
  return DEFAULT_API_URL;
}

// Set API URL (for settings page)
export function setApiUrl(url: string): void {
  localStorage.setItem('kwanza_api_url', url);
  // Reload to reconnect with new URL
  window.location.reload();
}

// Get WebSocket URL from API URL
export function getWsUrl(): string {
  const apiUrl = getApiUrl();
  return apiUrl.replace('http://', 'ws://').replace('https://', 'wss://');
}

// Check if we're in local network mode (custom API) or demo mode (localStorage)
export function isLocalNetworkMode(): boolean {
  const apiUrl = getApiUrl();
  return apiUrl !== DEFAULT_API_URL || localStorage.getItem('kwanza_force_api') === 'true';
}

// Force API mode even on localhost (for testing)
export function setForceApiMode(enabled: boolean): void {
  localStorage.setItem('kwanza_force_api', enabled ? 'true' : 'false');
  window.location.reload();
}

// Detect if running in web preview (no Electron, no setup configured)
// Used to disable background polling that would spam ECONNREFUSED errors
export function isWebPreview(): boolean {
  const isElectron = typeof window !== 'undefined' && !!(window as any).electronAPI?.isElectron;
  if (isElectron) return false;
  const setupComplete = typeof window !== 'undefined' && localStorage.getItem('kwanza_setup_complete') === 'true';
  return !setupComplete;
}
