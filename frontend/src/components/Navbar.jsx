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
      height: 48,
      background: 'var(--bg-surface)',
      borderBottom: '1px solid var(--border)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 var(--s5)',
      position: 'sticky',
      top: 0,
      zIndex: 100,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
        <Link to="/" style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 14,
          fontWeight: 600,
          color: 'var(--text-primary)',
          letterSpacing: '-0.02em',
        }}>
          DS×CS
        </Link>

        {user && (
          <div style={{ display: 'flex', gap: 20 }}>
            {NAV_LINKS.map(({ to, label }) => (
              <Link key={to} to={to} style={{
                fontSize: 12,
                color: pathname === to ? 'var(--text-primary)' : 'var(--text-secondary)',
                borderBottom: pathname === to ? '2px solid var(--accent)' : '2px solid transparent',
                paddingBottom: 2,
                transition: 'color 120ms',
              }}>
                {label}
              </Link>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
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
                background: 'none',
                border: '1px solid var(--border)',
                color: 'var(--text-secondary)',
                fontSize: 11,
                padding: '3px 10px',
                borderRadius: 2,
                cursor: 'pointer',
                transition: 'background 120ms',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-elevated)'}
              onMouseLeave={e => e.currentTarget.style.background = 'none'}
            >
              Sign out
            </button>
          </>
        ) : (
          <Link to="/login" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            Sign in
          </Link>
        )}
      </div>
    </nav>
  );
}
