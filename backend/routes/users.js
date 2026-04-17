const express = require('express');
const router = express.Router();
const supabase = require('../lib/supabase');
const { authenticateUser } = require('../middleware/auth');

// GET /api/users/:id — fetch a single user's profile
router.get('/:id', authenticateUser, async (req, res) => {
  const { id } = req.params;

  const { data, error } = await supabase
    .from('profiles')       // <-- update table name if different
    .select('*')
    .eq('id', id)
    .single();

  if (error) return res.status(404).json({ error: 'User not found.' });
  res.json(data);
});

// GET /api/users/me — fetch the currently logged-in user's profile
router.get('/me', authenticateUser, async (req, res) => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', req.user.id)
    .single();

  if (error) return res.status(404).json({ error: 'Profile not found.' });
  res.json(data);
});

module.exports = router;
