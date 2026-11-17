import { useState } from 'react';
import { NAV } from '../routes';
import { Icon, Logo } from '../icons';
import { initials, roleLabel } from '../utils';
import { isDark, setTheme } from '../theme';

// Side menu + mobile top bar, laid out like CareCollect
export default function Shell({ user, active, sharing, onLogout, children }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [dark, setDark] = useState(isDark);

  const links = NAV.filter((p) => p.roles.includes(user.role));
  const sections = [...new Set(links.map((p) => p.section))];

  function toggleTheme() {
    const next = dark ? 'light' : 'dark';
    setTheme(next);
    setDark(next === 'dark');
  }

  const shareText = { off: 'Off', waiting: 'Starting…', live: 'Live', error: 'Problem' }[sharing.status];

  return (
    <div className={`shell ${menuOpen ? 'nav-open' : ''}`}>
      <aside className="sidebar" aria-label="Main menu">
        <div className="brand">
          <Logo size={40} />
          <div>
            <div className="brand-name">RouteTrack</div>
            <div className="brand-sub">Delivery &amp; Route Tracking</div>
          </div>
        </div>

        {sections.map((section) => (
          <div key={section}>
            <div className="nav-label">{section}</div>
            {links.filter((p) => p.section === section).map((p) => (
              <a
                key={p.path}
                href={`#/${p.path}`}
                className={`nav-link ${p.path === active ? 'active' : ''}`}
                onClick={() => setMenuOpen(false)}
              >
                <Icon name={p.icon} />
                <span>{user.role === 'driver' && p.driverLabel ? p.driverLabel : p.label}</span>
              </a>
            ))}
          </div>
        ))}

        {sharing.available && (
          <button className="share-box" onClick={sharing.toggle} title="Share my location with dispatch">
            <span className={`share-dot ${sharing.status}`} />
            <span className="grow">Location sharing</span>
            <span className="tiny muted">{shareText}</span>
          </button>
        )}

        <div className="sidebar-foot">
          <div className="who-row">
            <div className="avatar">{initials(user.name)}</div>
            <div className="grow">
              <div className="who">{user.name}</div>
              <div className="who-role">{roleLabel(user.role)}</div>
            </div>
          </div>
          <div className="btn-row">
            <button
              className="btn btn-secondary btn-sm icon-btn"
              onClick={toggleTheme}
              aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
              title={dark ? 'Light mode' : 'Dark mode'}
            >
              <Icon name={dark ? 'sun' : 'moon'} />
            </button>
            <button className="btn btn-secondary btn-sm grow" onClick={onLogout}>
              <Icon name="logout" /> Log out
            </button>
          </div>
        </div>
      </aside>

      {menuOpen && <div className="scrim" onClick={() => setMenuOpen(false)} />}

      <div className="main">
        <header className="topbar">
          <button className="btn btn-secondary btn-sm icon-btn" onClick={() => setMenuOpen(true)} aria-label="Open menu">
            <Icon name="menu" />
          </button>
          <strong>RouteTrack</strong>
          <span className="tiny muted">{roleLabel(user.role)}</span>
        </header>
        <main className="page">{children}</main>
      </div>
    </div>
  );
}
