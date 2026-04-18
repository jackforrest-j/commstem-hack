import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

const API_BASE = import.meta.env.VITE_API_URL || '';

function fmt(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: true });
}

const MODE_ICONS = { 1: '🚆', 2: '🚆', 4: '🚆', 5: '🚌', 7: '⛴', 9: '🚃', 11: '🚌' };
function modeIcon(cls) { return MODE_ICONS[cls] ?? '🚌'; }

function StopInput({ label, value, onSelect, placeholder }) {
  const [query, setQuery]     = useState(value?.name || '');
  const [results, setResults] = useState([]);
  const [open, setOpen]       = useState(false);
  const timer = useRef(null);

  useEffect(() => { if (value?.name) setQuery(value.name); }, [value]);

  const onChange = (e) => {
    const q = e.target.value;
    setQuery(q);
    clearTimeout(timer.current);
    if (q.length < 2) { setResults([]); setOpen(false); return; }
    timer.current = setTimeout(async () => {
      try {
        const res = await fetch(`${API_BASE}/api/safecommute/stops?q=${encodeURIComponent(q)}`);
        setResults(await res.json());
        setOpen(true);
      } catch { /* ignore */ }
    }, 300);
  };

  return (
    <div style={{ position: 'relative', marginBottom: 16 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>
        {label}
      </div>
      <input
        value={query}
        onChange={onChange}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder || `Search…`}
        style={{
          width: '100%', padding: '16px', fontSize: 16,
          border: '2px solid var(--border)', borderRadius: 12,
          background: 'var(--bg-surface)', color: 'var(--text-primary)',
          fontFamily: 'var(--font-ui)', outline: 'none', boxSizing: 'border-box',
        }}
        onFocus={e => e.target.style.borderColor = 'var(--accent)'}
        onBlurCapture={e => e.target.style.borderColor = 'var(--border)'}
      />
      {open && results.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
          background: 'var(--bg-surface)', border: '1px solid var(--border)',
          borderRadius: 12, marginTop: 4, overflow: 'hidden',
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
        }}>
          {results.map(s => (
            <div key={s.id}
              onMouseDown={() => { onSelect(s); setQuery(s.name); setOpen(false); }}
              style={{ padding: '14px 16px', cursor: 'pointer', fontSize: 15, color: 'var(--text-primary)', borderBottom: '1px solid var(--border-subtle)' }}
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

export default function ChildView() {
  const navigate = useNavigate();
  const [origin, setOrigin]         = useState(null);
  const [dest, setDest]             = useState(null);
  const [trips, setTrips]           = useState([]);
  const [loading, setLoading]       = useState(false);
  const [locating, setLocating]     = useState(false);
  const [parentSent, setParentSent] = useState(false);
  const [error, setError]           = useState('');
  const watchRef = useRef(null);

  // Auto-detect current location
  useEffect(() => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async pos => {
        try {
          const { latitude: lat, longitude: lon } = pos.coords;
          const res   = await fetch(`${API_BASE}/api/safecommute/stops/nearby?lat=${lat}&lon=${lon}`);
          const stops = await res.json();
          if (stops[0]) setOrigin(stops[0]);
        } catch { /* ignore */ }
        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }, []);

  // Subscribe to parent-sent destination via Supabase Realtime
  useEffect(() => {
    // Load existing pending destination first
    supabase.from('safecommute_state').select('*').eq('id', 'current').single()
      .then(({ data }) => {
        if (data?.pending_destination_id) {
          setDest({ id: data.pending_destination_id, name: data.pending_destination_name });
          setParentSent(true);
        }
      });

    const channel = supabase
      .channel('safecommute_state')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'safecommute_state' }, payload => {
        const { pending_destination_id: id, pending_destination_name: name } = payload.new;
        if (id && name) {
          setDest({ id, name });
          setParentSent(true);
          setTrips([]);
        }
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

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
    // Save journey
    await fetch(`${API_BASE}/api/safecommute/journey`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(trip),
    });
    // Start sharing GPS
    watchRef.current = navigator.geolocation.watchPosition(
      pos => {
        fetch(`${API_BASE}/api/safecommute/child-location`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
        });
      },
      null,
      { enableHighAccuracy: true, maximumAge: 5000 },
    );
    navigate('/safecommute');
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)', fontFamily: 'var(--font-ui)' }}>

      {/* Header */}
      <div style={{ background: 'var(--sidebar-bg)', padding: '52px 24px 28px' }}>
        <div style={{ fontSize: 28, marginBottom: 8 }}>👋</div>
        <div style={{ fontSize: 26, fontWeight: 800, color: '#EFE3C2', lineHeight: 1.2 }}>
          Where are you<br />going today?
        </div>
        <div style={{ fontSize: 14, color: 'var(--sidebar-muted)', marginTop: 8 }}>
          We'll find you the best route
        </div>
      </div>

      <div style={{ padding: '28px 24px' }}>

        {locating && (
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>📍</span> Finding your location…
          </div>
        )}

        <StopInput
          label="You are at"
          value={origin}
          onSelect={setOrigin}
          placeholder="Your current stop…"
        />

        <div style={{ position: 'relative' }}>
          <StopInput
            label="Going to"
            value={dest}
            onSelect={s => { setDest(s); setParentSent(false); }}
            placeholder="Search destination…"
          />
          {parentSent && dest && (
            <div style={{
              position: 'absolute', top: 0, right: 0,
              fontSize: 11, fontWeight: 600, color: 'var(--accent-hot)',
              display: 'flex', alignItems: 'center', gap: 4,
            }}>
              <span>✓</span> Sent by parent
            </div>
          )}
        </div>

        {error && <div style={{ color: 'var(--red)', fontSize: 13, marginBottom: 12 }}>{error}</div>}

        <button
          onClick={findTrips}
          disabled={loading || !origin || !dest}
          style={{
            width: '100%', padding: '16px', fontSize: 16, fontWeight: 700,
            background: (!origin || !dest) ? 'var(--border)' : 'var(--accent-hot)',
            color: (!origin || !dest) ? 'var(--text-muted)' : '#fff',
            border: 'none', borderRadius: 12, cursor: (!origin || !dest) ? 'not-allowed' : 'pointer',
            marginBottom: 28,
          }}
        >
          {loading ? 'Finding trips…' : 'Find my trip →'}
        </button>

        {trips.map((trip, i) => {
          const firstLeg = trip.legs[0];
          return (
            <div key={i} onClick={() => selectTrip(trip)} style={{
              background: 'var(--bg-surface)', border: '2px solid var(--border)',
              borderRadius: 14, padding: '18px', marginBottom: 14, cursor: 'pointer',
            }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 24 }}>{modeIcon(firstLeg.mode)}</span>
                  <div>
                    <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>
                      {trip.legs.map(l => l.line).filter(Boolean).join(' → ')}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                      {trip.changes === 0 ? 'Direct' : `${trip.changes} change${trip.changes > 1 ? 's' : ''}`}
                    </div>
                  </div>
                </div>
                <div style={{ fontSize: 22, fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--accent-hot)' }}>
                  {trip.durationMin}m
                </div>
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                Departs {fmt(trip.departs)} · Arrives {fmt(trip.arrives)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
