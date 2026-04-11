// Branches API routes
const express = require('express');
const db = require('../db');
const crypto = require('crypto');

function buildBranchCode(name = '') {
  const cleaned = String(name).toUpperCase().replace(/[^A-Z0-9]/g, '');
  const base = (cleaned.slice(0, 3) || 'FIL').padEnd(3, 'X');
  const suffix = crypto.randomUUID().slice(0, 6).toUpperCase();
  return `${base}-${suffix}`.slice(0, 10);
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
      let normalizedCode = String(code || '').trim().toUpperCase();

      if (!normalizedName) {
        return res.status(400).json({ error: 'Branch name is required' });
      }

      // If code provided, check for duplicates
      if (normalizedCode) {
        const existing = await db.query('SELECT id FROM branches WHERE code = $1', [normalizedCode]);
        if (existing.rows.length > 0) {
          return res.status(409).json({ error: `Branch code '${normalizedCode}' already exists. Please use a different code.` });
        }
      } else {
        // Auto-generate a collision-proof code
        normalizedCode = buildBranchCode(normalizedName);
        // Double-check uniqueness (extremely unlikely collision with UUID)
        const existing = await db.query('SELECT id FROM branches WHERE code = $1', [normalizedCode]);
        if (existing.rows.length > 0) {
          normalizedCode = buildBranchCode(normalizedName); // regenerate
        }
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
        return res.status(409).json({ error: 'Branch code already exists. Please try again.' });
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
      let normalizedCode = String(code || '').trim().toUpperCase() || buildBranchCode(normalizedName);

      if (!normalizedName) {
        return res.status(400).json({ error: 'Branch name is required' });
      }

      // Check code uniqueness excluding current branch
      const existing = await db.query('SELECT id FROM branches WHERE code = $1 AND id != $2', [normalizedCode, id]);
      if (existing.rows.length > 0) {
        return res.status(409).json({ error: `Branch code '${normalizedCode}' is already used by another branch.` });
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
