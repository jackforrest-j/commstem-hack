const express = require('express');
const router  = express.Router();
const { getBusPosition, getChildPosition, ROUTE_STOPS, LOOP_SECONDS } = require('../lib/mockTransport');
const { getJourneyState } = require('../lib/journeyEngine');
const { getDepartures }   = require('../lib/nswTransport');
const { getDelayForJourney } = require('../lib/gtfsRealtime');
const store               = require('../lib/journeyStore');

router.get('/status', async (req, res) => {
  const { parentId } = req.query;
  const journey      = store.getJourney(parentId);
  const storedChild  = store.getChildLocation(parentId);

  // ── Real mode: active journey set ────────────────────────────────────────
  if (journey) {
    const activeLeg = journey.legs.find(l => l.tripCode || l.routeId);
    const child = storedChild || null;
    const arrives = journey.arrives ? new Date(journey.arrives) : null;
    const eta_minutes = arrives ? Math.max(0, Math.round((arrives - Date.now()) / 60000)) : null;

    // Use departure_mon to get real-time next departure from origin stop
    let nextDeparture = null;
    if (activeLeg?.routeId) {
      try {
        const stopId = journey.legs[0]?.fromStopId;
        if (stopId) {
          const departures = await getDepartures(stopId);
          nextDeparture = departures.find(d => d.tripCode === activeLeg.tripCode) || departures[0] || null;
        }
      } catch { /* non-fatal */ }
    }

    // GTFS-RT: delay (vehicle positions now fetched per-map via /vehicles/nearby)
    const delaySecs = await getDelayForJourney(activeLeg).catch(() => null);

    const manualState = store.getManualState(parentId);
    let state = manualState || (child ? 'ON_BUS' : 'WAITING');
    const nearest_stop = activeLeg?.from || '—';

    const firstLeg = journey.legs[0];
    const lastLeg  = journey.legs[journey.legs.length - 1];

    // Delay: prefer GTFS-RT, fall back to departure monitor comparison
    let delayMins = null;
    if (delaySecs !== null) {
      delayMins = Math.round(delaySecs / 60);
    } else if (nextDeparture?.departs && activeLeg?.departs) {
      const diff = Math.round((new Date(nextDeparture.departs) - new Date(activeLeg.departs)) / 60000);
      if (diff > 0) delayMins = diff;
    }

    return res.json({
      state,
      child:       child ? { lat: child.lat, lon: child.lon } : null,
      eta_minutes,
      nearest_stop,
      line:        activeLeg?.line,
      nextDeparts: nextDeparture?.departs || null,
      isRealTime:  nextDeparture?.isRealTime || false,
      delayMins,
      originCoord: firstLeg?.fromCoord  || null,
      originName:  firstLeg?.from       || null,
      destCoord:   lastLeg?.toCoord     || null,
      destName:    lastLeg?.to          || null,
      timestamp:   new Date().toISOString(),
      mode:        'live',
    });
  }

  // ── Demo mode: no journey set, use mock simulation ────────────────────────
  const phase   = req.query.phase || 'WAITING';
  const vehicle = getBusPosition();
  const child   = storedChild || null;
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
