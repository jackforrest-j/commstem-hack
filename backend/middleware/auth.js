const { createClient } = require('@supabase/supabase-js');

// Validates the JWT token sent by the frontend in the Authorization header.
// Usage: add `authenticateUser` as middleware to any route that requires login.
//
// Example:
//   router.get('/protected', authenticateUser, (req, res) => {
//     res.json({ user: req.user });
//   });

const authenticateUser = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header.' });
  }

  const token = authHeader.split(' ')[1];

  // Create a per-request Supabase client using the user's token
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );

  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error || !user) {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }

  req.user = user;
  next();
};

module.exports = { authenticateUser };
