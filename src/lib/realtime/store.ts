// Realtime Store - Zustand-like pattern for real-time data
// Data comes from the server via WebSocket and updates all clients instantly

import { useState, useEffect, useCallback } from 'react';
import { onTableSync } from './socket';
import { isLocalNetworkMode } from '../api/config';
import * as localStorage from '../storage';

// Type mapping from snake_case (DB) to camelCase (frontend)
function mapDbRow(row: any, tableName: string): any {
  if (!row) return row;
  
  // Map common fields
  const mapped: any = { ...row };
  
  // Convert snake_case to camelCase
  Object.keys(row).forEach(key => {
    const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    if (camelKey !== key) {
      mapped[camelKey] = row[key];
      delete mapped[key];
    }
  });
  
  return mapped;
}

// Generic real-time hook factory
function createRealtimeHook<T>(
  tableName: string,
  localStorageGetter: () => T[]
) {
  return function useRealtimeData(): { data: T[]; isLoading: boolean; isRealtime: boolean } {
    const [data, setData] = useState<T[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRealtime, setIsRealtime] = useState(false);

    useEffect(() => {
      // Check if we're in local network mode
      if (isLocalNetworkMode()) {
        // Subscribe to real-time updates
        const unsubscribe = onTableSync(tableName as any, (rows) => {
          setData(rows.map(row => mapDbRow(row, tableName)));
          setIsLoading(false);
          setIsRealtime(true);
        });
        
        return unsubscribe;
      } else {
        // Fallback to localStorage (demo mode)
        setData(localStorageGetter());
        setIsLoading(false);
        setIsRealtime(false);
      }
    }, []);

    return { data, isLoading, isRealtime };
  };
}

// Export real-time hooks for each table
export const useRealtimeBranches = createRealtimeHook('branches', localStorage.getBranches);
export const useRealtimeProducts = createRealtimeHook('products', localStorage.getAllProducts);
export const useRealtimeSales = createRealtimeHook('sales', localStorage.getAllSales);
export const useRealtimeClients = createRealtimeHook('clients', localStorage.getClients);
export const useRealtimeCategories = createRealtimeHook('categories', localStorage.getCategories);
export const useRealtimeSuppliers = createRealtimeHook('suppliers', localStorage.getSuppliers);
export const useRealtimeDailyReports = createRealtimeHook('daily_reports', localStorage.getDailyReports);
export const useRealtimeStockTransfers = createRealtimeHook('stock_transfers', localStorage.getStockTransfers);
export const useRealtimePurchaseOrders = createRealtimeHook('purchase_orders', localStorage.getPurchaseOrders);

// Connection status hook
export function useRealtimeStatus() {
  const [isConnected, setIsConnected] = useState(false);
  const [mode, setMode] = useState<'realtime' | 'local'>('local');

  useEffect(() => {
    if (isLocalNetworkMode()) {
      setMode('realtime');
      // Check connection status periodically
      const interval = setInterval(() => {
        // This would check the socket connection status
        setIsConnected(true); // Simplified for now
      }, 1000);
      
      return () => clearInterval(interval);
    } else {
      setMode('local');
      setIsConnected(false);
    }
  }, []);

  return { isConnected, mode };
}
