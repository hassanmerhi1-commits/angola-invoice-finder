// Sales API routes
const express = require('express');
const db = require('../db');

module.exports = function(broadcastTable) {
  const router = express.Router();

  // Get all sales
  router.get('/', async (req, res) => {
    try {
      const { branchId } = req.query;
      let query = 'SELECT * FROM sales';
      const params = [];
      
      if (branchId) {
        query += ' WHERE branch_id = $1';
        params.push(branchId);
      }
      
      query += ' ORDER BY created_at DESC';
      const result = await db.query(query, params);
      
      // Get items for each sale
      for (let sale of result.rows) {
        const itemsResult = await db.query(
          'SELECT * FROM sale_items WHERE sale_id = $1',
          [sale.id]
        );
        sale.items = itemsResult.rows;
      }
      
      res.json(result.rows);
    } catch (error) {
      console.error('[SALES ERROR]', error);
      res.status(500).json({ error: 'Failed to fetch sales' });
    }
  });

  // Create sale
  router.post('/', async (req, res) => {
    const client = await db.pool.connect();
    
    try {
      await client.query('BEGIN');
      
      const { 
        invoiceNumber, branchId, cashierId, cashierName, items, 
        subtotal, taxAmount, discount, total, 
        paymentMethod, amountPaid, change,
        customerNif, customerName 
      } = req.body;
      
      // Insert sale
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
      
      // Insert items and update stock
      for (const item of items) {
        await client.query(
          `INSERT INTO sale_items (
            sale_id, product_id, product_name, sku, quantity, 
            unit_price, discount, tax_rate, tax_amount, subtotal
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [sale.id, item.productId, item.productName, item.sku, item.quantity,
           item.unitPrice, item.discount || 0, item.taxRate, item.taxAmount, item.subtotal]
        );
        
        // Update product stock
        await client.query(
          'UPDATE products SET stock = stock - $1 WHERE id = $2',
          [item.quantity, item.productId]
        );
      }
      
      await client.query('COMMIT');
      
      // Broadcast updates
      await broadcastTable('sales');
      await broadcastTable('products'); // Stock changed
      
      res.status(201).json({ ...sale, items });
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('[SALES ERROR]', error);
      res.status(500).json({ error: 'Failed to create sale' });
    } finally {
      client.release();
    }
  });

  // Generate invoice number
  router.get('/generate-invoice-number/:branchCode', async (req, res) => {
    try {
      const { branchCode } = req.params;
      const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      
      const result = await db.query(
        `SELECT COUNT(*) as count FROM sales 
         WHERE invoice_number LIKE $1`,
        [`FT ${branchCode}/${today}/%`]
      );
      
      const count = parseInt(result.rows[0].count) + 1;
      const invoiceNumber = `FT ${branchCode}/${today}/${count.toString().padStart(4, '0')}`;
      
      res.json({ invoiceNumber });
    } catch (error) {
      console.error('[SALES ERROR]', error);
      res.status(500).json({ error: 'Failed to generate invoice number' });
    }
  });

  return router;
};
