import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api/client';
import { Account, AccountFormData, TrialBalanceRow, AccountType } from '@/types/accounting';

export function useChartOfAccounts() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAccounts = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await api.chartOfAccounts.list();
      if (response.error) throw new Error(response.error);
      setAccounts(response.data || []);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch accounts');
      console.error('[useChartOfAccounts] Error:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  const createAccount = async (data: AccountFormData): Promise<Account> => {
    const response = await api.chartOfAccounts.create(data);
    if (response.error) throw new Error(response.error);
    await fetchAccounts();
    return response.data;
  };

  const updateAccount = async (id: string, data: Partial<AccountFormData>): Promise<Account> => {
    const response = await api.chartOfAccounts.update(id, data);
    if (response.error) throw new Error(response.error);
    await fetchAccounts();
    return response.data;
  };

  const deleteAccount = async (id: string): Promise<void> => {
    const response = await api.chartOfAccounts.delete(id);
    if (response.error) throw new Error(response.error);
    await fetchAccounts();
  };

  const getAccountsByType = (type: AccountType): Account[] => {
    return accounts.filter(a => a.account_type === type);
  };

  const getChildAccounts = (parentId: string): Account[] => {
    return accounts.filter(a => a.parent_id === parentId);
  };

  const getParentAccounts = (): Account[] => {
    return accounts.filter(a => a.is_header);
  };

  const getRootAccounts = (): Account[] => {
    return accounts.filter(a => !a.parent_id);
  };

  // Build tree structure for hierarchical display
  const getAccountTree = (): (Account & { children: Account[] })[] => {
    const rootAccounts = getRootAccounts();
    
    const buildTree = (parentId: string | null): (Account & { children: Account[] })[] => {
      return accounts
        .filter(a => a.parent_id === parentId)
        .map(account => ({
          ...account,
          children: buildTree(account.id)
        }));
    };

    return buildTree(null);
  };

  return {
    accounts,
    isLoading,
    error,
    refetch: fetchAccounts,
    createAccount,
    updateAccount,
    deleteAccount,
    getAccountsByType,
    getChildAccounts,
    getParentAccounts,
    getRootAccounts,
    getAccountTree
  };
}

export function useTrialBalance(startDate?: string, endDate?: string) {
  const [data, setData] = useState<TrialBalanceRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTrialBalance = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await api.chartOfAccounts.getTrialBalance(startDate, endDate);
      if (response.error) throw new Error(response.error);
      setData(response.data || []);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch trial balance');
      console.error('[useTrialBalance] Error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    fetchTrialBalance();
  }, [fetchTrialBalance]);

  const totals = data.reduce((acc, row) => {
    if (!row.is_header) {
      acc.debits += Number(row.total_debits) || 0;
      acc.credits += Number(row.total_credits) || 0;
    }
    return acc;
  }, { debits: 0, credits: 0 });

  return {
    data,
    isLoading,
    error,
    refetch: fetchTrialBalance,
    totals
  };
}
