const express = require('express');
const router  = express.Router();
const { getDepartures }   = require('../lib/nswTransport');
const { getDelayForJourney } = require('../lib/gtfsRealtime');
const store               = require('../lib/journeyStore');
const { createClient }    = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

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

    // Fetch prefs once for both rerouteAvailable and prefsVersion
    let rerouteAvailable = false;
    let prefsVersion = null;
    try {
      const { data: childRow } = await supabase.from('children')
        .select('fallback_preference, walking_speed, familiarity_level, transfer_tolerance, walk_tolerance_m, buffer_minutes, allowed_modes')
        .eq('parent_id', parentId).single();
      if (childRow) {
        const fp = childRow.fallback_preference || 'both';
        rerouteAvailable = delayMins > 10 && (fp === 'next_route' || fp === 'both');
        prefsVersion = JSON.stringify([
          childRow.walking_speed, childRow.familiarity_level, childRow.transfer_tolerance,
          childRow.walk_tolerance_m, childRow.buffer_minutes,
          (childRow.allowed_modes || []).slice().sort().join(','),
        ]);
      }
    } catch { /* non-fatal */ }

    return res.json({
      state,
      child:       child ? { lat: child.lat, lon: child.lon } : null,
      eta_minutes,
      nearest_stop,
      line:        activeLeg?.line,
      nextDeparts: nextDeparture?.departs || null,
      isRealTime:  nextDeparture?.isRealTime || false,
      delayMins,
      rerouteAvailable,
      prefsVersion,
      originCoord: firstLeg?.fromCoord  || null,
      originName:  firstLeg?.from       || null,
      destCoord:   lastLeg?.toCoord     || null,
      destName:    lastLeg?.to          || null,
      timestamp:   new Date().toISOString(),
      mode:        'live',
    });
  }

  // ── Idle mode: no journey set, child not connected ───────────────────────
  let idlePrefsVersion = null;
  try {
    const { data: childRow } = await supabase.from('children')
      .select('walking_speed, familiarity_level, transfer_tolerance, walk_tolerance_m, buffer_minutes, allowed_modes')
      .eq('parent_id', parentId).single();
    if (childRow) {
      idlePrefsVersion = JSON.stringify([
        childRow.walking_speed, childRow.familiarity_level, childRow.transfer_tolerance,
        childRow.walk_tolerance_m, childRow.buffer_minutes,
        (childRow.allowed_modes || []).slice().sort().join(','),
      ]);
    }
  } catch { /* non-fatal */ }

  res.json({
    state:        'WAITING',
    child:        storedChild ? { lat: storedChild.lat, lon: storedChild.lon } : null,
    eta_minutes:  null,
    nearest_stop: '—',
    prefsVersion: idlePrefsVersion,
    timestamp:    new Date().toISOString(),
    mode:         'idle',
  });
});

module.exports = router;
