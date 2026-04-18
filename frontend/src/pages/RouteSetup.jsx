import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

const API_BASE = import.meta.env.VITE_API_URL || '';

const MODE_ICONS = { 1: '🚆', 2: '🚆', 4: '🚆', 5: '🚌', 7: '⛴', 9: '🚃', 11: '🚌' };
function modeIcon(cls) { return MODE_ICONS[cls] ?? '🚌'; }

function fmt(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function StopInput({ label, value, onSelect }) {
  const [query, setQuery]   = useState(value?.name || '');
  const [results, setResults] = useState([]);
  const [open, setOpen]     = useState(false);
  const timer = useRef(null);

  useEffect(() => { setQuery(value?.name || ''); }, [value]);

  const onChange = (e) => {
    const q = e.target.value;
    setQuery(q);
    clearTimeout(timer.current);
    if (q.length < 2) { setResults([]); setOpen(false); return; }
    timer.current = setTimeout(async () => {
      try {
        const res = await fetch(`${API_BASE}/api/safecommute/stops?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        setResults(data);
        setOpen(true);
      } catch { /* ignore */ }
    }, 300);
  };

  return (
    <div style={{ position: 'relative', marginBottom: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', letterSpacing: '0.06em', marginBottom: 6 }}>
        {label}
      </div>
      <input
        value={query}
        onChange={onChange}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={`Search ${label.toLowerCase()}…`}
        style={{
          width: '100%', padding: '13px 16px', fontSize: 15,
          border: '1.5px solid var(--border)', borderRadius: 10,
          background: 'var(--bg-surface)', color: 'var(--text-primary)',
          fontFamily: 'var(--font-ui)', outline: 'none', boxSizing: 'border-box',
        }}
        onFocus={e => { e.target.style.borderColor = 'var(--accent)'; }}
        onBlurCapture={e => { e.target.style.borderColor = 'var(--border)'; }}
      />
      {open && results.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
          background: 'var(--bg-surface)', border: '1px solid var(--border)',
          borderRadius: 10, marginTop: 4, overflow: 'hidden',
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
        }}>
          {results.map(s => (
            <div
              key={s.id}
              onMouseDown={() => { onSelect(s); setQuery(s.name); setOpen(false); }}
              style={{
                padding: '12px 16px', cursor: 'pointer', fontSize: 14,
                color: 'var(--text-primary)', borderBottom: '1px solid var(--border-subtle)',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-elevated)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              {s.name}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function RouteSetup() {
  const navigate = useNavigate();
  const [origin, setOrigin]     = useState(null);
  const [dest, setDest]         = useState(null);
  const [trips, setTrips]       = useState([]);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  const findTrips = async () => {
    if (!origin || !dest) { setError('Select both stops first'); return; }
    setError(''); setLoading(true); setTrips([]);
    try {
      const res  = await fetch(`${API_BASE}/api/safecommute/trips?from=${origin.id}&to=${dest.id}`);
      const data = await res.json();
      if (!data.length) setError('No trips found — try different stops');
      setTrips(data);
    } catch { setError('Could not reach server'); }
    setLoading(false);
  };

  const selectTrip = async (trip) => {
    await fetch(`${API_BASE}/api/safecommute/journey`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(trip),
    });
    navigate('/safecommute');
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)', fontFamily: 'var(--font-ui)' }}>

      {/* Header */}
      <div style={{
        background: 'var(--sidebar-bg)', padding: '52px 20px 24px',
      }}>
        <button onClick={() => navigate('/safecommute')} style={{
          background: 'none', border: 'none', color: 'var(--sidebar-muted)',
          fontSize: 13, cursor: 'pointer', padding: 0, marginBottom: 12,
        }}>← Back</button>
        <div style={{ fontSize: 22, fontWeight: 700, color: '#EFE3C2' }}>Set up journey</div>
        <div style={{ fontSize: 13, color: 'var(--sidebar-muted)', marginTop: 4 }}>
          Find the best route for your child
        </div>
      </div>

      <div style={{ padding: '24px 20px' }}>

        <StopInput label="From" value={origin} onSelect={setOrigin} />
        <StopInput label="To"   value={dest}   onSelect={setDest} />

        {error && (
          <div style={{ color: 'var(--red)', fontSize: 13, marginBottom: 12 }}>{error}</div>
        )}

        <button
          onClick={findTrips}
          disabled={loading || !origin || !dest}
          style={{
            width: '100%', padding: '15px', fontSize: 15, fontWeight: 700,
            background: (!origin || !dest) ? 'var(--border)' : 'var(--accent-hot)',
            color: (!origin || !dest) ? 'var(--text-muted)' : '#fff',
            border: 'none', borderRadius: 10, cursor: (!origin || !dest) ? 'not-allowed' : 'pointer',
            marginBottom: 24,
          }}
        >
          {loading ? 'Searching…' : 'Find trips →'}
        </button>

        {trips.map((trip, i) => {
          const firstLeg = trip.legs[0];
          return (
            <div
              key={i}
              onClick={() => selectTrip(trip)}
              style={{
                background: 'var(--bg-surface)', border: '1.5px solid var(--border)',
                borderRadius: 12, padding: '16px', marginBottom: 12, cursor: 'pointer',
              }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 20 }}>{modeIcon(firstLeg.mode)}</span>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
                      {trip.legs.map(l => l.line).filter(Boolean).join(' → ')}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                      {trip.changes === 0 ? 'Direct' : `${trip.changes} change${trip.changes > 1 ? 's' : ''}`}
                    </div>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--accent-hot)' }}>
                    {trip.durationMin} min
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 16, fontSize: 13, color: 'var(--text-secondary)' }}>
                <span>Departs {fmt(trip.departs)}</span>
                <span>Arrives {fmt(trip.arrives)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
