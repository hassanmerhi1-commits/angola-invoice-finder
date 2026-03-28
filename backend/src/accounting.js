// Automatic Journal Entry Generator
// Creates double-entry accounting records for all business transactions
const db = require('./db');

/**
 * Generate a unique journal entry number
 */
async function generateEntryNumber(prefix = 'JE') {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const result = await db.query(
    `SELECT COUNT(*) as count FROM journal_entries WHERE entry_number LIKE $1`,
    [`${prefix}${today}%`]
  );
  const count = parseInt(result.rows[0].count) + 1;
  return `${prefix}${today}${count.toString().padStart(4, '0')}`;
}

/**
 * Find account by code (e.g., '4.1.1' for Caixa Principal)
 */
async function findAccountByCode(client, code) {
  const result = await client.query(
    'SELECT id, code, name FROM chart_of_accounts WHERE code = $1 AND is_active = true',
    [code]
  );
  return result.rows[0] || null;
}

/**
 * Create a journal entry with lines (within an existing transaction)
 * @param {object} client - PostgreSQL client (from pool.connect())
 * @param {object} params - Journal entry parameters
 * @param {string} params.description - Description of the entry
 * @param {string} params.referenceType - Type: 'sale', 'purchase', 'transfer', 'expense'
 * @param {string} params.referenceId - ID of the related document
 * @param {string} params.branchId - Branch ID
 * @param {string} params.createdBy - User ID who created
 * @param {Array} params.lines - Array of { accountCode, description, debit, credit }
 * @param {string} [params.entryDate] - Entry date (defaults to today)
 */
async function createJournalEntry(client, params) {
  const {
    description, referenceType, referenceId, branchId,
    createdBy, lines, entryDate
  } = params;

  // Generate entry number based on reference type
  const prefixMap = {
    sale: 'VD',      // Venda
    purchase: 'CP',   // Compra
    transfer: 'TRF',  // Transferência
    expense: 'DSP',   // Despesa
    adjustment: 'AJ', // Ajuste
  };
  const prefix = prefixMap[referenceType] || 'JE';
  const entryNumber = await generateEntryNumber(prefix);

  const totalDebit = lines.reduce((sum, l) => sum + (l.debit || 0), 0);
  const totalCredit = lines.reduce((sum, l) => sum + (l.credit || 0), 0);

  // Validate balanced entry
  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    throw new Error(`Journal entry not balanced: Debit=${totalDebit}, Credit=${totalCredit}`);
  }

  // Insert journal entry header
  const entryResult = await client.query(
    `INSERT INTO journal_entries 
     (entry_number, entry_date, description, reference_type, reference_id, 
      total_debit, total_credit, is_posted, posted_at, branch_id, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, true, CURRENT_TIMESTAMP, $8, $9)
     RETURNING *`,
    [entryNumber, entryDate || new Date().toISOString().split('T')[0],
     description, referenceType, referenceId,
     totalDebit, totalCredit, branchId, createdBy]
  );

  const entry = entryResult.rows[0];

  // Insert journal entry lines
  for (const line of lines) {
    // Resolve account by code
    const account = await findAccountByCode(client, line.accountCode);
    if (!account) {
      console.warn(`[ACCOUNTING] Account not found for code: ${line.accountCode}, skipping line`);
      continue;
    }

    await client.query(
      `INSERT INTO journal_entry_lines 
       (journal_entry_id, account_id, description, debit_amount, credit_amount)
       VALUES ($1, $2, $3, $4, $5)`,
      [entry.id, account.id, line.description || description, 
       line.debit || 0, line.credit || 0]
    );

    // Update account current_balance
    const balanceChange = (line.debit || 0) - (line.credit || 0);
    // For debit-nature accounts: debit increases, credit decreases
    // For credit-nature accounts: credit increases, debit decreases
    await client.query(
      `UPDATE chart_of_accounts SET 
       current_balance = current_balance + $1,
       updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [balanceChange, account.id]
    );
  }

  console.log(`[ACCOUNTING] Created journal entry ${entryNumber} (${referenceType}): Debit=${totalDebit}, Credit=${totalCredit}`);
  return entry;
}

/**
 * SALE: Debit Cash/Bank, Credit Revenue + IVA
 * Cash sale: Debit 4.1.1 (Caixa), Credit 7.1.1 (Vendas) + Credit 3.3.1 (IVA)
 * Also: Debit 6.1 (CMV), Credit 2.2 (Mercadorias) for cost of goods sold
 */
async function recordSaleJournal(client, sale, branchId, userId) {
  const lines = [];

  // Revenue side
  const cashAccountCode = sale.paymentMethod === 'card' ? '4.2.1' : 
                           sale.paymentMethod === 'transfer' ? '4.2.1' : '4.1.1';

  // Debit: Cash/Bank for total amount received
  lines.push({
    accountCode: cashAccountCode,
    description: `Venda ${sale.invoice_number || sale.invoiceNumber}`,
    debit: parseFloat(sale.total),
    credit: 0
  });

  // Credit: Revenue (net of IVA)
  lines.push({
    accountCode: '7.1.1',
    description: `Receita venda ${sale.invoice_number || sale.invoiceNumber}`,
    debit: 0,
    credit: parseFloat(sale.subtotal || sale.total - (sale.tax_amount || sale.taxAmount || 0))
  });

  // Credit: IVA collected (if any tax)
  const taxAmount = parseFloat(sale.tax_amount || sale.taxAmount || 0);
  if (taxAmount > 0) {
    lines.push({
      accountCode: '3.3.1',
      description: `IVA venda ${sale.invoice_number || sale.invoiceNumber}`,
      debit: 0,
      credit: taxAmount
    });
  }

  await createJournalEntry(client, {
    description: `Venda ${sale.invoice_number || sale.invoiceNumber}`,
    referenceType: 'sale',
    referenceId: sale.id,
    branchId,
    createdBy: userId,
    lines
  });

  // Cost of Goods Sold entry (if we have cost data)
  if (sale.items && sale.items.length > 0) {
    let totalCost = 0;
    for (const item of sale.items) {
      // Get product cost
      const productResult = await client.query(
        'SELECT cost FROM products WHERE id = $1',
        [item.product_id || item.productId]
      );
      if (productResult.rows.length > 0) {
        totalCost += parseFloat(productResult.rows[0].cost) * (item.quantity || 0);
      }
    }

    if (totalCost > 0) {
      await createJournalEntry(client, {
        description: `CMV - Venda ${sale.invoice_number || sale.invoiceNumber}`,
        referenceType: 'sale',
        referenceId: sale.id,
        branchId,
        createdBy: userId,
        lines: [
          { accountCode: '6.1', description: 'Custo das Mercadorias Vendidas', debit: totalCost, credit: 0 },
          { accountCode: '2.2', description: 'Saída de Mercadorias', debit: 0, credit: totalCost }
        ]
      });
    }
  }
}

/**
 * PURCHASE RECEIVE: Debit Inventory, Credit Supplier Payable
 * Debit 2.1.1 (Compra Mercadorias) + Debit 3.3.1 (IVA dedutível), Credit 3.2.1 (Fornecedores)
 */
async function recordPurchaseJournal(client, order, branchId, userId) {
  const subtotal = parseFloat(order.subtotal || 0);
  const taxAmount = parseFloat(order.tax_amount || 0);
  const total = parseFloat(order.total || 0);
  const freight = parseFloat(order.freight_cost || 0);

  const lines = [];

  // Debit: Inventory (purchases)
  lines.push({
    accountCode: '2.1.1',
    description: `Compra ${order.order_number} - ${order.supplier_name}`,
    debit: subtotal + freight,
    credit: 0
  });

  // Debit: IVA on purchase (recoverable)
  if (taxAmount > 0) {
    lines.push({
      accountCode: '3.3.1',
      description: `IVA compra ${order.order_number}`,
      debit: taxAmount,
      credit: 0
    });
  }

  // Credit: Supplier payable
  lines.push({
    accountCode: '3.2.1',
    description: `Fornecedor ${order.supplier_name} - ${order.order_number}`,
    debit: 0,
    credit: subtotal + freight + taxAmount
  });

  await createJournalEntry(client, {
    description: `Compra ${order.order_number} - ${order.supplier_name}`,
    referenceType: 'purchase',
    referenceId: order.id,
    branchId,
    createdBy: userId,
    lines
  });
}

/**
 * STOCK TRANSFER: Internal movement between branches
 * Debit 2.2 (destination branch), Credit 2.2 (source branch)
 * This is an internal journal - no P&L impact
 */
async function recordTransferJournal(client, transfer, totalValue, userId) {
  if (totalValue <= 0) return;

  await createJournalEntry(client, {
    description: `Transferência ${transfer.transfer_number} - ${transfer.from_branch_name} → ${transfer.to_branch_name}`,
    referenceType: 'transfer',
    referenceId: transfer.id,
    branchId: transfer.from_branch_id,
    createdBy: userId,
    lines: [
      { 
        accountCode: '2.2', 
        description: `Entrada mercadorias - ${transfer.to_branch_name}`, 
        debit: totalValue, 
        credit: 0 
      },
      { 
        accountCode: '2.2', 
        description: `Saída mercadorias - ${transfer.from_branch_name}`, 
        debit: 0, 
        credit: totalValue 
      }
    ]
  });
}

module.exports = {
  createJournalEntry,
  recordSaleJournal,
  recordPurchaseJournal,
  recordTransferJournal,
  findAccountByCode
};
