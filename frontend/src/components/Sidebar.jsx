import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const SECTIONS = [
  {
    label: 'Workspace',
    items: [
      { to: '/dashboard', idx: '01', name: 'Overview' },
      { to: '/datasets',  idx: '02', name: 'Datasets',  disabled: true },
      { to: '/analysis',  idx: '03', name: 'Analysis',  disabled: true },
      { to: '/reports',   idx: '04', name: 'Reports',   disabled: true },
    ],
  },
  {
    label: 'System',
    items: [
      { to: '/pipelines', idx: '05', name: 'Pipelines', disabled: true },
      { to: '/settings',  idx: '06', name: 'Settings',  disabled: true },
    ],
  },
];

export default function Sidebar() {
  const { pathname } = useLocation();
  const { user } = useAuth();

  return (
    <aside style={{
      width: 220,
      background: 'var(--bg-surface)',
      borderRight: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      position: 'sticky',
      top: 0,
      height: '100vh',
      flexShrink: 0,
    }}>
      <div style={{
        padding: '18px 20px 14px',
        borderBottom: '1px solid var(--border)',
      }}>
        <Link to="/" style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 16,
          fontWeight: 700,
          letterSpacing: '-0.02em',
          color: 'var(--text-primary)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}>
          <span style={{ color: 'var(--accent)' }}>◆</span>
          DS<span style={{ color: 'var(--text-muted)' }}>×</span>CS
        </Link>
        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 9,
          color: 'var(--text-dim)',
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          marginTop: 4,
        }}>
          INTEL · v0.1.0
        </div>
      </div>

      <nav style={{ flex: 1, padding: '10px 0', overflowY: 'auto' }}>
        {SECTIONS.map(section => (
          <div key={section.label} style={{ marginBottom: 18 }}>
            <div style={{
              padding: '5px 20px',
              fontFamily: 'var(--font-mono)',
              fontSize: 9,
              fontWeight: 600,
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              color: 'var(--text-dim)',
            }}>
              — {section.label}
            </div>
            {section.items.map(item => {
              const active = pathname === item.to && !item.disabled;
              return (
                <Link
                  key={item.idx}
                  to={item.disabled ? '#' : item.to}
                  onClick={e => item.disabled && e.preventDefault()}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '7px 20px',
                    fontSize: 12,
                    color: active ? 'var(--text-primary)' : item.disabled ? 'var(--text-dim)' : 'var(--text-secondary)',
                    background: active ? 'var(--accent-dim)' : 'transparent',
                    borderLeft: active ? '2px solid var(--accent)' : '2px solid transparent',
                    cursor: item.disabled ? 'not-allowed' : 'pointer',
                    transition: 'background 120ms, color 120ms',
                    textDecoration: 'none',
                  }}
                  onMouseEnter={e => { if (!item.disabled && !active) e.currentTarget.style.background = 'var(--bg-elevated)'; }}
                  onMouseLeave={e => { if (!item.disabled && !active) e.currentTarget.style.background = 'transparent'; }}
                >
                  <span style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 10,
                    color: active ? 'var(--accent)' : 'var(--text-dim)',
                    letterSpacing: '0.04em',
                    minWidth: 16,
                  }}>
                    {item.idx}
                  </span>
                  <span>{item.name}</span>
                  {item.disabled && (
                    <span style={{
                      marginLeft: 'auto',
                      fontSize: 8,
                      fontFamily: 'var(--font-mono)',
                      color: 'var(--text-dim)',
                      border: '1px solid var(--border)',
                      padding: '1px 4px',
                      letterSpacing: '0.08em',
                    }}>
                      SOON
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {user && (
        <div style={{
          padding: '12px 20px',
          borderTop: '1px solid var(--border)',
        }}>
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 9,
            fontWeight: 600,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: 'var(--text-muted)',
            marginBottom: 3,
          }}>
            Operator
          </div>
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: 'var(--text-primary)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {user.email}
          </div>
        </div>
      )}
    </aside>
  );
}
