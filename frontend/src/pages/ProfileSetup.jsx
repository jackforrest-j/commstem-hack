import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

const API_BASE = import.meta.env.VITE_API_URL || '';
const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

const WALK_OPTIONS = [
  { value: 'slow',   label: 'Slow',   emoji: '🐢', desc: '~60 m/min' },
  { value: 'normal', label: 'Normal', emoji: '🚶', desc: '~80 m/min' },
  { value: 'fast',   label: 'Fast',   emoji: '🏃', desc: '~100 m/min' },
];

const PRESET_DESTINATIONS = [
  { label: 'Home',   emoji: '🏠' },
  { label: 'School', emoji: '🏫' },
];

// Address search using Mapbox Geocoding — returns any address, not just transit stops
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
  const { user }   = useAuth();
  const navigate   = useNavigate();

  // Load existing data
  const [childId, setChildId]           = useState(null);
  const [walkSpeed, setWalkSpeed]       = useState('normal');
  const [destinations, setDestinations] = useState([
    { label: 'Home',   emoji: '🏠', stop: null },
    { label: 'School', emoji: '🏫', stop: null },
  ]);
  const [extras, setExtras]   = useState([]); // custom destinations
  const [step, setStep]       = useState(0);  // 0=walk, 1=presets, 2=extras
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);

  useEffect(() => {
    if (!user) return;
    // Load child record
    supabase.from('children').select('id, walking_speed').eq('parent_id', user.id).single()
      .then(({ data }) => {
        if (data) {
          setChildId(data.id);
          if (data.walking_speed) setWalkSpeed(data.walking_speed);
        }
      });
    // Load existing destinations
    supabase.from('child_destinations')
      .select('*').eq('parent_id', user.id).order('sort_order')
      .then(({ data }) => {
        if (!data?.length) return;
        const presetLabels = ['Home', 'School'];
        const updatedPresets = [...destinations];
        const loadedExtras = [];
        for (const d of data) {
          const pi = presetLabels.indexOf(d.label);
          if (pi !== -1) {
            updatedPresets[pi] = { ...updatedPresets[pi], stop: { id: d.stop_id || null, name: d.stop_name, coord: d.stop_coord } };
          } else {
            loadedExtras.push({ label: d.label, emoji: d.emoji, stop: { id: d.stop_id || null, name: d.stop_name, coord: d.stop_coord } });
          }
        }
        setDestinations(updatedPresets);
        setExtras(loadedExtras);
      });
  }, [user]);

  const addExtra = () => setExtras(e => [...e, { label: '', emoji: '📍', stop: null }]);
  const removeExtra = i => setExtras(e => e.filter((_, idx) => idx !== i));
  const updateExtra = (i, field, val) =>
    setExtras(e => e.map((x, idx) => idx === i ? { ...x, [field]: val } : x));

  const save = async () => {
    if (!user) return;
    setSaving(true);

    // Save walking speed
    if (childId) {
      await supabase.from('children').update({ walking_speed: walkSpeed }).eq('id', childId);
    }

    // Delete all existing destinations and re-insert
    await supabase.from('child_destinations').delete().eq('parent_id', user.id);

    const allDests = [
      ...destinations.filter(d => d.stop),
      ...extras.filter(d => d.stop && d.label.trim()),
    ].map((d, i) => ({
      parent_id:  user.id,
      label:      d.label,
      emoji:      d.emoji,
      stop_id:    d.stop.id || null,   // null for address destinations
      stop_name:  d.stop.name,
      stop_coord: d.stop.coord || [],
      sort_order: i,
    }));

    if (allDests.length) {
      await supabase.from('child_destinations').insert(allDests);
    }

    setSaving(false);
    setSaved(true);
    setTimeout(() => navigate('/safecommute'), 1200);
  };

  const STEPS = [
    {
      title: 'Walking speed',
      subtitle: 'How fast does your child walk to the stop?',
      content: (
        <div style={{ display: 'flex', gap: 12, marginBottom: 32 }}>
          {WALK_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setWalkSpeed(opt.value)}
              style={{
                flex: 1, padding: '20px 12px', borderRadius: 14, border: 'none', cursor: 'pointer',
                background: walkSpeed === opt.value ? '#85A947' : 'var(--bg-surface)',
                outline: walkSpeed === opt.value ? '2px solid #3E7B27' : '2px solid var(--border)',
                transition: 'all 0.15s',
              }}
            >
              <div style={{ fontSize: 32, marginBottom: 6 }}>{opt.emoji}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: walkSpeed === opt.value ? '#123524' : 'var(--text-primary)' }}>{opt.label}</div>
              <div style={{ fontSize: 11, color: walkSpeed === opt.value ? '#1a4a10' : 'var(--text-muted)', marginTop: 2 }}>{opt.desc}</div>
            </button>
          ))}
        </div>
      ),
    },
    {
      title: 'Saved places',
      subtitle: 'Set your child\'s regular destinations',
      content: (
        <div style={{ marginBottom: 24 }}>
          {destinations.map((dest, i) => (
            <div key={dest.label} style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 20 }}>{dest.emoji}</span>
                <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{dest.label}</span>
                {dest.stop && <span style={{ fontSize: 11, color: '#85A947', marginLeft: 'auto' }}>✓ Set</span>}
              </div>
              <AddressSearch
                placeholder={`Search for ${dest.label.toLowerCase()} stop…`}
                initial={dest.stop ? { name: dest.stop.name } : null}
                onSelect={s => setDestinations(ds => ds.map((d, idx) => idx === i ? { ...d, stop: s } : d))}
              />
            </div>
          ))}
        </div>
      ),
    },
    {
      title: 'Other places',
      subtitle: 'Add any other places your child travels to',
      content: (
        <div style={{ marginBottom: 24 }}>
          {extras.map((ex, i) => (
            <div key={i} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px', marginBottom: 12 }}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                <input
                  value={ex.emoji}
                  onChange={e => updateExtra(i, 'emoji', e.target.value)}
                  placeholder="📍"
                  style={{ ...inputStyle, width: 52, textAlign: 'center', padding: '10px 8px', fontSize: 18 }}
                />
                <input
                  value={ex.label}
                  onChange={e => updateExtra(i, 'label', e.target.value)}
                  placeholder="Label (e.g. Gran's house)"
                  style={{ ...inputStyle, flex: 1 }}
                />
                <button onClick={() => removeExtra(i)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 18, cursor: 'pointer', padding: '0 4px' }}>✕</button>
              </div>
              <AddressSearch
                placeholder="Search for stop…"
                initial={ex.stop ? { name: ex.stop.name } : null}
                onSelect={s => updateExtra(i, 'stop', s)}
              />
            </div>
          ))}
          <button onClick={addExtra} style={{ width: '100%', padding: '13px', fontSize: 14, fontWeight: 600, background: 'none', border: '2px dashed var(--border)', borderRadius: 12, color: 'var(--text-muted)', cursor: 'pointer' }}>
            + Add a place
          </button>
        </div>
      ),
    },
  ];

  const currentStep = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)', fontFamily: 'var(--font-ui)' }}>
      {/* Header */}
      <div style={{ background: 'var(--sidebar-bg)', padding: '52px 24px 28px' }}>
        <button onClick={() => step > 0 ? setStep(s => s - 1) : navigate('/safecommute')} style={{
          background: 'none', border: 'none', color: 'var(--sidebar-muted)', fontSize: 13, cursor: 'pointer', padding: 0, marginBottom: 16,
        }}>← {step > 0 ? 'Back' : 'Dashboard'}</button>

        {/* Progress dots */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
          {STEPS.map((_, i) => (
            <div key={i} style={{ height: 4, borderRadius: 2, flex: 1, background: i <= step ? '#85A947' : 'rgba(255,255,255,0.15)', transition: 'background 0.2s' }} />
          ))}
        </div>

        <div style={{ fontSize: 22, fontWeight: 800, color: '#EFE3C2' }}>{currentStep.title}</div>
        <div style={{ fontSize: 14, color: 'var(--sidebar-muted)', marginTop: 4 }}>{currentStep.subtitle}</div>
      </div>

      <div style={{ padding: '28px 24px' }}>
        {currentStep.content}

        <button
          onClick={isLast ? save : () => setStep(s => s + 1)}
          disabled={saving}
          style={{
            width: '100%', padding: '16px', fontSize: 16, fontWeight: 700,
            background: saved ? '#3E7B27' : '#85A947', color: '#123524',
            border: 'none', borderRadius: 12, cursor: 'pointer',
          }}
        >
          {saved ? '✓ Saved!' : saving ? 'Saving…' : isLast ? 'Save profile →' : 'Next →'}
        </button>
      </div>
    </div>
  );
}

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
