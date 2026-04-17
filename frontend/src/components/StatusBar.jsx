import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function StatusBar() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const time = now.toLocaleTimeString('en-GB', { hour12: false });
  const date = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase();

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const cell = (extra = {}) => ({
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '0 14px',
    borderRight: '1px solid var(--border)',
    fontFamily: 'var(--font-mono)',
    fontSize: 10,
    color: 'var(--text-secondary)',
    height: '100%',
    letterSpacing: '0.04em',
    whiteSpace: 'nowrap',
    ...extra,
  });

  return (
    <div style={{
      height: 26,
      background: 'var(--bg-surface)',
      borderTop: '1px solid var(--border)',
      display: 'flex',
      alignItems: 'stretch',
      position: 'sticky',
      bottom: 0,
      zIndex: 50,
      flexShrink: 0,
    }}>
      <div style={cell({ background: 'var(--accent-dim)', color: 'var(--accent-hot)', fontWeight: 600, borderRight: '1px solid var(--border)' })}>
        <span className="pulse" style={{ width: 6, height: 6, background: 'var(--accent)', display: 'inline-block', borderRadius: '50%' }} />
        LIVE
      </div>
      <div style={cell()}>
        <span style={{ color: 'var(--text-muted)' }}>NODE</span>
        <span>sb-01</span>
      </div>
      <div style={cell()}>
        <span style={{ color: 'var(--text-muted)' }}>REGION</span>
        <span>ap-se-1</span>
      </div>
      <div style={cell()}>
        <span style={{ color: 'var(--text-muted)' }}>ENV</span>
        <span style={{ color: 'var(--accent-2)' }}>development</span>
      </div>

      <div style={{ flex: 1 }} />

      <div style={cell()}>
        <span style={{ color: 'var(--text-muted)' }}>USR</span>
        <span style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.email ?? 'anon'}</span>
      </div>
      <div style={cell()}>
        <span style={{ color: 'var(--text-muted)' }}>{date}</span>
        <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{time}</span>
      </div>
      {user && (
        <button
          onClick={handleSignOut}
          style={{
            ...cell({ borderRight: 'none', cursor: 'pointer' }),
            background: 'none',
          }}
          onMouseEnter={e => e.currentTarget.style.color = 'var(--red)'}
          onMouseLeave={e => e.currentTarget.style.color = 'var(--text-secondary)'}
        >
          [ SIGN OUT ]
        </button>
      )}
    </div>
  );
}
