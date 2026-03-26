import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { Branch } from '@/types/erp';
import * as storage from '@/lib/storage';

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
    storage.getBranches().then(data => {
      setBranches(data);
      setIsLoading(false);
      const current = storage.getCurrentBranch();
      if (current) {
        setCurrentBranchState(current);
      } else {
        const mainBranch = data.find(b => b.isMain);
        if (mainBranch) {
          storage.setCurrentBranch(mainBranch);
          setCurrentBranchState(mainBranch);
        }
      }
    });
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
