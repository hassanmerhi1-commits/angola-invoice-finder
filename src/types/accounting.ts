// Chart of Accounts types

export type AccountType = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
export type AccountNature = 'debit' | 'credit';

export interface Account {
  id: string;
  code: string;
  name: string;
  description?: string;
  account_type: AccountType;
  account_nature: AccountNature;
  parent_id?: string | null;
  parent_name?: string;
  parent_code?: string;
  level: number;
  is_header: boolean;
  is_active: boolean;
  opening_balance: number;
  current_balance: number;
  branch_id?: string | null;
  children_count?: number;
  created_at: string;
  updated_at: string;
}

export interface AccountBalance {
  id: string;
  code: string;
  name: string;
  account_type: AccountType;
  account_nature: AccountNature;
  opening_balance: number;
  total_debits: number;
  total_credits: number;
  current_balance: number;
}

export interface TrialBalanceRow {
  id: string;
  code: string;
  name: string;
  account_type: AccountType;
  account_nature: AccountNature;
  level: number;
  is_header: boolean;
  opening_balance: number;
  total_debits: number;
  total_credits: number;
  closing_balance: number;
}

export interface JournalEntry {
  id: string;
  entry_number: string;
  entry_date: string;
  description: string;
  reference_type?: string;
  reference_id?: string;
  total_debit: number;
  total_credit: number;
  is_posted: boolean;
  posted_at?: string;
  posted_by?: string;
  branch_id?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
  lines?: JournalEntryLine[];
}

export interface JournalEntryLine {
  id: string;
  journal_entry_id: string;
  account_id: string;
  account_code?: string;
  account_name?: string;
  description?: string;
  debit_amount: number;
  credit_amount: number;
  created_at: string;
}

export interface AccountFormData {
  code: string;
  name: string;
  description?: string;
  account_type: AccountType;
  account_nature: AccountNature;
  parent_id?: string | null;
  level?: number;
  is_header?: boolean;
  opening_balance?: number;
  branch_id?: string | null;
}

// Helper to get account type label
export const accountTypeLabels: Record<AccountType, { en: string; pt: string }> = {
  asset: { en: 'Asset', pt: 'Activo' },
  liability: { en: 'Liability', pt: 'Passivo' },
  equity: { en: 'Equity', pt: 'Capital Próprio' },
  revenue: { en: 'Revenue', pt: 'Receitas' },
  expense: { en: 'Expense', pt: 'Gastos' }
};

// Helper to get nature based on account type
export function getDefaultNature(type: AccountType): AccountNature {
  switch (type) {
    case 'asset':
    case 'expense':
      return 'debit';
    case 'liability':
    case 'equity':
    case 'revenue':
      return 'credit';
  }
}
