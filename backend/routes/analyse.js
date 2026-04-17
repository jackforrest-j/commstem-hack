const express    = require('express');
const Anthropic  = require('@anthropic-ai/sdk');
const router     = express.Router();
const supabase   = require('../lib/supabase');
const { authenticateUser } = require('../middleware/auth');

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Build a compact dataset summary to send to Claude (keeps prompt small)
function buildSummary(dataset, rows) {
  const sample = rows.slice(0, 20).map(r => r.data);
  const columns = dataset.columns || (sample[0] ? Object.keys(sample[0]) : []);

  // Per-column stats for numeric columns
  const stats = {};
  for (const col of columns) {
    const vals = sample.map(r => r[col]).filter(v => v != null && v !== '');
    const nums = vals.map(Number).filter(n => !isNaN(n));
    if (nums.length > vals.length * 0.5) {
      const sorted = [...nums].sort((a, b) => a - b);
      stats[col] = {
        type: 'numeric',
        min: sorted[0],
        max: sorted[sorted.length - 1],
        mean: +(nums.reduce((s, n) => s + n, 0) / nums.length).toFixed(3),
      };
    } else {
      const uniq = [...new Set(vals)];
      stats[col] = { type: 'categorical', unique_values: uniq.slice(0, 10), unique_count: uniq.length };
    }
  }

  return {
    name: dataset.name,
    row_count: dataset.row_count,
    columns,
    column_stats: stats,
    sample_rows: sample.slice(0, 5),
  };
}

// POST /api/analyse/:datasetId
router.post('/:datasetId', authenticateUser, async (req, res) => {
  if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY === 'your_anthropic_api_key_here') {
    return res.status(503).json({ error: 'ANTHROPIC_API_KEY is not configured. Add it to backend/.env.' });
  }

  // Fetch dataset metadata
  const { data: dataset, error: dsErr } = await supabase
    .from('datasets')
    .select('*')
    .eq('id', req.params.datasetId)
    .eq('user_id', req.user.id)
    .single();

  if (dsErr || !dataset) return res.status(404).json({ error: 'Dataset not found.' });

  // Fetch sample rows
  const { data: rows, error: rowErr } = await supabase
    .from('dataset_rows')
    .select('row_index, data')
    .eq('dataset_id', dataset.id)
    .order('row_index')
    .limit(100);

  if (rowErr) return res.status(500).json({ error: rowErr.message });

  const summary = buildSummary(dataset, rows);
  const { focus } = req.body; // optional analyst focus from the frontend

  const systemPrompt = `You are an expert data analyst embedded in an interdisciplinary intelligence platform used by a DataScience × Communications & STEM society. Your role is to surface non-obvious insights from datasets quickly and clearly.

Respond in structured JSON with the following fields:
{
  "headline": "one-sentence key finding",
  "insights": [
    { "title": "...", "detail": "...", "type": "trend|anomaly|correlation|distribution|recommendation" }
  ],
  "suggested_visualisations": ["..."],
  "data_quality": { "issues": ["..."], "score": 0-100 }
}

Keep language precise and analytical. Avoid filler. Maximum 4 insights.`;

  const userPrompt = `Analyse this dataset${focus ? ` with a focus on: ${focus}` : ''}.

Dataset summary:
${JSON.stringify(summary, null, 2)}`;

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const text = message.content[0].text;

    // Extract JSON from the response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return res.status(500).json({ error: 'Model returned non-JSON response.', raw: text });

    const analysis = JSON.parse(jsonMatch[0]);
    res.json({ analysis, dataset: { id: dataset.id, name: dataset.name, row_count: dataset.row_count } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
