const WALK_SPEED_MPS = { slow: 1.0, normal: 1.33, fast: 1.67 };

function haversineM([lat1, lon1], [lat2, lon2]) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Score and re-rank trips based on child preferences.
 * All factors contribute on the same 0–200 pt scale so no single one dominates.
 * Starts from 1000 so scores stay positive and easy to reason about.
 */
function scoreAndRankTrips(trips, prefs, childLat, childLon, destCoord) {
  if (!trips?.length) return trips;

  const walkSpeed   = prefs.walking_speed    || 'normal';
  const familiarity = prefs.familiarity_level || 'beginner';
  const transferTol = prefs.transfer_tolerance ?? 1;
  const walkTolM    = prefs.walk_tolerance_m  ?? 500;
  const bufferMins  = prefs.buffer_minutes    ?? 5;
  const speedMps    = WALK_SPEED_MPS[walkSpeed] || 1.33;

  const scored = trips.map(trip => {
    const firstLeg = trip.legs?.[0];
    const lastLeg  = trip.legs?.[trip.legs.length - 1];
    let score = 1000;

    // ── Hard filter: walk tolerance — both ends ───────────────────────────
    let walkToStop = 0;
    if (childLat != null && childLon != null && firstLeg?.fromCoord?.length === 2) {
      walkToStop = haversineM([childLat, childLon], firstLeg.fromCoord);
      if (walkToStop > walkTolM) return { trip, score: -Infinity };
    }

    let walkFromStop = 0;
    if (destCoord?.length === 2 && lastLeg?.toCoord?.length === 2) {
      walkFromStop = haversineM(lastLeg.toCoord, destCoord);
      if (walkFromStop > walkTolM) return { trip, score: -Infinity };
    }

    const changes = trip.changes ?? 0;

    // ── Transfers — cost scaled by tolerance (0–200 per change) ──────────
    const transferCost = [200, 75, 25][transferTol] ?? 75;
    score -= changes * transferCost;

    // ── Familiarity — direct-route bonus + trip duration weight ───────────
    const directBonus  = { beginner: 150, intermediate: 75, experienced: 0 }[familiarity] ?? 75;
    const durationCost = { beginner: 2.5, intermediate: 1.5, experienced: 0.75 }[familiarity] ?? 1.5;
    if (changes === 0) score += directBonus;
    score -= (trip.durationMin ?? 45) * durationCost;

    // ── Buffer — proportional to how much slack remains ───────────────────
    if (trip.departs) {
      const walkSecs  = walkToStop / speedMps;
      const secsUntil = (new Date(trip.departs) - Date.now()) / 1000;
      const slack     = secsUntil - walkSecs - bufferMins * 60;
      if (slack < 0)        score -= 500; // would miss it
      else if (slack < 60)  score -= 200; // dangerously tight
      else if (slack < 180) score -= 75;  // a bit tight
    }

    // ── Walk distance — proportional to tolerance (0–200) ─────────────────
    const walkFraction = (walkToStop + walkFromStop) / Math.max(walkTolM * 2, 1);
    score -= walkFraction * 200;

    return { trip, score };
  });

  return scored.sort((a, b) => b.score - a.score).map(s => s.trip);
}

module.exports = { scoreAndRankTrips };
