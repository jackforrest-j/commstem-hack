import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Map, { Marker, Source, Layer } from 'react-map-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;
const API_BASE     = import.meta.env.VITE_API_URL || '';
const INITIAL_VIEW = { longitude: 151.215, latitude: -33.878, zoom: 13 };

const STATE_META = {
  SELECTING_ROUTE: { bg: '#6366f1', label: 'Choosing a route', icon: '🗺️' },
  WALKING:  { bg: '#F59E0B', label: 'Walking to stop',  icon: '🚶' },
  WAITING:  { bg: '#85A947', label: 'Waiting at stop',  icon: '🚏' },
  AT_STOP:  { bg: '#F59E0B', label: 'At the stop',      icon: '🚏' },
  ON_BUS:   { bg: '#3E7B27', label: 'On the bus',       icon: '🚌' },
  ARRIVED:  { bg: '#2563eb', label: 'Arrived',          icon: '✅' },
};

function haversineM(lat1, lon1, lat2, lon2) {
  const R = 6371000, toR = x => x * Math.PI / 180;
  const dLat = toR(lat2 - lat1), dLon = toR(lon2 - lon1);
  const a = Math.sin(dLat/2)**2 + Math.cos(toR(lat1)) * Math.cos(toR(lat2)) * Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function notify(title, body) {
  if (Notification.permission === 'granted') new Notification(title, { body, icon: '/favicon.ico' });
}

function ShareLink({ childLink, copied, onCopy }) {
  return (
    <div style={{
      background: 'rgba(133,169,71,0.08)', border: '1px solid rgba(133,169,71,0.25)',
      borderRadius: 12, padding: '12px 14px', marginBottom: 16,
    }}>
      <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>
        Share with child
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <div style={{ flex: 1, fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {childLink}
        </div>
        <button
          onClick={onCopy}
          style={{
            padding: '6px 12px', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap',
            background: copied ? '#3E7B27' : 'var(--accent)', color: '#123524',
            border: 'none', borderRadius: 7, cursor: 'pointer',
          }}
        >
          {copied ? '✓ Copied' : 'Copy link'}
        </button>
      </div>
    </div>
  );
}

export default function SafeCommuteDashboard() {
  const { user }   = useAuth();
  const navigate   = useNavigate();
  const [childName, setChildName] = useState('');
  const [status, setStatus]       = useState(null);
  const [vehicles, setVehicles]   = useState([]);
  const [copied, setCopied]       = useState(false);
  const prevStateRef  = useRef(null);
  const prevChildRef  = useRef(null);
  const mapRef        = useRef(null);
  const childLink     = user ? `${window.location.origin}/child?p=${user.id}` : '';

  // Load child name
  useEffect(() => {
    if (!user) return;
    supabase.from('children').select('name').eq('parent_id', user.id).single()
      .then(({ data }) => { if (data?.name) setChildName(data.name); });
  }, [user]);

  // Request notification permission
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Poll status every 3s
  useEffect(() => {
    const poll = async () => {
      try {
        const res  = await fetch(`${API_BASE}/api/safecommute/status?parentId=${user?.id || ''}`);
        const data = await res.json();
        setStatus(data);

        // Notifications
        if (!prevChildRef.current && data.child) {
          notify('Hansel & Gretel', `${childName || 'Your child'} is now sharing their location.`);
        }
        if (prevStateRef.current && prevStateRef.current !== data.state) {
          if (data.state === 'ON_BUS') notify('Hansel & Gretel', `${childName || 'Your child'} is on the bus! 🚌`);
          if (data.state === 'ARRIVED') notify('Hansel & Gretel', `${childName || 'Your child'} has arrived! ✅`);
          if (data.state === 'WAITING' && prevStateRef.current === 'ON_BUS') {
            notify('Hansel & Gretel', `Heads up — ${childName || 'your child'} may have gotten off.`);
          }
          if (data.state === 'WAITING') {
            notify('Hansel & Gretel', `${childName || 'Your child'} is walking to the stop 🚶`);
          }
        }
        prevStateRef.current = data.state;
        prevChildRef.current = data.child;
      } catch { /* ignore */ }
    };
    poll();
    const id = setInterval(poll, 3000);
    return () => clearInterval(id);
  }, [childName]);

  // Poll nearby vehicles every 15s when child is connected
  useEffect(() => {
    if (!status?.child) return;
    const { lat, lon } = status.child;
    const poll = () =>
      fetch(`${API_BASE}/api/safecommute/vehicles/nearby?lat=${lat}&lon=${lon}&parentId=${user?.id || ''}`)
        .then(r => r.json())
        .then(v => Array.isArray(v) && setVehicles(v))
        .catch(() => {});
    poll();
    const id = setInterval(poll, 15000);
    return () => clearInterval(id);
  }, [status?.child?.lat, status?.child?.lon]);

  const copyLink = () => {
    navigator.clipboard.writeText(childLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  const childConnected     = !!status?.child;
  const state              = status?.state ?? 'WAITING';
  const eta                = status?.eta_minutes;
  const stop               = status?.nearest_stop ?? '—';
  const line               = status?.line;
  const childLng           = status?.child?.lon ?? INITIAL_VIEW.longitude;
  const childLat           = status?.child?.lat ?? INITIAL_VIEW.latitude;
  const liveMode           = status?.mode === 'live';
  const originCoord        = status?.originCoord;
  const destCoord          = status?.destCoord;
  const destName           = status?.destName;
  const delayMins          = status?.delayMins;
  const pendingRouteRequest = status?.pendingRouteRequest;

  const respondToApproval = async (approved) => {
    await fetch(`${API_BASE}/api/safecommute/route-approval-response`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ parentId: user?.id, approved }),
    });
  };

  // Detect walking: WAITING state + child location + boarding stop + >10m away
  const distToStop = (state === 'WAITING' && childConnected && originCoord)
    ? Math.round(haversineM(childLat, childLng, originCoord[0], originCoord[1]))
    : null;
  const isWalking  = distToStop !== null && distToStop > 10;
  const walkMins   = distToStop !== null ? Math.max(1, Math.round(distToStop / 80)) : null;
  const isSelectingRoute = status?.mode === 'idle' && childConnected;
  const displayState = isSelectingRoute ? 'SELECTING_ROUTE' : isWalking ? 'WALKING' : state;
  const stateMeta  = STATE_META[displayState] ?? STATE_META.WAITING;

  // Auto-zoom to frame child + boarding stop when walking
  useEffect(() => {
    if (!isWalking || !mapRef.current || !originCoord) return;
    const [sLat, sLon] = originCoord;
    mapRef.current.fitBounds(
      [[Math.min(childLng, sLon) - 0.001, Math.min(childLat, sLat) - 0.001],
       [Math.max(childLng, sLon) + 0.001, Math.max(childLat, sLat) + 0.001]],
      { padding: 80, duration: 900 },
    );
  }, [isWalking, childLat, childLng]);

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#1a1a1a', fontFamily: 'var(--font-ui)' }}>
      <style>{`
        @keyframes ping { 0% { transform: scale(1); opacity: 0.8; } 100% { transform: scale(2.5); opacity: 0; } }
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
      `}</style>

      {/* Map */}
      {MAPBOX_TOKEN ? (
        <Map
          ref={mapRef}
          mapboxAccessToken={MAPBOX_TOKEN}
          initialViewState={INITIAL_VIEW}
          style={{ width: '100%', height: '100%' }}
          mapStyle="mapbox://styles/mapbox/streets-v12"
        >
          {childConnected && (
            <Marker longitude={childLng} latitude={childLat} anchor="center">
              <div style={{ position: 'relative', width: 20, height: 20 }}>
                <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: '#2563eb', animation: 'ping 1.5s ease-out infinite' }} />
                <div style={{ position: 'absolute', inset: 2, borderRadius: '50%', background: '#2563eb', border: '2px solid #fff', boxShadow: '0 2px 8px rgba(0,0,0,0.4)' }} />
              </div>
            </Marker>
          )}

          {/* Dashed walk path: child → boarding stop */}
          {isWalking && originCoord && (
            <Source type="geojson" data={{
              type: 'Feature',
              geometry: {
                type: 'LineString',
                coordinates: [
                  [childLng, childLat],
                  [originCoord[1], originCoord[0]],
                ],
              },
            }}>
              <Layer
                type="line"
                paint={{
                  'line-color': '#F59E0B',
                  'line-width': 3,
                  'line-dasharray': [2, 2],
                  'line-opacity': 0.85,
                }}
                layout={{ 'line-cap': 'round', 'line-join': 'round' }}
              />
            </Source>
          )}

          {originCoord && (
            <Marker longitude={originCoord[1]} latitude={originCoord[0]} anchor="bottom">
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 24 }}>🚏</div>
                <div style={{ fontSize: 9, fontWeight: 700, color: '#fff', background: '#3E7B27', borderRadius: 4, padding: '2px 5px', whiteSpace: 'nowrap', marginTop: 2 }}>Board here</div>
              </div>
            </Marker>
          )}

          {destCoord && (
            <Marker longitude={destCoord[1]} latitude={destCoord[0]} anchor="bottom">
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 24 }}>📍</div>
                <div style={{ fontSize: 9, fontWeight: 700, color: '#123524', background: '#85A947', borderRadius: 4, padding: '2px 5px', whiteSpace: 'nowrap', marginTop: 2, maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {destName?.split(',')[0]}
                </div>
              </div>
            </Marker>
          )}

          {vehicles.map(v => (
            <Marker key={v.id} longitude={v.lon} latitude={v.lat} anchor="center">
              <div style={{
                display: 'flex', alignItems: 'center', gap: 3,
                background: v.isTarget ? '#85A947' : 'rgba(255,255,255,0.92)',
                border: v.isTarget ? '2px solid #3E7B27' : '1px solid rgba(0,0,0,0.18)',
                borderRadius: 6, padding: v.isTarget ? '4px 8px' : '2px 6px',
                fontSize: v.isTarget ? 13 : 10, fontWeight: 700,
                color: v.isTarget ? '#123524' : '#444',
                boxShadow: v.isTarget ? '0 3px 10px rgba(0,0,0,0.45)' : '0 1px 3px rgba(0,0,0,0.2)',
                transform: v.isTarget ? 'scale(1.25)' : 'scale(1)',
                transformOrigin: 'center',
                whiteSpace: 'nowrap', pointerEvents: 'none',
              }}>
                🚌 {v.label}
              </div>
            </Marker>
          ))}
        </Map>
      ) : (
        <div style={{ width: '100%', height: '100%', background: '#e8f0e8', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666', fontSize: 14 }}>
          Set VITE_MAPBOX_TOKEN to see map
        </div>
      )}

      {/* Waiting overlay — shown until child connects */}
      {!childConnected && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 20,
          background: 'rgba(18,53,36,0.85)', backdropFilter: 'blur(8px)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: 32, animation: 'fadeIn 0.4s ease',
        }}>
          {/* Pulse ring */}
          <div style={{ position: 'relative', width: 80, height: 80, marginBottom: 32 }}>
            <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '2px solid #85A947', animation: 'ping 1.5s ease-out infinite' }} />
            <div style={{ position: 'absolute', inset: 8, borderRadius: '50%', border: '2px solid rgba(133,169,71,0.5)', animation: 'ping 1.5s ease-out 0.5s infinite' }} />
            <div style={{ position: 'absolute', inset: 24, borderRadius: '50%', background: '#85A947', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>
              🚌
            </div>
          </div>

          <div style={{ fontSize: 22, fontWeight: 700, color: '#EFE3C2', marginBottom: 8, textAlign: 'center' }}>
            Waiting for {childName || 'your child'} to connect…
          </div>
          <div style={{ fontSize: 14, color: 'rgba(239,227,194,0.6)', marginBottom: 32, textAlign: 'center', lineHeight: 1.5 }}>
            Share the link below so they can start sharing their location
          </div>

          <ShareLink childLink={childLink} copied={copied} onCopy={copyLink} />

          <div style={{ fontSize: 12, color: 'rgba(239,227,194,0.4)', marginTop: 8, textAlign: 'center' }}>
            This screen will update automatically when they connect
          </div>

          <button onClick={() => navigate('/profile')} style={{
            marginTop: 20, padding: '10px 20px', fontSize: 13, fontWeight: 700,
            background: 'rgba(133,169,71,0.15)', color: '#85A947',
            border: '1.5px solid rgba(133,169,71,0.35)', borderRadius: 10, cursor: 'pointer',
          }}>
            ⚙ Edit child profile
          </button>
        </div>
      )}

      {/* Top header — shown once connected */}
      {childConnected && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
          padding: '48px 20px 32px',
          background: 'linear-gradient(to bottom, rgba(18,53,36,0.9) 0%, transparent 100%)',
          animation: 'fadeIn 0.4s ease',
        }}>
          <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'rgba(239,227,194,0.7)', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 4 }}>
            Hansel & Gretel {liveMode && '· Live'}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#EFE3C2' }}>
              {childName ? `${childName}'s Journey` : 'Your child\'s journey'}
            </div>
            <button onClick={() => navigate('/profile')} style={{
              background: '#1e4d2b', border: '1.5px solid #3E7B27', borderRadius: 10,
              padding: '8px 14px', fontSize: 13, fontWeight: 700, color: '#EFE3C2', cursor: 'pointer',
            }}>⚙ Profile</button>
          </div>
        </div>
      )}

      {/* Bottom card */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 10,
        background: 'var(--bg-surface)', borderRadius: '20px 20px 0 0',
        padding: '20px 20px 36px', boxShadow: '0 -4px 32px rgba(0,0,0,0.18)',
      }}>
        <div style={{ width: 36, height: 4, background: 'var(--border-strong)', borderRadius: 2, margin: '0 auto 20px' }} />

        {/* Share link — always visible in bottom card */}
        {childConnected
          ? <ShareLink childLink={childLink} copied={copied} onCopy={copyLink} />
          : null
        }

        {/* State badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: stateMeta.bg, borderRadius: 8, padding: '10px 16px',
          }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'rgba(255,255,255,0.7)' }} />
            <span style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>
              {stateMeta.icon} {stateMeta.label}{line ? ` · ${line}` : ''}
            </span>
          </div>
          {delayMins > 0 && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(248,113,113,0.15)', border: '1px solid rgba(248,113,113,0.4)', borderRadius: 8, padding: '8px 12px' }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#f87171' }}>⚠ {line ? `${line}` : 'Service'} running {delayMins} min behind schedule</span>
            </div>
          )}
        </div>

        {/* Route approval request from child */}
        {pendingRouteRequest && (
          <div style={{
            marginBottom: 16,
            background: 'rgba(245,158,11,0.08)', border: '1.5px solid rgba(245,158,11,0.4)',
            borderRadius: 14, padding: '14px 16px',
          }}>
            <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: '#FBBF24', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>
              Route approval needed
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
              {childName || 'Your child'} wants to use an alternative route
            </div>
            {pendingRouteRequest.filteredModeLabels?.length > 0 && (
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>
                No {pendingRouteRequest.filteredModeLabels.join(' or ')} routes available — they found an alternative.
              </div>
            )}
            {pendingRouteRequest.trip && (() => {
              const leg = pendingRouteRequest.trip.legs?.[0];
              const MODE_ICONS_PARENT = { 1: '🚆', 4: '🚊', 5: '🚌', 7: '🚌', 9: '⛴️', 2: '🚆', 11: '🚇' };
              const secsUntil = Math.round((new Date(pendingRouteRequest.trip.departs) - Date.now()) / 1000);
              const label = secsUntil <= 0 ? 'Now'
                : secsUntil < 3600 ? `${Math.round(secsUntil/60)} min`
                : new Date(pendingRouteRequest.trip.departs).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' });
              return (
                <div style={{
                  background: 'rgba(255,255,255,0.05)', borderRadius: 10,
                  padding: '10px 12px', marginBottom: 12,
                  border: '1px solid rgba(255,255,255,0.08)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 16 }}>{MODE_ICONS_PARENT[leg?.mode] || '🚌'}</span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{leg?.line || '—'}</span>
                    <span style={{ fontSize: 13, color: 'var(--text-muted)', marginLeft: 'auto' }}>in {label}</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {pendingRouteRequest.trip.durationMin} min
                    {pendingRouteRequest.trip.changes > 0 ? ` · ${pendingRouteRequest.trip.changes} change${pendingRouteRequest.trip.changes > 1 ? 's' : ''}` : ' · Direct'}
                    {' · '}to {pendingRouteRequest.trip.legs?.[pendingRouteRequest.trip.legs.length - 1]?.to?.split(',')[0]}
                  </div>
                </div>
              );
            })()}
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => respondToApproval(false)}
                style={{
                  flex: 1, padding: '11px', fontSize: 14, fontWeight: 700,
                  background: 'rgba(248,113,113,0.12)', color: '#f87171',
                  border: '1.5px solid rgba(248,113,113,0.35)', borderRadius: 10, cursor: 'pointer',
                }}
              >
                ✕ Deny
              </button>
              <button
                onClick={() => respondToApproval(true)}
                style={{
                  flex: 2, padding: '11px', fontSize: 14, fontWeight: 700,
                  background: 'linear-gradient(135deg, #85A947 0%, #3E7B27 100%)',
                  color: '#fff', border: 'none', borderRadius: 10, cursor: 'pointer',
                  boxShadow: '0 3px 12px rgba(62,123,39,0.4)',
                }}
              >
                ✓ Approve route
              </button>
            </div>
          </div>
        )}

        {/* Stats row */}
        {isWalking ? (
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 10, padding: '14px 16px' }}>
              <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 6 }}>Distance</div>
              <div style={{ fontSize: 26, fontWeight: 700, fontFamily: 'var(--font-mono)', color: '#F59E0B', lineHeight: 1 }}>
                {distToStop < 1000 ? `${distToStop}m` : `${(distToStop/1000).toFixed(1)}km`}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>to stop</div>
            </div>
            <div style={{ flex: 2, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 10, padding: '14px 16px' }}>
              <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 6 }}>Walk ETA</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.3 }}>~{walkMins} min to {stop !== '—' ? stop : (status?.originName ?? 'stop')}</div>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1, background: 'var(--bg-elevated)', borderRadius: 10, padding: '14px 16px' }}>
              <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 6 }}>ETA</div>
              <div style={{ fontSize: 28, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', lineHeight: 1 }}>
                {eta != null ? eta : '—'}
              </div>
              {eta != null && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>minutes</div>}
            </div>
            <div style={{ flex: 2, background: 'var(--bg-elevated)', borderRadius: 10, padding: '14px 16px' }}>
              <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 6 }}>Stop</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.3 }}>{stop}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
