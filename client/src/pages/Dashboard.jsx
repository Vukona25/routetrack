import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import { STATUS_LABELS, NEXT_ACTION, formatDate } from '../utils';
import { NewDeliveryForm, AddDriverForm } from '../components/Forms';
import HistoryPanel from '../components/HistoryPanel';

export default function Dashboard({ user, onLogout }) {
  const isDispatcher = user.role === 'dispatcher';

  const [deliveries, setDeliveries] = useState([]);
  const [stats, setStats] = useState({ total: 0, pending: 0, in_transit: 0, delivered: 0 });
  const [drivers, setDrivers] = useState([]);
  const [filters, setFilters] = useState({ status: '', driverId: '', search: '' });
  const [panel, setPanel] = useState(null); // 'delivery' | 'driver' | null
  const [historyFor, setHistoryFor] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams(Object.entries(filters).filter(([, v]) => v));
      const [list, statData] = await Promise.all([
        api(`/deliveries?${params}`),
        api('/stats'),
      ]);
      setDeliveries(list);
      setStats(statData);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const loadDrivers = useCallback(async () => {
    if (!isDispatcher) return;
    try {
      setDrivers(await api('/drivers'));
    } catch (err) {
      setError(err.message);
    }
  }, [isDispatcher]);

  useEffect(() => {
    const timer = setTimeout(load, 250); // small delay so search doesn't fire on every keystroke
    return () => clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    loadDrivers();
  }, [loadDrivers]);

  function updateFilter(e) {
    const { name, value } = e.target;
    setFilters((f) => ({ ...f, [name]: value }));
  }

  async function assignDriver(deliveryId, driverId) {
    try {
      await api(`/deliveries/${deliveryId}/assign`, {
        method: 'PATCH',
        body: { driverId: driverId ? Number(driverId) : null },
      });
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function advanceStatus(delivery) {
    const next = NEXT_ACTION[delivery.status];
    if (!next) return;

    let note = null;
    if (next.status === 'delivered') {
      note = window.prompt('Delivery note (optional), e.g. "Signed by J. Mokoena"', '');
      if (note === null) return; // cancelled
    }

    try {
      await api(`/deliveries/${delivery.id}/status`, {
        method: 'PATCH',
        body: { status: next.status, note },
      });
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  const statCards = [
    { key: '', label: 'Total', value: stats.total },
    { key: 'pending', label: 'Pending', value: stats.pending },
    { key: 'in_transit', label: 'In transit', value: stats.in_transit },
    { key: 'delivered', label: 'Delivered', value: stats.delivered },
  ];

  return (
    <div className="layout">
      <header className="topbar">
        <div className="brand">RouteTrack</div>
        <div className="user-info">
          <span>{user.name}</span>
          <span className={`role-tag ${user.role}`}>{user.role}</span>
          <button className="btn" onClick={onLogout}>Log out</button>
        </div>
      </header>

      <main className="content">
        <section className="stats">
          {statCards.map((card) => (
            <button
              key={card.label}
              className={`stat-card ${filters.status === card.key ? 'active' : ''}`}
              onClick={() => setFilters((f) => ({ ...f, status: card.key }))}
            >
              <span className="stat-value">{card.value}</span>
              <span className="stat-label">{card.label}</span>
            </button>
          ))}
        </section>

        <section className="toolbar">
          <input
            name="search"
            placeholder="Search tracking code, customer or address…"
            value={filters.search}
            onChange={updateFilter}
          />
          <select name="status" value={filters.status} onChange={updateFilter}>
            <option value="">All statuses</option>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          {isDispatcher && (
            <>
              <select name="driverId" value={filters.driverId} onChange={updateFilter}>
                <option value="">All drivers</option>
                <option value="unassigned">Unassigned</option>
                {drivers.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
              <button className="btn primary" onClick={() => setPanel(panel === 'delivery' ? null : 'delivery')}>
                + New delivery
              </button>
              <button className="btn" onClick={() => setPanel(panel === 'driver' ? null : 'driver')}>
                + Add driver
              </button>
            </>
          )}
        </section>

        {panel === 'delivery' && (
          <NewDeliveryForm
            drivers={drivers}
            onCreated={() => { setPanel(null); load(); }}
            onCancel={() => setPanel(null)}
          />
        )}
        {panel === 'driver' && (
          <AddDriverForm
            onCreated={() => { setPanel(null); loadDrivers(); }}
            onCancel={() => setPanel(null)}
          />
        )}

        {error && <p className="error banner">{error}</p>}

        <section className="card table-wrap">
          {loading ? (
            <p className="muted pad">Loading deliveries…</p>
          ) : deliveries.length === 0 ? (
            <p className="muted pad">No deliveries match these filters.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Tracking</th>
                  <th>Customer</th>
                  <th>Route</th>
                  <th>Driver</th>
                  <th>Status</th>
                  <th>Updated</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {deliveries.map((d) => (
                  <tr key={d.id}>
                    <td className="mono">{d.tracking_code}</td>
                    <td>
                      {d.customer_name}
                      {d.customer_phone && <div className="muted small">{d.customer_phone}</div>}
                    </td>
                    <td>
                      <div>{d.pickup_address}</div>
                      <div className="muted small">→ {d.dropoff_address}</div>
                    </td>
                    <td>
                      {isDispatcher ? (
                        <select
                          value={d.driver_id || ''}
                          disabled={d.status === 'delivered'}
                          onChange={(e) => assignDriver(d.id, e.target.value)}
                        >
                          <option value="">Unassigned</option>
                          {drivers.map((dr) => (
                            <option key={dr.id} value={dr.id}>{dr.name}</option>
                          ))}
                        </select>
                      ) : (
                        d.driver_name || '—'
                      )}
                    </td>
                    <td>
                      <span className={`badge ${d.status}`}>{STATUS_LABELS[d.status]}</span>
                    </td>
                    <td className="small">{formatDate(d.updated_at)}</td>
                    <td className="actions">
                      {!isDispatcher && NEXT_ACTION[d.status] && (
                        <button className="btn primary small-btn" onClick={() => advanceStatus(d)}>
                          {NEXT_ACTION[d.status].label}
                        </button>
                      )}
                      <button className="btn small-btn" onClick={() => setHistoryFor(d)}>
                        History
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </main>

      {historyFor && <HistoryPanel delivery={historyFor} onClose={() => setHistoryFor(null)} />}
    </div>
  );
}
