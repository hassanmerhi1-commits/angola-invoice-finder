import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { Branch } from '@/types/erp';
import { api } from '@/lib/api/client';
import { isLocalNetworkMode } from '@/lib/api/config';
import { onTableSync } from '@/lib/realtime/socket';
import * as storage from '@/lib/storage';

interface BranchContextType {
  branches: Branch[];
  currentBranch: Branch | null;
  setCurrentBranch: (branch: Branch) => void;
  isLoading: boolean;
}

const BranchContext = createContext<BranchContextType | undefined>(undefined);

// Map from DB format to TypeScript format
function mapBranchFromDb(row: any): Branch {
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    address: row.address,
    phone: row.phone,
    isMain: row.is_main ?? row.isMain ?? false,
    createdAt: row.created_at ?? row.createdAt,
  };
}

export function BranchProvider({ children }: { children: ReactNode }) {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [currentBranch, setCurrentBranchState] = useState<Branch | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadBranches = async () => {
      setIsLoading(true);
      
      if (isLocalNetworkMode()) {
        // Real-time mode: subscribe to WebSocket updates
        const unsubscribe = onTableSync('branches', (data) => {
          const mapped = data.map(mapBranchFromDb);
          setBranches(mapped);
        });
        
        // Also fetch initial data
        const res = await api.branches.list();
        if (res.data) {
          setBranches(res.data.map(mapBranchFromDb));
        }
        
        setIsLoading(false);
        return unsubscribe;
      } else {
        // Demo mode: use localStorage
        setBranches(storage.getBranches());
        setIsLoading(false);
      }
    };
    
    loadBranches();
    
    // Load current branch from storage
    const current = storage.getCurrentBranch();
    if (current) {
      setCurrentBranchState(current);
    } else {
      const storedBranches = storage.getBranches();
      const mainBranch = storedBranches.find(b => b.isMain);
      if (mainBranch) {
        storage.setCurrentBranch(mainBranch);
        setCurrentBranchState(mainBranch);
      }
    }
  }, []);

  const setCurrentBranch = useCallback((branch: Branch) => {
    storage.setCurrentBranch(branch);
    setCurrentBranchState(branch);
  }, []);

  return (
    <BranchContext.Provider value={{ branches, currentBranch, setCurrentBranch, isLoading }}>
      {children}
    </BranchContext.Provider>
  );
}

export function useBranchContext() {
  const context = useContext(BranchContext);
  if (context === undefined) {
    throw new Error('useBranchContext must be used within a BranchProvider');
  }
  return context;
}
