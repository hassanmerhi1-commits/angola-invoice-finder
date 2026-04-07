/**
 * Accounting Storage for Kwanza ERP
 * Handles Caixa, Bank Accounts, Expenses, and Cash Transactions
 */

import { 
  Caixa, 
  CaixaSession, 
  BankAccount, 
  Expense, 
  CashTransaction, 
  BankTransaction,
  MoneyTransfer,
  ExpenseCategory
} from '@/types/accounting';
import { format } from 'date-fns';

// Storage keys
const STORAGE_KEYS = {
  caixas: 'kwanzaerp_caixas',
  caixaSessions: 'kwanzaerp_caixa_sessions',
  bankAccounts: 'kwanzaerp_bank_accounts',
  expenses: 'kwanzaerp_expenses',
  cashTransactions: 'kwanzaerp_cash_transactions',
  bankTransactions: 'kwanzaerp_bank_transactions',
  moneyTransfers: 'kwanzaerp_money_transfers',
};

// Generic helpers
function getItem<T>(key: string, defaultValue: T): T {
  try {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : defaultValue;
  } catch {
    return defaultValue;
  }
}

function setItem<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value));
}

// ==================== CAIXA FUNCTIONS ====================

export function getCaixas(branchId?: string): Caixa[] {
  const caixas = getItem<Caixa[]>(STORAGE_KEYS.caixas, []);
  if (branchId) {
    return caixas.filter(c => c.branchId === branchId);
  }
  return caixas;
}

export function getCaixaById(id: string): Caixa | undefined {
  return getCaixas().find(c => c.id === id);
}

export function saveCaixa(caixa: Caixa): void {
  const caixas = getCaixas();
  const index = caixas.findIndex(c => c.id === caixa.id);
  if (index >= 0) {
    caixas[index] = { ...caixa, updatedAt: new Date().toISOString() };
  } else {
    caixas.push(caixa);
  }
  setItem(STORAGE_KEYS.caixas, caixas);
}

export function createCaixa(
  branchId: string,
  branchName: string,
  name: string,
  openingBalance: number = 0,
  pettyLimit?: number,
  dailyLimit?: number
): Caixa {
  const caixa: Caixa = {
    id: `caixa_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    branchId,
    branchName,
    name,
    openingBalance,
    currentBalance: openingBalance,
    status: 'closed',
    pettyLimit,
    dailyLimit,
    requiresApproval: !!pettyLimit,
    createdAt: new Date().toISOString(),
  };
  saveCaixa(caixa);
  return caixa;
}

export function updateCaixaBalance(caixaId: string, amount: number, direction: 'in' | 'out'): void {
  const caixa = getCaixaById(caixaId);
  if (caixa) {
    caixa.currentBalance = direction === 'in' 
      ? caixa.currentBalance + amount 
      : caixa.currentBalance - amount;
    saveCaixa(caixa);
  }
}

// Ensure a default Caixa exists for a branch - auto-seeds if none found
export function ensureBranchCaixa(branchId: string, branchName: string): Caixa {
  const existing = getCaixas(branchId);
  if (existing.length > 0) {
    return existing[0];
  }
  // Auto-create a default Caixa for this branch
  return createCaixa(branchId, branchName, `Caixa Principal - ${branchName}`, 0);
}

// Get the first open Caixa for a branch (for POS integration)
export function getOpenCaixaForBranch(branchId: string): Caixa | undefined {
  const caixas = getCaixas(branchId);
  return caixas.find(c => c.status === 'open');
}

// Process a sale payment through Caixa - the vital blood flow!
export function processSalePayment(
  branchId: string,
  saleId: string,
  invoiceNumber: string,
  amount: number,
  paymentMethod: 'cash' | 'card' | 'transfer',
  cashierId: string,
  customerName?: string
): { success: boolean; message: string; transaction?: CashTransaction; caixaName?: string; newBalance?: number } {
  // Only process cash payments through Caixa
  if (paymentMethod !== 'cash') {
    return { success: true, message: 'Non-cash payment - no Caixa update needed' };
  }
  
  // Find open Caixa for this branch
  const openCaixa = getOpenCaixaForBranch(branchId);
  if (!openCaixa) {
    // If no Caixa is open, the sale still completes but logs a warning
    console.warn(`[CAIXA] No open Caixa for branch ${branchId} - sale recorded without Caixa entry`);
    return { 
      success: true, 
      message: 'Venda registada, mas nenhuma Caixa aberta para este balcão' 
    };
  }
  
  // Find the open session
  const openSession = getOpenCaixaSession(openCaixa.id);
  if (!openSession) {
    console.warn(`[CAIXA] No open session for Caixa ${openCaixa.id}`);
    return { 
      success: true, 
      message: 'Venda registada, mas sessão de Caixa não encontrada' 
    };
  }
  
  // Create cash transaction - THE BLOOD FLOWS!
  const transaction = createCashTransaction(
    openCaixa.id,
    branchId,
    'sale',
    amount,
    `Venda ${invoiceNumber}${customerName ? ` - ${customerName}` : ''}`,
    cashierId,
    undefined, // category
    customerName, // payee
    'sale',
    saleId,
    invoiceNumber
  );
  
  // Update Caixa balance
  updateCaixaBalance(openCaixa.id, amount, 'in');
  
  // Get updated balance for feedback
  const updatedCaixa = getCaixaById(openCaixa.id);
  const newBalance = updatedCaixa?.currentBalance ?? openCaixa.currentBalance + amount;
  
  // Update session totals
  updateCaixaSessionTotals(openSession.id, amount, 'sale');
  
  console.log(`[CAIXA] Sale ${invoiceNumber} recorded: +${amount.toLocaleString('pt-AO')} Kz to ${openCaixa.name}`);
  
  return { 
    success: true, 
    message: 'Venda registada na Caixa',
    transaction,
    caixaName: openCaixa.name,
    newBalance
  };
}

// Update session totals (called when transactions happen)
export function updateCaixaSessionTotals(
  sessionId: string, 
  amount: number, 
  type: 'sale' | 'expense' | 'deposit' | 'withdrawal' | 'adjustment'
): void {
  const sessions = getCaixaSessions();
  const session = sessions.find(s => s.id === sessionId);
  if (session) {
    switch (type) {
      case 'sale':
      case 'deposit':
        session.totalIn += amount;
        if (type === 'sale') session.salesTotal += amount;
        break;
      case 'expense':
      case 'withdrawal':
        session.totalOut += amount;
        if (type === 'expense') session.expensesTotal += amount;
        break;
      case 'adjustment':
        session.adjustments += amount; // Can be negative
        if (amount > 0) session.totalIn += amount;
        else session.totalOut += Math.abs(amount);
        break;
    }
    setItem(STORAGE_KEYS.caixaSessions, sessions);
  }
}

// ==================== CAIXA SESSION FUNCTIONS ====================

export function getCaixaSessions(caixaId?: string, date?: string): CaixaSession[] {
  const sessions = getItem<CaixaSession[]>(STORAGE_KEYS.caixaSessions, []);
  let filtered = sessions;
  if (caixaId) {
    filtered = filtered.filter(s => s.caixaId === caixaId);
  }
  if (date) {
    filtered = filtered.filter(s => s.date === date);
  }
  return filtered;
}

export function getOpenCaixaSession(caixaId: string): CaixaSession | undefined {
  return getCaixaSessions(caixaId).find(s => s.status === 'open');
}

export function openCaixaSession(
  caixaId: string, 
  branchId: string, 
  openingBalance: number, 
  openedBy: string
): CaixaSession {
  const today = format(new Date(), 'yyyy-MM-dd');
  const session: CaixaSession = {
    id: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    caixaId,
    branchId,
    date: today,
    openingBalance,
    totalIn: 0,
    totalOut: 0,
    salesTotal: 0,
    expensesTotal: 0,
    adjustments: 0,
    status: 'open',
    openedBy,
    openedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  };
  
  const sessions = getCaixaSessions();
  sessions.push(session);
  setItem(STORAGE_KEYS.caixaSessions, sessions);
  
  // Update caixa status
  const caixa = getCaixaById(caixaId);
  if (caixa) {
    caixa.status = 'open';
    caixa.openedAt = session.openedAt;
    caixa.openedBy = openedBy;
    saveCaixa(caixa);
  }
  
  return session;
}

export function closeCaixaSession(
  sessionId: string,
  closingBalance: number,
  closedBy: string,
  notes?: string
): void {
  const sessions = getCaixaSessions();
  const session = sessions.find(s => s.id === sessionId);
  if (session) {
    session.closingBalance = closingBalance;
    session.closedBy = closedBy;
    session.closedAt = new Date().toISOString();
    session.status = 'closed';
    session.notes = notes;
    setItem(STORAGE_KEYS.caixaSessions, sessions);
    
    // Update caixa status
    const caixa = getCaixaById(session.caixaId);
    if (caixa) {
      caixa.status = 'closed';
      caixa.closedAt = session.closedAt;
      caixa.closedBy = closedBy;
      caixa.closingBalance = closingBalance;
      caixa.closingNotes = notes;
      saveCaixa(caixa);
    }
  }
}

// ==================== BANK ACCOUNT FUNCTIONS ====================

export function getBankAccounts(branchId?: string): BankAccount[] {
  const accounts = getItem<BankAccount[]>(STORAGE_KEYS.bankAccounts, []);
  if (branchId) {
    return accounts.filter(a => a.branchId === branchId);
  }
  return accounts;
}

export function getBankAccountById(id: string): BankAccount | undefined {
  return getBankAccounts().find(a => a.id === id);
}

export function saveBankAccount(account: BankAccount): void {
  const accounts = getBankAccounts();
  const index = accounts.findIndex(a => a.id === account.id);
  if (index >= 0) {
    accounts[index] = { ...account, updatedAt: new Date().toISOString() };
  } else {
    accounts.push(account);
  }
  setItem(STORAGE_KEYS.bankAccounts, accounts);
}

export function createBankAccount(
  branchId: string,
  branchName: string,
  bankName: string,
  accountName: string,
  accountNumber: string,
  currency: 'AOA' | 'USD' | 'EUR' = 'AOA',
  openingBalance: number = 0,
  iban?: string
): BankAccount {
  const account: BankAccount = {
    id: `bank_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    branchId,
    branchName,
    bankName,
    accountName,
    accountNumber,
    iban,
    currency,
    currentBalance: openingBalance,
    isActive: true,
    isPrimary: getBankAccounts(branchId).length === 0,
    createdAt: new Date().toISOString(),
  };
  saveBankAccount(account);
  return account;
}

// ==================== EXPENSE FUNCTIONS ====================

export function getExpenses(branchId?: string): Expense[] {
  const expenses = getItem<Expense[]>(STORAGE_KEYS.expenses, []);
  if (branchId) {
    return expenses.filter(e => e.branchId === branchId);
  }
  return expenses;
}

export function getExpenseById(id: string): Expense | undefined {
  return getExpenses().find(e => e.id === id);
}

export function generateExpenseNumber(branchCode: string): string {
  const expenses = getExpenses();
  const today = format(new Date(), 'yyyyMMdd');
  const todayExpenses = expenses.filter(e => e.expenseNumber.includes(today));
  const sequence = String(todayExpenses.length + 1).padStart(3, '0');
  return `DESP-${branchCode}-${today}-${sequence}`;
}

export function saveExpense(expense: Expense): void {
  const expenses = getExpenses();
  const index = expenses.findIndex(e => e.id === expense.id);
  if (index >= 0) {
    expenses[index] = { ...expense, updatedAt: new Date().toISOString() };
  } else {
    expenses.push(expense);
  }
  setItem(STORAGE_KEYS.expenses, expenses);
}

export function createExpense(
  branchId: string,
  branchName: string,
  branchCode: string,
  category: ExpenseCategory,
  description: string,
  amount: number,
  paymentSource: 'caixa' | 'bank',
  requestedBy: string,
  caixaId?: string,
  bankAccountId?: string,
  payeeName?: string,
  taxAmount?: number,
  invoiceNumber?: string,
  notes?: string
): Expense {
  const expense: Expense = {
    id: `exp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    expenseNumber: generateExpenseNumber(branchCode),
    branchId,
    branchName,
    category,
    description,
    amount,
    taxAmount: taxAmount || 0,
    totalAmount: amount + (taxAmount || 0),
    paymentSource,
    caixaId,
    bankAccountId,
    payeeName,
    invoiceNumber,
    status: 'draft',
    requestedBy,
    requestedAt: new Date().toISOString(),
    notes,
    createdAt: new Date().toISOString(),
  };
  saveExpense(expense);
  return expense;
}

export function payExpense(
  expenseId: string,
  paidBy: string,
  createTransaction: boolean = true
): void {
  const expense = getExpenseById(expenseId);
  if (!expense) return;
  
  expense.status = 'paid';
  expense.paidBy = paidBy;
  expense.paidAt = new Date().toISOString();
  
  if (createTransaction) {
    if (expense.paymentSource === 'caixa' && expense.caixaId) {
      // Create cash transaction
      const transaction = createCashTransaction(
        expense.caixaId,
        expense.branchId,
        'expense',
        expense.totalAmount,
        `Despesa: ${expense.description}`,
        paidBy,
        expense.category,
        expense.payeeName,
        'expense',
        expense.id,
        expense.expenseNumber
      );
      expense.transactionId = transaction.id;
      
      // Update caixa balance
      updateCaixaBalance(expense.caixaId, expense.totalAmount, 'out');
    } else if (expense.paymentSource === 'bank' && expense.bankAccountId) {
      // Create bank transaction
      const transaction = createBankTransaction(
        expense.bankAccountId,
        expense.branchId,
        'expense',
        expense.totalAmount,
        `Despesa: ${expense.description}`,
        paidBy,
        expense.category,
        expense.payeeName,
        'expense',
        expense.id,
        expense.expenseNumber
      );
      expense.transactionId = transaction.id;
      
      // Update bank balance
      const account = getBankAccountById(expense.bankAccountId);
      if (account) {
        account.currentBalance -= expense.totalAmount;
        saveBankAccount(account);
      }
    }
  }
  
  saveExpense(expense);
}

// ==================== CASH TRANSACTION FUNCTIONS ====================

export function getCashTransactions(caixaId?: string): CashTransaction[] {
  const transactions = getItem<CashTransaction[]>(STORAGE_KEYS.cashTransactions, []);
  if (caixaId) {
    return transactions.filter(t => t.caixaId === caixaId);
  }
  return transactions;
}

export function createCashTransaction(
  caixaId: string,
  branchId: string,
  type: CashTransaction['type'],
  amount: number,
  description: string,
  createdBy: string,
  category?: ExpenseCategory,
  payee?: string,
  referenceType?: CashTransaction['referenceType'],
  referenceId?: string,
  referenceNumber?: string,
  notes?: string
): CashTransaction {
  const caixa = getCaixaById(caixaId);
  const direction: 'in' | 'out' = ['sale', 'deposit', 'transfer_in', 'opening'].includes(type) ? 'in' : 'out';
  const balanceAfter = caixa ? (direction === 'in' ? caixa.currentBalance + amount : caixa.currentBalance - amount) : 0;
  
  const transaction: CashTransaction = {
    id: `ct_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    caixaId,
    branchId,
    type,
    direction,
    amount,
    balanceAfter,
    referenceType,
    referenceId,
    referenceNumber,
    description,
    category,
    payee,
    createdBy,
    createdAt: new Date().toISOString(),
    notes,
  };
  
  const transactions = getCashTransactions();
  transactions.push(transaction);
  setItem(STORAGE_KEYS.cashTransactions, transactions);
  
  return transaction;
}

// ==================== BANK TRANSACTION FUNCTIONS ====================

export function getBankTransactions(bankAccountId?: string): BankTransaction[] {
  const transactions = getItem<BankTransaction[]>(STORAGE_KEYS.bankTransactions, []);
  if (bankAccountId) {
    return transactions.filter(t => t.bankAccountId === bankAccountId);
  }
  return transactions;
}

export function createBankTransaction(
  bankAccountId: string,
  branchId: string,
  type: BankTransaction['type'],
  amount: number,
  description: string,
  createdBy: string,
  category?: ExpenseCategory,
  payee?: string,
  referenceType?: BankTransaction['referenceType'],
  referenceId?: string,
  referenceNumber?: string,
  notes?: string
): BankTransaction {
  const account = getBankAccountById(bankAccountId);
  const direction: 'in' | 'out' = ['sale', 'deposit', 'transfer_in', 'opening'].includes(type) ? 'in' : 'out';
  const balanceAfter = account ? (direction === 'in' ? account.currentBalance + amount : account.currentBalance - amount) : 0;
  
  const transaction: BankTransaction = {
    id: `bt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    bankAccountId,
    branchId,
    type,
    direction,
    amount,
    balanceAfter,
    referenceType,
    referenceId,
    referenceNumber,
    transactionDate: new Date().toISOString(),
    description,
    category,
    payee,
    createdBy,
    createdAt: new Date().toISOString(),
    notes,
  };
  
  const transactions = getBankTransactions();
  transactions.push(transaction);
  setItem(STORAGE_KEYS.bankTransactions, transactions);
  
  return transaction;
}

// ==================== MONEY TRANSFER FUNCTIONS (DOUBLE-ENTRY) ====================

const TRANSFER_STORAGE_KEY = 'kwanzaerp_money_transfers';

export function getMoneyTransfers(branchId?: string): MoneyTransfer[] {
  const transfers = getItem<MoneyTransfer[]>(TRANSFER_STORAGE_KEY, []);
  if (branchId) {
    return transfers.filter(t => t.branchId === branchId);
  }
  return transfers;
}

export function generateTransferNumber(branchCode: string): string {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const transfers = getMoneyTransfers();
  const todayTransfers = transfers.filter(t => 
    t.transferNumber.includes(`TRF-${branchCode}/${today}`)
  );
  const seq = (todayTransfers.length + 1).toString().padStart(4, '0');
  return `TRF-${branchCode}/${today}/${seq}`;
}

/**
 * Execute a double-entry money transfer between accounts
 * DEBIT: Money enters destination account
 * CREDIT: Money leaves source account
 */
export function executeMoneyTransfer(
  branchId: string,
  branchCode: string,
  sourceType: 'caixa' | 'bank',
  sourceId: string,
  destinationType: 'caixa' | 'bank',
  destinationId: string,
  amount: number,
  reason: string,
  createdBy: string,
  notes?: string
): { success: boolean; transfer?: MoneyTransfer; error?: string } {
  
  // Validate source has sufficient balance
  let sourceBalance = 0;
  let sourceDescription = '';
  let destinationDescription = '';
  
  if (sourceType === 'caixa') {
    const caixa = getCaixaById(sourceId);
    if (!caixa) return { success: false, error: 'Caixa de origem não encontrada' };
    if (caixa.status !== 'open') return { success: false, error: 'Caixa de origem não está aberta' };
    sourceBalance = caixa.currentBalance;
    sourceDescription = caixa.name;
  } else {
    const bank = getBankAccountById(sourceId);
    if (!bank) return { success: false, error: 'Conta bancária de origem não encontrada' };
    sourceBalance = bank.currentBalance;
    sourceDescription = `${bank.bankName} - ${bank.accountNumber}`;
  }
  
  if (sourceBalance < amount) {
    return { success: false, error: `Saldo insuficiente. Disponível: ${sourceBalance.toLocaleString('pt-AO')} Kz` };
  }
  
  if (destinationType === 'caixa') {
    const caixa = getCaixaById(destinationId);
    if (!caixa) return { success: false, error: 'Caixa de destino não encontrada' };
    destinationDescription = caixa.name;
  } else {
    const bank = getBankAccountById(destinationId);
    if (!bank) return { success: false, error: 'Conta bancária de destino não encontrada' };
    destinationDescription = `${bank.bankName} - ${bank.accountNumber}`;
  }
  
  // Generate transfer number
  const transferNumber = generateTransferNumber(branchCode);
  
  // Create transfer record
  const transfer: MoneyTransfer = {
    id: `trf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    transferNumber,
    branchId,
    sourceType,
    sourceCaixaId: sourceType === 'caixa' ? sourceId : undefined,
    sourceBankAccountId: sourceType === 'bank' ? sourceId : undefined,
    sourceDescription,
    destinationType,
    destinationCaixaId: destinationType === 'caixa' ? destinationId : undefined,
    destinationBankAccountId: destinationType === 'bank' ? destinationId : undefined,
    destinationDescription,
    amount,
    status: 'completed',
    reason,
    createdBy,
    createdAt: new Date().toISOString(),
    completedBy: createdBy,
    completedAt: new Date().toISOString(),
    notes
  };
  
  // === DOUBLE-ENTRY ACCOUNTING ===
  
  // 1. CREDIT: Deduct from source (money leaves)
  if (sourceType === 'caixa') {
    createCashTransaction(
      sourceId,
      branchId,
      'transfer_out',
      amount,
      `Transferência para ${destinationDescription}: ${reason}`,
      createdBy,
      undefined,
      destinationDescription,
      'transfer',
      transfer.id,
      transferNumber
    );
    updateCaixaBalance(sourceId, amount, 'out');
    
    // Update session if open
    const session = getOpenCaixaSession(sourceId);
    if (session) {
      updateCaixaSessionTotals(session.id, amount, 'withdrawal');
    }
  } else {
    createBankTransaction(
      sourceId,
      branchId,
      'transfer_out',
      amount,
      `Transferência para ${destinationDescription}: ${reason}`,
      createdBy,
      undefined,
      destinationDescription,
      'transfer',
      transfer.id,
      transferNumber
    );
    const sourceBank = getBankAccountById(sourceId);
    if (sourceBank) {
      sourceBank.currentBalance -= amount;
      saveBankAccount(sourceBank);
    }
  }
  
  // 2. DEBIT: Add to destination (money enters)
  if (destinationType === 'caixa') {
    createCashTransaction(
      destinationId,
      branchId,
      'transfer_in',
      amount,
      `Transferência de ${sourceDescription}: ${reason}`,
      createdBy,
      undefined,
      sourceDescription,
      'transfer',
      transfer.id,
      transferNumber
    );
    updateCaixaBalance(destinationId, amount, 'in');
    
    // Update session if open
    const session = getOpenCaixaSession(destinationId);
    if (session) {
      updateCaixaSessionTotals(session.id, amount, 'deposit');
    }
  } else {
    createBankTransaction(
      destinationId,
      branchId,
      'transfer_in',
      amount,
      `Transferência de ${sourceDescription}: ${reason}`,
      createdBy,
      undefined,
      sourceDescription,
      'transfer',
      transfer.id,
      transferNumber
    );
    const destBank = getBankAccountById(destinationId);
    if (destBank) {
      destBank.currentBalance += amount;
      saveBankAccount(destBank);
    }
  }
  
  // Save transfer record
  const transfers = getMoneyTransfers();
  transfers.push(transfer);
  setItem(TRANSFER_STORAGE_KEY, transfers);
  
  console.log(`[TRANSFER] ${transferNumber}: ${amount.toLocaleString('pt-AO')} Kz from ${sourceDescription} to ${destinationDescription}`);
  
  return { success: true, transfer };
}

// ==================== INITIALIZATION ====================

export function initializeBranchAccounting(branchId: string, branchName: string, branchCode: string): void {
  // Check if caixa exists for branch
  const existingCaixas = getCaixas(branchId);
  if (existingCaixas.length === 0) {
    createCaixa(branchId, branchName, 'Caixa Principal', 0, 50000, 200000);
  }
}
