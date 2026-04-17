import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState('signin');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { error } = mode === 'signin'
      ? await signIn(email, password)
      : await signUp(email, password);

    setLoading(false);

    if (error) {
      setError(error.message);
    } else {
      navigate('/dashboard');
    }
  };

  const inputStyle = {
    width: '100%',
    padding: '10px 14px',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    fontSize: 13,
    marginBottom: 12,
    background: 'var(--bg-input)',
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-ui)',
    outline: 'none',
    transition: 'border-color 150ms, box-shadow 150ms',
  };

  return (
    <div style={{
      minHeight: 'calc(100vh - 52px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 24px',
      position: 'relative',
    }}>
      {/* Decorative bg */}
      <div style={{
        position: 'absolute',
        top: '20%',
        left: '50%',
        transform: 'translateX(-50%)',
        width: 500,
        height: 500,
        background: 'radial-gradient(circle, rgba(133,169,71,0.10) 0%, transparent 65%)',
        pointerEvents: 'none',
      }} />

      <div style={{
        width: '100%',
        maxWidth: 400,
        position: 'relative',
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 48,
            height: 48,
            background: 'var(--sidebar-bg)',
            borderRadius: 12,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 22,
            color: '#85A947',
            marginBottom: 14,
            boxShadow: 'var(--shadow-card)',
          }}>◆</div>
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 18,
            fontWeight: 700,
            color: 'var(--text-primary)',
            letterSpacing: '-0.02em',
          }}>
            DS×CS
          </div>
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            color: 'var(--text-muted)',
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            marginTop: 4,
          }}>
            Intelligence Platform
          </div>
        </div>

        {/* Card */}
        <div style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          padding: '32px 32px 28px',
          boxShadow: 'var(--shadow-lg)',
        }}>
          <h2 style={{
            fontSize: 18,
            fontWeight: 700,
            color: 'var(--text-primary)',
            marginBottom: 6,
            letterSpacing: '-0.01em',
          }}>
            {mode === 'signin' ? 'Welcome back' : 'Create account'}
          </h2>
          <p style={{
            fontSize: 12,
            color: 'var(--text-muted)',
            marginBottom: 24,
          }}>
            {mode === 'signin' ? 'Sign in to your workspace' : 'Join the DS×CS platform'}
          </p>

          <form onSubmit={handleSubmit}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 5, letterSpacing: '0.04em' }}>
              Email
            </label>
            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              style={inputStyle}
              onFocus={e => { e.target.style.borderColor = 'var(--accent)'; e.target.style.boxShadow = '0 0 0 3px rgba(133,169,71,0.12)'; }}
              onBlur={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.boxShadow = 'none'; }}
            />

            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 5, letterSpacing: '0.04em' }}>
              Password
            </label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              style={{ ...inputStyle, marginBottom: 0 }}
              onFocus={e => { e.target.style.borderColor = 'var(--accent)'; e.target.style.boxShadow = '0 0 0 3px rgba(133,169,71,0.12)'; }}
              onBlur={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.boxShadow = 'none'; }}
            />

            {error && (
              <div style={{
                marginTop: 12,
                padding: '9px 12px',
                background: 'rgba(220,38,38,0.06)',
                border: '1px solid rgba(220,38,38,0.25)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--red)',
                fontSize: 12,
              }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                marginTop: 20,
                padding: '11px',
                background: loading ? 'var(--border)' : 'var(--accent)',
                color: loading ? 'var(--text-muted)' : '#123524',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                fontSize: 13,
                fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer',
                letterSpacing: '0.01em',
                transition: 'all 150ms',
              }}
              onMouseEnter={e => { if (!loading) { e.currentTarget.style.background = '#96BE52'; e.currentTarget.style.boxShadow = '0 4px 14px rgba(133,169,71,0.35)'; } }}
              onMouseLeave={e => { if (!loading) { e.currentTarget.style.background = 'var(--accent)'; e.currentTarget.style.boxShadow = 'none'; } }}
            >
              {loading ? 'Loading…' : mode === 'signin' ? 'Sign in' : 'Create account'}
            </button>
          </form>

          <p style={{
            marginTop: 20,
            color: 'var(--text-muted)',
            fontSize: 12,
            textAlign: 'center',
          }}>
            {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
            <button
              onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(''); }}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--accent-hot)',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: 12,
              }}
            >
              {mode === 'signin' ? 'Sign up' : 'Sign in'}
            </button>
          </p>
        </div>

        <p style={{ marginTop: 20, textAlign: 'center', fontSize: 11, color: 'var(--text-dim)' }}>
          <Link to="/" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>← Back to home</Link>
        </p>
      </div>
    </div>
  );
}
