import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Map, { Marker } from 'react-map-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

function DestinationSender({ apiBase }) {
  const [query, setQuery]     = useState('');
  const [results, setResults] = useState([]);
  const [open, setOpen]       = useState(false);
  const [sent, setSent]       = useState(null);
  const timer = useRef(null);

  const onChange = (e) => {
    const q = e.target.value;
    setQuery(q);
    setSent(null);
    clearTimeout(timer.current);
    if (q.length < 2) { setResults([]); setOpen(false); return; }
    timer.current = setTimeout(async () => {
      try {
        const res = await fetch(`${apiBase}/api/safecommute/stops?q=${encodeURIComponent(q)}`);
        setResults(await res.json());
        setOpen(true);
      } catch { /* ignore */ }
    }, 300);
  };

  const send = async (stop) => {
    setQuery(stop.name);
    setOpen(false);
    await fetch(`${apiBase}/api/safecommute/set-destination`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: stop.id, name: stop.name }),
    });
    setSent(stop.name);
  };

  return (
    <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
      <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10 }}>
        Send destination to child
      </div>
      <div style={{ position: 'relative' }}>
        <input
          value={query}
          onChange={onChange}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="Search destination stop…"
          style={{
            width: '100%', padding: '12px 14px', fontSize: 14,
            border: '1.5px solid var(--border)', borderRadius: 10,
            background: 'var(--bg-elevated)', color: 'var(--text-primary)',
            fontFamily: 'var(--font-ui)', outline: 'none', boxSizing: 'border-box',
          }}
          onFocus={e => e.target.style.borderColor = 'var(--accent)'}
          onBlurCapture={e => e.target.style.borderColor = 'var(--border)'}
        />
        {open && results.length > 0 && (
          <div style={{
            position: 'absolute', bottom: '100%', left: 0, right: 0, zIndex: 100,
            background: 'var(--bg-surface)', border: '1px solid var(--border)',
            borderRadius: 10, marginBottom: 4, overflow: 'hidden',
            boxShadow: '0 -8px 24px rgba(0,0,0,0.12)',
          }}>
            {results.map(s => (
              <div key={s.id}
                onMouseDown={() => send(s)}
                style={{ padding: '12px 14px', cursor: 'pointer', fontSize: 14, color: 'var(--text-primary)', borderBottom: '1px solid var(--border-subtle)' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-elevated)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                {s.name}
              </div>
            ))}
          </div>
        )}
      </div>
      {sent && (
        <div style={{ marginTop: 8, fontSize: 13, color: 'var(--accent-hot)', fontWeight: 600 }}>
          ✓ Sent "{sent}" to child's device
        </div>
      )}
    </div>
  );
}

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;
const API_BASE     = import.meta.env.VITE_API_URL || '';

const INITIAL_VIEW = { longitude: 151.215, latitude: -33.878, zoom: 13 };

const STATE_COLORS = {
  WAITING: { bg: '#85A947', label: 'Waiting at stop' },
  ON_BUS:  { bg: '#3E7B27', label: 'On the bus' },
};

export default function SafeCommuteDashboard() {
  const navigate = useNavigate();
  const [phase, setPhase]       = useState('WAITING');
  const [status, setStatus]     = useState(null);
  const [sharing, setSharing]   = useState(false);
  const [isLive, setIsLive]     = useState(false);
  const lastJson  = useRef(null);
  const watchRef  = useRef(null);

  // Poll status
  useEffect(() => {
    setStatus(null);
    lastJson.current = null;
    const poll = async () => {
      try {
        const url = isLive
          ? `${API_BASE}/api/safecommute/status`
          : `${API_BASE}/api/safecommute/status?phase=${phase}`;
        const res  = await fetch(url);
        const data = await res.json();
        const json = JSON.stringify(data);
        if (json !== lastJson.current) { lastJson.current = json; setStatus(data); }
      } catch { /* ignore */ }
    };
    poll();
    const id = setInterval(poll, 3000);
    return () => clearInterval(id);
  }, [phase, isLive]);

  // GPS sharing (child's device)
  const toggleSharing = () => {
    if (sharing) {
      navigator.geolocation.clearWatch(watchRef.current);
      setSharing(false);
      return;
    }
    watchRef.current = navigator.geolocation.watchPosition(
      pos => {
        const { latitude: lat, longitude: lon } = pos.coords;
        fetch(`${API_BASE}/api/safecommute/child-location`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lat, lon }),
        });
      },
      err => console.warn('GPS error', err),
      { enableHighAccuracy: true, maximumAge: 5000 },
    );
    setSharing(true);
  };

  const state       = status?.state        ?? phase;
  const eta         = status?.eta_minutes;
  const stop        = status?.nearest_stop ?? '—';
  const line        = status?.line;
  const childLng    = status?.child?.lon   ?? 151.206;
  const childLat    = status?.child?.lat   ?? -33.883;
  const busLng      = status?.vehicle?.lon ?? 151.215;
  const busLat      = status?.vehicle?.lat ?? -33.876;
  const hasVehicle  = !!status?.vehicle;
  const stateInfo   = STATE_COLORS[state] ?? STATE_COLORS.WAITING;

  const liveMode = status?.mode === 'live';

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#1a1a1a', fontFamily: 'var(--font-ui)' }}>

      {/* Map */}
      {MAPBOX_TOKEN ? (
        <Map
          mapboxAccessToken={MAPBOX_TOKEN}
          initialViewState={INITIAL_VIEW}
          style={{ width: '100%', height: '100%' }}
          mapStyle="mapbox://styles/mapbox/streets-v12"
        >
          {status?.child && (
            <Marker longitude={childLng} latitude={childLat} anchor="center">
              <div style={{
                width: 16, height: 16, borderRadius: '50%',
                background: '#2563eb', border: '3px solid #fff',
                boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
              }} />
            </Marker>
          )}
          {hasVehicle && (
            <Marker longitude={busLng} latitude={busLat} anchor="center">
              <div style={{ fontSize: 28, filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.4))' }}>🚌</div>
            </Marker>
          )}
        </Map>
      ) : (
        <div style={{ width: '100%', height: '100%', background: '#e8f0e8', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666', fontSize: 14 }}>
          Set VITE_MAPBOX_TOKEN to see map
        </div>
      )}

      {/* Top header */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
        padding: '48px 20px 32px',
        background: 'linear-gradient(to bottom, rgba(18,53,36,0.9) 0%, transparent 100%)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
      }}>
        <div>
          <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'rgba(239,227,194,0.7)', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 4 }}>
            SafeCommute {liveMode && '· Live'}
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#EFE3C2', letterSpacing: '-0.01em' }}>
            Alex's Journey
          </div>
        </div>
        <button
          onClick={() => navigate('/setup')}
          style={{
            marginTop: 4, padding: '8px 14px', fontSize: 12, fontWeight: 600,
            background: 'rgba(239,227,194,0.15)', color: '#EFE3C2',
            border: '1px solid rgba(239,227,194,0.3)', borderRadius: 8, cursor: 'pointer',
          }}
        >
          Change route
        </button>
      </div>

      {/* Bottom card */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 10,
        background: 'var(--bg-surface)', borderRadius: '20px 20px 0 0',
        padding: '20px 20px 36px',
        boxShadow: '0 -4px 32px rgba(0,0,0,0.18)',
      }}>
        <div style={{ width: 36, height: 4, background: 'var(--border-strong)', borderRadius: 2, margin: '0 auto 20px' }} />

        {/* State badge */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: stateInfo.bg, borderRadius: 8, padding: '10px 16px',
          }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'rgba(255,255,255,0.7)' }} />
            <span style={{ fontSize: 15, fontWeight: 700, color: '#fff', letterSpacing: '0.02em' }}>
              {stateInfo.label}
              {line ? ` · ${line}` : ''}
            </span>
          </div>

          {/* GPS share button */}
          <button
            onClick={toggleSharing}
            style={{
              padding: '10px 14px', fontSize: 12, fontWeight: 600,
              background: sharing ? 'var(--accent-hot)' : 'var(--bg-elevated)',
              color: sharing ? '#fff' : 'var(--text-secondary)',
              border: 'none', borderRadius: 8, cursor: 'pointer',
            }}
          >
            {sharing ? '📍 Sharing' : '📍 Share GPS'}
          </button>
        </div>

        {/* Stats row */}
        <div style={{ display: 'flex', gap: 12, marginBottom: liveMode ? 0 : 24 }}>
          <div style={{ flex: 1, background: 'var(--bg-elevated)', borderRadius: 10, padding: '14px 16px' }}>
            <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 6 }}>ETA</div>
            <div style={{ fontSize: 28, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', lineHeight: 1 }}>
              {eta != null ? `${eta}` : '—'}
            </div>
            {eta != null && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>minutes</div>}
          </div>
          <div style={{ flex: 2, background: 'var(--bg-elevated)', borderRadius: 10, padding: '14px 16px' }}>
            <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 6 }}>Next Stop</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.3 }}>{stop}</div>
          </div>
        </div>

        {/* Demo phase toggle — only in demo mode */}
        {!liveMode && (
          <div style={{ display: 'flex', gap: 8, marginTop: 0 }}>
            {['WAITING', 'ON_BUS'].map(p => (
              <button
                key={p}
                onClick={() => { setPhase(p); setIsLive(false); }}
                style={{
                  flex: 1, padding: '12px',
                  fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 600, letterSpacing: '0.08em',
                  cursor: 'pointer', border: 'none', borderRadius: 8,
                  background: phase === p ? 'var(--accent-hot)' : 'var(--bg-elevated)',
                  color: phase === p ? '#fff' : 'var(--text-secondary)',
                }}
              >
                {p.replace('_', ' ')}
              </button>
            ))}
          </div>
        )}

        <DestinationSender apiBase={API_BASE} />
      </div>
    </div>
  );
}
