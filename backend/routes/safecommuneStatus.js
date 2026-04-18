const express = require('express');
const router = express.Router();
const { getBusPosition, getChildPosition, ROUTE_STOPS, LOOP_SECONDS } = require('../lib/mockTransport');
const { getJourneyState } = require('../lib/journeyEngine');

router.get('/status', (req, res) => {
  const phase = req.query.phase || 'waiting';
  const vehicle = getBusPosition();
  const child = getChildPosition(phase);
  const { state, nearest_stop } = getJourneyState(child, vehicle, ROUTE_STOPS);

  const totalSegments = ROUTE_STOPS.length - 1;
  const loopProgressFraction = (vehicle.segment_index + vehicle.progress) / totalSegments;
  const secondsElapsed = loopProgressFraction * LOOP_SECONDS;
  const secondsRemaining = LOOP_SECONDS - secondsElapsed;
  const eta_minutes = Math.round(secondsRemaining / 60);

  res.json({
    state,
    child: { lat: child.lat, lon: child.lon },
    vehicle: { lat: vehicle.lat, lon: vehicle.lon, speed: vehicle.speed },
    eta_minutes,
    nearest_stop,
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
