const GtfsRealtimeBindings = require('gtfs-realtime-bindings');

const NSW_API_KEY = process.env.NSW_API_KEY;
const BASE = 'https://api.transport.nsw.gov.au';

// 15-second TTL cache for each feed URL
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

// Find vehicle position for a given tripCode (matches against trip_id and route_id)
async function getVehiclePosition(tripCode, routeId) {
  const feed = await fetchFeed('/v1/gtfs/vehiclepos/buses');
  for (const entity of feed.entity) {
    const vp = entity.vehicle;
    if (!vp?.position) continue;
    const tid = vp.trip?.tripId;
    const rid = vp.trip?.routeId;
    if ((tripCode && tid === tripCode) || (routeId && rid === routeId)) {
      return {
        lat: vp.position.latitude,
        lon: vp.position.longitude,
        tripId: tid,
        routeId: rid,
      };
    }
  }
  return null;
}

// Get delay (seconds) for the next upcoming stop on a trip
async function getTripDelay(tripCode, routeId) {
  const feed = await fetchFeed('/v1/gtfs/realtime/buses');
  for (const entity of feed.entity) {
    const tu = entity.tripUpdate;
    if (!tu) continue;
    const tid = tu.trip?.tripId;
    const rid = tu.trip?.routeId;
    if ((tripCode && tid === tripCode) || (routeId && rid === routeId)) {
      // Find the first future stop time update with a delay
      for (const stu of (tu.stopTimeUpdate || [])) {
        const delay = stu.arrival?.delay ?? stu.departure?.delay;
        if (delay != null) return delay;
      }
    }
  }
  return null;
}

// Debug: sample first N vehicle entities from the feed
async function sampleVehicles(n = 5) {
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

module.exports = { getVehiclePosition, getTripDelay, sampleVehicles };
