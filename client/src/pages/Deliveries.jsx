import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import { Icon } from '../icons';
import { formatDate, hasCoords } from '../utils';
import StatusBadge from '../components/StatusBadge';
import DeliveryDetail from '../components/DeliveryDetail';
import { NewDeliveryModal } from '../components/Forms';

export default function Deliveries({ user }) {
  const isDispatcher = user.role === 'dispatcher';
  const [list, setList] = useState([]);
  const [stats, setStats] = useState(null);
  const [drivers, setDrivers] = useState([]);
  const [status, setStatus] = useState('');
  const [driverId, setDriverId] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openId, setOpenId] = useState(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams(Object.entries({ status, driverId, search }).filter(([, v]) => v));
      const [rows, s] = await Promise.all([api(`/deliveries?${params}`), api('/stats')]);
      setList(rows);
      setStats(s);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [status, driverId, search]);

  useEffect(() => {
    const timer = setTimeout(load, 250); // wait for typing to pause before searching
    return () => clearTimeout(timer);
  }, [load]);

  const loadDrivers = useCallback(() => {
    if (isDispatcher) api('/drivers').then(setDrivers).catch(() => {});
  }, [isDispatcher]);

  useEffect(() => { loadDrivers(); }, [loadDrivers]);

  const tabs = [
    ['', 'All', stats?.total],
    ['pending', 'Pending', stats?.pending],
    ['in_transit', 'In transit', stats?.in_transit],
    ['delivered', 'Delivered', stats?.delivered],
  ];

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{isDispatcher ? 'Deliveries' : 'My deliveries'}</h1>
          <p className="muted">
            {isDispatcher
              ? 'Create deliveries, assign drivers and follow each order to the door.'
              : 'Deliveries assigned to you. Open one to see the route and update its status.'}
          </p>
        </div>
        {isDispatcher && (
          <button className="btn" onClick={() => setCreating(true)}>
            <Icon name="plus" /> New delivery
          </button>
        )}
      </div>

      <div className="tabs" role="tablist">
        {tabs.map(([value, label, count]) => (
          <button
            key={label}
            role="tab"
            className="tab"
            aria-selected={status === value}
            onClick={() => setStatus(value)}
          >
            {label} <span className="count-pill">{count ?? '–'}</span>
          </button>
        ))}
      </div>

      <div className="filters">
        <div className="search-box">
          <Icon name="search" />
          <input
            className="input"
            placeholder="Search tracking code, customer or address"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {isDispatcher && (
          <select className="input" value={driverId} onChange={(e) => setDriverId(e.target.value)}>
            <option value="">All drivers</option>
            <option value="unassigned">Unassigned</option>
            {drivers.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        )}
      </div>

      {error && <div className="notice notice-error">{error}</div>}

      <div className="table-wrap">
        {loading ? (
          <p className="empty">Loading deliveries…</p>
        ) : list.length === 0 ? (
          <p className="empty">No deliveries match these filters.</p>
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
              </tr>
            </thead>
            <tbody>
              {list.map((d) => {
                const onMap = hasCoords(d, 'pickup') && hasCoords(d, 'dropoff');
                return (
                  <tr key={d.id} className="clickable" onClick={() => setOpenId(d.id)}>
                    <td><span className="ticket">{d.tracking_code}</span></td>
                    <td>
                      {d.customer_name}
                      {d.customer_phone && <div className="tiny muted">{d.customer_phone}</div>}
                    </td>
                    <td className="route-cell">
                      <div><span className="dot-label pickup">A</span> {d.pickup_address}</div>
                      <div><span className="dot-label dropoff">B</span> {d.dropoff_address}</div>
                      {!onMap && <div className="tiny text-warning"><Icon name="warning" size={12} /> Not on the map</div>}
                    </td>
                    <td>{d.driver_name || <span className="muted">Unassigned</span>}</td>
                    <td><StatusBadge status={d.status} /></td>
                    <td className="tiny muted nowrap">{formatDate(d.updated_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {openId && (
        <DeliveryDetail
          deliveryId={openId}
          user={user}
          drivers={drivers}
          onClose={() => setOpenId(null)}
          onChanged={load}
        />
      )}
      {creating && (
        <NewDeliveryModal
          drivers={drivers}
          onClose={() => setCreating(false)}
          onCreated={() => { setCreating(false); load(); }}
        />
      )}
    </>
  );
}
