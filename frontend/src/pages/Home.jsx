import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Home() {
  const { user } = useAuth();

  return (
    <main style={{
      maxWidth: 560,
      margin: '80px auto',
      padding: '0 24px',
    }}>
      <p style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 11,
        color: 'var(--accent)',
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        marginBottom: 16,
      }}>
        DataScience × ComStem Society
      </p>
      <h1 style={{
        fontSize: 28,
        fontWeight: 700,
        lineHeight: 1.2,
        marginBottom: 16,
        color: 'var(--text-primary)',
      }}>
        Interdisciplinary<br />Intelligence Platform
      </h1>
      <p style={{
        fontSize: 13,
        color: 'var(--text-secondary)',
        lineHeight: 1.7,
        marginBottom: 32,
        maxWidth: 440,
      }}>
        A unified workspace for synthesising multi-domain datasets across communications, systems, and data science research.
      </p>
      <Link
        to={user ? '/dashboard' : '/login'}
        style={{
          display: 'inline-block',
          background: 'var(--accent)',
          color: '#fff',
          fontSize: 12,
          fontWeight: 600,
          padding: '9px 20px',
          borderRadius: 2,
          letterSpacing: '0.02em',
          transition: 'opacity 120ms',
        }}
        onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
        onMouseLeave={e => e.currentTarget.style.opacity = '1'}
      >
        {user ? 'Go to Dashboard' : 'Sign in'}
      </Link>
    </main>
  );
}
