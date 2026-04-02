/**
 * Chart of Accounts Engine
 * 
 * Automatically creates sub-accounts for suppliers/clients
 * and updates account balances when journal entries are posted.
 */

import { Account } from '@/types/accounting';

const LOCAL_COA_STORAGE_KEY = 'kwanzaerp_chart_of_accounts';

function loadAccounts(): Account[] {
  try {
    const raw = localStorage.getItem(LOCAL_COA_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveAccounts(accounts: Account[]) {
  localStorage.setItem(LOCAL_COA_STORAGE_KEY, JSON.stringify(
    [...accounts].sort((a, b) => a.code.localeCompare(b.code))
  ));
}

/**
 * Ensure a supplier has a sub-account under 3.2 (Fornecedores).
 * Returns the proper account code (e.g., "3.2.001").
 */
export function ensureSupplierAccount(supplierId: string, supplierName: string, supplierNif?: string): string {
  const accounts = loadAccounts();
  
  // Check if supplier already has an account (match by name or NIF in description)
  const existing = accounts.find(a => 
    a.code.startsWith('3.2.') && 
    a.level >= 3 && 
    !a.is_header &&
    (a.name === supplierName || (supplierNif && a.description?.includes(supplierNif)))
  );
  
  if (existing) return existing.code;
  
  // Find parent "3.2" (Fornecedores)
  const parent = accounts.find(a => a.code === '3.2');
  if (!parent) {
    console.warn('[CoA Engine] Parent account 3.2 (Fornecedores) not found');
    return '3.2.001'; // Fallback
  }
  
  // Find next sequence under 3.2.XXX
  const children = accounts.filter(a => a.code.startsWith('3.2.') && a.level === 3 && !a.is_header);
  const nextSeq = children.length + 1;
  const code = `3.2.${nextSeq.toString().padStart(3, '0')}`;
  
  // Create the account
  const now = new Date().toISOString();
  const newAccount: Account = {
    id: `local-coa-supplier-${supplierId}`,
    code,
    name: supplierName,
    description: supplierNif ? `NIF: ${supplierNif}` : undefined,
    account_type: 'liability',
    account_nature: 'credit',
    parent_id: parent.id,
    parent_name: parent.name,
    parent_code: '3.2',
    level: 3,
    is_header: false,
    is_active: true,
    opening_balance: 0,
    current_balance: 0,
    branch_id: null,
    children_count: 0,
    created_at: now,
    updated_at: now,
  };
  
  // Update parent children_count
  const parentIdx = accounts.findIndex(a => a.id === parent.id);
  if (parentIdx >= 0) {
    accounts[parentIdx] = { ...accounts[parentIdx], children_count: (accounts[parentIdx].children_count || 0) + 1 };
  }
  
  accounts.push(newAccount);
  saveAccounts(accounts);
  console.log(`[CoA Engine] Created supplier account ${code} — ${supplierName}`);
  
  return code;
}

/**
 * Ensure a client has a sub-account under 3.1 (Clientes).
 * Returns the proper account code (e.g., "3.1.001").
 */
export function ensureClientAccount(clientId: string, clientName: string, clientNif?: string): string {
  const accounts = loadAccounts();
  
  const existing = accounts.find(a => 
    a.code.startsWith('3.1.') && 
    a.level >= 3 && 
    !a.is_header &&
    (a.name === clientName || (clientNif && a.description?.includes(clientNif)))
  );
  
  if (existing) return existing.code;
  
  const parent = accounts.find(a => a.code === '3.1');
  if (!parent) return '3.1.001';
  
  const children = accounts.filter(a => a.code.startsWith('3.1.') && a.level === 3 && !a.is_header);
  const nextSeq = children.length + 1;
  const code = `3.1.${nextSeq.toString().padStart(3, '0')}`;
  
  const now = new Date().toISOString();
  const newAccount: Account = {
    id: `local-coa-client-${clientId}`,
    code,
    name: clientName,
    description: clientNif ? `NIF: ${clientNif}` : undefined,
    account_type: 'asset',
    account_nature: 'debit',
    parent_id: parent.id,
    parent_name: parent.name,
    parent_code: '3.1',
    level: 3,
    is_header: false,
    is_active: true,
    opening_balance: 0,
    current_balance: 0,
    branch_id: null,
    children_count: 0,
    created_at: now,
    updated_at: now,
  };
  
  const parentIdx = accounts.findIndex(a => a.id === parent.id);
  if (parentIdx >= 0) {
    accounts[parentIdx] = { ...accounts[parentIdx], children_count: (accounts[parentIdx].children_count || 0) + 1 };
  }
  
  accounts.push(newAccount);
  saveAccounts(accounts);
  console.log(`[CoA Engine] Created client account ${code} — ${clientName}`);
  
  return code;
}

/**
 * Update account balances in the Chart of Accounts from journal lines.
 * Debit increases debit-nature accounts, Credit increases credit-nature accounts.
 */
export function updateCoABalancesFromJournal(lines: { accountCode: string; debit: number; credit: number }[]) {
  const accounts = loadAccounts();
  let changed = false;
  
  for (const line of lines) {
    const account = accounts.find(a => a.code === line.accountCode && a.is_active);
    if (!account) {
      console.warn(`[CoA Engine] Account ${line.accountCode} not found for balance update`);
      continue;
    }
    
    // For debit-nature accounts (assets, expenses): debit increases, credit decreases
    // For credit-nature accounts (liabilities, equity, revenue): credit increases, debit decreases
    const balanceChange = account.account_nature === 'debit'
      ? (line.debit || 0) - (line.credit || 0)
      : (line.credit || 0) - (line.debit || 0);
    
    const idx = accounts.findIndex(a => a.id === account.id);
    if (idx >= 0) {
      accounts[idx] = {
        ...accounts[idx],
        current_balance: (accounts[idx].current_balance || 0) + balanceChange,
        updated_at: new Date().toISOString(),
      };
      changed = true;
      console.log(`[CoA Engine] ${account.code} ${account.name}: balance ${balanceChange >= 0 ? '+' : ''}${balanceChange.toFixed(2)} → ${accounts[idx].current_balance.toFixed(2)}`);
    }
  }
  
  if (changed) {
    // Also roll up balances to parent header accounts
    rollUpParentBalances(accounts);
    saveAccounts(accounts);
  }
}

/**
 * Roll up child account balances to parent header accounts
 */
function rollUpParentBalances(accounts: Account[]) {
  // Get all header accounts, sorted by level descending (deepest first)
  const headers = accounts.filter(a => a.is_header).sort((a, b) => b.level - a.level);
  
  for (const header of headers) {
    const children = accounts.filter(a => a.parent_id === header.id);
    if (children.length === 0) continue;
    
    const sum = children.reduce((total, child) => total + (child.current_balance || 0), 0);
    const idx = accounts.findIndex(a => a.id === header.id);
    if (idx >= 0) {
      accounts[idx] = { ...accounts[idx], current_balance: sum };
    }
  }
}
