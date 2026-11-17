import { useState } from 'react';
import { api } from '../api';
import { Logo } from '../icons';
import { TextField } from '../components/Fields';

const DEMO_ACCOUNTS = [
  ['Dispatcher', 'dispatcher@demo.com'],
  ['Driver · Sipho', 'sipho@demo.com'],
  ['Driver · Lerato', 'lerato@demo.com'],
];

export default function Login({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
      setBusy(false);
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="auth-brand">
          <Logo size={64} />
          <h1>RouteTrack</h1>
          <p>Delivery and route tracking</p>
        </div>

        <form className="auth-panel" onSubmit={handleSubmit}>
          <h2>Sign in</h2>
          <p className="sub">Use your work email and password.</p>

          <TextField
            name="email"
            type="email"
            label="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            required
          />
          <TextField
            name="password"
            type="password"
            label="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />

          {error && <p className="auth-error">{error}</p>}

          <button className="btn btn-block btn-tall" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>

          <div className="demo-box">
            <div className="section-label">Try a demo account</div>
            <div className="btn-row">
              {DEMO_ACCOUNTS.map(([label, mail]) => (
                <button
                  key={mail}
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => { setEmail(mail); setPassword('password123'); setError(''); }}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="tiny muted">All demo accounts use the password <strong>password123</strong>.</p>
          </div>
        </form>

        <p className="auth-foot">RouteTrack · Built by Vukona Ngwenya</p>
      </div>
    </div>
  );
}
