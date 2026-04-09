// Products API routes — with Optimistic Locking (Phase 3)
const express = require('express');
const db = require('../db');
const { checkOptimisticLock } = require('../middleware/security');

module.exports = function(broadcastTable) {
  const router = express.Router();

  // Get all products
  router.get('/', async (req, res) => {
    try {
      const { branchId } = req.query;
      let query = 'SELECT * FROM products WHERE is_active = true';
      const params = [];
      
      if (branchId) {
        query += ' AND (branch_id = $1 OR branch_id IS NULL)';
        params.push(branchId);
      }
      
      query += ' ORDER BY name';
      const result = await db.query(query, params);
      res.json(result.rows);
    } catch (error) {
      console.error('[PRODUCTS ERROR]', error);
      res.status(500).json({ error: 'Failed to fetch products' });
    }
  });

  // Create product
  router.post('/', async (req, res) => {
    try {
      const { name, sku, barcode, category, price, cost, stock, unit, taxRate, branchId, isActive } = req.body;
      
      const result = await db.query(
        `INSERT INTO products (name, sku, barcode, category, price, cost, stock, unit, tax_rate, branch_id, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING *`,
        [name, sku, barcode, category, price, cost, stock || 0, unit || 'un', taxRate || 14, branchId, isActive !== false]
      );
      
      // Broadcast to ALL clients
      await broadcastTable('products');
      
      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error('[PRODUCTS ERROR]', error);
      res.status(500).json({ error: 'Failed to create product' });
    }
  });

  // Update product (with optimistic locking)
  router.put('/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const { name, sku, barcode, category, price, cost, stock, unit, taxRate, branchId, isActive, version } = req.body;
      
      if (version == null) {
        return res.status(400).json({ error: 'version is required for updates' });
      }

      const result = await db.query(
        `UPDATE products 
         SET name = $1, sku = $2, barcode = $3, category = $4, price = $5, cost = $6, 
             stock = $7, unit = $8, tax_rate = $9, branch_id = $10, is_active = $11,
             version = version + 1
         WHERE id = $12 AND version = $13
         RETURNING *`,
        [name, sku, barcode, category, price, cost, stock, unit, taxRate, branchId, isActive, id, version]
      );
      
      if (!checkOptimisticLock(result, res, 'Product')) return;
      
      await broadcastTable('products');
      res.json(result.rows[0]);
    } catch (error) {
      console.error('[PRODUCTS ERROR]', error);
      res.status(500).json({ error: 'Failed to update product' });
    }
  });

  // Update stock
  router.patch('/:id/stock', async (req, res) => {
    try {
      const { id } = req.params;
      const { quantityChange } = req.body;
      
      const result = await db.query(
        'UPDATE products SET stock = stock + $1 WHERE id = $2 RETURNING *',
        [quantityChange, id]
      );
      
      // Broadcast to ALL clients
      await broadcastTable('products');
      
      res.json(result.rows[0]);
    } catch (error) {
      console.error('[PRODUCTS ERROR]', error);
      res.status(500).json({ error: 'Failed to update stock' });
    }
  });

  // Delete product (soft delete)
  router.delete('/:id', async (req, res) => {
    try {
      const { id } = req.params;
      
      await db.query('UPDATE products SET is_active = false WHERE id = $1', [id]);
      
      // Broadcast to ALL clients
      await broadcastTable('products');
      
      res.json({ success: true });
    } catch (error) {
      console.error('[PRODUCTS ERROR]', error);
      res.status(500).json({ error: 'Failed to delete product' });
    }
  });

  return router;
};
