import { useState, useRef, useEffect } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || '';

const MODE_ICONS = { 1: '🚆', 4: '🚊', 5: '🚌', 7: '🚌', 9: '⛴️' };
const COMPASS = ['N','NE','E','SE','S','SW','W','NW'];

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
  return `${m}m ${String(s).padStart(2,'0')}s`;
}

export default function ChildView() {
  const [sharing, setSharing]         = useState(false);
  const [coords, setCoords]           = useState(null);
  const [gpsError, setGpsError]       = useState('');
  const [nearestStop, setNearestStop] = useState(null);
  const [destination, setDestination] = useState(null);
  const [query, setQuery]             = useState('');
  const [stopResults, setStopResults] = useState([]);
  const [trips, setTrips]             = useState(null);
  const [loadingTrips, setLoadingTrips] = useState(false);
  const [journey, setJourney]         = useState(null);
  const [boardedState, setBoardedState] = useState(null);
  const watchRef    = useRef(null);
  const coordsRef   = useRef(null);
  const debounceRef = useRef(null);

  const depSecs = useCountdown(journey?.departs);

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
          .catch(e => setGpsError(`Cannot reach server: ${e.message}`));
        // Find nearest stop once (only when we don't have one yet)
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

  // Destination stop search
  useEffect(() => {
    if (query.length < 2) { setStopResults([]); return; }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const res = await fetch(`${API_BASE}/api/safecommute/stops?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      setStopResults(data.filter(s => s.type === 'stop').slice(0, 5));
    }, 300);
  }, [query]);

  const selectDestination = async (stop) => {
    setDestination(stop); setQuery(stop.name); setStopResults([]); setLoadingTrips(true);
    const loc = coordsRef.current;
    const url = loc
      ? `${API_BASE}/api/safecommute/trips/from-coord?lat=${loc.lat}&lon=${loc.lon}&to=${stop.id}`
      : `${API_BASE}/api/safecommute/trips?from=${nearestStop?.id || ''}&to=${stop.id}`;
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

  // ── Journey confirmed: walk + countdown screen ──────────────────────────
  if (journey) {
    const leg       = journey.legs[0];
    const stopCoord = leg?.fromCoord;  // [lat, lon] from NSW API
    const loc       = coordsRef.current || coords;
    let distM = null, walkMins = null, dir = null;
    if (loc && stopCoord) {
      const [sLat, sLon] = stopCoord;
      distM    = Math.round(haversineM(loc.lat, loc.lon, sLat, sLon));
      walkMins = Math.max(1, Math.round(distM / 80));
      const bear = bearingTo(loc.lat, loc.lon, sLat, sLon);
      dir = COMPASS[Math.round(bear / 45) % 8];
    }
    const isBoarded  = boardedState === 'ON_BUS';
    const depPast    = depSecs !== null && depSecs <= 0;

    return (
      <div style={styles.page}>
        <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}`}</style>
        <div style={styles.card}>
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>{isBoarded ? '🚌' : '🚶'}</div>
            <div style={styles.heading}>{isBoarded ? "You're on the bus!" : 'Head to your stop'}</div>
            <div style={{ ...styles.badge, fontSize: 15, marginTop: 6 }}>
              {MODE_ICONS[leg?.mode] || '🚌'} {leg?.line} → {destination?.name}
            </div>
          </div>

          {/* Walk to stop */}
          {!isBoarded && distM !== null && (
            <div style={styles.infoCard}>
              <div style={styles.infoLabel}>WALK TO STOP</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#EFE3C2' }}>
                {dir} · {distM < 1000 ? `${distM}m` : `${(distM/1000).toFixed(1)}km`}
              </div>
              <div style={{ ...styles.muted, marginTop: 4 }}>~{walkMins} min walk to {leg?.from}</div>
            </div>
          )}

          {/* Departure countdown */}
          <div style={{ ...styles.infoCard, marginTop: 12 }}>
            <div style={styles.infoLabel}>{depPast ? 'DEPARTED' : 'BUS DEPARTS IN'}</div>
            <div style={{
              fontSize: 36, fontWeight: 800, fontFamily: 'var(--font-mono)', color: depPast ? '#f87171' : '#85A947',
              animation: depSecs !== null && depSecs > 0 && depSecs < 60 ? 'pulse 1s infinite' : 'none',
            }}>
              {depPast ? 'Now / Departed' : fmtCountdown(depSecs)}
            </div>
            <div style={styles.muted}>
              {new Date(journey.departs).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}
              {' '}· {journey.durationMin} min journey
            </div>
          </div>

          {/* Board button */}
          {!isBoarded && (
            <button style={{ ...styles.btn, ...styles.btnStart, marginTop: 20 }} onClick={boardBus}>
              ✅ I'm on the bus
            </button>
          )}

          {isBoarded && (
            <div style={{ ...styles.infoCard, marginTop: 12, borderColor: 'rgba(133,169,71,0.5)' }}>
              <div style={styles.infoLabel}>ARRIVING AT</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#EFE3C2' }}>{destination?.name}</div>
              <div style={styles.muted}>
                {new Date(journey.arrives).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          )}

          {/* GPS status */}
          {sharing
            ? <div style={{ ...styles.muted, marginTop: 20, fontSize: 12 }}>📍 Location sharing active</div>
            : <button style={{ ...styles.btn, background: 'rgba(133,169,71,0.12)', color: '#85A947', marginTop: 20 }} onClick={start}>
                📍 Share my location
              </button>
          }

          <button
            style={{ background: 'none', border: 'none', color: 'var(--sidebar-muted)', fontSize: 12, marginTop: 16, cursor: 'pointer' }}
            onClick={() => { setJourney(null); setDestination(null); setTrips(null); setQuery(''); setBoardedState(null); }}
          >
            Change trip
          </button>
        </div>
      </div>
    );
  }

  // ── Main screen ───────────────────────────────────────────────────────────
  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>{sharing ? '📍' : '🚌'}</div>
        <div style={styles.heading}>{sharing ? 'Location shared' : 'Ready to go?'}</div>
        <div style={styles.muted}>
          {sharing ? 'Your parent can see where you are.' : 'Tap the button so your parent can see where you are.'}
        </div>

        {gpsError && <div style={styles.error}>{gpsError}</div>}

        {coords && (
          <div style={styles.infoCard}>
            <div style={styles.infoLabel}>LIVE LOCATION</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: '#EFE3C2' }}>
              {coords.lat.toFixed(5)}, {coords.lon.toFixed(5)}
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--sidebar-muted)', marginTop: 2 }}>
              ±{coords.accuracy}m · {nearestStop ? `Near ${nearestStop.name}` : 'Finding stop…'}
            </div>
          </div>
        )}

        <button onClick={sharing ? stop : start} style={{ ...styles.btn, ...(sharing ? styles.btnStop : styles.btnStart) }}>
          {sharing ? 'Stop sharing' : 'Share my location'}
        </button>

        {sharing && (
          <div style={{ width: '100%', marginTop: 32 }}>
            <div style={styles.divider} />
            <div style={{ fontSize: 15, fontWeight: 700, color: '#EFE3C2', marginBottom: 12 }}>Where are you going?</div>
            <div style={{ position: 'relative' }}>
              <input
                value={query}
                onChange={e => { setQuery(e.target.value); setDestination(null); setTrips(null); }}
                placeholder="Search for a stop…"
                style={styles.input}
              />
              {stopResults.length > 0 && (
                <div style={styles.dropdown}>
                  {stopResults.map(s => (
                    <button key={s.id} style={styles.dropdownItem} onClick={() => selectDestination(s)}>
                      🚏 {s.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {loadingTrips && <div style={{ ...styles.muted, marginTop: 16 }}>Finding trips…</div>}
            {trips?.length === 0 && <div style={{ ...styles.muted, marginTop: 16 }}>No trips found. Try a different destination.</div>}

            {trips?.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 12, color: 'var(--sidebar-muted)', marginBottom: 8 }}>Pick a trip:</div>
                {trips.slice(0, 4).map((trip, i) => {
                  const leg = trip.legs[0];
                  const secsUntil = Math.round((new Date(trip.departs) - Date.now()) / 1000);
                  const label = secsUntil <= 0 ? 'Now' : secsUntil < 60 ? `${secsUntil}s` : `${Math.round(secsUntil/60)} min`;
                  return (
                    <button key={i} style={styles.tripCard} onClick={() => confirmTrip(trip)}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={styles.badge}>{MODE_ICONS[leg?.mode] || '🚌'} {leg?.line}</span>
                        <span style={{ fontSize: 15, fontWeight: 700, color: '#EFE3C2' }}>{label}</span>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--sidebar-muted)', marginTop: 4 }}>
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
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh', background: 'var(--sidebar-bg)', display: 'flex',
    flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start',
    padding: '40px 20px', fontFamily: 'var(--font-ui)',
  },
  card: { width: '100%', maxWidth: 360, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' },
  heading: { fontSize: 24, fontWeight: 800, color: '#EFE3C2', marginBottom: 8 },
  muted: { fontSize: 14, color: 'var(--sidebar-muted)', lineHeight: 1.5 },
  error: { color: '#f87171', fontSize: 13, marginTop: 12 },
  infoCard: {
    background: 'rgba(133,169,71,0.08)', border: '1px solid rgba(133,169,71,0.2)',
    borderRadius: 12, padding: '14px 16px', textAlign: 'left', width: '100%',
  },
  infoLabel: { fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--sidebar-muted)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 6 },
  btn: { width: '100%', padding: '16px', fontSize: 16, fontWeight: 700, borderRadius: 14, cursor: 'pointer', border: 'none', marginTop: 20 },
  btnStart: { background: '#85A947', color: '#123524' },
  btnStop:  { background: 'rgba(220,38,38,0.15)', color: '#f87171', border: '2px solid rgba(220,38,38,0.3)' },
  input: {
    width: '100%', padding: '12px 14px', fontSize: 15,
    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(133,169,71,0.3)',
    borderRadius: 10, color: '#EFE3C2', outline: 'none', fontFamily: 'var(--font-ui)', boxSizing: 'border-box',
  },
  dropdown: {
    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10,
    background: '#1a2e1a', border: '1px solid rgba(133,169,71,0.3)',
    borderRadius: 10, overflow: 'hidden', marginTop: 4,
  },
  dropdownItem: {
    display: 'block', width: '100%', padding: '12px 14px', textAlign: 'left',
    fontSize: 14, color: '#EFE3C2', background: 'none', border: 'none',
    borderBottom: '1px solid rgba(255,255,255,0.05)', cursor: 'pointer',
  },
  tripCard: {
    width: '100%', padding: '12px 14px', marginBottom: 8, textAlign: 'left',
    background: 'rgba(133,169,71,0.08)', border: '1px solid rgba(133,169,71,0.2)',
    borderRadius: 12, cursor: 'pointer',
  },
  badge: {
    display: 'inline-block', padding: '3px 8px', fontSize: 12, fontWeight: 700,
    background: 'rgba(133,169,71,0.2)', color: '#85A947', borderRadius: 6,
  },
  divider: { width: '100%', height: 1, background: 'rgba(255,255,255,0.08)', marginBottom: 24 },
};
