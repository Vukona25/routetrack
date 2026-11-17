import { useState } from 'react';
import { api } from '../api';

export default function Login({ onLogin }) {
  const [email, setEmail] = useState('dispatcher@demo.com');
  const [password, setPassword] = useState('password123');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const { token, user } = await api('/auth/login', {
        method: 'POST',
        body: { email, password },
      });
      onLogin(token, user);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-page">
      <form className="card login-card" onSubmit={handleSubmit}>
        <h1>RouteTrack</h1>
        <p className="muted">Delivery and route tracking</p>

        <label>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>

        <label>
          Password
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>

        {error && <p className="error">{error}</p>}

        <button className="btn primary" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>

        <p className="muted small">
          Demo accounts: dispatcher@demo.com, sipho@demo.com, lerato@demo.com (password: password123)
        </p>
      </form>
    </div>
  );
}
