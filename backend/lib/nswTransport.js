const NSW_API_KEY = process.env.NSW_API_KEY;
const BASE = 'https://api.transport.nsw.gov.au';

function nswHeaders() {
  return { Authorization: `apikey ${NSW_API_KEY}` };
}

function sydneyNow() {
  return new Date(new Date().toLocaleString('en-AU', { timeZone: 'Australia/Sydney' }));
}

function formatDate(d) {
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}

function formatTime(d) {
  return `${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}`;
}

function pickTime(planned, estimated) {
  return estimated || planned;
}

async function nswFetch(endpoint, params) {
  const url = `${BASE}/v1/tp/${endpoint}?${params}`;
  const res = await fetch(url, { headers: nswHeaders() });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`NSW API ${endpoint} ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

// Search stops by name — returns up to 6 results
async function searchStops(query) {
  const params = new URLSearchParams({
    outputFormat: 'rapidJSON',
    TfNSWSF: 'true',
    type_sf: 'any',
    name_sf: query,
    coordOutputFormat: 'EPSG:4326',
    anyObjFilter_sf: '2',
    odvSugMacro: '1',
  });
  const data = await nswFetch('stop_finder', params);
  return (data.locations || []).slice(0, 6).map(loc => ({
    id: loc.id,
    name: loc.disassembledName || loc.name,
    type: loc.type,
    coord: loc.coord,
  }));
}

// Find nearby stops by GPS coordinate — lon:lat format required by API
async function nearbyStops(lat, lon) {
  const params = new URLSearchParams({
    outputFormat: 'rapidJSON',
    TfNSWSF: 'true',
    type_sf: 'coord',
    name_sf: `${lon}:${lat}:EPSG:4326`,
    coordOutputFormat: 'EPSG:4326',
    anyObjFilter_sf: '2',
    odvSugMacro: '1',
  });
  const data = await nswFetch('stop_finder', params);
  return (data.locations || []).slice(0, 5).map(loc => ({
    id: loc.id,
    name: loc.disassembledName || loc.name,
    type: loc.type,
    coord: loc.coord,
  }));
}

// Plan trip between two stop IDs
async function planTrip(originId, destinationId) {
  const now = sydneyNow();
  const params = new URLSearchParams({
    outputFormat: 'rapidJSON',
    TfNSWTR: 'true',
    coordOutputFormat: 'EPSG:4326',
    depArrMacro: 'dep',
    itdDate: formatDate(now),
    itdTime: formatTime(now),
    type_origin: 'stop',
    name_origin: originId,
    type_destination: 'stop',
    name_destination: destinationId,
    calcNumberOfTrips: '5',
  });
  const data = await nswFetch('trip', params);
  return parseJourneys(data);
}

// Plan trip from a GPS coordinate to a destination stop ID
async function planTripFromCoord(lat, lon, destinationId) {
  const now = sydneyNow();
  const params = new URLSearchParams({
    outputFormat: 'rapidJSON',
    TfNSWTR: 'true',
    coordOutputFormat: 'EPSG:4326',
    depArrMacro: 'dep',
    itdDate: formatDate(now),
    itdTime: formatTime(now),
    type_origin: 'coord',
    name_origin: `${lon}:${lat}:EPSG:4326`,
    type_destination: 'stop',
    name_destination: destinationId,
    calcNumberOfTrips: '5',
  });
  const data = await nswFetch('trip', params);
  return parseJourneys(data);
}

function parseJourneys(data) {
  return (data.journeys || []).map(journey => {
    // Filter out walk-only legs (class 99/100) for display, but keep for calculation
    const legs = (journey.legs || []).filter(
      l => l.transportation?.product?.class !== 99 && l.transportation?.product?.class !== 100
    );
    if (!legs.length) return null;

    const first = legs[0];
    const last  = legs[legs.length - 1];

    // Prefer real-time estimated times over planned
    const deptTime = pickTime(first.origin?.departureTimePlanned, first.origin?.departureTimeEstimated);
    const arrTime  = pickTime(last.destination?.arrivalTimePlanned, last.destination?.arrivalTimeEstimated);

    const deptMs      = deptTime ? new Date(deptTime).getTime() : 0;
    const arrMs       = arrTime  ? new Date(arrTime).getTime()  : 0;
    const durationMin = Math.round((arrMs - deptMs) / 60000);

    return {
      departs:     deptTime,
      arrives:     arrTime,
      durationMin,
      changes:     legs.length - 1,
      legs: legs.map(leg => ({
        mode:     leg.transportation?.product?.class,
        line:     leg.transportation?.disassembledName || leg.transportation?.number || '',
        tripCode: leg.transportation?.properties?.tripCode,
        routeId:  leg.transportation?.id,
        from:     leg.origin?.name,
        to:       leg.destination?.name,
        departs:  pickTime(leg.origin?.departureTimePlanned, leg.origin?.departureTimeEstimated),
        arrives:  pickTime(leg.destination?.arrivalTimePlanned, leg.destination?.arrivalTimeEstimated),
        stopSequence: leg.stopSequence || [],
        coords:   leg.coords || [],
      })),
    };
  }).filter(Boolean);
}

// Get live departures from a stop — replaces GTFS-RT vehicle tracking
async function getDepartures(stopId) {
  const params = new URLSearchParams({
    outputFormat: 'rapidJSON',
    TfNSWDM: 'true',
    coordOutputFormat: 'EPSG:4326',
    mode: 'direct',
    type_dm: 'stop',
    name_dm: stopId,
    departureMonitorMacro: '1',
    maxAssignedStops: '1',
  });
  const data = await nswFetch('departure_mon', params);

  return (data.stopEvents || []).slice(0, 10).map(ev => ({
    line:       ev.transportation?.disassembledName || ev.transportation?.number || '',
    direction:  ev.transportation?.destination?.name || '',
    tripCode:   ev.transportation?.properties?.tripCode,
    routeId:    ev.transportation?.id,
    mode:       ev.transportation?.product?.class,
    departs:    pickTime(ev.departureTimePlanned, ev.departureTimeEstimated),
    isRealTime: !!ev.departureTimeEstimated,
  }));
}

module.exports = { searchStops, nearbyStops, planTrip, planTripFromCoord, getDepartures };
