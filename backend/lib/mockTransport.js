const ROUTE_STOPS = [
  { name: 'Central Station', lat: -33.8830, lon: 151.2063 },
  { name: 'Museum', lat: -33.8767, lon: 151.2096 },
  { name: 'St James', lat: -33.8716, lon: 151.2114 },
  { name: 'Circular Quay', lat: -33.8613, lon: 151.2102 },
  { name: 'Kings Cross', lat: -33.8752, lon: 151.2223 },
  { name: 'Edgecliff', lat: -33.8790, lon: 151.2359 },
  { name: 'Bondi Junction', lat: -33.8915, lon: 151.2474 },
];
const LOOP_SECONDS = 420;

function getBusPosition() {
  const nowSeconds = Date.now() / 1000;
  const loopProgress = (nowSeconds % LOOP_SECONDS) / LOOP_SECONDS;
  const totalSegments = ROUTE_STOPS.length - 1;
  const scaledPos = loopProgress * totalSegments;
  const segmentIndex = Math.min(Math.floor(scaledPos), totalSegments - 1);
  const progress = scaledPos - segmentIndex;

  const from = ROUTE_STOPS[segmentIndex];
  const to = ROUTE_STOPS[segmentIndex + 1];
  const lat = from.lat + (to.lat - from.lat) * progress;
  const lon = from.lon + (to.lon - from.lon) * progress;

  return {
    lat,
    lon,
    speed: 30,
    segment_index: segmentIndex,
    progress,
  };
}

function noise() {
  return (Math.random() - 0.5) * 0.0004; // ±0.0002 degrees
}

function getChildPosition(phase) {
  if (phase === 'on_bus') {
    const bus = getBusPosition();
    return { lat: bus.lat + noise(), lon: bus.lon + noise() };
  }
  // waiting: child at Central Station
  const stop = ROUTE_STOPS[0];
  return { lat: stop.lat + noise(), lon: stop.lon + noise() };
}

module.exports = { getBusPosition, getChildPosition, ROUTE_STOPS, LOOP_SECONDS };
