import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import { Icon } from '../icons';
import { initials, timeAgo } from '../utils';
import { AddDriverModal } from '../components/Forms';

export default function Drivers() {
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    try {
      setDrivers(await api('/drivers'));
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const sharingCount = drivers.filter((d) => d.last_lat != null).length;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Drivers</h1>
          <p className="muted">{drivers.length} drivers · {sharingCount} have shared a location</p>
        </div>
        <button className="btn" onClick={() => setAdding(true)}>
          <Icon name="userplus" /> Add driver
        </button>
      </div>

      {error && <div className="notice notice-error">{error}</div>}

      <div className="table-wrap">
        {loading ? (
          <p className="empty">Loading drivers…</p>
        ) : drivers.length === 0 ? (
          <p className="empty">No drivers yet. Add your first driver.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Driver</th>
                <th className="num">Active</th>
                <th className="num">Delivered</th>
                <th>Location</th>
              </tr>
            </thead>
            <tbody>
              {drivers.map((d) => (
                <tr key={d.id}>
                  <td>
                    <div className="person">
                      <span className="avatar">{initials(d.name)}</span>
                      <div>
                        <div className="row-title">{d.name}</div>
                        <div className="tiny muted">{d.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="num">{d.active_count}</td>
                  <td className="num">{d.delivered_count}</td>
                  <td>
                    {d.last_lat != null ? (
                      <a href="#/map" className="loc-link">
                        <Icon name="pin" size={14} /> Seen {timeAgo(d.location_updated_at)}
                      </a>
                    ) : (
                      <span className="muted">Not sharing</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {adding && (
        <AddDriverModal
          onClose={() => setAdding(false)}
          onCreated={() => { setAdding(false); load(); }}
        />
      )}
    </>
  );
}
