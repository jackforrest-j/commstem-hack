import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

export default function AccountSetup() {
  const { user } = useAuth();
  const navigate  = useNavigate();
  const [name, setName]     = useState('');
  const [saved, setSaved]   = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState('');
  const [copied, setCopied] = useState(false);

  const childUrl = `${window.location.origin}/child`;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    setError('');
    const { error } = await supabase.from('children').insert({ parent_id: user.id, name: name.trim() });
    setLoading(false);
    if (error) { setError(error.message); return; }
    setSaved(true);
  };

  const copy = () => {
    navigator.clipboard.writeText(childUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)', fontFamily: 'var(--font-ui)', display: 'flex', flexDirection: 'column' }}>

      <div style={{ background: 'var(--sidebar-bg)', padding: '52px 24px 28px' }}>
        <div style={{ fontSize: 28, marginBottom: 8 }}>👨‍👩‍👧</div>
        <div style={{ fontSize: 26, fontWeight: 800, color: '#EFE3C2', lineHeight: 1.2 }}>
          Set up your<br />family
        </div>
        <div style={{ fontSize: 14, color: 'var(--sidebar-muted)', marginTop: 8 }}>
          Add your child to get started
        </div>
      </div>

      <div style={{ padding: '32px 24px', flex: 1 }}>
        {!saved ? (
          <form onSubmit={handleSubmit}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }}>
              Child's name
            </label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Alex"
              autoFocus
              required
              style={{
                width: '100%', padding: '16px', fontSize: 18, fontWeight: 600,
                border: '2px solid var(--border)', borderRadius: 12,
                background: 'var(--bg-surface)', color: 'var(--text-primary)',
                fontFamily: 'var(--font-ui)', outline: 'none', boxSizing: 'border-box',
                marginBottom: 24,
              }}
              onFocus={e => e.target.style.borderColor = 'var(--accent)'}
              onBlur={e => e.target.style.borderColor = 'var(--border)'}
            />

            {error && (
              <div style={{ color: 'var(--red)', fontSize: 13, marginBottom: 16 }}>{error}</div>
            )}

            <button
              type="submit"
              disabled={loading || !name.trim()}
              style={{
                width: '100%', padding: '16px', fontSize: 16, fontWeight: 700,
                background: !name.trim() ? 'var(--border)' : 'var(--accent-hot)',
                color: !name.trim() ? 'var(--text-muted)' : '#fff',
                border: 'none', borderRadius: 12,
                cursor: !name.trim() ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? 'Saving…' : 'Continue →'}
            </button>
          </form>
        ) : (
          <div>
            <div style={{
              background: 'var(--bg-surface)', border: '2px solid var(--accent)',
              borderRadius: 14, padding: '20px', marginBottom: 24,
            }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
                ✓ {name} added!
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
                Send this link to {name}'s phone. They'll open it when they start their journey.
              </div>
              <div style={{
                background: 'var(--bg-elevated)', borderRadius: 8, padding: '12px 14px',
                fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-primary)',
                wordBreak: 'break-all', marginBottom: 12,
              }}>
                {childUrl}
              </div>
              <button
                onClick={copy}
                style={{
                  width: '100%', padding: '12px', fontSize: 14, fontWeight: 600,
                  background: copied ? 'var(--accent)' : 'var(--bg-elevated)',
                  color: copied ? '#fff' : 'var(--text-secondary)',
                  border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer',
                }}
              >
                {copied ? '✓ Copied!' : 'Copy link'}
              </button>
            </div>

            <button
              onClick={() => navigate('/safecommute')}
              style={{
                width: '100%', padding: '16px', fontSize: 16, fontWeight: 700,
                background: 'var(--accent-hot)', color: '#fff',
                border: 'none', borderRadius: 12, cursor: 'pointer',
              }}
            >
              Go to parent dashboard →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
