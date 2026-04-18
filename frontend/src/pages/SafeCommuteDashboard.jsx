import { useEffect, useRef, useState } from 'react';
import Map, { Marker } from 'react-map-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

const initialViewState = {
  longitude: 151.22,
  latitude: -33.88,
  zoom: 12,
};

const STATE_STYLES = {
  WAITING: { background: 'var(--accent)', color: '#fff' },
  ON_BUS:  { background: 'var(--accent-hot)', color: '#fff' },
};

const CARD_BASE = {
  flex: 1,
  background: 'var(--bg-surface)',
  border: '1px solid var(--border)',
  padding: '16px',
};

const LABEL_STYLE = {
  fontSize: 10,
  fontFamily: 'var(--font-mono)',
  color: 'var(--text-muted)',
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  marginBottom: 10,
};

function InfoCard({ label, children }) {
  return (
    <div style={CARD_BASE}>
      <div style={LABEL_STYLE}>{label}</div>
      {children}
    </div>
  );
}

export default function SafeCommuteDashboard() {
  const [phase, setPhase]   = useState('WAITING');
  const [status, setStatus] = useState(null);
  const lastJson = useRef(null);

  useEffect(() => {
    setStatus(null);
    lastJson.current = null;

    const poll = async () => {
      try {
        const res  = await fetch(`/api/safecommute/status?phase=${phase}`);
        const data = await res.json();
        const json = JSON.stringify(data);
        if (json !== lastJson.current) {
          lastJson.current = json;
          setStatus(data);
        }
      } catch {
        // ignore network errors during demo
      }
    };
    poll();
    const id = setInterval(poll, 3000);
    return () => clearInterval(id);
  }, [phase]);

  const state       = status?.state                      ?? phase;
  const eta         = status?.eta_minutes                ?? '—';
  const nearestStop = status?.nearest_stop               ?? '—';
  const childLng    = status?.child_location?.longitude  ?? 151.215;
  const childLat    = status?.child_location?.latitude   ?? -33.875;
  const busLng      = status?.bus_location?.longitude    ?? 151.225;
  const busLat      = status?.bus_location?.latitude     ?? -33.885;

  const badgeStyle = STATE_STYLES[state] ?? STATE_STYLES.WAITING;

  return (
    <div style={{ background: 'var(--bg-base)', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>

      <div style={{
        background: 'var(--bg-surface)',
        borderBottom: '1px solid var(--border)',
        padding: '16px 24px',
      }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
          SafeCommute
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
          Alex's Journey
        </div>
      </div>

      <div style={{ padding: '24px', flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>

        <div style={{ display: 'flex', gap: 16 }}>
          <InfoCard label="State">
            <span style={{
              ...badgeStyle,
              display: 'inline-block',
              padding: '4px 12px',
              fontSize: 12,
              fontWeight: 700,
              fontFamily: 'var(--font-mono)',
              letterSpacing: '0.1em',
              borderRadius: 4,
            }}>
              {state}
            </span>
          </InfoCard>

          <InfoCard label="ETA">
            <div style={{ fontSize: 24, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', lineHeight: 1 }}>
              {eta === '—' ? '—' : `${eta} min`}
            </div>
          </InfoCard>

          <InfoCard label="Nearest Stop">
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
              {nearestStop}
            </div>
          </InfoCard>
        </div>

        <div style={{
          height: 420,
          border: '1px solid var(--border)',
          overflow: 'hidden',
          position: 'relative',
        }}>
          {MAPBOX_TOKEN ? (
            <Map
              mapboxAccessToken={MAPBOX_TOKEN}
              initialViewState={initialViewState}
              style={{ width: '100%', height: '100%' }}
              mapStyle="mapbox://styles/mapbox/streets-v12"
            >
              <Marker longitude={childLng} latitude={childLat} anchor="center">
                <div style={{
                  width: 14,
                  height: 14,
                  borderRadius: '50%',
                  background: '#2563eb',
                  border: '2px solid #fff',
                }} />
              </Marker>

              <Marker longitude={busLng} latitude={busLat} anchor="center">
                <div style={{ fontSize: 22, lineHeight: 1 }}>
                  🚌
                </div>
              </Marker>
            </Map>
          ) : (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              background: 'var(--bg-surface)',
              color: 'var(--text-muted)',
              fontFamily: 'var(--font-mono)',
              fontSize: 13,
            }}>
              Set VITE_MAPBOX_TOKEN to see map
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
            Demo phase:
          </span>
          {['WAITING', 'ON_BUS'].map(p => (
            <button
              key={p}
              onClick={() => setPhase(p)}
              style={{
                padding: '7px 16px',
                fontSize: 11,
                fontFamily: 'var(--font-mono)',
                fontWeight: 600,
                letterSpacing: '0.1em',
                cursor: 'pointer',
                border: '1px solid var(--border)',
                borderRadius: 4,
                background: phase === p ? 'var(--accent)' : 'var(--bg-surface)',
                color: phase === p ? '#fff' : 'var(--text-secondary)',
              }}
            >
              {p}
            </button>
          ))}
        </div>

      </div>
    </div>
  );
}
