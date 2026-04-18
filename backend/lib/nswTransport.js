const { transit_realtime } = require('gtfs-realtime-bindings');

const NSW_API_KEY = process.env.NSW_API_KEY;
const BASE = 'https://api.transport.nsw.gov.au';

function nswHeaders() {
  return { Authorization: `apikey ${NSW_API_KEY}` };
}

async function searchStops(query) {
  const params = new URLSearchParams({
    outputFormat: 'rapidJSON',
    type_sf: 'stop',
    name_sf: query,
    coordOutputFormat: 'EPSG:4326',
    anyObjFilter_sf: '2',
  });
  const res = await fetch(`${BASE}/v1/tp/stop_finder?${params}`, { headers: nswHeaders() });
  const data = await res.json();
  return (data.locations || []).slice(0, 6).map(loc => ({
    id: loc.id,
    name: loc.disassembledName || loc.name,
    type: loc.type,
  }));
}

async function nearbyStops(lat, lon) {
  // NSW stop_finder accepts coord type: name_sf = lon:lat:EPSG:4326
  const params = new URLSearchParams({
    outputFormat: 'rapidJSON',
    type_sf: 'coord',
    name_sf: `${lon}:${lat}:EPSG:4326`,
    coordOutputFormat: 'EPSG:4326',
    anyObjFilter_sf: '2',
    SpEncId: '0',
  });
  const res = await fetch(`${BASE}/v1/tp/stop_finder?${params}`, { headers: nswHeaders() });
  const data = await res.json();
  return (data.locations || []).slice(0, 3).map(loc => ({
    id: loc.id,
    name: loc.disassembledName || loc.name,
    type: loc.type,
  }));
}

async function planTrip(originId, destinationId) {
  const now = new Date(new Date().toLocaleString('en-AU', { timeZone: 'Australia/Sydney' }));
  const date = now.toISOString().slice(0, 10).replace(/-/g, '');
  const time = `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;

  const params = new URLSearchParams({
    outputFormat: 'rapidJSON',
    coordOutputFormat: 'EPSG:4326',
    depArrMacro: 'dep',
    itdDate: date,
    itdTime: time,
    type_origin: 'stop',
    name_origin: originId,
    type_destination: 'stop',
    name_destination: destinationId,
    calcNumberOfTrips: '5',
  });
  const res = await fetch(`${BASE}/v1/tp/trip?${params}`, { headers: nswHeaders() });
  const data = await res.json();

  return (data.journeys || []).map(journey => {
    const legs = (journey.legs || []).filter(l => l.transportation?.product?.class !== 99 && l.transportation?.product?.class !== 100);
    if (!legs.length) return null;
    const first = legs[0];
    const last  = legs[legs.length - 1];
    const deptTime = first.origin?.departureTimePlanned;
    const arrTime  = last.destination?.arrivalTimePlanned;
    const deptMs   = deptTime ? new Date(deptTime).getTime() : 0;
    const arrMs    = arrTime  ? new Date(arrTime).getTime()  : 0;
    const durationMin = Math.round((arrMs - deptMs) / 60000);
    return {
      legs: legs.map(leg => ({
        mode:      leg.transportation?.product?.class,
        line:      leg.transportation?.disassembledName || leg.transportation?.number || '',
        tripCode:  leg.transportation?.properties?.tripCode,
        routeId:   leg.transportation?.id,
        from:      leg.origin?.name,
        to:        leg.destination?.name,
        fromCoord: leg.origin?.coord,
        departs:   leg.origin?.departureTimePlanned,
        arrives:   leg.destination?.arrivalTimePlanned,
      })),
      departs:     deptTime,
      arrives:     arrTime,
      durationMin,
      changes:     legs.length - 1,
    };
  }).filter(Boolean);
}

// Cache vehicles for 30s to avoid hammering the API
const vehicleCache = {};

async function getVehiclesForFeed(feed) {
  const now = Date.now();
  if (vehicleCache[feed] && now - vehicleCache[feed].ts < 30000) {
    return vehicleCache[feed].data;
  }
  try {
    const res = await fetch(`${BASE}/v2/gtfs/realtime/${feed}`, { headers: nswHeaders() });
    if (!res.ok) return [];
    const buf  = Buffer.from(await res.arrayBuffer());
    const msg  = transit_realtime.FeedMessage.decode(buf);
    const vehicles = msg.entity
      .filter(e => e.vehicle?.position)
      .map(e => ({
        tripId:  e.vehicle.trip?.tripId,
        routeId: e.vehicle.trip?.routeId,
        lat:     e.vehicle.position.latitude,
        lon:     e.vehicle.position.longitude,
        speed:   e.vehicle.position.speed || 0,
      }));
    vehicleCache[feed] = { ts: now, data: vehicles };
    return vehicles;
  } catch { return []; }
}

async function findVehicle(tripCode, routeId) {
  for (const feed of ['buses', 'sydneytrains', 'lightrail', 'ferries', 'nswtrains']) {
    const vehicles = await getVehiclesForFeed(feed);

    // Try exact tripCode match first
    const byTrip = vehicles.find(v => v.tripId === tripCode);
    if (byTrip) return byTrip;

    // Fall back to route match — pick first vehicle on this route
    if (routeId) {
      const byRoute = vehicles.find(v => v.routeId && routeId && v.routeId.startsWith(routeId.split('_')[0]));
      if (byRoute) return byRoute;
    }
  }
  return null;
}

module.exports = { searchStops, nearbyStops, planTrip, findVehicle };
