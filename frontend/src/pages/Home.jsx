import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const FEATURES = [
  { icon: '⬡', title: 'Multi-domain Synthesis', desc: 'Unified workspace for comms, systems, and data science datasets.' },
  { icon: '◈', title: 'AI-powered Analysis', desc: 'Claude-driven insights surface patterns across interdisciplinary data.' },
  { icon: '⬟', title: 'Real-time Intelligence', desc: 'Live signal tracking with cross-domain correlation and variance monitoring.' },
];

export default function Home() {
  const { user } = useAuth();

  return (
    <div style={{ minHeight: 'calc(100vh - 52px)' }}>
      {/* Hero */}
      <div style={{
        background: 'linear-gradient(135deg, #123524 0%, #1e4d34 50%, #2a6340 100%)',
        padding: '80px 24px 90px',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Background texture */}
        <div style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(239,227,194,0.04) 1px, transparent 0)',
          backgroundSize: '28px 28px',
          pointerEvents: 'none',
        }} />
        {/* Decorative orbs */}
        <div style={{
          position: 'absolute',
          top: -80,
          right: -80,
          width: 380,
          height: 380,
          background: 'radial-gradient(circle, rgba(133,169,71,0.18) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute',
          bottom: -60,
          left: '30%',
          width: 280,
          height: 280,
          background: 'radial-gradient(circle, rgba(62,123,39,0.20) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        <div style={{ maxWidth: 680, margin: '0 auto', position: 'relative' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            background: 'rgba(133,169,71,0.15)',
            border: '1px solid rgba(133,169,71,0.30)',
            borderRadius: 20,
            padding: '5px 14px',
            marginBottom: 24,
          }}>
            <span style={{ width: 6, height: 6, background: '#85A947', borderRadius: '50%', display: 'inline-block', animation: 'pulse 1.8s ease-in-out infinite' }} />
            <span style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              color: '#85A947',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
            }}>
              DataScience × ComStem Society
            </span>
          </div>

          <h1 style={{
            fontSize: 48,
            fontWeight: 800,
            lineHeight: 1.1,
            marginBottom: 20,
            color: '#EFE3C2',
            letterSpacing: '-0.03em',
          }}>
            Interdisciplinary<br />
            <span style={{ color: '#85A947' }}>Intelligence</span> Platform
          </h1>

          <p style={{
            fontSize: 16,
            color: 'rgba(239,227,194,0.70)',
            lineHeight: 1.75,
            marginBottom: 36,
            maxWidth: 520,
          }}>
            A unified workspace for synthesising multi-domain datasets across communications, systems, and data science research.
          </p>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <Link
              to={user ? '/dashboard' : '/login'}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                background: '#85A947',
                color: '#123524',
                fontSize: 13,
                fontWeight: 700,
                padding: '12px 24px',
                borderRadius: 'var(--radius-sm)',
                letterSpacing: '0.01em',
                transition: 'all 150ms',
                textDecoration: 'none',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = '#96BE52'; e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(133,169,71,0.40)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = '#85A947'; e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}
            >
              {user ? 'Go to Dashboard' : 'Get Started'}
              <span style={{ fontSize: 16 }}>→</span>
            </Link>
            {!user && (
              <Link
                to="/login"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  background: 'rgba(239,227,194,0.08)',
                  color: 'rgba(239,227,194,0.85)',
                  border: '1px solid rgba(239,227,194,0.20)',
                  fontSize: 13,
                  fontWeight: 500,
                  padding: '12px 24px',
                  borderRadius: 'var(--radius-sm)',
                  transition: 'all 150ms',
                  textDecoration: 'none',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,227,194,0.13)'; e.currentTarget.style.borderColor = 'rgba(239,227,194,0.35)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(239,227,194,0.08)'; e.currentTarget.style.borderColor = 'rgba(239,227,194,0.20)'; }}
              >
                Sign in
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Features */}
      <div style={{
        padding: '64px 24px',
        maxWidth: 900,
        margin: '0 auto',
      }}>
        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
          color: 'var(--text-muted)',
          marginBottom: 12,
          textAlign: 'center',
        }}>
          Platform capabilities
        </div>
        <h2 style={{
          fontSize: 28,
          fontWeight: 700,
          letterSpacing: '-0.02em',
          color: 'var(--text-primary)',
          textAlign: 'center',
          marginBottom: 48,
        }}>
          Built for cross-domain research
        </h2>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 20,
        }}>
          {FEATURES.map((f, i) => (
            <div
              key={i}
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                padding: '28px 24px',
                boxShadow: 'var(--shadow-card)',
                transition: 'all 200ms',
              }}
              onMouseEnter={e => { e.currentTarget.style.boxShadow = 'var(--shadow-card-hover)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow = 'var(--shadow-card)'; e.currentTarget.style.transform = 'none'; }}
            >
              <div style={{
                width: 40,
                height: 40,
                background: 'var(--accent-dim)',
                border: '1px solid rgba(133,169,71,0.25)',
                borderRadius: 'var(--radius-sm)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 18,
                color: 'var(--accent)',
                marginBottom: 16,
              }}>
                {f.icon}
              </div>
              <h3 style={{
                fontSize: 14,
                fontWeight: 700,
                color: 'var(--text-primary)',
                marginBottom: 8,
                letterSpacing: '-0.01em',
              }}>
                {f.title}
              </h3>
              <p style={{
                fontSize: 12,
                color: 'var(--text-muted)',
                lineHeight: 1.65,
              }}>
                {f.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
