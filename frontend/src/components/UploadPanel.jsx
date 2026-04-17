import { useRef, useState } from 'react';
import { supabase } from '../lib/supabase';

const ACCEPTED = '.csv,.json';

async function uploadFile(file, name) {
  const { data: { session } } = await supabase.auth.getSession();
  const form = new FormData();
  form.append('file', file);
  form.append('name', name);

  const res = await fetch('/api/upload', {
    method: 'POST',
    headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
    body: form,
  });

  const json = await res.json();
  if (!res.ok) throw new Error(json.error || res.statusText);
  return json;
}

export default function UploadPanel({ onSuccess }) {
  const inputRef   = useRef(null);
  const [drag, setDrag]       = useState(false);
  const [file, setFile]       = useState(null);
  const [name, setName]       = useState('');
  const [status, setStatus]   = useState('idle'); // idle | uploading | done | error
  const [result, setResult]   = useState(null);
  const [errMsg, setErrMsg]   = useState('');

  function handleFile(f) {
    if (!f) return;
    setFile(f);
    setName(f.name.replace(/\.[^.]+$/, ''));
    setStatus('idle');
    setResult(null);
  }

  function onDrop(e) {
    e.preventDefault();
    setDrag(false);
    handleFile(e.dataTransfer.files[0]);
  }

  async function submit(e) {
    e.preventDefault();
    if (!file) return;
    setStatus('uploading');
    setErrMsg('');
    try {
      const res = await uploadFile(file, name || file.name);
      setResult(res);
      setStatus('done');
      onSuccess?.(res.dataset);
    } catch (err) {
      setErrMsg(err.message);
      setStatus('error');
    }
  }

  function reset() {
    setFile(null); setName(''); setStatus('idle'); setResult(null); setErrMsg('');
  }

  const inputStyle = {
    background: 'var(--bg-input)',
    border: '1px solid var(--border)',
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-mono)',
    fontSize: 12,
    padding: '8px 10px',
    outline: 'none',
    width: '100%',
    transition: 'border-color 120ms',
  };

  return (
    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg-panel-header)', display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--accent)', fontWeight: 600 }}>08 //</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-primary)' }}>Ingest Dataset</span>
        <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>CSV · JSON · max 20 MB</span>
      </div>

      <div style={{ padding: 16 }}>
        {status === 'done' && result ? (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <span style={{ color: 'var(--green)', fontSize: 16 }}>✓</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--green)', fontWeight: 600 }}>Ingested successfully</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 14 }}>
              {[
                ['Dataset', result.dataset.name],
                ['Rows', result.dataset.row_count.toLocaleString()],
                ['Columns', result.columns.length],
              ].map(([l, v]) => (
                <div key={l} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', padding: '10px 12px' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 4 }}>{l}</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{v}</div>
                </div>
              ))}
            </div>
            {result.preview?.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8 }}>Columns detected</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {result.columns.map(c => (
                    <span key={c} style={{ fontFamily: 'var(--font-mono)', fontSize: 10, padding: '3px 8px', background: 'var(--accent-dim)', border: '1px solid var(--accent)', color: 'var(--accent-hot)', letterSpacing: '0.04em' }}>
                      {c}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <button onClick={reset} style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-secondary)', border: '1px solid var(--border)', padding: '7px 14px', letterSpacing: '0.08em', cursor: 'pointer' }}>
              [ Upload another ]
            </button>
          </div>
        ) : (
          <form onSubmit={submit}>
            {/* Drop zone */}
            <div
              onDragOver={e => { e.preventDefault(); setDrag(true); }}
              onDragLeave={() => setDrag(false)}
              onDrop={onDrop}
              onClick={() => inputRef.current?.click()}
              style={{
                border: `2px dashed ${drag ? 'var(--accent)' : file ? 'var(--green)' : 'var(--border-strong)'}`,
                background: drag ? 'var(--accent-dim)' : file ? 'rgba(16,185,129,0.05)' : 'var(--bg-input)',
                padding: '24px 20px',
                textAlign: 'center',
                cursor: 'pointer',
                marginBottom: 14,
                transition: 'border-color 120ms, background 120ms',
              }}
            >
              <input ref={inputRef} type="file" accept={ACCEPTED} style={{ display: 'none' }} onChange={e => handleFile(e.target.files[0])} />
              {file ? (
                <div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--green)', fontWeight: 600, marginBottom: 4 }}>
                    {file.name}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    {(file.size / 1024).toFixed(1)} KB · click to change
                  </div>
                </div>
              ) : (
                <div>
                  <div style={{ fontSize: 24, color: 'var(--text-dim)', marginBottom: 8 }}>⬆</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>
                    Drop CSV or JSON here
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    or click to browse
                  </div>
                </div>
              )}
            </div>

            {/* Dataset name */}
            {file && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 5 }}>
                  Dataset name
                </div>
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. survey_results_2024"
                  style={inputStyle}
                  onFocus={e => e.target.style.borderColor = 'var(--accent)'}
                  onBlur={e => e.target.style.borderColor = 'var(--border)'}
                />
              </div>
            )}

            {status === 'error' && (
              <div style={{ padding: '8px 12px', marginBottom: 12, border: '1px solid var(--red)', background: 'rgba(239,68,68,0.08)', color: 'var(--red)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                ✗ {errMsg}
              </div>
            )}

            <button
              type="submit"
              disabled={!file || status === 'uploading'}
              style={{
                width: '100%',
                padding: '10px',
                background: file && status !== 'uploading' ? 'var(--accent)' : 'var(--bg-elevated)',
                color: file && status !== 'uploading' ? '#0a0f18' : 'var(--text-muted)',
                fontFamily: 'var(--font-mono)',
                fontSize: 12, fontWeight: 700,
                letterSpacing: '0.1em', textTransform: 'uppercase',
                cursor: file && status !== 'uploading' ? 'pointer' : 'not-allowed',
                transition: 'background 120ms',
                border: 'none',
              }}
              onMouseEnter={e => { if (file && status !== 'uploading') e.currentTarget.style.background = 'var(--accent-hot)'; }}
              onMouseLeave={e => { if (file && status !== 'uploading') e.currentTarget.style.background = 'var(--accent)'; }}
            >
              {status === 'uploading' ? '◌ Ingesting...' : 'Ingest →'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
