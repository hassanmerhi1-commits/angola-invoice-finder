/**
 * Central Transaction Engine for Electron Main Process
 * All business operations flow through here for atomic DB updates.
 * Ported from backend/src/transactionEngine.js
 */

const { createJournalEntry } = require('./accounting.cjs');

function isUuid(value) {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

// ==================== AUDIT ====================
async function auditLog(client, params) {
  const { tableName, recordId, action, userId, userName, branchId, oldValues, newValues, description } = params;
  try {
    await client.query(
      `INSERT INTO audit_log (table_name, record_id, action, user_id, user_name, branch_id, old_values, new_values, description)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [tableName, recordId, action, userId, userName, branchId,
       oldValues ? JSON.stringify(oldValues) : null,
       newValues ? JSON.stringify(newValues) : null,
       description]
    );
  } catch (e) {
    console.warn('[AUDIT] Log skipped:', e.message);
  }
}

// ==================== STOCK MOVEMENTS ====================
async function recordStockMovement(client, params) {
  const {
    productId, warehouseId, movementType, quantity, unitCost,
    referenceType, referenceId, referenceNumber, notes, createdBy
  } = params;

  const result = await client.query(
    `INSERT INTO stock_movements 
     (product_id, warehouse_id, movement_type, quantity, unit_cost,
      reference_type, reference_id, reference_number, notes, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [productId, warehouseId, movementType, quantity, unitCost || 0,
     referenceType, referenceId, referenceNumber || '', notes || '', createdBy]
  );

  const stockChange = movementType === 'IN' ? quantity : -quantity;
  await client.query(
    'UPDATE products SET stock = stock + $1 WHERE id = $2',
    [stockChange, productId]
  );

  return result.rows[0];
}

// ==================== OPEN ITEMS ====================
async function createOpenItem(client, params) {
  const {
    entityType, entityId, documentType, documentId, documentNumber,
    documentDate, dueDate, originalAmount, isDebit, branchId, currency
  } = params;

  const result = await client.query(
    `INSERT INTO open_items 
     (entity_type, entity_id, document_type, document_id, document_number,
      document_date, due_date, currency, original_amount, remaining_amount, is_debit, branch_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9, $10, $11)
     RETURNING *`,
    [entityType, entityId, documentType, documentId, documentNumber,
     documentDate, dueDate, currency || 'AOA', originalAmount, isDebit, branchId]
  );

  return result.rows[0];
}

async function clearOpenItems(client, params) {
  const { paymentItemId, invoiceItemIds, amounts, clearedBy } = params;
  const clearings = [];

  for (let i = 0; i < invoiceItemIds.length; i++) {
    const invoiceItemId = invoiceItemIds[i];
    const amount = amounts[i];

    const clearingResult = await client.query(
      `INSERT INTO clearings (debit_item_id, credit_item_id, amount, created_by)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [invoiceItemId, paymentItemId, amount, clearedBy]
    );
    clearings.push(clearingResult.rows[0]);

    await client.query(
      `UPDATE open_items SET 
       remaining_amount = remaining_amount - $1,
       status = CASE WHEN remaining_amount - $1 <= 0.01 THEN 'cleared' ELSE 'partial' END,
       cleared_at = CASE WHEN remaining_amount - $1 <= 0.01 THEN CURRENT_TIMESTAMP ELSE NULL END
       WHERE id = $2`,
      [amount, invoiceItemId]
    );

    await client.query(
      `UPDATE open_items SET 
       remaining_amount = remaining_amount - $1,
       status = CASE WHEN remaining_amount - $1 <= 0.01 THEN 'cleared' ELSE 'partial' END,
       cleared_at = CASE WHEN remaining_amount - $1 <= 0.01 THEN CURRENT_TIMESTAMP ELSE NULL END
       WHERE id = $2`,
      [amount, paymentItemId]
    );
  }

  return clearings;
}

// ==================== DOCUMENT LINKS ====================
async function linkDocuments(client, sourceType, sourceId, sourceNumber, targetType, targetId, targetNumber) {
  await client.query(
    `INSERT INTO document_links (source_type, source_id, source_number, target_type, target_id, target_number)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [sourceType, sourceId, sourceNumber, targetType, targetId, targetNumber]
  );
}

// ==================== PERIOD VALIDATION ====================
async function validatePeriod(client, date) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = d.getMonth() + 1;

  const result = await client.query(
    `SELECT status FROM accounting_periods WHERE year = $1 AND month = $2`,
    [year, month]
  );

  if (result.rows.length > 0 && result.rows[0].status !== 'open') {
    throw new Error(`Período contabilístico ${month}/${year} está ${result.rows[0].status}. Não é possível lançar.`);
  }
  return true;
}

async function getCashAccountCode(client, branchId, paymentMethod) {
  if (paymentMethod !== 'cash') {
    return '4.2.1';
  }

  const branchCaixaResult = await client.query(
    `SELECT code FROM chart_of_accounts
     WHERE code LIKE '4.1.%' AND level = 3 AND is_header = false
       AND branch_id = $1 AND is_active = true
     ORDER BY code
     LIMIT 1`,
    [branchId]
  );

  if (branchCaixaResult.rows.length > 0) {
    return branchCaixaResult.rows[0].code;
  }

  return '4.1.1';
}

// ==================== PROCESS SALE ====================
async function processSale(client, pool, saleData) {
  const {
    invoiceNumber, branchId, cashierId, cashierName, items,
    subtotal, taxAmount, discount, total,
    paymentMethod, amountPaid, change,
    customerNif, customerName, clientId
  } = saleData;

  const today = new Date().toISOString().split('T')[0];
  await validatePeriod(client, today);

  const saleResult = await client.query(
    `INSERT INTO sales (
      invoice_number, branch_id, cashier_id, cashier_name,
      subtotal, tax_amount, discount, total,
      payment_method, amount_paid, change,
      customer_nif, customer_name, status
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'completed')
    RETURNING *`,
    [invoiceNumber, branchId, cashierId, cashierName, subtotal, taxAmount,
     discount || 0, total, paymentMethod, amountPaid, change, customerNif, customerName]
  );
  const sale = saleResult.rows[0];

  let totalCOGS = 0;
  for (const item of items) {
    const normalizedProductId = isUuid(item.productId) ? item.productId : null;

    await client.query(
      `INSERT INTO sale_items (
        sale_id, product_id, product_name, sku, quantity,
        unit_price, discount, tax_rate, tax_amount, subtotal
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [sale.id, normalizedProductId, item.productName, item.sku, item.quantity,
       item.unitPrice, item.discount || 0, item.taxRate, item.taxAmount, item.subtotal]
    );

    if (normalizedProductId) {
      await recordStockMovement(client, {
        productId: normalizedProductId, warehouseId: branchId,
        movementType: 'OUT', quantity: item.quantity,
        unitCost: item.costAtSale || 0,
        referenceType: 'sale', referenceId: sale.id,
        referenceNumber: invoiceNumber, createdBy: cashierId,
      });

      const productResult = await client.query('SELECT cost FROM products WHERE id = $1', [normalizedProductId]);
      if (productResult.rows.length > 0) {
        totalCOGS += parseFloat(productResult.rows[0].cost) * item.quantity;
      }
    }
  }

  const cashAccountCode = await getCashAccountCode(client, branchId, paymentMethod);
  const revenueLines = [
    { accountCode: cashAccountCode, description: `Venda ${invoiceNumber}`, debit: parseFloat(total), credit: 0 },
    { accountCode: '7.1.1', description: `Receita ${invoiceNumber}`, debit: 0, credit: parseFloat(subtotal) },
  ];
  if (parseFloat(taxAmount) > 0) {
    revenueLines.push({ accountCode: '3.3.1', description: `IVA ${invoiceNumber}`, debit: 0, credit: parseFloat(taxAmount) });
  }

  await createJournalEntry(client, pool, {
    description: `Venda ${invoiceNumber}`, referenceType: 'sale',
    referenceId: sale.id, branchId, createdBy: cashierId, lines: revenueLines,
  });

  if (totalCOGS > 0) {
    await createJournalEntry(client, pool, {
      description: `CMV - ${invoiceNumber}`, referenceType: 'sale',
      referenceId: sale.id, branchId, createdBy: cashierId,
      lines: [
        { accountCode: '6.1', description: 'Custo Mercadorias Vendidas', debit: totalCOGS, credit: 0 },
        { accountCode: '2.2', description: 'Saída Mercadorias', debit: 0, credit: totalCOGS },
      ],
    });
  }

  if (clientId && paymentMethod !== 'cash') {
    await createOpenItem(client, {
      entityType: 'customer', entityId: clientId,
      documentType: 'invoice', documentId: sale.id,
      documentNumber: invoiceNumber, documentDate: today, dueDate: today,
      originalAmount: parseFloat(total), isDebit: true, branchId,
    });
  }

  const saleDate = new Date(today);
  try {
    await client.query(
      `INSERT INTO tax_summaries (document_type, document_id, tax_code, tax_rate, total_base, total_tax, direction, period_year, period_month)
       VALUES ('sale', $1, 'IVA14', 14.00, $2, $3, 'output', $4, $5)`,
      [sale.id, parseFloat(subtotal), parseFloat(taxAmount), saleDate.getFullYear(), saleDate.getMonth() + 1]
    );
  } catch (e) {
    console.warn('[TX ENGINE] Tax summary skipped:', e.message);
  }

  await auditLog(client, {
    tableName: 'sales', recordId: sale.id, action: 'create',
    userId: cashierId, userName: cashierName, branchId,
    newValues: { invoiceNumber, total, paymentMethod, items: items.length },
    description: `Venda ${invoiceNumber} - ${parseFloat(total).toLocaleString()} AOA`,
  });

  console.log(`[TX ENGINE] Sale ${invoiceNumber}: Stock OUT, Journal, Tax, Audit ✓`);
  return sale;
}

// ==================== PROCESS PURCHASE RECEIVE ====================
async function processPurchaseReceive(client, pool, orderId, receivedQuantities, receivedBy) {
  const today = new Date().toISOString().split('T')[0];
  await validatePeriod(client, today);

  const orderResult = await client.query('SELECT * FROM purchase_orders WHERE id = $1', [orderId]);
  const order = orderResult.rows[0];
  if (!order) throw new Error(`Purchase order ${orderId} not found`);

  const itemsResult = await client.query('SELECT * FROM purchase_order_items WHERE order_id = $1', [orderId]);

  const orderItemsTotal = itemsResult.rows.reduce((sum, item) => sum + (item.quantity * parseFloat(item.unit_cost)), 0);
  const freightCost = parseFloat(order.freight_cost) || 0;
  const otherCosts = parseFloat(order.other_costs) || 0;
  const totalLandingCosts = freightCost + otherCosts;

  for (const item of itemsResult.rows) {
    const receivedQty = receivedQuantities[item.product_id] ?? item.quantity;
    await client.query('UPDATE purchase_order_items SET received_quantity = $1 WHERE id = $2', [receivedQty, item.id]);

    if (receivedQty > 0) {
      let freightPerUnit = 0;
      if (orderItemsTotal > 0 && totalLandingCosts > 0) {
        const itemValue = item.quantity * parseFloat(item.unit_cost);
        freightPerUnit = (totalLandingCosts * (itemValue / orderItemsTotal)) / item.quantity;
      }
      const effectiveCost = parseFloat(item.unit_cost) + freightPerUnit;

      const productResult = await client.query(
        'SELECT id, stock, cost FROM products WHERE id = $1 AND branch_id = $2',
        [item.product_id, order.branch_id]
      );

      if (productResult.rows.length > 0) {
        const product = productResult.rows[0];
        const currentStock = parseInt(product.stock) || 0;
        const currentCost = parseFloat(product.cost) || 0;
        const newTotalStock = currentStock + receivedQty;
        const newAverageCost = newTotalStock > 0
          ? ((currentStock * currentCost) + (receivedQty * effectiveCost)) / newTotalStock
          : effectiveCost;

        await client.query(
          'UPDATE products SET cost = $1 WHERE id = $2 AND branch_id = $3',
          [newAverageCost.toFixed(2), item.product_id, order.branch_id]
        );
      }

      await recordStockMovement(client, {
        productId: item.product_id, warehouseId: order.branch_id,
        movementType: 'IN', quantity: receivedQty, unitCost: effectiveCost,
        referenceType: 'purchase', referenceId: orderId,
        referenceNumber: order.order_number, createdBy: receivedBy,
      });
    }
  }

  await client.query(
    `UPDATE purchase_orders SET status = 'received', received_by = $1, received_at = CURRENT_TIMESTAMP, 
     freight_distributed = true WHERE id = $2`,
    [receivedBy, orderId]
  );

  const subtotal = parseFloat(order.subtotal || 0);
  const taxAmount = parseFloat(order.tax_amount || 0);
  const journalLines = [
    { accountCode: '2.1.1', description: `Compra ${order.order_number}`, debit: subtotal + freightCost, credit: 0 },
  ];
  if (taxAmount > 0) {
    journalLines.push({ accountCode: '3.3.1', description: `IVA compra ${order.order_number}`, debit: taxAmount, credit: 0 });
  }
  journalLines.push({ accountCode: '3.2.1', description: `Fornecedor ${order.supplier_name}`, debit: 0, credit: subtotal + freightCost + taxAmount });

  await createJournalEntry(client, pool, {
    description: `Compra ${order.order_number} - ${order.supplier_name}`,
    referenceType: 'purchase', referenceId: orderId,
    branchId: order.branch_id, createdBy: receivedBy, lines: journalLines,
  });

  if (order.supplier_id) {
    await createOpenItem(client, {
      entityType: 'supplier', entityId: order.supplier_id,
      documentType: 'invoice', documentId: orderId,
      documentNumber: order.order_number, documentDate: today, dueDate: null,
      originalAmount: subtotal + freightCost + taxAmount, isDebit: true, branchId: order.branch_id,
    });
  }

  await auditLog(client, {
    tableName: 'purchase_orders', recordId: orderId, action: 'create',
    userId: receivedBy, branchId: order.branch_id,
    newValues: { orderNumber: order.order_number, total: subtotal + freightCost + taxAmount },
    description: `Recepção ${order.order_number} - ${order.supplier_name}`,
  });

  console.log(`[TX ENGINE] Purchase ${order.order_number}: Stock IN, Journal, Open Item, Audit ✓`);
  return order;
}

// ==================== PROCESS TRANSFER ====================
async function processTransferApprove(client, pool, transferId, approvedBy) {
  const transferResult = await client.query('SELECT * FROM stock_transfers WHERE id = $1', [transferId]);
  const transfer = transferResult.rows[0];
  const itemsResult = await client.query('SELECT * FROM stock_transfer_items WHERE transfer_id = $1', [transferId]);

  for (const item of itemsResult.rows) {
    await recordStockMovement(client, {
      productId: item.product_id, warehouseId: transfer.from_branch_id,
      movementType: 'OUT', quantity: item.quantity, unitCost: 0,
      referenceType: 'transfer', referenceId: transferId,
      referenceNumber: transfer.transfer_number,
      notes: `Para ${transfer.to_branch_name}`, createdBy: approvedBy,
    });
  }

  await client.query(
    `UPDATE stock_transfers SET status = 'in_transit', approved_by = $1, approved_at = CURRENT_TIMESTAMP WHERE id = $2`,
    [approvedBy, transferId]
  );

  console.log(`[TX ENGINE] Transfer ${transfer.transfer_number}: Approved, Stock OUT ✓`);
  return transfer;
}

async function processTransferReceive(client, pool, transferId, receivedQuantities, receivedBy) {
  const today = new Date().toISOString().split('T')[0];
  await validatePeriod(client, today);

  const transferResult = await client.query('SELECT * FROM stock_transfers WHERE id = $1', [transferId]);
  const transfer = transferResult.rows[0];
  const itemsResult = await client.query('SELECT * FROM stock_transfer_items WHERE transfer_id = $1', [transferId]);

  let totalTransferValue = 0;
  for (const item of itemsResult.rows) {
    const receivedQty = receivedQuantities?.[item.product_id] ?? item.quantity;
    await client.query('UPDATE stock_transfer_items SET received_quantity = $1 WHERE id = $2', [receivedQty, item.id]);

    if (receivedQty > 0) {
      const productResult = await client.query('SELECT cost FROM products WHERE id = $1', [item.product_id]);
      const unitCost = productResult.rows.length > 0 ? parseFloat(productResult.rows[0].cost) : 0;
      totalTransferValue += unitCost * receivedQty;

      await recordStockMovement(client, {
        productId: item.product_id, warehouseId: transfer.to_branch_id,
        movementType: 'IN', quantity: receivedQty, unitCost,
        referenceType: 'transfer', referenceId: transferId,
        referenceNumber: transfer.transfer_number,
        notes: `De ${transfer.from_branch_name}`, createdBy: receivedBy,
      });
    }
  }

  await client.query(
    `UPDATE stock_transfers SET status = 'received', received_by = $1, received_at = CURRENT_TIMESTAMP WHERE id = $2`,
    [receivedBy, transferId]
  );

  if (totalTransferValue > 0) {
    await createJournalEntry(client, pool, {
      description: `Transferência ${transfer.transfer_number}`,
      referenceType: 'transfer', referenceId: transferId,
      branchId: transfer.from_branch_id, createdBy: receivedBy,
      lines: [
        { accountCode: '2.2', description: `Entrada ${transfer.to_branch_name}`, debit: totalTransferValue, credit: 0 },
        { accountCode: '2.2', description: `Saída ${transfer.from_branch_name}`, debit: 0, credit: totalTransferValue },
      ],
    });
  }

  console.log(`[TX ENGINE] Transfer ${transfer.transfer_number}: Stock moved, Journal ✓`);
  return transfer;
}

// ==================== PROCESS PAYMENT ====================
async function processPayment(client, pool, paymentData) {
  const {
    paymentType, entityType, entityId, entityName,
    paymentMethod, amount, branchId, createdBy,
    bankAccount, reference, notes, invoiceIds
  } = paymentData;

  const today = new Date().toISOString().split('T')[0];
  await validatePeriod(client, today);

  const prefix = paymentType === 'receipt' ? 'REC' : 'PAG';
  const dateStr = today.replace(/-/g, '');
  const countResult = await client.query(
    `SELECT COUNT(*) as count FROM payments WHERE payment_number LIKE $1`,
    [`${prefix}${dateStr}%`]
  );
  const seq = (parseInt(countResult.rows[0].count) + 1).toString().padStart(4, '0');
  const paymentNumber = `${prefix}${dateStr}${seq}`;

  const paymentResult = await client.query(
    `INSERT INTO payments (payment_number, payment_type, entity_type, entity_id, entity_name,
     payment_method, amount, bank_account, reference, notes, branch_id, created_by, posted_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, CURRENT_TIMESTAMP)
     RETURNING *`,
    [paymentNumber, paymentType, entityType, entityId, entityName,
     paymentMethod, amount, bankAccount || '', reference || '', notes || '', branchId, createdBy]
  );
  const payment = paymentResult.rows[0];

  const paymentOpenItem = await createOpenItem(client, {
    entityType, entityId, documentType: 'payment',
    documentId: payment.id, documentNumber: paymentNumber,
    documentDate: today, originalAmount: amount,
    isDebit: false, branchId,
  });

  if (invoiceIds && invoiceIds.length > 0) {
    const openInvoices = await client.query(
      `SELECT * FROM open_items WHERE document_id = ANY($1) AND status != 'cleared' ORDER BY document_date ASC`,
      [invoiceIds]
    );

    let remainingPayment = amount;
    const clearInvoiceIds = [];
    const clearAmounts = [];

    for (const inv of openInvoices.rows) {
      if (remainingPayment <= 0) break;
      const clearAmount = Math.min(remainingPayment, parseFloat(inv.remaining_amount));
      clearInvoiceIds.push(inv.id);
      clearAmounts.push(clearAmount);
      remainingPayment -= clearAmount;
    }

    if (clearInvoiceIds.length > 0) {
      await clearOpenItems(client, {
        paymentItemId: paymentOpenItem.id,
        invoiceItemIds: clearInvoiceIds,
        amounts: clearAmounts, clearedBy: createdBy,
      });
    }
  }

  const cashAccountCode = paymentMethod === 'cash' ? '4.1.1' : '4.2.1';
  const entityAccountCode = entityType === 'customer' ? '3.1.1' : '3.2.1';

  const lines = paymentType === 'receipt'
    ? [
        { accountCode: cashAccountCode, description: `Recebimento ${paymentNumber}`, debit: amount, credit: 0 },
        { accountCode: entityAccountCode, description: `${entityName}`, debit: 0, credit: amount },
      ]
    : [
        { accountCode: entityAccountCode, description: `${entityName}`, debit: amount, credit: 0 },
        { accountCode: cashAccountCode, description: `Pagamento ${paymentNumber}`, debit: 0, credit: amount },
      ];

  await createJournalEntry(client, pool, {
    description: `${paymentType === 'receipt' ? 'Recebimento' : 'Pagamento'} ${paymentNumber} - ${entityName}`,
    referenceType: paymentType, referenceId: payment.id,
    branchId, createdBy, lines,
  });

  await auditLog(client, {
    tableName: 'payments', recordId: payment.id, action: 'create',
    userId: createdBy, branchId,
    newValues: { paymentNumber, paymentType, entityName, amount, paymentMethod },
    description: `${paymentType === 'receipt' ? 'Recebimento' : 'Pagamento'} ${paymentNumber} - ${entityName} - ${amount} AOA`,
  });

  console.log(`[TX ENGINE] Payment ${paymentNumber}: ${amount} AOA ✓`);
  return payment;
}

async function processTransaction(client, pool, txData) {
  const {
    transactionType, documentId, documentNumber, branchId,
    userId, date, description, currency,
    stockEntries, journalLines, openItem, documentLinks,
    priceUpdates, entityBalanceUpdate,
  } = txData;

  const result = {
    success: false,
    stockMovementIds: [],
    journalEntryId: null,
    openItemId: null,
    documentLinkIds: [],
    errors: [],
  };

  await validatePeriod(client, date || new Date().toISOString());

  if (stockEntries && stockEntries.length > 0) {
    for (const entry of stockEntries) {
      const movement = await recordStockMovement(client, {
        productId: entry.productId,
        warehouseId: entry.warehouseId,
        movementType: entry.direction,
        quantity: entry.quantity,
        unitCost: entry.unitCost || 0,
        referenceType: transactionType,
        referenceId: documentId,
        referenceNumber: documentNumber,
        createdBy: userId,
      });
      result.stockMovementIds.push(movement.id);
    }
  }

  if (priceUpdates && priceUpdates.length > 0) {
    for (const pu of priceUpdates) {
      const prodResult = await client.query('SELECT stock, cost FROM products WHERE id = $1', [pu.productId]);
      if (prodResult.rows.length > 0) {
        const p = prodResult.rows[0];
        const currentStock = parseInt(p.stock) || 0;
        const currentCost = parseFloat(p.cost) || 0;
        const prevTotal = currentStock * currentCost;
        const newTotal = pu.quantityReceived * pu.newUnitCost;
        const totalStock = currentStock + pu.quantityReceived;
        const newAvg = totalStock > 0 ? (prevTotal + newTotal) / totalStock : pu.newUnitCost;

        await client.query('UPDATE products SET cost = $1 WHERE id = $2', [newAvg.toFixed(2), pu.productId]);
      }
    }
  }

  if (journalLines && journalLines.length > 0) {
    const entry = await createJournalEntry(client, pool, {
      description,
      referenceType: transactionType,
      referenceId: documentId,
      branchId,
      createdBy: userId,
      lines: journalLines.map((line) => ({
        accountCode: line.accountCode,
        description: line.note || description,
        debit: line.debit || 0,
        credit: line.credit || 0,
      })),
    });
    result.journalEntryId = entry.id;
  }

  if (openItem) {
    const oi = await createOpenItem(client, {
      entityType: openItem.entityType,
      entityId: openItem.entityId,
      documentType: openItem.documentType,
      documentId,
      documentNumber,
      documentDate: date || new Date().toISOString().split('T')[0],
      dueDate: openItem.dueDate || null,
      originalAmount: openItem.originalAmount,
      isDebit: openItem.isDebit,
      branchId,
      currency: openItem.currency || currency || 'AOA',
    });
    result.openItemId = oi.id;
  }

  if (documentLinks && documentLinks.length > 0) {
    for (const dl of documentLinks) {
      await linkDocuments(client, dl.sourceType, dl.sourceId, dl.sourceNumber, dl.targetType, dl.targetId, dl.targetNumber);
      result.documentLinkIds.push(`dl_${Date.now()}`);
    }
  }

  if (entityBalanceUpdate) {
    if (entityBalanceUpdate.entityType === 'supplier') {
      await client.query('UPDATE suppliers SET balance = COALESCE(balance, 0) + $1 WHERE id = $2', [entityBalanceUpdate.amount, entityBalanceUpdate.entityId]);
    } else if (entityBalanceUpdate.entityType === 'customer') {
      await client.query('UPDATE clients SET current_balance = COALESCE(current_balance, 0) + $1 WHERE id = $2', [entityBalanceUpdate.amount, entityBalanceUpdate.entityId]);
    }
  }

  result.success = true;
  console.log(`[TX ENGINE] ${transactionType} ${documentNumber}: ${result.stockMovementIds.length} stock, journal=${!!result.journalEntryId}, openItem=${!!result.openItemId} ✓`);
  return result;
}

module.exports = {
  recordStockMovement,
  createOpenItem,
  clearOpenItems,
  linkDocuments,
  validatePeriod,
  processTransaction,
  processSale,
  processPurchaseReceive,
  processTransferReceive,
  processTransferApprove,
  processPayment,
};
