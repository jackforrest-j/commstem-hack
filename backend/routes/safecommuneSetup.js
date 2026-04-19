const express = require('express');
const router  = express.Router();
const { searchStops, nearbyStops, planTrip, planTripFromCoord, planTripFromCoordToCoord, getDepartures } = require('../lib/nswTransport');
const { sampleVehicles, getNearbyVehicles } = require('../lib/gtfsRealtime');
const store = require('../lib/journeyStore');
const { scoreAndRankTrips } = require('../lib/tripScorer');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const CLASS_LABELS = { 1: 'Train', 2: 'Train', 11: 'Metro', 4: 'Tram', 5: 'Bus', 7: 'Bus', 10: 'Bus', 9: 'Ferry' };
function allowedModeLabels(modes) {
  if (!modes?.length) return [];
  const seen = new Set();
  return modes.map(m => CLASS_LABELS[m] || 'Transit').filter(l => !seen.has(l) && seen.add(l));
}

// NSW API ignores inclMOT_X params — enforce mode restrictions ourselves
function filterTripsByMode(trips, allowedModes) {
  if (!allowedModes?.length) return trips;
  const allowed = new Set(allowedModes.map(Number));
  return trips.filter(trip =>
    trip.legs.every(leg => leg.mode == null || allowed.has(Number(leg.mode)))
  );
}

async function fetchChildPrefs(parentId) {
  if (!parentId) return null;
  try {
    const { data } = await supabase.from('children')
      .select('walking_speed, familiarity_level, transfer_tolerance, walk_tolerance_m, buffer_minutes, allowed_modes')
      .eq('parent_id', parentId).single();
    return data || null;
  } catch { return null; }
}

// Nearest stops to GPS coordinates
router.get('/stops/nearby', async (req, res) => {
  const { lat, lon } = req.query;
  if (!lat || !lon) return res.status(400).json({ error: 'lat and lon required' });
  try {
    const stops = await nearbyStops(parseFloat(lat), parseFloat(lon));
    res.json(stops);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

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

// Debug: try multiple NSW stop_finder param combos
router.get('/debug/stops-raw', async (req, res) => {
  const q = (req.query.q || 'Central').trim();
  const NSW_API_KEY = process.env.NSW_API_KEY;
  const tryParams = async (extra) => {
    const params = new URLSearchParams({ outputFormat: 'rapidJSON', coordOutputFormat: 'EPSG:4326', name_sf: q, ...extra });
    const r = await fetch(`https://api.transport.nsw.gov.au/v1/tp/stop_finder?${params}`, { headers: { Authorization: `apikey ${NSW_API_KEY}` } });
    const data = await r.json();
    const locs = data.locations || [];
    return { count: locs.length, types: [...new Set(locs.map(l => l.type))], sample: locs.slice(0, 2).map(l => ({ id: l.id, name: l.name, type: l.type })) };
  };
  res.json({
    'type_sf=any':      await tryParams({ type_sf: 'any' }),
    'type_sf=stop':     await tryParams({ type_sf: 'stop' }),
    'type_sf=any+TfNSWSF': await tryParams({ type_sf: 'any', TfNSWSF: 'true' }),
    'type_sf=stop+TfNSWSF': await tryParams({ type_sf: 'stop', TfNSWSF: 'true' }),
  });
});

// Debug: raw NSW trip response
router.get('/debug/trip-raw', async (req, res) => {
  const { from, to } = req.query;
  if (!from || !to) return res.status(400).json({ error: 'from and to required' });
  const NSW_API_KEY = process.env.NSW_API_KEY;
  const parts = new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Sydney', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date());
  const gp = t => parts.find(p => p.type === t)?.value || '';
  const date = `${gp('year')}${gp('month')}${gp('day')}`;
  const time = `${gp('hour').replace('24','00')}${gp('minute')}`;
  const params = new URLSearchParams({ outputFormat: 'rapidJSON', TfNSWTR: 'true', coordOutputFormat: 'EPSG:4326', depArrMacro: 'dep', itdDate: date, itdTime: time, type_origin: 'stop', name_origin: from, type_destination: 'stop', name_destination: to, calcNumberOfTrips: '3' });
  const r = await fetch(`https://api.transport.nsw.gov.au/v1/tp/trip?${params}`, { headers: { Authorization: `apikey ${NSW_API_KEY}` } });
  const data = await r.json();
  // Also try without TfNSWTR to see if that's the blocker
  const params2 = new URLSearchParams({ outputFormat: 'rapidJSON', coordOutputFormat: 'EPSG:4326', depArrMacro: 'dep', itdDate: date, itdTime: time, type_origin: 'stop', name_origin: from, type_destination: 'stop', name_destination: to, calcNumberOfTrips: '3' });
  const r2 = await fetch(`https://api.transport.nsw.gov.au/v1/tp/trip?${params2}`, { headers: { Authorization: `apikey ${NSW_API_KEY}` } });
  const data2 = await r2.json();
  res.json({ withTfNSWTR: { keys: Object.keys(data), journeys: data.journeys?.length, systemMessages: data.systemMessages }, withoutTfNSWTR: { keys: Object.keys(data2), journeys: data2.journeys?.length, systemMessages: data2.systemMessages }, date, time });
});

// Plan trips between two stops
router.get('/trips', async (req, res) => {
  const { from, to, parentId } = req.query;
  if (!from || !to) return res.status(400).json({ error: 'from and to required' });
  try {
    const prefs = parentId ? await fetchChildPrefs(parentId) : null;
    const allowedModes = prefs?.allowed_modes?.length ? prefs.allowed_modes.map(Number) : null;
    let trips = await planTrip(from, to, allowedModes);
    if (!trips.length) console.warn(`[trips] no results for from=${from} to=${to}`);
    if (prefs) trips = scoreAndRankTrips(trips, prefs, null, null, null);
    if (allowedModes?.length) trips = filterTripsByMode(trips, allowedModes);

    // If mode-filtered and empty, retry without restriction and return alternatives
    if (!trips.length && allowedModes?.length) {
      const altTrips = await planTrip(from, to, null);
      if (altTrips.length) {
        return res.json({ trips: altTrips, modesFiltered: true, filteredModeLabels: allowedModeLabels(allowedModes) });
      }
    }
    res.json(trips);
  } catch (e) {
    console.error('[trips] error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// Plan trips from GPS coordinates to a destination stop ID or coordinate
router.get('/trips/from-coord', async (req, res) => {
  const { lat, lon, to, toLat, toLon, parentId } = req.query;
  if (!lat || !lon) return res.status(400).json({ error: 'lat and lon required' });
  try {
    const prefs = parentId ? await fetchChildPrefs(parentId) : null;
    const allowedModes = prefs?.allowed_modes?.length ? prefs.allowed_modes.map(Number) : null;
    let trips;
    if (toLat && toLon) {
      trips = await planTripFromCoordToCoord(parseFloat(lat), parseFloat(lon), parseFloat(toLat), parseFloat(toLon), allowedModes);
    } else if (to) {
      trips = await planTripFromCoord(parseFloat(lat), parseFloat(lon), to, allowedModes);
    } else {
      return res.status(400).json({ error: 'either to (stop ID) or toLat+toLon required' });
    }
    if (prefs) {
      const childLat  = parseFloat(lat);
      const childLon  = parseFloat(lon);
      const destCoord = (toLat && toLon) ? [parseFloat(toLat), parseFloat(toLon)] : null;
      trips = scoreAndRankTrips(trips, prefs, childLat, childLon, destCoord);
    }
    if (allowedModes?.length) trips = filterTripsByMode(trips, allowedModes);

    // If mode-filtered and empty, retry without restriction and return alternatives
    if (!trips.length && allowedModes?.length) {
      let altTrips;
      if (toLat && toLon) {
        altTrips = await planTripFromCoordToCoord(parseFloat(lat), parseFloat(lon), parseFloat(toLat), parseFloat(toLon), null);
      } else {
        altTrips = await planTripFromCoord(parseFloat(lat), parseFloat(lon), to, null);
      }
      if (altTrips.length) {
        return res.json({ trips: altTrips, modesFiltered: true, filteredModeLabels: allowedModeLabels(allowedModes) });
      }
    }
    res.json(trips);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Live departures from a stop (replaces GTFS-RT)
router.get('/departures', async (req, res) => {
  const { stop } = req.query;
  if (!stop) return res.status(400).json({ error: 'stop required' });
  try {
    const departures = await getDepartures(stop);
    res.json(departures);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Nearby vehicles — used by both child and parent map
router.get('/vehicles/nearby', async (req, res) => {
  const { lat, lon, parentId } = req.query;
  if (!lat || !lon) return res.status(400).json({ error: 'lat and lon required' });
  const journey   = store.getJourney(parentId);
  const activeLeg = journey?.legs?.find(l => l.mode != null);
  const mode      = activeLeg?.mode ?? 5;
  try {
    const vehicles = await getNearbyVehicles(
      parseFloat(lat), parseFloat(lon), mode, activeLeg, journey?.legs ?? []
    );
    res.json(vehicles);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Debug: probe GTFS-RT vehicle positions + compare with active journey
router.get('/debug/gtfs-probe', async (req, res) => {
  try {
    const samples = await sampleVehicles(10);
    const journey = store.getJourney(req.query.parentId);
    const activeLeg = journey?.legs?.find(l => l.tripCode || l.routeId);
    res.json({
      samples,
      activeJourney: activeLeg ? {
        tripCode: activeLeg.tripCode,
        routeId:  activeLeg.routeId,
        line:     activeLeg.line,
      } : null,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Save selected journey
router.post('/journey', (req, res) => {
  const { legs, departs, arrives, durationMin, parentId } = req.body;
  if (!legs?.length) return res.status(400).json({ error: 'legs required' });
  store.setJourney(parentId, { legs, departs, arrives, durationMin });
  res.json({ ok: true });
});

// Get active journey
router.get('/journey', (req, res) => {
  res.json(store.getJourney(req.query.parentId) || null);
});

// Parent sends destination to child's device via Supabase
router.post('/set-destination', async (req, res) => {
  const { id, name } = req.body;
  if (!id || !name) return res.status(400).json({ error: 'id and name required' });
  await supabase.from('safecommute_state').upsert({
    id: 'current',
    pending_destination_id: id,
    pending_destination_name: name,
    updated_at: new Date().toISOString(),
  });
  res.json({ ok: true });
});

// Child requests parent approval for an alternative route (when preferred modes have no trips)
router.post('/route-approval-request', (req, res) => {
  const { parentId, trip, filteredModeLabels } = req.body;
  if (!parentId || !trip) return res.status(400).json({ error: 'parentId and trip required' });
  store.setPendingRouteRequest(parentId, { trip, filteredModeLabels: filteredModeLabels || [], ts: Date.now() });
  res.json({ ok: true });
});

// Parent approves or denies the pending alternative route request
router.post('/route-approval-response', (req, res) => {
  const { parentId, approved } = req.body;
  if (!parentId || approved == null) return res.status(400).json({ error: 'parentId and approved required' });
  store.setRouteApprovalStatus(parentId, approved ? 'approved' : 'denied');
  if (!approved) store.setPendingRouteRequest(parentId, null);
  res.json({ ok: true });
});

// Child confirms the approved trip and clears the approval state
router.post('/route-approval-clear', (req, res) => {
  const { parentId } = req.body;
  store.setPendingRouteRequest(parentId, null);
  store.setRouteApprovalStatus(parentId, null);
  res.json({ ok: true });
});

// Child manually sets journey state (ON_BUS, WAITING, ARRIVED)
router.post('/state', (req, res) => {
  const { state, parentId } = req.body;
  if (!['WAITING', 'AT_STOP', 'ON_BUS', 'ARRIVED'].includes(state)) return res.status(400).json({ error: 'invalid state' });
  store.setManualState(parentId, state);
  res.json({ ok: true });
});

// Receive child GPS from device
router.post('/child-location', (req, res) => {
  const { lat, lon, parentId } = req.body;
  if (lat == null || lon == null) return res.status(400).json({ error: 'lat and lon required' });
  store.setChildLocation(parentId, { lat: parseFloat(lat), lon: parseFloat(lon), ts: Date.now() });
  res.json({ ok: true });
});

module.exports = router;
