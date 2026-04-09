// Branches API routes
const express = require('express');
const db = require('../db');

function buildBranchCode(name = '') {
  const cleaned = String(name).toUpperCase().replace(/[^A-Z0-9]/g, '');
  const base = (cleaned.slice(0, 3) || 'FIL').padEnd(3, 'X');
  const suffix = String(Date.now()).slice(-4);
  return `${base}${suffix}`.slice(0, 10);
}

module.exports = function(broadcastTable) {
  const router = express.Router();

  // Get all branches
  router.get('/', async (req, res) => {
    try {
      const result = await db.query('SELECT * FROM branches ORDER BY is_main DESC, name');
      res.json(result.rows);
    } catch (error) {
      console.error('[BRANCHES ERROR]', error);
      res.status(500).json({ error: 'Failed to fetch branches' });
    }
  });

  // Create branch
  router.post('/', async (req, res) => {
    try {
      const { name, code, address, phone, isMain } = req.body;
      const normalizedName = String(name || '').trim();
      const normalizedCode = String(code || '').trim().toUpperCase() || buildBranchCode(normalizedName);

      if (!normalizedName) {
        return res.status(400).json({ error: 'Branch name is required' });
      }
      
      const result = await db.query(
        `INSERT INTO branches (name, code, address, phone, is_main)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
         [normalizedName, normalizedCode, address?.trim?.() || '', phone?.trim?.() || '', isMain || false]
      );
      
      await broadcastTable('branches');
      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error('[BRANCHES ERROR]', error);
      if (error.code === '23505') {
        return res.status(409).json({ error: 'Branch code already exists' });
      }
      res.status(500).json({ error: 'Failed to create branch' });
    }
  });

  // Update branch
  router.put('/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const { name, code, address, phone, isMain } = req.body;
      const normalizedName = String(name || '').trim();
      const normalizedCode = String(code || '').trim().toUpperCase() || buildBranchCode(normalizedName);

      if (!normalizedName) {
        return res.status(400).json({ error: 'Branch name is required' });
      }
      
      const result = await db.query(
        `UPDATE branches SET name = $1, code = $2, address = $3, phone = $4, is_main = $5
         WHERE id = $6 RETURNING *`,
         [normalizedName, normalizedCode, address?.trim?.() || '', phone?.trim?.() || '', isMain, id]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({ error: 'Branch not found' });
      }
      
      await broadcastTable('branches');
      res.json(result.rows[0]);
    } catch (error) {
      console.error('[BRANCHES ERROR]', error);
      if (error.code === '23505') {
        return res.status(409).json({ error: 'Branch code already exists' });
      }
      res.status(500).json({ error: 'Failed to update branch' });
    }
  });

  return router;
};
