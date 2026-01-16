// Stock Transfers API routes
const express = require('express');
const db = require('../db');

module.exports = function(broadcastTable) {
  const router = express.Router();

  router.get('/', async (req, res) => {
    try {
      const { branchId } = req.query;
      let query = 'SELECT * FROM stock_transfers';
      const params = [];
      
      if (branchId) {
        query += ' WHERE from_branch_id = $1 OR to_branch_id = $1';
        params.push(branchId);
      }
      
      query += ' ORDER BY created_at DESC';
      const result = await db.query(query, params);
      
      // Get items for each transfer
      for (let transfer of result.rows) {
        const itemsResult = await db.query(
          'SELECT * FROM stock_transfer_items WHERE transfer_id = $1',
          [transfer.id]
        );
        transfer.items = itemsResult.rows;
      }
      
      res.json(result.rows);
    } catch (error) {
      console.error('[STOCK TRANSFERS ERROR]', error);
      res.status(500).json({ error: 'Failed to fetch stock transfers' });
    }
  });

  router.post('/', async (req, res) => {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');
      
      const { fromBranchId, toBranchId, items, requestedBy, notes } = req.body;
      
      // Get branch names
      const fromBranch = await client.query('SELECT name FROM branches WHERE id = $1', [fromBranchId]);
      const toBranch = await client.query('SELECT name FROM branches WHERE id = $1', [toBranchId]);
      
      // Generate transfer number
      const countResult = await client.query('SELECT COUNT(*) as count FROM stock_transfers');
      const count = parseInt(countResult.rows[0].count) + 1;
      const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
      const transferNumber = `TRF${today}${count.toString().padStart(4, '0')}`;
      
      const result = await client.query(
        `INSERT INTO stock_transfers (transfer_number, from_branch_id, from_branch_name, to_branch_id, to_branch_name, requested_by, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [transferNumber, fromBranchId, fromBranch.rows[0]?.name, toBranchId, toBranch.rows[0]?.name, requestedBy, notes]
      );
      
      const transfer = result.rows[0];
      
      for (const item of items) {
        await client.query(
          'INSERT INTO stock_transfer_items (transfer_id, product_id, product_name, sku, quantity) VALUES ($1, $2, $3, $4, $5)',
          [transfer.id, item.productId, item.productName, item.sku, item.quantity]
        );
      }
      
      await client.query('COMMIT');
      await broadcastTable('stock_transfers');
      res.status(201).json({ ...transfer, items });
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('[STOCK TRANSFERS ERROR]', error);
      res.status(500).json({ error: 'Failed to create stock transfer' });
    } finally {
      client.release();
    }
  });

  router.post('/:id/approve', async (req, res) => {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');
      
      const { id } = req.params;
      const { approvedBy } = req.body;
      
      // Get transfer with items
      const transferResult = await client.query('SELECT * FROM stock_transfers WHERE id = $1', [id]);
      const transfer = transferResult.rows[0];
      
      const itemsResult = await client.query('SELECT * FROM stock_transfer_items WHERE transfer_id = $1', [id]);
      
      // Deduct stock from source branch
      for (const item of itemsResult.rows) {
        await client.query(
          'UPDATE products SET stock = stock - $1 WHERE id = $2 AND branch_id = $3',
          [item.quantity, item.product_id, transfer.from_branch_id]
        );
      }
      
      await client.query(
        'UPDATE stock_transfers SET status = $1, approved_by = $2, approved_at = CURRENT_TIMESTAMP WHERE id = $3',
        ['in_transit', approvedBy, id]
      );
      
      await client.query('COMMIT');
      await broadcastTable('stock_transfers');
      await broadcastTable('products');
      res.json({ success: true });
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('[STOCK TRANSFERS ERROR]', error);
      res.status(500).json({ error: 'Failed to approve transfer' });
    } finally {
      client.release();
    }
  });

  router.post('/:id/receive', async (req, res) => {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');
      
      const { id } = req.params;
      const { receivedBy, receivedQuantities } = req.body;
      
      const transferResult = await client.query('SELECT * FROM stock_transfers WHERE id = $1', [id]);
      const transfer = transferResult.rows[0];
      
      const itemsResult = await client.query('SELECT * FROM stock_transfer_items WHERE transfer_id = $1', [id]);
      
      // Add stock to destination branch
      for (const item of itemsResult.rows) {
        const receivedQty = receivedQuantities?.[item.product_id] ?? item.quantity;
        
        // Update received quantity
        await client.query(
          'UPDATE stock_transfer_items SET received_quantity = $1 WHERE id = $2',
          [receivedQty, item.id]
        );
        
        // Add to destination branch stock
        await client.query(
          'UPDATE products SET stock = stock + $1 WHERE id = $2 AND branch_id = $3',
          [receivedQty, item.product_id, transfer.to_branch_id]
        );
      }
      
      await client.query(
        'UPDATE stock_transfers SET status = $1, received_by = $2, received_at = CURRENT_TIMESTAMP WHERE id = $3',
        ['received', receivedBy, id]
      );
      
      await client.query('COMMIT');
      await broadcastTable('stock_transfers');
      await broadcastTable('products');
      res.json({ success: true });
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('[STOCK TRANSFERS ERROR]', error);
      res.status(500).json({ error: 'Failed to receive transfer' });
    } finally {
      client.release();
    }
  });

  return router;
};
