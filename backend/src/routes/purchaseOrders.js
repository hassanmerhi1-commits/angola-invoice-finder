// Purchase Orders API routes
const express = require('express');
const db = require('../db');

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
      
      const { supplierId, branchId, items, createdBy, notes, expectedDeliveryDate } = req.body;
      
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

  router.post('/:id/receive', async (req, res) => {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');
      
      const { id } = req.params;
      const { receivedBy, receivedQuantities } = req.body;
      
      const orderResult = await client.query('SELECT * FROM purchase_orders WHERE id = $1', [id]);
      const order = orderResult.rows[0];
      
      const itemsResult = await client.query('SELECT * FROM purchase_order_items WHERE order_id = $1', [id]);
      
      for (const item of itemsResult.rows) {
        const receivedQty = receivedQuantities[item.product_id] ?? item.quantity;
        
        await client.query(
          'UPDATE purchase_order_items SET received_quantity = $1 WHERE id = $2',
          [receivedQty, item.id]
        );
        
        await client.query(
          'UPDATE products SET stock = stock + $1 WHERE id = $2 AND branch_id = $3',
          [receivedQty, item.product_id, order.branch_id]
        );
      }
      
      await client.query(
        'UPDATE purchase_orders SET status = $1, received_by = $2, received_at = CURRENT_TIMESTAMP WHERE id = $3',
        ['received', receivedBy, id]
      );
      
      await client.query('COMMIT');
      await broadcastTable('purchase_orders');
      await broadcastTable('products');
      res.json({ success: true });
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('[PURCHASE ORDERS ERROR]', error);
      res.status(500).json({ error: 'Failed to receive order' });
    } finally {
      client.release();
    }
  });

  return router;
};
