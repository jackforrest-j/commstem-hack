import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

const API_BASE     = import.meta.env.VITE_API_URL || '';
const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

const WALK_OPTIONS = [
  { value: 'slow',   label: 'Slow',   emoji: '🐢', desc: '~60 m/min' },
  { value: 'normal', label: 'Normal', emoji: '🚶', desc: '~80 m/min' },
  { value: 'fast',   label: 'Fast',   emoji: '🏃', desc: '~100 m/min' },
];

function AddressSearch({ placeholder, onSelect, initial }) {
  const [query, setQuery]     = useState(initial?.name || '');
  const [results, setResults] = useState([]);
  const timer = useRef(null);

  useEffect(() => { setQuery(initial?.name || ''); }, [initial]);

  const onChange = e => {
    const q = e.target.value;
    setQuery(q);
    clearTimeout(timer.current);
    if (q.length < 2) { setResults([]); return; }
    timer.current = setTimeout(async () => {
      if (!MAPBOX_TOKEN) return;
      try {
        const res = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json` +
          `?country=AU&proximity=151.2093,-33.8688&limit=5&access_token=${MAPBOX_TOKEN}`
        );
        const data = await res.json();
        setResults(data.features || []);
      } catch { /* ignore */ }
    }, 300);
  };

  return (
    <div style={{ position: 'relative' }}>
      <input
        value={query}
        onChange={onChange}
        onBlur={() => setTimeout(() => setResults([]), 150)}
        placeholder={placeholder}
        style={inputStyle}
      />
      {results.length > 0 && (
        <div style={dropdownStyle}>
          {results.map(f => (
            <div
              key={f.id}
              onMouseDown={() => {
                const [lon, lat] = f.center;
                onSelect({ id: null, name: f.place_name, coord: [lat, lon] });
                setQuery(f.place_name);
                setResults([]);
              }}
              style={dropItemStyle}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-elevated)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              📍 {f.place_name}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ProfileSetup() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [view, setView] = useState('menu'); // 'menu' | 'locations' | 'preferences'

  const [childId, setChildId]           = useState(null);
  const [walkSpeed, setWalkSpeed]       = useState('normal');
  const [destinations, setDestinations] = useState([
    { label: 'Home',   emoji: '🏠', stop: null },
    { label: 'School', emoji: '🏫', stop: null },
  ]);
  const [extras, setExtras] = useState([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved]   = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from('children').select('id, walking_speed').eq('parent_id', user.id).single()
      .then(({ data }) => {
        if (data) { setChildId(data.id); if (data.walking_speed) setWalkSpeed(data.walking_speed); }
      });
    supabase.from('child_destinations').select('*').eq('parent_id', user.id).order('sort_order')
      .then(({ data }) => {
        if (!data?.length) return;
        const updatedPresets = [
          { label: 'Home',   emoji: '🏠', stop: null },
          { label: 'School', emoji: '🏫', stop: null },
        ];
        const loadedExtras = [];
        for (const d of data) {
          const pi = ['Home', 'School'].indexOf(d.label);
          if (pi !== -1) updatedPresets[pi] = { ...updatedPresets[pi], stop: { id: d.stop_id || null, name: d.stop_name, coord: d.stop_coord } };
          else loadedExtras.push({ label: d.label, emoji: d.emoji, stop: { id: d.stop_id || null, name: d.stop_name, coord: d.stop_coord } });
        }
        setDestinations(updatedPresets);
        setExtras(loadedExtras);
      });
  }, [user]);

  const saveLocations = async () => {
    if (!user) return;
    setSaving(true);
    await supabase.from('child_destinations').delete().eq('parent_id', user.id);
    const allDests = [
      ...destinations.filter(d => d.stop),
      ...extras.filter(d => d.stop && d.label.trim()),
    ].map((d, i) => ({
      parent_id: user.id, label: d.label, emoji: d.emoji,
      stop_id: d.stop.id || null, stop_name: d.stop.name,
      stop_coord: d.stop.coord || [], sort_order: i,
    }));
    if (allDests.length) await supabase.from('child_destinations').insert(allDests);
    setSaving(false); setSaved(true);
    setTimeout(() => { setSaved(false); setView('menu'); }, 1200);
  };

  const savePreferences = async () => {
    if (!user || !childId) return;
    setSaving(true);
    await supabase.from('children').update({ walking_speed: walkSpeed }).eq('id', childId);
    setSaving(false); setSaved(true);
    setTimeout(() => { setSaved(false); setView('menu'); }, 1200);
  };

  const addExtra    = () => setExtras(e => [...e, { label: '', emoji: '📍', stop: null }]);
  const removeExtra = i  => setExtras(e => e.filter((_, idx) => idx !== i));
  const updateExtra = (i, field, val) => setExtras(e => e.map((x, idx) => idx === i ? { ...x, [field]: val } : x));

  // ── Menu ────────────────────────────────────────────────────────────────────
  if (view === 'menu') {
    const menuItems = [
      {
        icon: '📍',
        title: 'Saved locations',
        subtitle: 'Manage where your child travels to',
        detail: destinations.filter(d => d.stop).length + extras.filter(d => d.stop).length + ' location(s) saved',
        action: () => setView('locations'),
      },
      {
        icon: '🚶',
        title: 'Child preferences',
        subtitle: 'Walking speed and travel settings',
        detail: `Walking speed: ${WALK_OPTIONS.find(o => o.value === walkSpeed)?.label || 'Normal'}`,
        action: () => setView('preferences'),
      },
    ];

    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg-base)', fontFamily: 'var(--font-ui)' }}>
        <div style={{ background: 'var(--sidebar-bg)', padding: '52px 24px 32px' }}>
          <button onClick={() => navigate('/safecommute')} style={backBtnStyle}>
            ← Dashboard
          </button>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#EFE3C2', marginTop: 12 }}>Profile</div>
          <div style={{ fontSize: 14, color: 'var(--sidebar-muted)', marginTop: 4 }}>Manage your child's settings</div>
        </div>

        <div style={{ padding: '24px' }}>
          {menuItems.map(item => (
            <button
              key={item.title}
              onClick={item.action}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 16,
                background: 'var(--bg-surface)', border: '1.5px solid var(--border)',
                borderRadius: 16, padding: '18px 20px', marginBottom: 12,
                cursor: 'pointer', textAlign: 'left',
                transition: 'border-color 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.borderColor = '#85A947'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
            >
              <div style={{
                width: 52, height: 52, borderRadius: 14, flexShrink: 0,
                background: 'rgba(133,169,71,0.12)', border: '1.5px solid rgba(133,169,71,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24,
              }}>
                {item.icon}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>{item.title}</div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{item.subtitle}</div>
                <div style={{ fontSize: 11, color: '#85A947', marginTop: 4, fontWeight: 600 }}>{item.detail}</div>
              </div>
              <div style={{ fontSize: 20, color: 'var(--text-muted)' }}>›</div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ── Saved locations ──────────────────────────────────────────────────────────
  if (view === 'locations') {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg-base)', fontFamily: 'var(--font-ui)' }}>
        <div style={{ background: 'var(--sidebar-bg)', padding: '52px 24px 28px' }}>
          <button onClick={() => setView('menu')} style={backBtnStyle}>← Profile</button>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#EFE3C2', marginTop: 12 }}>Saved locations</div>
          <div style={{ fontSize: 14, color: 'var(--sidebar-muted)', marginTop: 4 }}>Set your child's regular destinations</div>
        </div>

        <div style={{ padding: '28px 24px' }}>
          {destinations.map((dest, i) => (
            <div key={dest.label} style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 20 }}>{dest.emoji}</span>
                <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{dest.label}</span>
                {dest.stop && <span style={{ fontSize: 11, color: '#85A947', marginLeft: 'auto' }}>✓ Set</span>}
              </div>
              <AddressSearch
                placeholder={`Search for ${dest.label.toLowerCase()} address…`}
                initial={dest.stop ? { name: dest.stop.name } : null}
                onSelect={s => setDestinations(ds => ds.map((d, idx) => idx === i ? { ...d, stop: s } : d))}
              />
            </div>
          ))}

          <div style={{ height: 1, background: 'var(--border)', margin: '24px 0' }} />
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Other places</div>

          {extras.map((ex, i) => (
            <div key={i} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px', marginBottom: 12 }}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                <input value={ex.emoji} onChange={e => updateExtra(i, 'emoji', e.target.value)} placeholder="📍"
                  style={{ ...inputStyle, width: 52, textAlign: 'center', padding: '10px 8px', fontSize: 18 }} />
                <input value={ex.label} onChange={e => updateExtra(i, 'label', e.target.value)} placeholder="Label (e.g. Gran's house)"
                  style={{ ...inputStyle, flex: 1 }} />
                <button onClick={() => removeExtra(i)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 18, cursor: 'pointer', padding: '0 4px' }}>✕</button>
              </div>
              <AddressSearch placeholder="Search for address…" initial={ex.stop ? { name: ex.stop.name } : null} onSelect={s => updateExtra(i, 'stop', s)} />
            </div>
          ))}

          <button onClick={addExtra} style={{ width: '100%', padding: '13px', fontSize: 14, fontWeight: 600, background: 'none', border: '2px dashed var(--border)', borderRadius: 12, color: 'var(--text-muted)', cursor: 'pointer', marginBottom: 24 }}>
            + Add a place
          </button>

          <button onClick={saveLocations} disabled={saving} style={saveBtn(saved)}>
            {saved ? '✓ Saved!' : saving ? 'Saving…' : 'Save locations →'}
          </button>
        </div>
      </div>
    );
  }

  // ── Child preferences ────────────────────────────────────────────────────────
  if (view === 'preferences') {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg-base)', fontFamily: 'var(--font-ui)' }}>
        <div style={{ background: 'var(--sidebar-bg)', padding: '52px 24px 28px' }}>
          <button onClick={() => setView('menu')} style={backBtnStyle}>← Profile</button>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#EFE3C2', marginTop: 12 }}>Child preferences</div>
          <div style={{ fontSize: 14, color: 'var(--sidebar-muted)', marginTop: 4 }}>How fast does your child walk to the stop?</div>
        </div>

        <div style={{ padding: '28px 24px' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Walking speed</div>
          <div style={{ display: 'flex', gap: 12, marginBottom: 32 }}>
            {WALK_OPTIONS.map(opt => (
              <button key={opt.value} onClick={() => setWalkSpeed(opt.value)} style={{
                flex: 1, padding: '20px 12px', borderRadius: 14, border: 'none', cursor: 'pointer',
                background: walkSpeed === opt.value ? '#85A947' : 'var(--bg-surface)',
                outline: walkSpeed === opt.value ? '2px solid #3E7B27' : '2px solid var(--border)',
                transition: 'all 0.15s',
              }}>
                <div style={{ fontSize: 32, marginBottom: 6 }}>{opt.emoji}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: walkSpeed === opt.value ? '#123524' : 'var(--text-primary)' }}>{opt.label}</div>
                <div style={{ fontSize: 11, color: walkSpeed === opt.value ? '#1a4a10' : 'var(--text-muted)', marginTop: 2 }}>{opt.desc}</div>
              </button>
            ))}
          </div>

          <button onClick={savePreferences} disabled={saving} style={saveBtn(saved)}>
            {saved ? '✓ Saved!' : saving ? 'Saving…' : 'Save preferences →'}
          </button>
        </div>
      </div>
    );
  }

  return null;
}

const backBtnStyle = {
  background: 'none', border: 'none', color: 'var(--sidebar-muted)',
  fontSize: 13, cursor: 'pointer', padding: 0,
};

const saveBtn = (saved) => ({
  width: '100%', padding: '16px', fontSize: 16, fontWeight: 700,
  background: saved ? '#3E7B27' : '#85A947', color: '#123524',
  border: 'none', borderRadius: 12, cursor: 'pointer',
});

const inputStyle = {
  width: '100%', padding: '12px 14px', fontSize: 15,
  border: '1.5px solid var(--border)', borderRadius: 10,
  background: 'var(--bg-surface)', color: 'var(--text-primary)',
  fontFamily: 'var(--font-ui)', outline: 'none', boxSizing: 'border-box',
};

const dropdownStyle = {
  position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
  background: 'var(--bg-surface)', border: '1px solid var(--border)',
  borderRadius: 10, marginTop: 4, overflow: 'hidden',
  boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
};

const dropItemStyle = {
  padding: '12px 14px', cursor: 'pointer', fontSize: 14,
  color: 'var(--text-primary)', borderBottom: '1px solid var(--border-subtle)',
};
