import { useEffect, useState } from 'react';

// Side menu entries (same structure as CareCollect's menu sections)
export const NAV = [
  { path: 'dashboard', label: 'Dashboard', icon: 'home', section: 'Overview', roles: ['dispatcher', 'driver'] },
  { path: 'deliveries', label: 'Deliveries', driverLabel: 'My deliveries', icon: 'package', section: 'Overview', roles: ['dispatcher', 'driver'] },
  { path: 'map', label: 'Live map', icon: 'map', section: 'Overview', roles: ['dispatcher', 'driver'] },
  { path: 'drivers', label: 'Drivers', icon: 'users', section: 'Team', roles: ['dispatcher'] },
];

const readPath = () => window.location.hash.replace(/^#\/?/, '').split('?')[0] || 'dashboard';

export function useHashPath() {
  const [path, setPath] = useState(readPath);
  useEffect(() => {
    const onChange = () => setPath(readPath());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return path;
}

export function navigate(path) {
  window.location.hash = `#/${path}`;
}
