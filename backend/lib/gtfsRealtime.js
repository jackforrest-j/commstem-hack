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
// mode 1=train, 4=lightrail, 5/7=bus, 9=ferry
function feedPathForMode(mode) {
  if (mode === 1)            return '/v1/gtfs/vehiclepos/nswtrains';
  if (mode === 4)            return '/v1/gtfs/vehiclepos/lightrail/cbdandsoutheast';
  if (mode === 5 || mode === 7) return '/v1/gtfs/vehiclepos/buses';
  if (mode === 9)            return '/v1/gtfs/vehiclepos/ferries/sydneyferries';
  return null;
}

function tripUpdateFeedForMode(mode) {
  if (mode === 1)            return '/v1/gtfs/realtime/nswtrains';
  if (mode === 4)            return '/v1/gtfs/realtime/lightrail/cbdandsoutheast';
  if (mode === 5 || mode === 7) return '/v1/gtfs/realtime/buses';
  if (mode === 9)            return '/v1/gtfs/realtime/ferries/sydneyferries';
  return null;
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371, toR = x => x * Math.PI / 180;
  const dLat = toR(lat2 - lat1), dLon = toR(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toR(lat1)) * Math.cos(toR(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function timeToMins(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

// Find the vehicle closest to the boarding stop with a matching departure time window.
// Strategy: score = distance_km + timeDiff_mins * 0.3 → pick lowest score within limits.
async function getVehicleForJourney(leg) {
  const feedPath = feedPathForMode(leg.mode);
  if (!feedPath) return null;

  const fromCoord = leg.fromCoord; // [lat, lon]
  if (!fromCoord) return null;
  const [stopLat, stopLon] = fromCoord;

  // Scheduled departure as HH:MM
  const depDate = leg.departs ? new Date(leg.departs) : null;
  const depMins = depDate
    ? depDate.getHours() * 60 + depDate.getMinutes()
    : null;

  let feed;
  try { feed = await fetchFeed(feedPath); } catch { return null; }

  let best = null, bestScore = Infinity;
  for (const entity of feed.entity) {
    const vp = entity.vehicle;
    if (!vp?.position) continue;

    const dist = haversineKm(stopLat, stopLon, vp.position.latitude, vp.position.longitude);
    if (dist > 10) continue; // ignore vehicles more than 10 km away

    let timePenalty = 0;
    if (depMins !== null && vp.trip?.startTime) {
      const startMins = timeToMins(vp.trip.startTime.slice(0, 5));
      const diff = Math.abs(startMins - depMins);
      if (diff > 30) continue; // departure time too different
      timePenalty = diff * 0.3;
    }

    const score = dist + timePenalty;
    if (score < bestScore) {
      bestScore = score;
      best = {
        lat: vp.position.latitude,
        lon: vp.position.longitude,
        tripId: vp.trip?.tripId,
        routeId: vp.trip?.routeId,
      };
    }
  }
  return best;
}

// Get delay in seconds for a trip, matched by proximity + start time (same strategy).
async function getDelayForJourney(leg) {
  const feedPath = tripUpdateFeedForMode(leg.mode);
  if (!feedPath) return null;

  const fromCoord = leg.fromCoord;
  const depDate = leg.departs ? new Date(leg.departs) : null;
  const depMins = depDate ? depDate.getHours() * 60 + depDate.getMinutes() : null;

  let feed;
  try { feed = await fetchFeed(feedPath); } catch { return null; }

  // Find the best-matching trip update
  let bestDelay = null, bestScore = Infinity;
  for (const entity of feed.entity) {
    const tu = entity.tripUpdate;
    if (!tu?.stopTimeUpdate?.length) continue;

    let timePenalty = 999;
    if (depMins !== null && tu.trip?.startTime) {
      const diff = Math.abs(timeToMins(tu.trip.startTime.slice(0, 5)) - depMins);
      if (diff > 30) continue;
      timePenalty = diff;
    }

    if (timePenalty < bestScore) {
      const stu = tu.stopTimeUpdate[0];
      const delay = stu?.arrival?.delay ?? stu?.departure?.delay ?? null;
      if (delay !== null) {
        bestScore = timePenalty;
        bestDelay = delay;
      }
    }
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

module.exports = { getVehicleForJourney, getDelayForJourney, sampleVehicles };
