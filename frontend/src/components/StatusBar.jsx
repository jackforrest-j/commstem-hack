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
    borderRight: '1px solid rgba(239,227,194,0.10)',
    fontFamily: 'var(--font-mono)',
    fontSize: 10,
    color: 'rgba(239,227,194,0.60)',
    height: '100%',
    letterSpacing: '0.04em',
    whiteSpace: 'nowrap',
    ...extra,
  });

  return (
    <div style={{
      height: 26,
      background: 'var(--sidebar-bg)',
      borderTop: '1px solid rgba(18,53,36,0.3)',
      display: 'flex',
      alignItems: 'stretch',
      position: 'sticky',
      bottom: 0,
      zIndex: 50,
      flexShrink: 0,
    }}>
      <div style={cell({
        background: 'rgba(133,169,71,0.18)',
        color: '#85A947',
        fontWeight: 600,
        borderRight: '1px solid rgba(133,169,71,0.25)',
      })}>
        <span className="pulse" style={{
          width: 5,
          height: 5,
          background: '#85A947',
          display: 'inline-block',
          borderRadius: '50%',
        }} />
        LIVE
      </div>
      <div style={cell()}>
        <span style={{ color: 'rgba(239,227,194,0.35)' }}>NODE</span>
        <span style={{ color: 'rgba(239,227,194,0.75)' }}>sb-01</span>
      </div>
      <div style={cell()}>
        <span style={{ color: 'rgba(239,227,194,0.35)' }}>REGION</span>
        <span style={{ color: 'rgba(239,227,194,0.75)' }}>ap-se-1</span>
      </div>
      <div style={cell()}>
        <span style={{ color: 'rgba(239,227,194,0.35)' }}>ENV</span>
        <span style={{ color: '#85A947' }}>development</span>
      </div>

      <div style={{ flex: 1 }} />

      <div style={cell()}>
        <span style={{ color: 'rgba(239,227,194,0.35)' }}>USR</span>
        <span style={{ color: 'rgba(239,227,194,0.75)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {user?.email ?? 'anon'}
        </span>
      </div>
      <div style={cell()}>
        <span style={{ color: 'rgba(239,227,194,0.45)' }}>{date}</span>
        <span style={{ color: '#EFE3C2', fontWeight: 600 }}>{time}</span>
      </div>
      {user && (
        <button
          onClick={handleSignOut}
          style={{
            ...cell({ borderRight: 'none', cursor: 'pointer' }),
            background: 'none',
            transition: 'color 150ms',
          }}
          onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
          onMouseLeave={e => e.currentTarget.style.color = 'rgba(239,227,194,0.60)'}
        >
          [ SIGN OUT ]
        </button>
      )}
    </div>
  );
}
