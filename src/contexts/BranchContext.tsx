import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { Branch } from '@/types/erp';
import { api } from '@/lib/api/client';

interface BranchContextType {
  branches: Branch[];
  currentBranch: Branch | null;
  setCurrentBranch: (branch: Branch) => void;
  isLoading: boolean;
}

const BranchContext = createContext<BranchContextType | undefined>(undefined);

export function BranchProvider({ children }: { children: ReactNode }) {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [currentBranch, setCurrentBranchState] = useState<Branch | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadBranches() {
      try {
        const response = await api.branches.list();
        if (response.data && Array.isArray(response.data) && response.data.length > 0) {
          setBranches(response.data);
          // Cache in localStorage for offline use
          localStorage.setItem('kwanzaerp_branches', JSON.stringify(response.data));
          
          const savedBranchId = localStorage.getItem('kwanza_current_branch_id');
          const saved = savedBranchId ? response.data.find((b: Branch) => b.id === savedBranchId) : null;
          if (saved) {
            setCurrentBranchState(saved);
          } else {
            const mainBranch = response.data.find((b: Branch) => b.isMain);
            if (mainBranch) {
              localStorage.setItem('kwanza_current_branch_id', mainBranch.id);
              setCurrentBranchState(mainBranch);
            }
          }
        } else {
          throw new Error('No branches from API');
        }
      } catch {
        // Fallback: localStorage
        try {
          const raw = localStorage.getItem('kwanzaerp_branches');
          const data: Branch[] = raw ? JSON.parse(raw) : [];
          setBranches(data);
          const savedBranchId = localStorage.getItem('kwanza_current_branch_id');
          const saved = savedBranchId ? data.find(b => b.id === savedBranchId) : null;
          if (saved) {
            setCurrentBranchState(saved);
          } else {
            const mainBranch = data.find(b => b.isMain);
            if (mainBranch) {
              localStorage.setItem('kwanza_current_branch_id', mainBranch.id);
              setCurrentBranchState(mainBranch);
            }
          }
        } catch { /* ignore */ }
      } finally {
        setIsLoading(false);
      }
    }
    loadBranches();
  }, []);

  const setCurrentBranch = useCallback((branch: Branch) => {
    localStorage.setItem('kwanza_current_branch_id', branch.id);
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
