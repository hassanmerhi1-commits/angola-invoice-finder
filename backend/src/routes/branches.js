// Branches API routes
const express = require('express');
const db = require('../db');

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
      
      const result = await db.query(
        `INSERT INTO branches (name, code, address, phone, is_main)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [name, code, address, phone, isMain || false]
      );
      
      await broadcastTable('branches');
      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error('[BRANCHES ERROR]', error);
      res.status(500).json({ error: 'Failed to create branch' });
    }
  });

  // Update branch
  router.put('/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const { name, code, address, phone, isMain } = req.body;
      
      const result = await db.query(
        `UPDATE branches SET name = $1, code = $2, address = $3, phone = $4, is_main = $5
         WHERE id = $6 RETURNING *`,
        [name, code, address, phone, isMain, id]
      );
      
      await broadcastTable('branches');
      res.json(result.rows[0]);
    } catch (error) {
      console.error('[BRANCHES ERROR]', error);
      res.status(500).json({ error: 'Failed to update branch' });
    }
  });

  return router;
};
