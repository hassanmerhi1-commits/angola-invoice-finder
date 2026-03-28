// Purchase Orders API routes
const express = require('express');
const db = require('../db');
const { recordPurchaseJournal } = require('../accounting');

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
      
      // Get order with freight costs
      const orderResult = await client.query('SELECT * FROM purchase_orders WHERE id = $1', [id]);
      const order = orderResult.rows[0];
      
      const itemsResult = await client.query('SELECT * FROM purchase_order_items WHERE order_id = $1', [id]);
      
      // Calculate total order value for freight allocation
      const orderItemsTotal = itemsResult.rows.reduce((sum, item) => sum + (item.quantity * parseFloat(item.unit_cost)), 0);
      const freightCost = parseFloat(order.freight_cost) || 0;
      const otherCosts = parseFloat(order.other_costs) || 0;
      const totalLandingCosts = freightCost + otherCosts;
      
      for (const item of itemsResult.rows) {
        const receivedQty = receivedQuantities[item.product_id] ?? item.quantity;
        
        // Update received quantity
        await client.query(
          'UPDATE purchase_order_items SET received_quantity = $1 WHERE id = $2',
          [receivedQty, item.id]
        );
        
        if (receivedQty > 0) {
          // Calculate freight allocation for this item (proportional to value)
          let freightPerUnit = 0;
          if (orderItemsTotal > 0 && totalLandingCosts > 0) {
            const itemValue = item.quantity * parseFloat(item.unit_cost);
            const proportion = itemValue / orderItemsTotal;
            freightPerUnit = (totalLandingCosts * proportion) / item.quantity;
          }
          
          // Effective cost = unit cost + freight allocation
          const effectiveCost = parseFloat(item.unit_cost) + freightPerUnit;
          
          // Get current product data for weighted average calculation
          const productResult = await client.query(
            'SELECT id, stock, cost FROM products WHERE id = $1 AND branch_id = $2',
            [item.product_id, order.branch_id]
          );
          
          if (productResult.rows.length > 0) {
            const product = productResult.rows[0];
            const currentStock = parseInt(product.stock) || 0;
            const currentCost = parseFloat(product.cost) || 0;
            
            // Calculate weighted average cost
            // WAC = (Previous Stock × Previous Cost + Received Qty × Landed Cost) / Total Stock
            const previousTotalValue = currentStock * currentCost;
            const newItemsTotalValue = receivedQty * effectiveCost;
            const newTotalStock = currentStock + receivedQty;
            
            const newAverageCost = newTotalStock > 0 
              ? (previousTotalValue + newItemsTotalValue) / newTotalStock
              : effectiveCost;
            
            // Update product with new stock AND weighted average cost
            await client.query(
              'UPDATE products SET stock = $1, cost = $2 WHERE id = $3 AND branch_id = $4',
              [newTotalStock, newAverageCost.toFixed(2), item.product_id, order.branch_id]
            );
          }
        }
      }
      
      await client.query(
        'UPDATE purchase_orders SET status = $1, received_by = $2, received_at = CURRENT_TIMESTAMP, freight_distributed = true WHERE id = $3',
        ['received', receivedBy, id]
      );

      // Create automatic journal entry for this purchase
      try {
        await recordPurchaseJournal(client, order, order.branch_id, receivedBy);
      } catch (jeError) {
        console.warn('[PURCHASE] Journal entry creation failed (non-fatal):', jeError.message);
      }
      
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
