// Suppliers API routes
const express = require('express');
const db = require('../db');

module.exports = function(broadcastTable) {
  const router = express.Router();

  router.get('/', async (req, res) => {
    try {
      const result = await db.query('SELECT * FROM suppliers WHERE is_active = true ORDER BY name');
      res.json(result.rows);
    } catch (error) {
      console.error('[SUPPLIERS ERROR]', error);
      res.status(500).json({ error: 'Failed to fetch suppliers' });
    }
  });

  router.post('/', async (req, res) => {
    try {
      const { name, nif, email, phone, address, city, country, contactPerson, paymentTerms, notes } = req.body;
      const result = await db.query(
        `INSERT INTO suppliers (name, nif, email, phone, address, city, country, contact_person, payment_terms, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
        [name, nif, email, phone, address, city, country || 'Angola', contactPerson, paymentTerms || '30_days', notes]
      );
      await broadcastTable('suppliers');
      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error('[SUPPLIERS ERROR]', error);
      res.status(500).json({ error: 'Failed to create supplier' });
    }
  });

  router.put('/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const { name, nif, email, phone, address, city, country, contactPerson, paymentTerms, notes, isActive } = req.body;
      const result = await db.query(
        `UPDATE suppliers 
         SET name = $1, nif = $2, email = $3, phone = $4, address = $5, city = $6, 
             country = $7, contact_person = $8, payment_terms = $9, notes = $10, is_active = $11, updated_at = CURRENT_TIMESTAMP
         WHERE id = $12 RETURNING *`,
        [name, nif, email, phone, address, city, country, contactPerson, paymentTerms, notes, isActive, id]
      );
      await broadcastTable('suppliers');
      res.json(result.rows[0]);
    } catch (error) {
      console.error('[SUPPLIERS ERROR]', error);
      res.status(500).json({ error: 'Failed to update supplier' });
    }
  });

  router.delete('/:id', async (req, res) => {
    try {
      const { id } = req.params;
      await db.query('UPDATE suppliers SET is_active = false WHERE id = $1', [id]);
      await broadcastTable('suppliers');
      res.json({ success: true });
    } catch (error) {
      console.error('[SUPPLIERS ERROR]', error);
      res.status(500).json({ error: 'Failed to delete supplier' });
    }
  });

  return router;
};
