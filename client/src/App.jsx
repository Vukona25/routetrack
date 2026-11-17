import { useEffect, useState } from 'react';
import { api, getToken, setToken } from './api';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(!!getToken());

  useEffect(() => {
    if (!getToken()) return;
    api('/auth/me')
      .then((data) => setUser(data.user))
      .catch(() => setToken(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="center">Loading…</div>;

  if (!user) {
    return (
      <Login
        onLogin={(token, loggedInUser) => {
          setToken(token);
          setUser(loggedInUser);
        }}
      />
    );
  }

  return (
    <Dashboard
      user={user}
      onLogout={() => {
        setToken(null);
        setUser(null);
      }}
    />
  );
}
