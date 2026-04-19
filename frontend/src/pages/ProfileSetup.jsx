import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

const API_BASE     = import.meta.env.VITE_API_URL || '';
const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;


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
  const [familiarity, setFamiliarity]   = useState('beginner');
  const [transferTol, setTransferTol]   = useState(1);
  const [walkTolM, setWalkTolM]         = useState(500);
  const [bufferMins, setBufferMins]     = useState(5);
  const [allowedModes, setAllowedModes] = useState(null); // null = all
  const [destinations, setDestinations] = useState([
    { label: 'Home',   emoji: '🏠', stop: null },
    { label: 'School', emoji: '🏫', stop: null },
  ]);
  const [extras, setExtras] = useState([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved]   = useState(false);

  const toggleMode = (modes) => setAllowedModes(prev => {
    const arr = Array.isArray(modes) ? modes : [modes];
    const base = prev || [];
    const hasAll = arr.every(m => base.includes(m));
    const next = hasAll ? base.filter(x => !arr.includes(x)) : [...new Set([...base, ...arr])];
    return next.length === 0 ? null : next;
  });

  useEffect(() => {
    if (!user) return;
    supabase.from('children')
      .select('id, walking_speed, familiarity_level, transfer_tolerance, walk_tolerance_m, buffer_minutes, allowed_modes, fallback_preference')
      .eq('parent_id', user.id).single()
      .then(({ data }) => {
        if (!data) return;
        setChildId(data.id);
        if (data.walking_speed) setWalkSpeed(data.walking_speed);
        if (data.familiarity_level) setFamiliarity(data.familiarity_level);
        if (data.transfer_tolerance != null) setTransferTol(data.transfer_tolerance);
        if (data.walk_tolerance_m != null) setWalkTolM(data.walk_tolerance_m);
        if (data.buffer_minutes != null) setBufferMins(data.buffer_minutes);
        setAllowedModes(data.allowed_modes?.length ? data.allowed_modes.map(Number) : null);
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
    await supabase.from('children').update({
      walking_speed:       walkSpeed,
      familiarity_level:   familiarity,
      transfer_tolerance:  transferTol,
      walk_tolerance_m:    walkTolM,
      buffer_minutes:      bufferMins,
      allowed_modes:       allowedModes,
    }).eq('id', childId);
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
        detail: `Walking pace: ${{ slow: 'Slow', normal: 'Normal', fast: 'Fast' }[walkSpeed] || 'Normal'}`,
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
    const prefSection = (label, subtitle) => (
      <div style={{ marginTop: 28, marginBottom: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</div>
        {subtitle && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3, opacity: 0.7 }}>{subtitle}</div>}
      </div>
    );
    const optRow = (options, value, onSelect) => (
      <div style={{ display: 'flex', gap: 10, marginBottom: 4 }}>
        {options.map(opt => {
          const active = value === opt.value;
          return (
            <button key={opt.value} onClick={() => onSelect(opt.value)} style={{
              flex: 1, padding: '14px 8px', borderRadius: 12, border: 'none', cursor: 'pointer',
              background: active ? '#85A947' : 'var(--bg-surface)',
              outline: active ? '2px solid #3E7B27' : '2px solid var(--border)',
              transition: 'all 0.15s', textAlign: 'center',
            }}>
              <div style={{ fontSize: 24, marginBottom: 4 }}>{opt.emoji}</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: active ? '#123524' : 'var(--text-primary)' }}>{opt.label}</div>
              {opt.desc && <div style={{ fontSize: 10, color: active ? '#1a4a10' : 'var(--text-muted)', marginTop: 2 }}>{opt.desc}</div>}
            </button>
          );
        })}
      </div>
    );

    const TRANSPORT_CHIPS = [
      { modes: [1, 2, 11], label: 'Train', emoji: '🚆' },
      { modes: [5, 7, 10], label: 'Bus',   emoji: '🚌' },
      { modes: [4],        label: 'Tram',  emoji: '🚊' },
      { modes: [9],        label: 'Ferry', emoji: '⛴️' },
    ];
    const allActive = allowedModes === null;

    const WALK_DISTANCES = {
      slow:   [{ value: 150,  label: '150m', desc: '~2.5 min' }, { value: 300,  label: '300m', desc: '~5 min'  }, { value: 600,  label: '600m',  desc: '~10 min' }],
      normal: [{ value: 200,  label: '200m', desc: '~2.5 min' }, { value: 500,  label: '500m', desc: '~6 min'  }, { value: 1000, label: '1km',   desc: '~12 min' }],
      fast:   [{ value: 300,  label: '300m', desc: '~3 min'   }, { value: 750,  label: '750m', desc: '~7.5 min'}, { value: 1500, label: '1.5km', desc: '~15 min' }],
    };
    const distOptions = WALK_DISTANCES[walkSpeed] || WALK_DISTANCES.normal;
    const validDistValues = distOptions.map(o => o.value);
    const effectiveWalkTolM = validDistValues.includes(walkTolM) ? walkTolM : distOptions[1].value;

    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg-base)', fontFamily: 'var(--font-ui)' }}>
        <div style={{ background: 'var(--sidebar-bg)', padding: '52px 24px 28px' }}>
          <button onClick={() => setView('menu')} style={backBtnStyle}>← Profile</button>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#EFE3C2', marginTop: 12 }}>Child preferences</div>
          <div style={{ fontSize: 14, color: 'var(--sidebar-muted)', marginTop: 4 }}>Personalise routing for your child</div>
        </div>

        <div style={{ padding: '0 24px 32px' }}>

          {prefSection('Allowed transport modes', 'Only selected modes will be used — others are blocked')}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
            <button
              onClick={() => setAllowedModes(null)}
              style={{
                padding: '10px 18px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                background: allActive ? '#85A947' : 'var(--bg-surface)',
                outline: allActive ? '2px solid #3E7B27' : '2px solid var(--border)',
                color: allActive ? '#123524' : 'var(--text-primary)',
              }}>All modes</button>
            {TRANSPORT_CHIPS.map(({ modes, label, emoji }) => {
              const active = !allActive && modes.some(m => (allowedModes || []).includes(m));
              return (
                <button key={modes[0]} onClick={() => toggleMode(modes)} style={{
                  padding: '10px 18px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                  background: active ? '#85A947' : 'var(--bg-surface)',
                  outline: active ? '2px solid #3E7B27' : '2px solid var(--border)',
                  color: active ? '#123524' : 'var(--text-primary)',
                }}>{emoji} {label}</button>
              );
            })}
          </div>
          <div style={{
            fontSize: 12, color: allActive ? 'var(--text-muted)' : '#85A947',
            fontWeight: allActive ? 400 : 600, marginBottom: 4,
          }}>
            {allActive
              ? 'Your child can use any transport mode.'
              : `Your child can only use: ${TRANSPORT_CHIPS.filter(({ modes }) => modes.some(m => (allowedModes || []).includes(m))).map(c => c.label).join(', ')}. Other modes will be blocked.`}
          </div>

          {prefSection('Walking pace', 'Used to calculate if your child can reach the stop in time')}
          {optRow([
            { value: 'slow',   emoji: '🐢', label: 'Slow',   desc: '~60m/min' },
            { value: 'normal', emoji: '🚶', label: 'Normal', desc: '~80m/min' },
            { value: 'fast',   emoji: '🏃', label: 'Fast',   desc: '~100m/min' },
          ], walkSpeed, v => {
            setWalkSpeed(v);
            const opts = WALK_DISTANCES[v] || WALK_DISTANCES.normal;
            if (!opts.map(o => o.value).includes(walkTolM)) setWalkTolM(opts[1].value);
          })}

          {prefSection('Maximum walking distance', 'Stops further than this will be filtered out entirely')}
          {optRow(
            distOptions.map(o => ({ value: o.value, emoji: o.value <= 300 ? '🏃' : o.value <= 750 ? '🚶' : '🗺️', label: o.label, desc: o.desc })),
            effectiveWalkTolM,
            v => setWalkTolM(Number(v))
          )}

          {prefSection('Comfort with public transport', 'Affects how strongly we prefer simple, direct routes')}
          {optRow([
            { value: 'beginner',     emoji: '🌱', label: 'First timer',   desc: 'Always picks simplest route' },
            { value: 'intermediate', emoji: '🚍', label: 'Getting there', desc: 'Balances simple + fast' },
            { value: 'experienced',  emoji: '🎓', label: 'Confident',     desc: 'Fastest route wins' },
          ], familiarity, setFamiliarity)}

          {prefSection('Maximum transfers', 'Routes needing more changes will be penalised or hidden')}
          {optRow([
            { value: 0, emoji: '🎯', label: 'None', desc: 'Direct routes only' },
            { value: 1, emoji: '🔄', label: 'One',  desc: 'Up to 1 transfer' },
            { value: 2, emoji: '🗺️', label: 'Any',  desc: 'No limit' },
          ], transferTol, v => setTransferTol(Number(v)))}

          {prefSection('Leave-early buffer', 'Extra time before departure so your child is never rushed')}
          {optRow([
            { value: 5,  emoji: '⚡', label: '5 min',  desc: 'Leave ASAP' },
            { value: 10, emoji: '🕐', label: '10 min', desc: 'Breathing room' },
            { value: 15, emoji: '🛡️', label: '15 min', desc: 'Extra safe' },
          ], bufferMins, v => setBufferMins(Number(v)))}

          <div style={{ marginTop: 32 }}>
            <button onClick={savePreferences} disabled={saving} style={saveBtn(saved)}>
              {saved ? '✓ Saved!' : saving ? 'Saving…' : 'Save preferences →'}
            </button>
          </div>
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
