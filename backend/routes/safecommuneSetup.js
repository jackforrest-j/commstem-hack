const express = require('express');
const router  = express.Router();
const { searchStops, planTrip } = require('../lib/nswTransport');
const store = require('../lib/journeyStore');

// Stop autocomplete
router.get('/stops', async (req, res) => {
  const q = (req.query.q || '').trim();
  if (q.length < 2) return res.json([]);
  try {
    const stops = await searchStops(q);
    res.json(stops);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Plan trips between two stops
router.get('/trips', async (req, res) => {
  const { from, to } = req.query;
  if (!from || !to) return res.status(400).json({ error: 'from and to required' });
  try {
    const trips = await planTrip(from, to);
    res.json(trips);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Save selected journey
router.post('/journey', (req, res) => {
  const { legs, departs, arrives, durationMin } = req.body;
  if (!legs?.length) return res.status(400).json({ error: 'legs required' });
  store.setJourney({ legs, departs, arrives, durationMin });
  res.json({ ok: true });
});

// Get active journey
router.get('/journey', (req, res) => {
  res.json(store.getJourney() || null);
});

// Receive child GPS from device
router.post('/child-location', (req, res) => {
  const { lat, lon } = req.body;
  if (lat == null || lon == null) return res.status(400).json({ error: 'lat and lon required' });
  store.setChildLocation({ lat: parseFloat(lat), lon: parseFloat(lon), ts: Date.now() });
  res.json({ ok: true });
});

module.exports = router;
