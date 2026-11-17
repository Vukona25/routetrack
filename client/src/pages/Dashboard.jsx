import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import { Icon } from '../icons';
import { driverPinOf, greeting } from '../utils';
import MapView, { MapLegend } from '../components/MapView';
import StatusBadge from '../components/StatusBadge';
import DeliveryDetail from '../components/DeliveryDetail';
import LocationCard from '../components/LocationCard';
import { NewDeliveryModal } from '../components/Forms';

export default function Dashboard({ user, sharing }) {
  const isDispatcher = user.role === 'dispatcher';
  const [stats, setStats] = useState(null);
  const [active, setActive] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [openId, setOpenId] = useState(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const [s, list, drv] = await Promise.all([
        api('/stats'),
        api('/deliveries?status=active'),
        isDispatcher ? api('/drivers') : Promise.resolve([]),
      ]);
      setStats(s);
      setActive(list);
      setDrivers(drv);
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }, [isDispatcher]);

  useEffect(() => {
    load();
    const timer = setInterval(load, 30000);
    return () => clearInterval(timer);
  }, [load]);

  const today = new Date().toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const myPin = !isDispatcher ? active.map(driverPinOf).find(Boolean) : null;
  const mapDrivers = isDispatcher ? drivers : myPin ? [myPin] : [];

  const tiles = [
    { label: isDispatcher ? 'All deliveries' : 'My deliveries', value: stats?.total, icon: 'package' },
    { label: 'Pending', value: stats?.pending, icon: 'clock' },
    { label: 'In transit', value: stats?.in_transit, icon: 'truck' },
    { label: 'Delivered today', value: stats?.delivered_today, icon: 'done' },
  ];

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{greeting()}, {user.name.split(' ')[0]}</h1>
          <p className="muted">{today}</p>
        </div>
        {isDispatcher && (
          <button className="btn" onClick={() => setCreating(true)}>
            <Icon name="plus" /> New delivery
          </button>
        )}
      </div>

      {error && <div className="notice notice-error">{error}</div>}

      <div className="stats">
        {tiles.map((t) => (
          <a key={t.label} className="stat" href="#/deliveries">
            <div className="stat-head">
              <span className="stat-label">{t.label}</span>
              <span className="icon-box sm"><Icon name={t.icon} /></span>
            </div>
            <div className="stat-value">{t.value ?? '—'}</div>
          </a>
        ))}
      </div>

      {sharing.available && <LocationCard sharing={sharing} />}

      {isDispatcher && stats?.unassigned > 0 && (
        <a className="alert-card tone-amber" href="#/deliveries">
          <span className="alert-ic"><Icon name="warning" /></span>
          <span className="grow">
            <strong>{stats.unassigned} {stats.unassigned === 1 ? 'delivery needs' : 'deliveries need'} a driver</strong>
            <span className="small muted">Open Deliveries and assign a driver so they can get going.</span>
          </span>
          <span className="chev"><Icon name="chevron" /></span>
        </a>
      )}

      <div className="grid grid-2 dash-grid">
        <section className="card">
          <div className="card-head">
            <h3><Icon name="map" /> Live map</h3>
            <a className="btn btn-secondary btn-sm" href="#/map">Open full map</a>
          </div>
          <MapView deliveries={active} drivers={mapDrivers} height={320} onSelect={(d) => setOpenId(d.id)} />
          <MapLegend showDrivers={mapDrivers.length > 0} />
        </section>

        <section className="card">
          <div className="card-head">
            <h3><Icon name="truck" /> Active deliveries</h3>
            <span className="count-pill">{active.length}</span>
          </div>
          {active.length === 0 ? (
            <p className="empty">No active deliveries right now.</p>
          ) : (
            <div className="list-card">
              {active.slice(0, 6).map((d) => (
                <button key={d.id} className="list-row" onClick={() => setOpenId(d.id)}>
                  <span className="icon-box"><Icon name={d.status === 'in_transit' ? 'truck' : 'package'} /></span>
                  <span className="grow">
                    <span className="row-title"><span className="mono">{d.tracking_code}</span> · {d.customer_name}</span>
                    <span className="row-sub">
                      {d.dropoff_address} · {d.driver_name || 'Unassigned'}
                    </span>
                  </span>
                  <StatusBadge status={d.status} />
                  <span className="chev"><Icon name="chevron" /></span>
                </button>
              ))}
            </div>
          )}
          {active.length > 6 && (
            <a className="btn-link view-all" href="#/deliveries">View all {active.length} active deliveries</a>
          )}
        </section>
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
