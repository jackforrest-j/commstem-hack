const NSW_API_KEY = process.env.NSW_API_KEY;
const BASE = 'https://api.transport.nsw.gov.au';

function nswHeaders() {
  return { Authorization: `apikey ${NSW_API_KEY}` };
}

function sydneyDateTime() {
  const parts = new Intl.DateTimeFormat('en-AU', {
    timeZone: 'Australia/Sydney',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date());
  const get = t => parts.find(p => p.type === t)?.value || '';
  return {
    date: `${get('year')}${get('month')}${get('day')}`,
    time: `${get('hour').replace('24', '00')}${get('minute')}`,
  };
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
    type_sf: 'any',
    name_sf: query,
    coordOutputFormat: 'EPSG:4326',
  });
  const data = await nswFetch('stop_finder', params);
  return (data.locations || [])
    .filter(loc => loc.type === 'stop')
    .slice(0, 6)
    .map(loc => ({
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
    type_sf: 'coord',
    name_sf: `${lon}:${lat}:EPSG:4326`,
    coordOutputFormat: 'EPSG:4326',
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
// Build inclMOT_X params from an allowed product-class array.
// NSW EFA numbering: 0=train, 1=suburban, 2=metro, 3=urban rail,
// 4=tram, 5=bus, 6=coach, 7=ferry, 8=cable, 9=gondola, 10=funicular,
// 11=shared taxi, 12=school bus
function buildModeParams(allowedModes) {
  if (!allowedModes?.length) return {}; // null/empty = all modes, no restriction

  // Map our product-class groups to the MOT indices they cover
  const CLASS_TO_MOT = {
    1:  [0, 1, 3], // Sydney Trains / heavy rail
    2:  [0, 1, 3], // TrainLink (intercity)
    11: [2],       // Sydney Metro
    4:  [4],       // Light Rail
    5:  [5],       // Bus
    7:  [6],       // Coach
    10: [5, 12],   // School Bus
    9:  [7],       // Ferry
  };

  const enabled = new Set();
  for (const cls of allowedModes) {
    for (const mot of (CLASS_TO_MOT[cls] || [])) enabled.add(mot);
  }

  const out = {};
  for (let i = 0; i <= 12; i++) {
    out[`inclMOT_${i}`] = enabled.has(i) ? '1' : '0';
  }
  return out;
}

async function planTrip(originId, destinationId, allowedModes) {
  const { date, time } = sydneyDateTime();
  const params = new URLSearchParams({
    outputFormat: 'rapidJSON',
    TfNSWTR: 'true',
    coordOutputFormat: 'EPSG:4326',
    depArrMacro: 'dep',
    itdDate: date,
    itdTime: time,
    type_origin: 'stop',
    name_origin: originId,
    type_destination: 'stop',
    name_destination: destinationId,
    calcNumberOfTrips: '5',
    ...buildModeParams(allowedModes),
  });
  const data = await nswFetch('trip', params);
  return parseJourneys(data);
}

// Plan trip from a GPS coordinate to a destination stop ID
async function planTripFromCoord(lat, lon, destinationId, allowedModes) {
  const { date, time } = sydneyDateTime();
  const params = new URLSearchParams({
    outputFormat: 'rapidJSON',
    TfNSWTR: 'true',
    coordOutputFormat: 'EPSG:4326',
    depArrMacro: 'dep',
    itdDate: date,
    itdTime: time,
    type_origin: 'coord',
    name_origin: `${lon}:${lat}:EPSG:4326`,
    type_destination: 'stop',
    name_destination: destinationId,
    calcNumberOfTrips: '5',
    ...buildModeParams(allowedModes),
  });
  const data = await nswFetch('trip', params);
  return parseJourneys(data);
}

// Plan trip from a GPS coordinate to a destination coordinate (address)
async function planTripFromCoordToCoord(fromLat, fromLon, toLat, toLon, allowedModes) {
  const { date, time } = sydneyDateTime();
  const params = new URLSearchParams({
    outputFormat: 'rapidJSON',
    TfNSWTR: 'true',
    coordOutputFormat: 'EPSG:4326',
    depArrMacro: 'dep',
    itdDate: date,
    itdTime: time,
    type_origin: 'coord',
    name_origin: `${fromLon}:${fromLat}:EPSG:4326`,
    type_destination: 'coord',
    name_destination: `${toLon}:${toLat}:EPSG:4326`,
    calcNumberOfTrips: '5',
    ...buildModeParams(allowedModes),
  });
  const data = await nswFetch('trip', params);
  return parseJourneys(data);
}

function parseJourneys(data) {
  if (data.error || data.errorCode) {
    console.error('[NSW trip] API error:', data.error || data.errorCode, data.errorText);
  }
  if (!data.journeys?.length) {
    console.warn('[NSW trip] no journeys in response. Keys:', Object.keys(data));
  }
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
    console.log('[NSW trip] raw departureTimePlanned:', first.origin?.departureTimePlanned, '| estimated:', first.origin?.departureTimeEstimated, '| picked:', deptTime);
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
        from:         leg.origin?.name,
        fromStopId:   leg.origin?.id,
        fromCoord:    leg.origin?.coord,
        to:           leg.destination?.name,
        toStopId:     leg.destination?.id,
        toCoord:      leg.destination?.coord,
        departs:  pickTime(leg.origin?.departureTimePlanned, leg.origin?.departureTimeEstimated),
        arrives:  pickTime(leg.destination?.arrivalTimePlanned, leg.destination?.arrivalTimeEstimated),
        stopSequence: leg.stopSequence || [],
        coords:   leg.coords || [],
      })),
    };
  }).filter(Boolean).sort((a, b) => new Date(a.departs) - new Date(b.departs));
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

module.exports = { searchStops, nearbyStops, planTrip, planTripFromCoord, planTripFromCoordToCoord, getDepartures };
