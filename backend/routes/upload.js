const express  = require('express');
const multer   = require('multer');
const { parse } = require('csv-parse');
const router   = express.Router();
const supabase = require('../lib/supabase');
const { authenticateUser } = require('../middleware/auth');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
  fileFilter(_, file, cb) {
    const ok = ['text/csv', 'application/json', 'text/plain', 'application/vnd.ms-excel'].includes(file.mimetype)
      || file.originalname.endsWith('.csv')
      || file.originalname.endsWith('.json');
    cb(ok ? null : new Error('Only CSV and JSON files are supported.'), ok);
  },
});

// Parse CSV buffer → array of row objects
function parseCSV(buffer) {
  return new Promise((resolve, reject) => {
    parse(buffer, { columns: true, skip_empty_lines: true, trim: true }, (err, records) => {
      err ? reject(err) : resolve(records);
    });
  });
}

// Parse JSON buffer → array of objects (or wrap single object)
function parseJSON(buffer) {
  const parsed = JSON.parse(buffer.toString('utf8'));
  return Array.isArray(parsed) ? parsed : [parsed];
}

// POST /api/upload
router.post('/', authenticateUser, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });

  const { originalname, buffer, mimetype } = req.file;
  const isJSON = originalname.endsWith('.json') || mimetype === 'application/json';
  const name   = (req.body.name || originalname.replace(/\.[^.]+$/, '')).trim();

  let rows;
  try {
    rows = isJSON ? parseJSON(buffer) : await parseCSV(buffer);
  } catch (err) {
    return res.status(422).json({ error: `Parse error: ${err.message}` });
  }

  if (!rows.length) return res.status(422).json({ error: 'File is empty or has no data rows.' });

  const columns = Object.keys(rows[0]);

  // Create dataset record
  const { data: dataset, error: dsErr } = await supabase
    .from('datasets')
    .insert({ user_id: req.user.id, name, columns, row_count: rows.length, description: req.body.description || null })
    .select()
    .single();

  if (dsErr) return res.status(500).json({ error: dsErr.message });

  // Bulk insert rows in batches of 500
  const BATCH = 500;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH).map((data, j) => ({
      dataset_id: dataset.id,
      data,
      row_index: i + j,
    }));
    const { error: rowErr } = await supabase.from('dataset_rows').insert(batch);
    if (rowErr) {
      await supabase.from('datasets').delete().eq('id', dataset.id);
      return res.status(500).json({ error: `Row insert failed: ${rowErr.message}` });
    }
  }

  res.status(201).json({
    dataset: { ...dataset, row_count: rows.length },
    columns,
    preview: rows.slice(0, 5),
  });
});

// GET /api/upload — list user's datasets
router.get('/', authenticateUser, async (req, res) => {
  const { data, error } = await supabase
    .from('datasets')
    .select('id, name, description, row_count, columns, created_at')
    .eq('user_id', req.user.id)
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// GET /api/upload/:id/rows — paginated rows for a dataset
router.get('/:id/rows', authenticateUser, async (req, res) => {
  const limit  = Math.min(parseInt(req.query.limit)  || 100, 1000);
  const offset = parseInt(req.query.offset) || 0;

  const { data, error } = await supabase
    .from('dataset_rows')
    .select('row_index, data')
    .eq('dataset_id', req.params.id)
    .order('row_index')
    .range(offset, offset + limit - 1);

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

module.exports = router;
