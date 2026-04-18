function haversineMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Earth radius in metres
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function nearestStopName(lat, lon, stops) {
  let name = stops[0].name;
  let minDist = Infinity;
  for (const stop of stops) {
    const d = haversineMeters(lat, lon, stop.lat, stop.lon);
    if (d < minDist) { minDist = d; name = stop.name; }
  }
  return name;
}

function getJourneyState(child, vehicle, stops) {
  if (haversineMeters(child.lat, child.lon, vehicle.lat, vehicle.lon) <= 40) {
    return { state: 'ON_BUS', nearest_stop: nearestStopName(vehicle.lat, vehicle.lon, stops) };
  }
  return { state: 'WAITING', nearest_stop: nearestStopName(child.lat, child.lon, stops) };
}

module.exports = { getJourneyState, haversineMeters };
