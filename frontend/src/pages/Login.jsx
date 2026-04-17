import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState('signin'); // 'signin' | 'signup'
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
    width: '100%', padding: '0.6rem 0.75rem',
    border: '1px solid #d1d5db', borderRadius: 6,
    fontSize: '0.95rem', marginBottom: '0.75rem',
  };

  return (
    <main style={{ maxWidth: 400, margin: '4rem auto', padding: '0 1rem' }}>
      <h2 style={{ fontWeight: 700, marginBottom: '1.5rem' }}>
        {mode === 'signin' ? 'Sign in' : 'Create account'}
      </h2>
      <form onSubmit={handleSubmit}>
        <input
          type="email" placeholder="Email" value={email}
          onChange={e => setEmail(e.target.value)}
          required style={inputStyle}
        />
        <input
          type="password" placeholder="Password" value={password}
          onChange={e => setPassword(e.target.value)}
          required style={inputStyle}
        />
        {error && <p style={{ color: '#dc2626', marginBottom: '0.75rem', fontSize: '0.9rem' }}>{error}</p>}
        <button
          type="submit" disabled={loading}
          style={{ width: '100%', padding: '0.7rem', background: '#111827', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}
        >
          {loading ? 'Loading...' : mode === 'signin' ? 'Sign in' : 'Sign up'}
        </button>
      </form>
      <p style={{ marginTop: '1rem', color: '#6b7280', fontSize: '0.9rem', textAlign: 'center' }}>
        {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
        <button
          onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
          style={{ background: 'none', border: 'none', color: '#111827', cursor: 'pointer', fontWeight: 600 }}
        >
          {mode === 'signin' ? 'Sign up' : 'Sign in'}
        </button>
      </p>
    </main>
  );
}
