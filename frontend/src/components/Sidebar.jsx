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
      background: 'var(--sidebar-bg)',
      borderRight: '1px solid rgba(18,53,36,0.2)',
      display: 'flex',
      flexDirection: 'column',
      position: 'sticky',
      top: 0,
      height: '100vh',
      flexShrink: 0,
    }}>
      {/* Logo area */}
      <div style={{
        padding: '20px 20px 16px',
        borderBottom: '1px solid var(--sidebar-border)',
      }}>
        <Link to="/" style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 16,
          fontWeight: 700,
          letterSpacing: '-0.02em',
          color: 'var(--sidebar-text)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          textDecoration: 'none',
        }}>
          <span style={{
            width: 24,
            height: 24,
            background: 'var(--sidebar-accent)',
            borderRadius: 6,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 11,
            fontWeight: 800,
            color: '#123524',
            flexShrink: 0,
          }}>◆</span>
          DS<span style={{ color: 'var(--sidebar-muted)' }}>×</span>CS
        </Link>
        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 9,
          color: 'var(--sidebar-dim)',
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          marginTop: 5,
          paddingLeft: 32,
        }}>
          INTEL · v0.1.0
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '12px 0', overflowY: 'auto' }}>
        {SECTIONS.map(section => (
          <div key={section.label} style={{ marginBottom: 20 }}>
            <div style={{
              padding: '4px 20px 6px',
              fontFamily: 'var(--font-mono)',
              fontSize: 9,
              fontWeight: 600,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: 'var(--sidebar-dim)',
            }}>
              {section.label}
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
                    gap: 10,
                    padding: '8px 20px',
                    fontSize: 12,
                    color: active ? 'var(--sidebar-text)' : item.disabled ? 'var(--sidebar-dim)' : 'var(--sidebar-muted)',
                    background: active ? 'var(--sidebar-active)' : 'transparent',
                    borderLeft: `2px solid ${active ? 'var(--sidebar-accent)' : 'transparent'}`,
                    cursor: item.disabled ? 'not-allowed' : 'pointer',
                    transition: 'background 150ms, color 150ms',
                    textDecoration: 'none',
                  }}
                  onMouseEnter={e => { if (!item.disabled && !active) e.currentTarget.style.background = 'rgba(239,227,194,0.06)'; }}
                  onMouseLeave={e => { if (!item.disabled && !active) e.currentTarget.style.background = 'transparent'; }}
                >
                  <span style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 9,
                    color: active ? 'var(--sidebar-accent)' : 'var(--sidebar-dim)',
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
                      color: 'var(--sidebar-dim)',
                      border: '1px solid var(--sidebar-border)',
                      padding: '1px 4px',
                      letterSpacing: '0.08em',
                      borderRadius: 2,
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

      {/* User footer */}
      {user && (
        <div style={{
          padding: '12px 20px 16px',
          borderTop: '1px solid var(--sidebar-border)',
        }}>
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 9,
            fontWeight: 600,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: 'var(--sidebar-dim)',
            marginBottom: 4,
          }}>
            Operator
          </div>
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: 'var(--sidebar-text)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {user.email}
          </div>
          <div style={{
            marginTop: 8,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}>
            <span style={{
              width: 6,
              height: 6,
              background: 'var(--sidebar-accent)',
              borderRadius: '50%',
              display: 'inline-block',
              animation: 'pulse 1.8s ease-in-out infinite',
            }} />
            <span style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 9,
              color: 'var(--sidebar-accent)',
              letterSpacing: '0.1em',
            }}>CONNECTED</span>
          </div>
        </div>
      )}
    </aside>
  );
}
