const GtfsRealtimeBindings = require('gtfs-realtime-bindings');

const NSW_API_KEY = process.env.NSW_API_KEY;
const BASE = 'https://api.transport.nsw.gov.au';

// 15-second TTL cache per feed URL
const cache = new Map();

async function fetchFeed(path) {
  const now = Date.now();
  const cached = cache.get(path);
  if (cached && now - cached.ts < 15000) return cached.feed;

  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `apikey ${NSW_API_KEY}` },
  });
  if (!res.ok) throw new Error(`GTFS-RT ${path} ${res.status}`);

  const buf = await res.arrayBuffer();
  const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(new Uint8Array(buf));
  cache.set(path, { feed, ts: now });
  return feed;
}

// mode class → vehicle position feed path
function feedPathForMode(mode) {
  if (mode === 1)               return '/v1/gtfs/vehiclepos/nswtrains';
  if (mode === 4)               return '/v1/gtfs/vehiclepos/lightrail/cbdandsoutheast';
  if (mode === 5 || mode === 7) return '/v1/gtfs/vehiclepos/buses';
  if (mode === 9)               return '/v1/gtfs/vehiclepos/ferries/sydneyferries';
  return null;
}

function tripUpdateFeedForMode(mode) {
  if (mode === 1)               return '/v1/gtfs/realtime/nswtrains';
  if (mode === 4)               return '/v1/gtfs/realtime/lightrail/cbdandsoutheast';
  if (mode === 5 || mode === 7) return '/v1/gtfs/realtime/buses';
  if (mode === 9)               return '/v1/gtfs/realtime/ferries/sydneyferries';
  return null;
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371, toR = x => x * Math.PI / 180;
  const dLat = toR(lat2 - lat1), dLon = toR(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toR(lat1)) * Math.cos(toR(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function timeToMins(hhmm) {
  const [h, m] = (hhmm || '0:0').split(':').map(Number);
  return h * 60 + (m || 0);
}

// Derive a human-readable route label from a GTFS routeId like "2507_524" → "524"
function routeLabel(routeId) {
  if (!routeId) return '?';
  const parts = routeId.split('_');
  return parts[parts.length - 1] || routeId;
}

// Return up to `limit` vehicles nearest to (lat, lon) from the given mode's feed,
// filtered to only lines that appear in the active journey's legs.
// Each vehicle: { id, lat, lon, label, routeId, isTarget }.
async function getNearbyVehicles(lat, lon, mode, activeLeg, journeyLegs, limit = 100) {
  const feedPath = feedPathForMode(mode ?? 5);
  if (!feedPath) return [];

  let feed;
  try { feed = await fetchFeed(feedPath); } catch { return []; }

  // Build a set of line names from all journey legs (e.g. ["T9", "370"])
  const journeyLines = new Set(
    (journeyLegs || [])
      .map(l => (l.line || '').trim().toUpperCase())
      .filter(Boolean)
  );

  const depMins = activeLeg?.departs
    ? (() => { const d = new Date(activeLeg.departs); return d.getHours() * 60 + d.getMinutes(); })()
    : null;
  const stopLat = activeLeg?.fromCoord?.[0];
  const stopLon = activeLeg?.fromCoord?.[1];

  const vehicles = [];

  for (const entity of feed.entity) {
    const vp = entity.vehicle;
    if (!vp?.position) continue;

    const label = routeLabel(vp.trip?.routeId);

    // Filter: only keep vehicles whose label matches one of the journey lines
    if (journeyLines.size > 0) {
      const labelUp = label.toUpperCase();
      const matches = [...journeyLines].some(
        line => labelUp === line || labelUp.includes(line) || line.includes(labelUp)
      );
      if (!matches) continue;
    }

    const vLat = vp.position.latitude;
    const vLon = vp.position.longitude;
    const dist = haversineKm(lat, lon, vLat, vLon);
    if (dist > 5) continue;

    let targetScore = Infinity;
    if (stopLat != null && depMins !== null) {
      const distToStop = haversineKm(stopLat, stopLon, vLat, vLon);
      if (vp.trip?.startTime) {
        const diff = Math.abs(timeToMins(vp.trip.startTime.slice(0, 5)) - depMins);
        if (diff <= 30) targetScore = distToStop + diff * 0.3;
      } else {
        targetScore = distToStop * 2;
      }
    }

    vehicles.push({
      id:          entity.id,
      lat:         vLat,
      lon:         vLon,
      label,
      routeId:     vp.trip?.routeId || '',
      dist,
      targetScore,
      isTarget:    false,
    });
  }

  vehicles.sort((a, b) => a.dist - b.dist);
  const closest = vehicles.slice(0, limit);

  let best = null;
  for (const v of closest) {
    if (v.targetScore < Infinity && (!best || v.targetScore < best.targetScore)) best = v;
  }
  if (best) best.isTarget = true;

  return closest.map(({ dist, targetScore, ...v }) => v);
}

// Get delay in seconds for the active leg (best-effort, matched by start time).
async function getDelayForJourney(leg) {
  const feedPath = tripUpdateFeedForMode(leg.mode);
  if (!feedPath) return null;

  const depDate = leg.departs ? new Date(leg.departs) : null;
  const depMins = depDate ? depDate.getHours() * 60 + depDate.getMinutes() : null;

  let feed;
  try { feed = await fetchFeed(feedPath); } catch { return null; }

  let bestDelay = null, bestScore = Infinity;
  for (const entity of feed.entity) {
    const tu = entity.tripUpdate;
    if (!tu?.stopTimeUpdate?.length) continue;
    if (!tu.trip?.startTime || depMins === null) continue;

    const diff = Math.abs(timeToMins(tu.trip.startTime.slice(0, 5)) - depMins);
    if (diff > 30 || diff >= bestScore) continue;

    const stu = tu.stopTimeUpdate[0];
    const delay = stu?.arrival?.delay ?? stu?.departure?.delay ?? null;
    if (delay !== null) { bestScore = diff; bestDelay = delay; }
  }
  return bestDelay;
}

// Debug: sample first N vehicle entities from the buses feed
async function sampleVehicles(n = 10) {
  const feed = await fetchFeed('/v1/gtfs/vehiclepos/buses');
  return feed.entity.slice(0, n).map(e => ({
    id: e.id,
    tripId: e.vehicle?.trip?.tripId,
    routeId: e.vehicle?.trip?.routeId,
    startTime: e.vehicle?.trip?.startTime,
    lat: e.vehicle?.position?.latitude,
    lon: e.vehicle?.position?.longitude,
  }));
}

module.exports = { getNearbyVehicles, getDelayForJourney, sampleVehicles };
