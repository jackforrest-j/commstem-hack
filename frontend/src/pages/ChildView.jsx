import { useState, useRef, useEffect } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || '';

const MODE_ICONS = { 1: '🚆', 4: '🚊', 5: '🚌', 7: '🚌', 9: '⛴️' };

function minutesUntil(iso) {
  const diff = Math.round((new Date(iso) - Date.now()) / 60000);
  if (diff <= 0) return 'Now';
  if (diff === 1) return '1 min';
  return `${diff} mins`;
}

export default function ChildView() {
  const [sharing, setSharing]         = useState(false);
  const [coords, setCoords]           = useState(null);
  const [gpsError, setGpsError]       = useState('');
  const [destination, setDestination] = useState(null);
  const [query, setQuery]             = useState('');
  const [stopResults, setStopResults] = useState([]);
  const [trips, setTrips]             = useState(null);
  const [loadingTrips, setLoadingTrips] = useState(false);
  const [journey, setJourney]         = useState(null);
  const watchRef  = useRef(null);
  const coordsRef = useRef(null);
  const debounceRef = useRef(null);

  const start = () => {
    if (!navigator.geolocation) { setGpsError('GPS not available on this device'); return; }
    setGpsError('');
    watchRef.current = navigator.geolocation.watchPosition(
      pos => {
        const { latitude: lat, longitude: lon } = pos.coords;
        const loc = { lat, lon, accuracy: Math.round(pos.coords.accuracy) };
        setCoords(loc);
        coordsRef.current = loc;
        fetch(`${API_BASE}/api/safecommute/child-location`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lat, lon }),
        }).then(r => { if (!r.ok) setGpsError(`Server error: ${r.status}`); else setGpsError(''); })
          .catch(e => setGpsError(`Cannot reach server: ${e.message}`));
      },
      err => setGpsError(`GPS error: ${err.message}`),
      { enableHighAccuracy: true, maximumAge: 5000 },
    );
    setSharing(true);
  };

  const stop = () => {
    navigator.geolocation.clearWatch(watchRef.current);
    setSharing(false);
    setCoords(null);
    coordsRef.current = null;
  };

  // Destination stop search with debounce
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
    setDestination(stop);
    setQuery(stop.name);
    setStopResults([]);
    setLoadingTrips(true);
    const loc = coordsRef.current;
    const url = loc
      ? `${API_BASE}/api/safecommute/trips/from-coord?lat=${loc.lat}&lon=${loc.lon}&to=${stop.id}`
      : `${API_BASE}/api/safecommute/trips?from=200060&to=${stop.id}`;
    const res = await fetch(url);
    const data = await res.json();
    setTrips(data);
    setLoadingTrips(false);
  };

  const confirmTrip = async (trip) => {
    await fetch(`${API_BASE}/api/safecommute/journey`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(trip),
    });
    setJourney(trip);
  };

  // ── Journey confirmed screen ──────────────────────────────────────────────
  if (journey) {
    const leg = journey.legs[0];
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
          <div style={styles.heading}>You're all set!</div>
          <div style={styles.muted}>Your parent can see your trip.</div>
          <div style={{ ...styles.badge, marginTop: 24, fontSize: 16 }}>
            {MODE_ICONS[leg?.mode] || '🚌'} {leg?.line} → {destination?.name}
          </div>
          <div style={{ ...styles.muted, marginTop: 8 }}>
            Departs {new Date(journey.departs).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })} · {journey.durationMin} min
          </div>
          <button style={{ ...styles.btn, marginTop: 32, background: 'rgba(133,169,71,0.15)', color: 'var(--accent)' }}
            onClick={() => { setJourney(null); setDestination(null); setTrips(null); setQuery(''); }}>
            Change trip
          </button>
          {sharing && <div style={{ ...styles.muted, marginTop: 16, fontSize: 12 }}>📍 Location sharing active</div>}
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>

        {/* GPS section */}
        <div style={{ fontSize: 48, marginBottom: 16 }}>{sharing ? '📍' : '🚌'}</div>
        <div style={styles.heading}>{sharing ? 'Location shared' : 'Ready to go?'}</div>
        <div style={styles.muted}>
          {sharing ? 'Your parent can see where you are.' : 'Tap the button so your parent can see where you are.'}
        </div>

        {gpsError && <div style={styles.error}>{gpsError}</div>}

        {coords && (
          <div style={styles.coordBox}>
            <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--sidebar-muted)', marginBottom: 4 }}>LIVE LOCATION</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: '#EFE3C2' }}>{coords.lat.toFixed(5)}, {coords.lon.toFixed(5)}</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--sidebar-muted)', marginTop: 2 }}>±{coords.accuracy}m</div>
          </div>
        )}

        <button onClick={sharing ? stop : start} style={{ ...styles.btn, ...(sharing ? styles.btnStop : styles.btnStart) }}>
          {sharing ? 'Stop sharing' : 'Share my location'}
        </button>

        {/* Trip planning — only show once GPS is active */}
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

            {trips && trips.length === 0 && (
              <div style={{ ...styles.muted, marginTop: 16 }}>No trips found. Try a different destination.</div>
            )}

            {trips && trips.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 12, color: 'var(--sidebar-muted)', marginBottom: 8 }}>Pick a trip:</div>
                {trips.slice(0, 4).map((trip, i) => {
                  const leg = trip.legs[0];
                  return (
                    <button key={i} style={styles.tripCard} onClick={() => confirmTrip(trip)}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={styles.badge}>{MODE_ICONS[leg?.mode] || '🚌'} {leg?.line}</span>
                        <span style={{ fontSize: 14, fontWeight: 700, color: '#EFE3C2' }}>
                          {minutesUntil(trip.departs)}
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--sidebar-muted)', marginTop: 4 }}>
                        {new Date(trip.departs).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })} · {trip.durationMin} min
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
    minHeight: '100vh', background: 'var(--sidebar-bg)',
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'flex-start', padding: '40px 20px',
    fontFamily: 'var(--font-ui)',
  },
  card: {
    width: '100%', maxWidth: 360, display: 'flex', flexDirection: 'column',
    alignItems: 'center', textAlign: 'center',
  },
  heading: { fontSize: 24, fontWeight: 800, color: '#EFE3C2', marginBottom: 8 },
  muted: { fontSize: 14, color: 'var(--sidebar-muted)', lineHeight: 1.5 },
  error: { color: '#f87171', fontSize: 13, marginTop: 12 },
  coordBox: {
    background: 'rgba(133,169,71,0.12)', border: '1px solid rgba(133,169,71,0.25)',
    borderRadius: 10, padding: '10px 14px', marginTop: 16, textAlign: 'left', width: '100%',
  },
  btn: {
    width: '100%', padding: '16px', fontSize: 16, fontWeight: 700,
    borderRadius: 14, cursor: 'pointer', border: 'none', marginTop: 20,
  },
  btnStart: { background: '#85A947', color: '#123524' },
  btnStop: { background: 'rgba(220,38,38,0.15)', color: '#f87171', border: '2px solid rgba(220,38,38,0.3)' },
  input: {
    width: '100%', padding: '12px 14px', fontSize: 15,
    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(133,169,71,0.3)',
    borderRadius: 10, color: '#EFE3C2', outline: 'none',
    fontFamily: 'var(--font-ui)', boxSizing: 'border-box',
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
