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
 * Falls back to original list if all trips are filtered out.
 *
 * @param {object[]} trips
 * @param {object}   prefs   - child row from DB (walking_speed, familiarity_level, etc.)
 * @param {number}   childLat
 * @param {number}   childLon
 * @param {number[]|null} destCoord - [lat, lon] of final destination (null = skip end-walk check)
 */
function scoreAndRankTrips(trips, prefs, childLat, childLon, destCoord) {
  if (!trips?.length) return trips;

  const walkSpeed   = prefs.walking_speed   || 'normal';
  const familiarity = prefs.familiarity_level || 'beginner';
  const transferTol = prefs.transfer_tolerance ?? 1;
  const walkTolM    = prefs.walk_tolerance_m  ?? 500;
  const bufferMins  = prefs.buffer_minutes     ?? 5;
  // Normalise to numbers — Supabase int[] can come back as strings
  const allowedModes = prefs.allowed_modes?.length
    ? prefs.allowed_modes.map(Number)
    : null;
  const speedMps = WALK_SPEED_MPS[walkSpeed] || 1.33;

  const scored = trips.map(trip => {
    const firstLeg = trip.legs?.[0];
    const lastLeg  = trip.legs?.[trip.legs.length - 1];
    let score = 0;

    // ── Hard filter: mode block ───────────────────────────────────────────
    if (allowedModes && trip.legs) {
      for (const leg of trip.legs) {
        const legMode = leg.mode != null ? Number(leg.mode) : null;
        if (legMode != null && !allowedModes.includes(legMode)) {
          score = -Infinity;
          break;
        }
      }
    }

    if (score === -Infinity) return { trip, score };

    // ── Hard filter: walk tolerance — both ends ───────────────────────────
    let walkToStop = 0;
    if (childLat != null && childLon != null && firstLeg?.fromCoord?.length === 2) {
      walkToStop = haversineM([childLat, childLon], firstLeg.fromCoord);
      if (walkToStop > walkTolM) { return { trip, score: -Infinity }; }
    }

    let walkFromStop = 0;
    if (destCoord?.length === 2 && lastLeg?.toCoord?.length === 2) {
      walkFromStop = haversineM(lastLeg.toCoord, destCoord);
      if (walkFromStop > walkTolM) { return { trip, score: -Infinity }; }
    }

    // ── Soft: transfer penalty ────────────────────────────────────────────
    const changes = trip.changes ?? 0;
    score -= changes * (3 - transferTol) * 25;

    // ── Soft: buffer penalty ──────────────────────────────────────────────
    if (trip.departs) {
      const walkSecs  = walkToStop / speedMps;
      const secsUntil = (new Date(trip.departs) - Date.now()) / 1000;
      if (secsUntil < walkSecs + bufferMins * 60) score -= 300;
    }

    // ── Soft: familiarity bonus ───────────────────────────────────────────
    if (familiarity === 'beginner' && changes === 0) score += 50;
    if (familiarity === 'experienced') score += Math.max(0, 60 - (trip.durationMin ?? 60));

    // ── Soft: walk distance penalty ───────────────────────────────────────
    score -= (walkToStop + walkFromStop) * 0.03;

    return { trip, score };
  });

  const valid = scored.filter(s => s.score !== -Infinity);
  if (!valid.length) return []; // hard filters win — nothing passes
  return valid.sort((a, b) => b.score - a.score).map(s => s.trip);
}

module.exports = { scoreAndRankTrips };
