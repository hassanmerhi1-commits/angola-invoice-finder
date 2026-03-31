// Purchase Orders API routes - Using Central Transaction Engine
const express = require('express');
const db = require('../db');
const { processPurchaseReceive } = require('../transactionEngine');

module.exports = function(broadcastTable) {
  const router = express.Router();

  router.get('/', async (req, res) => {
    try {
      const { branchId } = req.query;
      let query = 'SELECT * FROM purchase_orders';
      const params = [];
      
      if (branchId) {
        query += ' WHERE branch_id = $1';
        params.push(branchId);
      }
      
      query += ' ORDER BY created_at DESC';
      const result = await db.query(query, params);
      
      for (let order of result.rows) {
        const itemsResult = await db.query(
          'SELECT * FROM purchase_order_items WHERE order_id = $1',
          [order.id]
        );
        order.items = itemsResult.rows;
      }
      
      res.json(result.rows);
    } catch (error) {
      console.error('[PURCHASE ORDERS ERROR]', error);
      res.status(500).json({ error: 'Failed to fetch purchase orders' });
    }
  });

  router.post('/', async (req, res) => {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');
      
      const { supplierId, branchId, items, createdBy, createdByName, notes, expectedDeliveryDate } = req.body;
      
      const supplierResult = await client.query('SELECT name FROM suppliers WHERE id = $1', [supplierId]);
      const branchResult = await client.query('SELECT name FROM branches WHERE id = $1', [branchId]);
      
      const countResult = await client.query('SELECT COUNT(*) as count FROM purchase_orders');
      const count = parseInt(countResult.rows[0].count) + 1;
      const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
      const orderNumber = `PO${today}${count.toString().padStart(4, '0')}`;
      
      const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
      const taxAmount = items.reduce((sum, item) => sum + (item.subtotal * item.taxRate / 100), 0);
      const total = subtotal + taxAmount;
      
      const result = await client.query(
        `INSERT INTO purchase_orders (order_number, supplier_id, supplier_name, branch_id, branch_name, 
         subtotal, tax_amount, total, created_by, notes, expected_delivery_date, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'pending') RETURNING *`,
        [orderNumber, supplierId, supplierResult.rows[0]?.name, branchId, branchResult.rows[0]?.name,
         subtotal, taxAmount, total, createdBy, notes, expectedDeliveryDate]
      );
      
      const order = result.rows[0];
      
      for (const item of items) {
        await client.query(
          `INSERT INTO purchase_order_items (order_id, product_id, product_name, sku, quantity, unit_cost, tax_rate, subtotal)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [order.id, item.productId, item.productName, item.sku, item.quantity, item.unitCost, item.taxRate, item.subtotal]
        );
      }

      // Auto-submit for approval if workflow exists
      try {
        const workflowResult = await client.query(
          `SELECT * FROM approval_workflows 
           WHERE document_type = 'purchase_order' AND is_active = true AND min_amount <= $1
           AND (max_amount IS NULL OR max_amount >= $1)
           ORDER BY min_amount DESC LIMIT 1`,
          [total]
        );
        if (workflowResult.rows.length > 0) {
          const workflow = workflowResult.rows[0];
          const steps = typeof workflow.steps === 'string' ? JSON.parse(workflow.steps) : workflow.steps;
          await client.query(
            `INSERT INTO approval_requests 
             (workflow_id, document_type, document_id, document_number, amount, total_steps, 
              requested_by, requested_by_name, branch_id, notes)
             VALUES ($1, 'purchase_order', $2, $3, $4, $5, $6, $7, $8, $9)`,
            [workflow.id, order.id, orderNumber, total, steps.length,
             createdBy, createdByName || '', branchId, 'Auto-submetido na criação']
          );
          // Set PO to awaiting_approval
          await client.query(
            `UPDATE purchase_orders SET status = 'awaiting_approval' WHERE id = $1`,
            [order.id]
          );
          order.status = 'awaiting_approval';
        }
      } catch (e) {
        // approval_requests table may not exist — continue without approval
        console.warn('[PO] Approval submission skipped:', e.message);
      }
      
      await client.query('COMMIT');
      await broadcastTable('purchase_orders');
      res.status(201).json({ ...order, items });
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('[PURCHASE ORDERS ERROR]', error);
      res.status(500).json({ error: 'Failed to create purchase order' });
    } finally {
      client.release();
    }
  });

  router.post('/:id/approve', async (req, res) => {
    try {
      const { id } = req.params;
      const { approvedBy } = req.body;
      
      await db.query(
        'UPDATE purchase_orders SET status = $1, approved_by = $2, approved_at = CURRENT_TIMESTAMP WHERE id = $3',
        ['approved', approvedBy, id]
      );
      
      await broadcastTable('purchase_orders');
      res.json({ success: true });
    } catch (error) {
      console.error('[PURCHASE ORDERS ERROR]', error);
      res.status(500).json({ error: 'Failed to approve order' });
    }
  });

  // Receive — ALL logic handled by Transaction Engine
  router.post('/:id/receive', async (req, res) => {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');
      
      const { id } = req.params;
      const { receivedBy, receivedQuantities } = req.body;
      
      await processPurchaseReceive(client, id, receivedQuantities, receivedBy);
      
      await client.query('COMMIT');
      await broadcastTable('purchase_orders');
      await broadcastTable('products');
      res.json({ success: true });
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('[PURCHASE ORDERS ERROR]', error);
      res.status(500).json({ error: error.message || 'Failed to receive order' });
    } finally {
      client.release();
    }
  });

  return router;
};
