import { useState } from 'react';
import { supabase } from '../lib/supabase';

const TYPE_COLOR = {
  trend:          'var(--accent)',
  anomaly:        'var(--red)',
  correlation:    'var(--accent-2)',
  distribution:   'var(--chart-3)',
  recommendation: 'var(--green)',
};

async function runAnalysis(datasetId, focus) {
  const { data: { session } } = await supabase.auth.getSession();
  const base = import.meta.env.VITE_API_URL ?? '/api';
  const res = await fetch(`${base}/analyse/${datasetId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
    },
    body: JSON.stringify({ focus }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || res.statusText);
  return json;
}

export default function AnalysisPanel({ datasets }) {
  const [selectedId, setSelectedId] = useState('');
  const [focus, setFocus]           = useState('');
  const [status, setStatus]         = useState('idle');
  const [result, setResult]         = useState(null);
  const [errMsg, setErrMsg]         = useState('');

  async function handleAnalyse(e) {
    e.preventDefault();
    if (!selectedId) return;
    setStatus('loading');
    setResult(null);
    setErrMsg('');
    try {
      const data = await runAnalysis(selectedId, focus);
      setResult(data);
      setStatus('done');
    } catch (err) {
      setErrMsg(err.message);
      setStatus('error');
    }
  }

  const inputStyle = {
    background: 'var(--bg-input)',
    border: '1px solid var(--border)',
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-mono)',
    fontSize: 12,
    padding: '8px 10px',
    outline: 'none',
    transition: 'border-color 120ms',
  };

  return (
    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg-panel-header)', display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--accent)', fontWeight: 600 }}>10 //</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-primary)' }}>AI Analysis</span>
        <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>powered by Claude</span>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--chart-3)' }}>
          <span style={{ width: 6, height: 6, background: 'var(--chart-3)', borderRadius: '50%', display: 'inline-block' }} />
          claude-sonnet-4-6
        </div>
      </div>

      <div style={{ padding: 16 }}>
        {/* Controls */}
        <form onSubmit={handleAnalyse}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 5 }}>
                Dataset
              </div>
              <select
                value={selectedId}
                onChange={e => setSelectedId(e.target.value)}
                style={{ ...inputStyle, width: '100%' }}
                onFocus={e => e.target.style.borderColor = 'var(--accent)'}
                onBlur={e => e.target.style.borderColor = 'var(--border)'}
              >
                <option value="">— Select a dataset —</option>
                {datasets.map(ds => (
                  <option key={ds.id} value={ds.id}>{ds.name} ({ds.row_count?.toLocaleString()} rows)</option>
                ))}
              </select>
            </div>
            <div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 5 }}>
                Focus (optional)
              </div>
              <input
                value={focus}
                onChange={e => setFocus(e.target.value)}
                placeholder="e.g. trends over time, outliers in column X"
                style={{ ...inputStyle, width: '100%' }}
                onFocus={e => e.target.style.borderColor = 'var(--accent)'}
                onBlur={e => e.target.style.borderColor = 'var(--border)'}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={!selectedId || status === 'loading'}
            style={{
              padding: '9px 20px',
              background: selectedId && status !== 'loading' ? 'var(--accent)' : 'var(--bg-elevated)',
              color: selectedId && status !== 'loading' ? '#0a0f18' : 'var(--text-muted)',
              fontFamily: 'var(--font-mono)',
              fontSize: 12, fontWeight: 700,
              letterSpacing: '0.1em', textTransform: 'uppercase',
              cursor: selectedId && status !== 'loading' ? 'pointer' : 'not-allowed',
              border: 'none',
              transition: 'background 120ms',
            }}
            onMouseEnter={e => { if (selectedId && status !== 'loading') e.currentTarget.style.background = 'var(--accent-hot)'; }}
            onMouseLeave={e => { if (selectedId && status !== 'loading') e.currentTarget.style.background = 'var(--accent)'; }}
          >
            {status === 'loading' ? '◌ Analysing...' : '❯ Run Analysis'}
          </button>
        </form>

        {/* Error */}
        {status === 'error' && (
          <div style={{ marginTop: 12, padding: '10px 12px', border: '1px solid var(--red)', background: 'rgba(239,68,68,0.08)', color: 'var(--red)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
            ✗ {errMsg}
          </div>
        )}

        {/* Results */}
        {status === 'done' && result && (
          <div style={{ marginTop: 16 }}>
            {/* Headline */}
            <div style={{ padding: '12px 14px', background: 'var(--accent-dim)', border: '1px solid var(--accent)', marginBottom: 12 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--accent)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 4 }}>KEY FINDING</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.4 }}>
                {result.analysis.headline}
              </div>
            </div>

            {/* Insights */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
              {result.analysis.insights?.map((ins, i) => {
                const color = TYPE_COLOR[ins.type] || 'var(--text-secondary)';
                return (
                  <div key={i} style={{ display: 'flex', gap: 12, padding: '10px 14px', background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
                    <div style={{ flexShrink: 0, marginTop: 2 }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, padding: '2px 6px', background: `${color}22`, border: `1px solid ${color}`, color, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                        {ins.type}
                      </span>
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 3, color: 'var(--text-primary)' }}>{ins.title}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{ins.detail}</div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Visualisation suggestions + data quality */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {result.analysis.suggested_visualisations?.length > 0 && (
                <div style={{ padding: '10px 14px', background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 8 }}>Suggested Visualisations</div>
                  {result.analysis.suggested_visualisations.map((v, i) => (
                    <div key={i} style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4, display: 'flex', gap: 6 }}>
                      <span style={{ color: 'var(--accent-2)' }}>→</span> {v}
                    </div>
                  ))}
                </div>
              )}
              {result.analysis.data_quality && (
                <div style={{ padding: '10px 14px', background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 8 }}>Data Quality</div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 6 }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 22, fontWeight: 700, color: result.analysis.data_quality.score >= 70 ? 'var(--green)' : result.analysis.data_quality.score >= 40 ? 'var(--amber)' : 'var(--red)' }}>
                      {result.analysis.data_quality.score}
                    </span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)' }}>/100</span>
                  </div>
                  {result.analysis.data_quality.issues?.map((iss, i) => (
                    <div key={i} style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 3, display: 'flex', gap: 6 }}>
                      <span style={{ color: 'var(--amber)' }}>⚠</span> {iss}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {datasets.length === 0 && (
          <div style={{ marginTop: 14, padding: '16px', textAlign: 'center', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
            Upload a dataset first to run analysis.
          </div>
        )}
      </div>
    </div>
  );
}
