import { useState, useRef, useEffect } from 'react';
import Map, { Marker, Source, Layer } from 'react-map-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { supabase } from '../lib/supabase';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;
const API_BASE = import.meta.env.VITE_API_URL || '';

const MODE_ICONS = { 1: '🚆', 4: '🚊', 5: '🚌', 7: '🚌', 9: '⛴️' };
const COMPASS = ['N','NE','E','SE','S','SW','W','NW'];

// Distinct bright colors for destination buttons
const DEST_COLORS = [
  { bg: 'rgba(245,158,11,0.18)', border: 'rgba(245,158,11,0.55)', glow: 'rgba(245,158,11,0.35)', text: '#F59E0B' },  // amber
  { bg: 'rgba(59,130,246,0.18)',  border: 'rgba(59,130,246,0.55)',  glow: 'rgba(59,130,246,0.35)',  text: '#60A5FA' },  // blue
  { bg: 'rgba(139,92,246,0.18)', border: 'rgba(139,92,246,0.55)', glow: 'rgba(139,92,246,0.35)', text: '#A78BFA' },  // purple
  { bg: 'rgba(236,72,153,0.18)', border: 'rgba(236,72,153,0.55)', glow: 'rgba(236,72,153,0.35)', text: '#F472B6' },  // pink
  { bg: 'rgba(16,185,129,0.18)', border: 'rgba(16,185,129,0.55)', glow: 'rgba(16,185,129,0.35)', text: '#34D399' },  // emerald
  { bg: 'rgba(249,115,22,0.18)', border: 'rgba(249,115,22,0.55)', glow: 'rgba(249,115,22,0.35)', text: '#FB923C' },  // orange
];

function haversineM(lat1, lon1, lat2, lon2) {
  const R = 6371000, toR = x => x * Math.PI / 180;
  const dLat = toR(lat2 - lat1), dLon = toR(lon2 - lon1);
  const a = Math.sin(dLat/2)**2 + Math.cos(toR(lat1)) * Math.cos(toR(lat2)) * Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function bearingTo(lat1, lon1, lat2, lon2) {
  const toR = x => x * Math.PI / 180;
  const y = Math.sin(toR(lon2-lon1)) * Math.cos(toR(lat2));
  const x = Math.cos(toR(lat1)) * Math.sin(toR(lat2)) - Math.sin(toR(lat1)) * Math.cos(toR(lat2)) * Math.cos(toR(lon2-lon1));
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

function useCountdown(isoTarget) {
  const [secs, setSecs] = useState(null);
  useEffect(() => {
    if (!isoTarget) return;
    const tick = () => setSecs(Math.round((new Date(isoTarget) - Date.now()) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [isoTarget]);
  return secs;
}

function fmtCountdown(secs) {
  if (secs == null) return '—';
  if (secs <= 0) return 'Now';
  const m = Math.floor(secs / 60), s = secs % 60;
  if (m === 0) return `${s}s`;
  return `${m}:${String(s).padStart(2,'0')}`;
}

export default function ChildView() {
  const [sharing, setSharing]           = useState(false);
  const [coords, setCoords]             = useState(null);
  const [gpsError, setGpsError]         = useState('');
  const [nearestStop, setNearestStop]   = useState(null);
  const [destination, setDestination]   = useState(null);
  const [query, setQuery]               = useState('');
  const [stopResults, setStopResults]   = useState([]);
  const [trips, setTrips]               = useState(null);
  const [loadingTrips, setLoadingTrips] = useState(false);
  const [journey, setJourney]           = useState(null);
  const [boardedState, setBoardedState] = useState(null);
  const [liveStatus, setLiveStatus]     = useState(null);
  const [vehicles, setVehicles]         = useState([]);
  const [savedDests, setSavedDests]     = useState([]);
  const [loadingDest, setLoadingDest]   = useState(null); // dest id being auto-confirmed
  const [walkRoute, setWalkRoute]       = useState(null); // GeoJSON from Mapbox Directions
  const watchRef       = useRef(null);
  const coordsRef      = useRef(null);
  const debounceRef    = useRef(null);
  const routeFetchRef  = useRef(null); // timer for debouncing route re-fetches

  const depSecs = useCountdown(journey?.departs);

  useEffect(() => {
    if (!journey) return;
    const pollStatus = () =>
      fetch(`${API_BASE}/api/safecommute/status`)
        .then(r => r.json()).then(d => setLiveStatus(d)).catch(() => {});
    pollStatus();
    const sid = setInterval(pollStatus, 10000);
    return () => clearInterval(sid);
  }, [journey]);

  useEffect(() => {
    if (!journey) return;
    const pollVehicles = () => {
      const loc = coordsRef.current;
      if (!loc) return;
      fetch(`${API_BASE}/api/safecommute/vehicles/nearby?lat=${loc.lat}&lon=${loc.lon}`)
        .then(r => r.json())
        .then(v => Array.isArray(v) && setVehicles(v))
        .catch(() => {});
    };
    pollVehicles();
    const vid = setInterval(pollVehicles, 15000);
    return () => clearInterval(vid);
  }, [journey]);

  useEffect(() => {
    supabase.from('child_destinations').select('*').order('sort_order')
      .then(({ data }) => { if (data?.length) setSavedDests(data); });
  }, []);

  // Fetch road-snapped walking route from child → boarding stop (debounced 15s)
  useEffect(() => {
    if (!journey || boardedState === 'ON_BUS' || !coords || !MAPBOX_TOKEN) {
      setWalkRoute(null);
      return;
    }
    const leg = journey.legs[0];
    const originCoord = leg?.fromCoord; // [lat, lon]
    if (!originCoord) return;

    const fetchRoute = () => {
      const [sLat, sLon] = originCoord;
      fetch(
        `https://api.mapbox.com/directions/v5/mapbox/walking/${coords.lon},${coords.lat};${sLon},${sLat}?geometries=geojson&overview=full&access_token=${MAPBOX_TOKEN}`
      )
        .then(r => r.json())
        .then(data => {
          const geom = data.routes?.[0]?.geometry;
          if (geom) setWalkRoute(geom);
        })
        .catch(() => {});
    };

    fetchRoute();
    clearInterval(routeFetchRef.current);
    routeFetchRef.current = setInterval(fetchRoute, 15000);
    return () => clearInterval(routeFetchRef.current);
  }, [journey, boardedState, coords?.lat, coords?.lon]);

  const start = () => {
    if (!navigator.geolocation) { setGpsError('GPS not available'); return; }
    setGpsError('');
    watchRef.current = navigator.geolocation.watchPosition(
      pos => {
        const { latitude: lat, longitude: lon } = pos.coords;
        const loc = { lat, lon, accuracy: Math.round(pos.coords.accuracy) };
        setCoords(loc);
        coordsRef.current = loc;
        fetch(`${API_BASE}/api/safecommute/child-location`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lat, lon }),
        }).then(r => { if (!r.ok) setGpsError(`Server error: ${r.status}`); else setGpsError(''); })
          .catch(e => setGpsError(`Can't reach server: ${e.message}`));
        if (!coordsRef.nearestFetched) {
          coordsRef.nearestFetched = true;
          fetch(`${API_BASE}/api/safecommute/stops/nearby?lat=${lat}&lon=${lon}`)
            .then(r => r.json())
            .then(stops => { if (stops[0]) setNearestStop(stops[0]); })
            .catch(() => {});
        }
      },
      err => setGpsError(`GPS error: ${err.message}`),
      { enableHighAccuracy: true, maximumAge: 5000 },
    );
    setSharing(true);
  };

  const stop = () => {
    navigator.geolocation.clearWatch(watchRef.current);
    setSharing(false); setCoords(null); coordsRef.current = null;
  };

  // Address search via Mapbox Geocoding
  useEffect(() => {
    if (query.length < 2) { setStopResults([]); return; }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      if (!MAPBOX_TOKEN) return;
      try {
        const res = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json` +
          `?country=AU&proximity=151.2093,-33.8688&limit=5&access_token=${MAPBOX_TOKEN}`
        );
        const data = await res.json();
        setStopResults(data.features || []);
      } catch { /* ignore */ }
    }, 300);
  }, [query]);

  const selectDestination = async (place) => {
    // place is either a Mapbox feature (has .center) or a legacy stop object (has .id)
    const isFeature = !!place.center;
    const dest = isFeature
      ? { id: null, name: place.place_name, coord: [place.center[1], place.center[0]] }
      : place;

    setDestination(dest); setQuery(dest.name); setStopResults([]); setLoadingTrips(true);
    const loc = coordsRef.current;

    let url;
    if (loc && dest.id == null && dest.coord?.length >= 2) {
      const [toLat, toLon] = dest.coord;
      url = `${API_BASE}/api/safecommute/trips/from-coord?lat=${loc.lat}&lon=${loc.lon}&toLat=${toLat}&toLon=${toLon}`;
    } else if (loc) {
      url = `${API_BASE}/api/safecommute/trips/from-coord?lat=${loc.lat}&lon=${loc.lon}&to=${dest.id}`;
    } else {
      url = `${API_BASE}/api/safecommute/trips?from=${nearestStop?.id || ''}&to=${dest.id}`;
    }

    const res = await fetch(url);
    setTrips(await res.json());
    setLoadingTrips(false);
  };

  const confirmTrip = async (trip) => {
    await fetch(`${API_BASE}/api/safecommute/journey`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(trip),
    });
    setJourney(trip);
    await fetch(`${API_BASE}/api/safecommute/state`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state: 'WAITING' }),
    });
  };

  const boardBus = async () => {
    await fetch(`${API_BASE}/api/safecommute/state`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state: 'ON_BUS' }),
    });
    setBoardedState('ON_BUS');
  };

  // ── Journey confirmed: fullscreen map ────────────────────────────────────
  if (journey) {
    const leg         = journey.legs[0];
    const originCoord = leg?.fromCoord;
    const destCoord   = destination?.coord;
    const loc         = coords;
    const isBoarded   = boardedState === 'ON_BUS';
    const delayMins   = liveStatus?.delayMins;
    const depPast     = depSecs !== null && depSecs <= 0;

    let distM = null, walkMins = null, dir = null;
    if (loc && originCoord) {
      const [sLat, sLon] = originCoord;
      distM    = Math.round(haversineM(loc.lat, loc.lon, sLat, sLon));
      walkMins = Math.max(1, Math.round(distM / 80));
      dir      = COMPASS[Math.round(bearingTo(loc.lat, loc.lon, sLat, sLon) / 45) % 8];
    }

    const focusLat = loc?.lat ?? (originCoord?.[0] ?? -33.878);
    const focusLon = loc?.lon ?? (originCoord?.[1] ?? 151.215);

    const countdownColor = depPast ? '#f87171' : (depSecs !== null && depSecs < 120) ? '#FBBF24' : '#34D399';
    const atStop = distM !== null && distM <= 10;
    const noGps  = !loc;

    return (
      <div style={{ position: 'fixed', inset: 0, fontFamily: 'var(--font-ui)' }}>
        <style>{`
          @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.45} }
          @keyframes ping  { 0%{transform:scale(1);opacity:0.8} 100%{transform:scale(2.5);opacity:0} }
          @keyframes slideUp { from{transform:translateY(20px);opacity:0} to{transform:translateY(0);opacity:1} }
        `}</style>

        {MAPBOX_TOKEN ? (
          <Map
            mapboxAccessToken={MAPBOX_TOKEN}
            initialViewState={{ longitude: focusLon, latitude: focusLat, zoom: 14 }}
            style={{ width: '100%', height: '100%' }}
            mapStyle="mapbox://styles/mapbox/dark-v11"
          >
            {loc && (
              <Marker longitude={loc.lon} latitude={loc.lat} anchor="center">
                <div style={{ position: 'relative', width: 22, height: 22 }}>
                  <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: '#60A5FA', animation: 'ping 1.5s ease-out infinite' }} />
                  <div style={{ position: 'absolute', inset: 2, borderRadius: '50%', background: '#3B82F6', border: '2px solid #fff', boxShadow: '0 0 12px rgba(59,130,246,0.7)' }} />
                </div>
              </Marker>
            )}

            {originCoord && (
              <Marker longitude={originCoord[1]} latitude={originCoord[0]} anchor="bottom">
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 28 }}>🚏</div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#fff', background: '#3E7B27', borderRadius: 5, padding: '2px 6px', whiteSpace: 'nowrap', marginTop: 2, boxShadow: '0 2px 6px rgba(0,0,0,0.5)' }}>
                    Board here
                  </div>
                </div>
              </Marker>
            )}

            {destCoord && (
              <Marker longitude={destCoord[1]} latitude={destCoord[0]} anchor="bottom">
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 28 }}>📍</div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#123524', background: '#85A947', borderRadius: 5, padding: '2px 6px', whiteSpace: 'nowrap', marginTop: 2, maxWidth: 96, overflow: 'hidden', textOverflow: 'ellipsis', boxShadow: '0 2px 6px rgba(0,0,0,0.5)' }}>
                    {destination?.name?.split(',')[0]}
                  </div>
                </div>
              </Marker>
            )}

            {/* Road-snapped walking route: child → boarding stop */}
            {walkRoute && !isBoarded && (
              <Source type="geojson" data={{ type: 'Feature', geometry: walkRoute }}>
                {/* Glow underlay */}
                <Layer
                  id="walk-route-glow"
                  type="line"
                  paint={{ 'line-color': '#34D399', 'line-width': 8, 'line-opacity': 0.18 }}
                  layout={{ 'line-cap': 'round', 'line-join': 'round' }}
                />
                {/* Main route line */}
                <Layer
                  id="walk-route"
                  type="line"
                  paint={{ 'line-color': '#34D399', 'line-width': 3.5, 'line-opacity': 0.9 }}
                  layout={{ 'line-cap': 'round', 'line-join': 'round' }}
                />
              </Source>
            )}

            {vehicles.map(v => (
              <Marker key={v.id} longitude={v.lon} latitude={v.lat} anchor="center">
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 3,
                  background: v.isTarget ? '#85A947' : 'rgba(15,15,15,0.88)',
                  border: v.isTarget ? '2px solid #3E7B27' : '1px solid rgba(255,255,255,0.18)',
                  borderRadius: 6, padding: v.isTarget ? '4px 8px' : '2px 6px',
                  fontSize: v.isTarget ? 13 : 10, fontWeight: 700,
                  color: v.isTarget ? '#123524' : '#ddd',
                  boxShadow: v.isTarget ? '0 0 14px rgba(133,169,71,0.6)' : '0 1px 4px rgba(0,0,0,0.4)',
                  transform: v.isTarget ? 'scale(1.25)' : 'scale(1)',
                  transformOrigin: 'center', whiteSpace: 'nowrap', pointerEvents: 'none',
                }}>
                  🚌 {v.label}
                </div>
              </Marker>
            ))}
          </Map>
        ) : (
          <div style={{ width: '100%', height: '100%', background: '#0d1b2a' }} />
        )}

        {/* Bottom glassmorphism card */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 10,
          background: 'rgba(10,22,40,0.82)',
          backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
          borderRadius: '24px 24px 0 0',
          padding: '16px 20px 40px',
          boxShadow: '0 -2px 40px rgba(0,0,0,0.5)',
          border: '1px solid rgba(255,255,255,0.08)',
          animation: 'slideUp 0.35s ease',
        }}>
          <div style={{ width: 40, height: 4, background: 'rgba(255,255,255,0.18)', borderRadius: 2, margin: '0 auto 18px' }} />

          {/* Route + destination */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '5px 10px', fontSize: 13, fontWeight: 800,
              background: 'rgba(133,169,71,0.22)', color: '#85A947',
              borderRadius: 8, border: '1px solid rgba(133,169,71,0.35)',
            }}>
              {MODE_ICONS[leg?.mode] || '🚌'} {leg?.line}
            </span>
            <span style={{ fontSize: 15, fontWeight: 700, color: '#EFE3C2', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              → {destination?.name?.split(',')[0]}
            </span>
          </div>

          {/* Countdown + walk row */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
            <div style={{
              flex: 1.2, background: 'rgba(255,255,255,0.05)', borderRadius: 16,
              padding: '14px 16px', border: '1px solid rgba(255,255,255,0.08)',
            }}>
              <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'rgba(255,255,255,0.4)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 4 }}>
                {depPast ? 'Departed' : 'Departs in'}
              </div>
              <div style={{
                fontSize: 40, fontWeight: 900, fontFamily: 'var(--font-mono)',
                color: countdownColor, lineHeight: 1,
                animation: depSecs !== null && depSecs > 0 && depSecs < 60 ? 'pulse 0.8s infinite' : 'none',
                textShadow: `0 0 20px ${countdownColor}55`,
              }}>
                {depPast || depSecs === null
                  ? new Date(journey.departs).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })
                  : depSecs >= 3600
                    ? new Date(journey.departs).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })
                    : fmtCountdown(depSecs)}
              </div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 3 }}>
                {journey.durationMin} min ride
              </div>
            </div>

            {!isBoarded && distM !== null && (
              <div style={{
                flex: 1, background: 'rgba(255,255,255,0.05)', borderRadius: 16,
                padding: '14px 16px', border: '1px solid rgba(255,255,255,0.08)',
              }}>
                <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'rgba(255,255,255,0.4)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 4 }}>
                  Walk
                </div>
                <div style={{ fontSize: 24, fontWeight: 800, color: '#EFE3C2', lineHeight: 1 }}>
                  {dir} {distM < 1000 ? `${distM}m` : `${(distM/1000).toFixed(1)}km`}
                </div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 3 }}>~{walkMins} min</div>
              </div>
            )}
          </div>

          {delayMins > 0 && (
            <div style={{
              marginBottom: 12, padding: '10px 14px', borderRadius: 12,
              background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)',
              fontSize: 13, fontWeight: 700, color: '#f87171', textAlign: 'center',
            }}>
              ⚠ Running {delayMins} min late
            </div>
          )}

          {!isBoarded ? (
            <div>
              <button
                disabled={!atStop}
                style={{
                  width: '100%', padding: '17px', fontSize: 17, fontWeight: 800,
                  background: atStop
                    ? 'linear-gradient(135deg, #85A947 0%, #3E7B27 100%)'
                    : 'rgba(255,255,255,0.07)',
                  color: atStop ? '#fff' : 'rgba(255,255,255,0.3)',
                  border: atStop ? 'none' : '1.5px solid rgba(255,255,255,0.1)',
                  borderRadius: 16,
                  cursor: atStop ? 'pointer' : 'not-allowed',
                  boxShadow: atStop ? '0 4px 20px rgba(62,123,39,0.5)' : 'none',
                  letterSpacing: '0.01em',
                  transition: 'all 0.3s',
                }}
                onClick={atStop ? boardBus : undefined}
              >
                🚌 I'm on the bus!
              </button>
              {!atStop && (
                <div style={{ textAlign: 'center', marginTop: 8, fontSize: 12, color: 'rgba(255,255,255,0.35)', fontWeight: 600 }}>
                  {noGps ? '📍 Waiting for GPS…' : `${distM}m from stop — get closer to unlock`}
                </div>
              )}
            </div>
          ) : (
            <div style={{
              padding: '14px 16px', borderRadius: 16, textAlign: 'center',
              background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.35)',
            }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#34D399' }}>
                ✓ On the way!
              </div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginTop: 3 }}>
                Arriving {new Date(journey.arrives).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 14 }}>
            {!sharing
              ? <button style={styles.ghostBtn} onClick={start}>📍 Start sharing</button>
              : <span style={{ fontSize: 12, color: 'rgba(52,211,153,0.7)', fontWeight: 600 }}>📍 Sharing live</span>
            }
            <button
              style={styles.ghostBtn}
              onClick={() => { setJourney(null); setDestination(null); setTrips(null); setQuery(''); setBoardedState(null); }}
            >
              ← Change trip
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Main screen ───────────────────────────────────────────────────────────
  const goTo = async (dest) => {
    setLoadingDest(dest.id);
    const isAddress = !dest.stop_id;
    const stop = { id: dest.stop_id || null, name: dest.stop_name, coord: dest.stop_coord };
    setDestination(stop);
    if (!sharing) start();

    // Try to get a GPS fix (up to 3s) for better trip planning
    let loc = coordsRef.current;
    if (!loc && navigator.geolocation) {
      loc = await new Promise(resolve => {
        navigator.geolocation.getCurrentPosition(
          p => resolve({ lat: p.coords.latitude, lon: p.coords.longitude }),
          () => resolve(null),
          { timeout: 3000, maximumAge: 10000, enableHighAccuracy: true },
        );
      });
    }

    try {
      let url;
      if (loc && isAddress && stop.coord?.length >= 2) {
        // Address destination: coord-to-coord routing
        const [toLat, toLon] = stop.coord;
        url = `${API_BASE}/api/safecommute/trips/from-coord?lat=${loc.lat}&lon=${loc.lon}&toLat=${toLat}&toLon=${toLon}`;
      } else if (loc && stop.id) {
        url = `${API_BASE}/api/safecommute/trips/from-coord?lat=${loc.lat}&lon=${loc.lon}&to=${stop.id}`;
      } else if (stop.id) {
        url = `${API_BASE}/api/safecommute/trips?from=${nearestStop?.id || ''}&to=${stop.id}`;
      } else {
        setTrips([]); setLoadingDest(null); return;
      }
      const res = await fetch(url);
      const fetchedTrips = await res.json();
      if (Array.isArray(fetchedTrips) && fetchedTrips.length > 0) {
        await confirmTrip(fetchedTrips[0]);
      } else {
        setTrips(fetchedTrips || []);
      }
    } catch {
      setTrips([]);
    }
    setLoadingDest(null);
  };

  return (
    <div style={styles.page}>
      <style>{`
        @keyframes fadeInUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        .dest-btn:active { transform: scale(0.94) !important; }
      `}</style>

      <div style={styles.card}>

        {/* Header */}
        <div style={{ width: '100%', marginBottom: savedDests.length > 0 ? 28 : 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'rgba(133,169,71,0.8)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 6 }}>
            SafeCommute
          </div>
          <div style={{ fontSize: 32, fontWeight: 900, color: '#fff', lineHeight: 1.1 }}>
            {savedDests.length > 0 ? 'Where to?' : (sharing ? 'Location shared' : 'Ready to go?')}
          </div>
          {savedDests.length === 0 && (
            <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.45)', marginTop: 6, lineHeight: 1.5 }}>
              {sharing ? 'Your parent can see where you are.' : 'Tap the button so your parent can see where you are.'}
            </div>
          )}
        </div>

        {/* Saved destination circles */}
        {savedDests.length > 0 && (
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 14, width: '100%', marginBottom: 28,
            animation: 'fadeInUp 0.4s ease',
          }}>
            {savedDests.map((d, i) => {
              const c = DEST_COLORS[i % DEST_COLORS.length];
              const isLoading = loadingDest === d.id;
              return (
                <button
                  key={d.id}
                  className="dest-btn"
                  onClick={() => !loadingDest && goTo(d)}
                  disabled={!!loadingDest}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 9,
                    background: 'none', border: 'none', cursor: loadingDest ? 'default' : 'pointer',
                    padding: '4px 0', transition: 'transform 0.15s',
                    opacity: loadingDest && !isLoading ? 0.4 : 1,
                  }}
                >
                  <div style={{
                    width: 76, height: 76, borderRadius: '50%',
                    background: isLoading ? c.border : c.bg,
                    border: `2px solid ${c.border}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: isLoading ? 22 : 32,
                    boxShadow: isLoading ? `0 4px 28px ${c.glow}, 0 0 0 4px ${c.bg}` : `0 4px 20px ${c.glow}`,
                    transition: 'all 0.2s',
                    animation: isLoading ? 'pulse 1s ease-in-out infinite' : 'none',
                  }}>
                    {isLoading ? '⏳' : d.emoji}
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: isLoading ? '#fff' : c.text, textAlign: 'center', lineHeight: 1.2 }}>
                    {isLoading ? 'Finding trip…' : d.label}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* No saved dests: share button */}
        {savedDests.length === 0 && (
          <button onClick={sharing ? stop : start} style={{
            ...styles.btn,
            background: sharing
              ? 'rgba(220,38,38,0.15)'
              : 'linear-gradient(135deg, #85A947 0%, #3E7B27 100%)',
            color: sharing ? '#f87171' : '#fff',
            border: sharing ? '2px solid rgba(220,38,38,0.3)' : 'none',
            boxShadow: sharing ? 'none' : '0 4px 20px rgba(62,123,39,0.45)',
          }}>
            {sharing ? 'Stop sharing' : '📍 Share my location'}
          </button>
        )}

        {gpsError && (
          <div style={{ color: '#f87171', fontSize: 13, marginTop: 10, width: '100%', textAlign: 'center' }}>
            {gpsError}
          </div>
        )}

        {coords && (
          <div style={{ ...styles.infoCard, marginTop: 16 }}>
            <div style={styles.infoLabel}>Live location</div>
            <div style={{ fontSize: 13, color: '#34D399', fontFamily: 'var(--font-mono)' }}>
              ● Sharing · ±{coords.accuracy}m
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>
              {nearestStop ? `Near ${nearestStop.name}` : 'Finding nearest stop…'}
            </div>
          </div>
        )}

        {/* Divider + search */}
        {(sharing || savedDests.length > 0) && (
          <div style={{ width: '100%', marginTop: savedDests.length > 0 ? 0 : 24 }}>
            {savedDests.length > 0 && (
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', marginBottom: 10, fontWeight: 600, letterSpacing: '0.05em' }}>
                Or search for another destination
              </div>
            )}
            {savedDests.length === 0 && sharing && (
              <div style={{ fontSize: 15, fontWeight: 700, color: '#EFE3C2', marginBottom: 12 }}>
                Where are you going?
              </div>
            )}

            <div style={{ position: 'relative' }}>
              <input
                value={query}
                onChange={e => { setQuery(e.target.value); setDestination(null); setTrips(null); }}
                placeholder="Search for an address or place…"
                style={styles.input}
              />
              {stopResults.length > 0 && (
                <div style={styles.dropdown}>
                  {stopResults.map(f => (
                    <button key={f.id} style={styles.dropdownItem} onClick={() => selectDestination(f)}>
                      📍 {f.place_name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {loadingTrips && (
              <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14, marginTop: 16, textAlign: 'center' }}>
                Finding trips…
              </div>
            )}
            {trips?.length === 0 && (
              <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14, marginTop: 16, textAlign: 'center' }}>
                No trips found. Try a different destination.
              </div>
            )}

            {trips?.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginBottom: 10, fontWeight: 600, letterSpacing: '0.05em' }}>
                  Pick a trip
                </div>
                {trips.slice(0, 4).map((trip, i) => {
                  const leg = trip.legs[0];
                  const secsUntil = Math.round((new Date(trip.departs) - Date.now()) / 1000);
                  const label = secsUntil <= 0 ? 'Now'
                    : secsUntil < 60 ? `${secsUntil}s`
                    : secsUntil < 3600 ? `${Math.round(secsUntil/60)} min`
                    : new Date(trip.departs).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' });
                  const isFirst = i === 0;
                  return (
                    <button key={i} style={{
                      ...styles.tripCard,
                      background: isFirst ? 'rgba(133,169,71,0.12)' : 'rgba(255,255,255,0.04)',
                      border: isFirst ? '1.5px solid rgba(133,169,71,0.4)' : '1px solid rgba(255,255,255,0.08)',
                    }} onClick={() => confirmTrip(trip)}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{
                          ...styles.badge,
                          background: isFirst ? 'rgba(133,169,71,0.25)' : 'rgba(255,255,255,0.08)',
                          color: isFirst ? '#85A947' : 'rgba(255,255,255,0.6)',
                          border: isFirst ? '1px solid rgba(133,169,71,0.4)' : '1px solid rgba(255,255,255,0.12)',
                        }}>
                          {MODE_ICONS[leg?.mode] || '🚌'} {leg?.line}
                        </span>
                        <span style={{ fontSize: 17, fontWeight: 800, color: isFirst ? '#fff' : '#EFE3C2' }}>
                          {label}
                        </span>
                        {isFirst && (
                          <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, color: '#85A947', background: 'rgba(133,169,71,0.15)', padding: '2px 8px', borderRadius: 6 }}>
                            Next
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginTop: 5 }}>
                        {new Date(trip.departs).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}
                        {' '}· {trip.durationMin} min
                        {trip.changes > 0 ? ` · ${trip.changes} change${trip.changes > 1 ? 's' : ''}` : ' · Direct'}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {savedDests.length > 0 && sharing && (
          <button onClick={stop} style={{
            ...styles.btn, marginTop: 20, fontSize: 13, padding: '12px',
            background: 'rgba(220,38,38,0.1)', color: '#f87171',
            border: '1.5px solid rgba(220,38,38,0.25)', boxShadow: 'none',
          }}>
            Stop sharing location
          </button>
        )}
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    background: 'linear-gradient(160deg, #0d1b2a 0%, #0f2318 100%)',
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'flex-start', padding: '52px 20px 40px',
    fontFamily: 'var(--font-ui)',
  },
  card: {
    width: '100%', maxWidth: 380,
    display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
  },
  infoCard: {
    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 14, padding: '14px 16px', textAlign: 'left', width: '100%',
  },
  infoLabel: {
    fontSize: 10, fontFamily: 'var(--font-mono)', color: 'rgba(255,255,255,0.35)',
    letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 5,
  },
  btn: {
    width: '100%', padding: '16px', fontSize: 16, fontWeight: 800,
    borderRadius: 16, cursor: 'pointer', marginTop: 20,
  },
  ghostBtn: {
    fontSize: 12, background: 'none', border: 'none',
    color: 'rgba(255,255,255,0.35)', cursor: 'pointer', fontWeight: 600,
  },
  input: {
    width: '100%', padding: '14px 16px', fontSize: 15,
    background: 'rgba(255,255,255,0.07)', border: '1.5px solid rgba(255,255,255,0.12)',
    borderRadius: 12, color: '#fff', outline: 'none',
    fontFamily: 'var(--font-ui)', boxSizing: 'border-box',
  },
  dropdown: {
    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10,
    background: '#0e1f14', border: '1px solid rgba(133,169,71,0.3)',
    borderRadius: 12, overflow: 'hidden', marginTop: 4,
    boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
  },
  dropdownItem: {
    display: 'block', width: '100%', padding: '13px 16px', textAlign: 'left',
    fontSize: 14, color: '#EFE3C2', background: 'none', border: 'none',
    borderBottom: '1px solid rgba(255,255,255,0.06)', cursor: 'pointer',
    fontFamily: 'var(--font-ui)',
  },
  tripCard: {
    width: '100%', padding: '14px 16px', marginBottom: 8, textAlign: 'left',
    borderRadius: 14, cursor: 'pointer', fontFamily: 'var(--font-ui)',
    transition: 'opacity 0.1s',
  },
  badge: {
    display: 'inline-flex', alignItems: 'center', gap: 4,
    padding: '4px 10px', fontSize: 12, fontWeight: 800,
    borderRadius: 8,
  },
};
