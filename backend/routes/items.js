/**
 * PLACEHOLDER ROUTE — rename this file and update the table/fields
 * to match your actual domain (e.g. events.js, posts.js, products.js)
 *
 * API contract for this resource:
 *   GET    /api/items        → list all items
 *   GET    /api/items/:id    → get one item
 *   POST   /api/items        → create an item (requires auth)
 *   DELETE /api/items/:id    → delete an item (requires auth)
 */

const express = require('express');
const router = express.Router();
const supabase = require('../lib/supabase');
const { authenticateUser } = require('../middleware/auth');

// GET /api/items — public list
router.get('/', async (req, res) => {
  const { data, error } = await supabase
    .from('items')          // <-- update table name
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// GET /api/items/:id — single item
router.get('/:id', async (req, res) => {
  const { data, error } = await supabase
    .from('items')
    .select('*')
    .eq('id', req.params.id)
    .single();

  if (error) return res.status(404).json({ error: 'Not found.' });
  res.json(data);
});

// POST /api/items — create (protected)
router.post('/', authenticateUser, async (req, res) => {
  const { title, description } = req.body;  // <-- update fields to match your table

  if (!title) return res.status(400).json({ error: 'title is required.' });

  const { data, error } = await supabase
    .from('items')
    .insert({ title, description, user_id: req.user.id })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

// DELETE /api/items/:id — delete (protected)
router.delete('/:id', authenticateUser, async (req, res) => {
  const { error } = await supabase
    .from('items')
    .delete()
    .eq('id', req.params.id)
    .eq('user_id', req.user.id);  // ensures users can only delete their own

  if (error) return res.status(500).json({ error: error.message });
  res.status(204).send();
});

module.exports = router;
