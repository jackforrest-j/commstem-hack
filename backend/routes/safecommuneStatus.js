const express = require('express');
const router  = express.Router();
const { getBusPosition, getChildPosition, ROUTE_STOPS, LOOP_SECONDS } = require('../lib/mockTransport');
const { getJourneyState } = require('../lib/journeyEngine');
const { findVehicle }     = require('../lib/nswTransport');
const store               = require('../lib/journeyStore');

router.get('/status', async (req, res) => {
  const journey      = store.getJourney();
  const storedChild  = store.getChildLocation();

  // ── Real mode: active journey set ────────────────────────────────────────
  if (journey) {
    const activeLeg = journey.legs.find(l => l.tripCode || l.routeId);
    let vehicle = null;
    if (activeLeg) {
      vehicle = await findVehicle(activeLeg.tripCode, activeLeg.routeId);
    }

    const child = storedChild || null;
    const arrives = journey.arrives ? new Date(journey.arrives) : null;
    const eta_minutes = arrives ? Math.max(0, Math.round((arrives - Date.now()) / 60000)) : null;

    let state = 'WAITING';
    let nearest_stop = activeLeg?.from || '—';
    if (child && vehicle) {
      const result = getJourneyState(child, vehicle, ROUTE_STOPS);
      state        = result.state;
      nearest_stop = result.nearest_stop;
    } else if (!child) {
      state = 'WAITING';
    }

    return res.json({
      state,
      child:    child ? { lat: child.lat, lon: child.lon } : null,
      vehicle:  vehicle ? { lat: vehicle.lat, lon: vehicle.lon, speed: vehicle.speed } : null,
      eta_minutes,
      nearest_stop,
      line:      activeLeg?.line,
      timestamp: new Date().toISOString(),
      mode:      'live',
    });
  }

  // ── Demo mode: no journey set, use mock simulation ────────────────────────
  const phase   = req.query.phase || 'WAITING';
  const vehicle = getBusPosition();
  const child   = storedChild || getChildPosition(phase);
  const { state, nearest_stop } = getJourneyState(child, vehicle, ROUTE_STOPS);

  const loopFraction   = (vehicle.segment_index + vehicle.progress) / (ROUTE_STOPS.length - 1);
  const eta_minutes    = Math.round(((1 - loopFraction) * LOOP_SECONDS) / 60);

  res.json({
    state,
    child:    { lat: child.lat, lon: child.lon },
    vehicle:  { lat: vehicle.lat, lon: vehicle.lon, speed: vehicle.speed },
    eta_minutes,
    nearest_stop,
    timestamp: new Date().toISOString(),
    mode:      'demo',
  });
});

module.exports = router;
