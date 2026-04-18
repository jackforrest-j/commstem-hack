require('dotenv').config();
const express = require('express');
const cors = require('cors');

const usersRouter  = require('./routes/users');
const itemsRouter  = require('./routes/items');
const uploadRouter  = require('./routes/upload');
const analyseRouter = require('./routes/analyse');
const safecommuneStatusRouter = require('./routes/safecommuneStatus');
const safecommuneSimulateRouter = require('./routes/safecommuneSimulate');

const app = express();
const PORT = process.env.PORT || 3001;

// ─── Middleware ───────────────────────────────────────────────────────────────
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:5173',
].filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    // Allow server-to-server requests (no origin) and allowed origins
    if (!origin || allowedOrigins.some(o => origin.startsWith(o))) return cb(null, true);
    cb(new Error(`CORS: ${origin} not allowed`));
  },
  credentials: true,
}));
app.options('*', cors()); // pre-flight for all routes
app.use(express.json());

// ─── Routes ───────────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/users',  usersRouter);
app.use('/api/items',  itemsRouter);
app.use('/api/upload',  uploadRouter);
app.use('/api/analyse', analyseRouter);  // Rename 'items' to your domain (e.g. 'events', 'posts')
app.use('/api/safecommute', safecommuneStatusRouter);
app.use('/api/safecommute', safecommuneSimulateRouter);

// ─── Global error handler ─────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong.' });
});

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
