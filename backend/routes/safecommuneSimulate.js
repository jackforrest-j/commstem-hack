const express = require('express');
const router = express.Router();
const { getChildPosition } = require('../lib/mockTransport');

router.get('/simulate-child', (req, res) => {
  const phase = req.query.phase || 'waiting';
  const { lat, lon } = getChildPosition(phase);
  res.json({ lat, lon });
});

module.exports = router;
