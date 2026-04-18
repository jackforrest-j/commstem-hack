import { useState, useRef } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || '';

export default function ChildView() {
  const [sharing, setSharing]   = useState(false);
  const [coords, setCoords]     = useState(null);
  const [error, setError]       = useState('');
  const watchRef = useRef(null);

  const start = () => {
    if (!navigator.geolocation) { setError('GPS not available on this device'); return; }
    setError('');
    watchRef.current = navigator.geolocation.watchPosition(
      pos => {
        const { latitude: lat, longitude: lon, accuracy } = pos.coords;
        setCoords({ lat: lat.toFixed(6), lon: lon.toFixed(6), accuracy: Math.round(accuracy) });
        fetch(`${API_BASE}/api/safecommute/child-location`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lat, lon }),
        })
          .then(r => { if (!r.ok) setError(`Server error: ${r.status} — check CORS/API config`); else setError(''); })
          .catch(e => setError(`Cannot reach server: ${e.message}`));
      },
      err => setError(`GPS error: ${err.message}`),
      { enableHighAccuracy: true, maximumAge: 5000 },
    );
    setSharing(true);
  };

  const stop = () => {
    navigator.geolocation.clearWatch(watchRef.current);
    setSharing(false);
    setCoords(null);
  };

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--sidebar-bg)',
      fontFamily: 'var(--font-ui)', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', padding: '40px 24px',
    }}>

      <div style={{ textAlign: 'center', maxWidth: 320 }}>
        <div style={{ fontSize: 56, marginBottom: 24 }}>
          {sharing ? '📍' : '🚌'}
        </div>

        <div style={{ fontSize: 26, fontWeight: 800, color: '#EFE3C2', marginBottom: 12 }}>
          {sharing ? 'Location shared' : 'Ready to go?'}
        </div>

        <div style={{ fontSize: 15, color: 'var(--sidebar-muted)', marginBottom: 40, lineHeight: 1.5 }}>
          {sharing
            ? 'Your location is being sent to your parent in real time.'
            : 'Tap the button so your parent can see where you are.'}
        </div>

        {error && (
          <div style={{ color: '#f87171', fontSize: 13, marginBottom: 20 }}>
            {error}
            <div style={{ fontSize: 10, opacity: 0.6, marginTop: 4, wordBreak: 'break-all' }}>URL: {API_BASE || '(empty)'}/api/safecommute/child-location</div>
          </div>
        )}

        {coords && (
          <div style={{
            background: 'rgba(133,169,71,0.15)', border: '1px solid rgba(133,169,71,0.3)',
            borderRadius: 10, padding: '12px 16px', marginBottom: 24, textAlign: 'left',
          }}>
            <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--sidebar-muted)', marginBottom: 6 }}>
              LIVE LOCATION
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: '#EFE3C2' }}>
              {coords.lat}, {coords.lon}
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--sidebar-muted)', marginTop: 4 }}>
              ±{coords.accuracy}m accuracy
            </div>
          </div>
        )}

        <button
          onClick={sharing ? stop : start}
          style={{
            width: '100%', padding: '18px', fontSize: 17, fontWeight: 700,
            background: sharing ? 'rgba(220,38,38,0.2)' : '#85A947',
            color: sharing ? '#f87171' : '#123524',
            border: sharing ? '2px solid rgba(220,38,38,0.4)' : 'none',
            borderRadius: 14, cursor: 'pointer',
          }}
        >
          {sharing ? 'Stop sharing' : 'Share my location'}
        </button>
      </div>
    </div>
  );
}
