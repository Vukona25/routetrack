import { useEffect, useState } from 'react';
import { api, getToken, setToken } from './api';
import { NAV, useHashPath } from './routes';
import { applyTheme } from './theme';
import useLocationSharing from './hooks/useLocationSharing';
import Shell from './components/Shell';
import Toast from './components/Toast';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Deliveries from './pages/Deliveries';
import LiveMap from './pages/LiveMap';
import Drivers from './pages/Drivers';

const PAGES = {
  dashboard: Dashboard,
  deliveries: Deliveries,
  map: LiveMap,
  drivers: Drivers,
};

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(!!getToken());
  const path = useHashPath();
  const sharing = useLocationSharing(user);

  useEffect(() => { applyTheme(); }, []);

  useEffect(() => {
    if (!getToken()) return;
    api('/auth/me')
      .then((data) => setUser(data.user))
      .catch(() => setToken(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="boot">Loading RouteTrack…</div>;

  if (!user) {
    return (
      <>
        <Login
          onLogin={(token, loggedInUser) => {
            setToken(token);
            setUser(loggedInUser);
          }}
        />
        <Toast />
      </>
    );
  }

  const entry = NAV.find((p) => p.path === path && p.roles.includes(user.role)) || NAV[0];
  const Page = PAGES[entry.path];

  return (
    <>
      <Shell
        user={user}
        active={entry.path}
        sharing={sharing}
        onLogout={() => {
          setToken(null);
          setUser(null);
          window.location.hash = '';
        }}
      >
        <Page key={entry.path} user={user} sharing={sharing} />
      </Shell>
      <Toast />
    </>
  );
}
