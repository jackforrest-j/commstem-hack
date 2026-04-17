import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const NAV_LINKS = [
  { to: '/dashboard', label: 'Overview' },
];

export default function Navbar() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  return (
    <nav style={{
      height: 52,
      background: 'var(--bg-surface)',
      borderBottom: '1px solid var(--border)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 28px',
      position: 'sticky',
      top: 0,
      zIndex: 100,
      boxShadow: 'var(--shadow-sm)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 36 }}>
        <Link to="/" style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          textDecoration: 'none',
        }}>
          <span style={{
            width: 26,
            height: 26,
            background: 'var(--sidebar-bg)',
            borderRadius: 6,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 10,
            fontWeight: 800,
            color: '#85A947',
          }}>◆</span>
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 14,
            fontWeight: 700,
            color: 'var(--text-primary)',
            letterSpacing: '-0.02em',
          }}>
            DS<span style={{ color: 'var(--text-muted)' }}>×</span>CS
          </span>
        </Link>

        {user && (
          <div style={{ display: 'flex', gap: 4 }}>
            {NAV_LINKS.map(({ to, label }) => {
              const active = pathname === to;
              return (
                <Link key={to} to={to} style={{
                  fontSize: 12,
                  fontWeight: 500,
                  color: active ? 'var(--text-primary)' : 'var(--text-muted)',
                  padding: '4px 10px',
                  borderRadius: 'var(--radius-sm)',
                  background: active ? 'var(--accent-dim)' : 'transparent',
                  transition: 'all 150ms',
                  textDecoration: 'none',
                }}>
                  {label}
                </Link>
              );
            })}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {user ? (
          <>
            <span style={{
              fontSize: 11,
              color: 'var(--text-muted)',
              maxWidth: 200,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {user.email}
            </span>
            <button
              onClick={handleSignOut}
              style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                color: 'var(--text-secondary)',
                fontSize: 11,
                fontWeight: 500,
                padding: '5px 12px',
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
                transition: 'all 150ms',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'var(--accent-dim)';
                e.currentTarget.style.borderColor = 'var(--accent)';
                e.currentTarget.style.color = 'var(--accent-hot)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'var(--bg-elevated)';
                e.currentTarget.style.borderColor = 'var(--border)';
                e.currentTarget.style.color = 'var(--text-secondary)';
              }}
            >
              Sign out
            </button>
          </>
        ) : (
          <Link to="/login" style={{
            fontSize: 12,
            fontWeight: 600,
            color: 'var(--bg-surface)',
            background: 'var(--accent)',
            padding: '6px 16px',
            borderRadius: 'var(--radius-sm)',
            transition: 'background 150ms',
          }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--accent-hot)'}
            onMouseLeave={e => e.currentTarget.style.background = 'var(--accent)'}
          >
            Sign in
          </Link>
        )}
      </div>
    </nav>
  );
}
