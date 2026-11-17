import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import { Icon } from '../icons';
import { driverPinOf, formatDistance, formatDuration, hasCoords, initials, timeAgo } from '../utils';
import MapView, { MapLegend } from '../components/MapView';
import StatusBadge from '../components/StatusBadge';
import DeliveryDetail from '../components/DeliveryDetail';
import LocationCard from '../components/LocationCard';

export default function LiveMap({ user, sharing }) {
  const isDispatcher = user.role === 'dispatcher';
  const [deliveries, setDeliveries] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [showDelivered, setShowDelivered] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [route, setRoute] = useState(null);
  const [openId, setOpenId] = useState(null);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const [list, drv] = await Promise.all([
        api(showDelivered ? '/deliveries' : '/deliveries?status=active'),
        isDispatcher ? api('/drivers') : Promise.resolve([]),
      ]);
      setDeliveries(list);
      setDrivers(drv);
      setUpdatedAt(new Date());
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }, [showDelivered, isDispatcher]);

  useEffect(() => {
    load();
    const timer = setInterval(load, 30000);
    return () => clearInterval(timer);
  }, [load]);

  const selected = deliveries.find((d) => d.id === selectedId) || null;

  // Fetch the driving route for the selected delivery
  useEffect(() => {
    setRoute(null);
    if (!selected || !hasCoords(selected, 'pickup') || !hasCoords(selected, 'dropoff')) return undefined;
    let cancelled = false;
    api(`/deliveries/${selected.id}/route`)
      .then((r) => { if (!cancelled) setRoute(r); })
      .catch(() => {});
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id, selected?.pickup_lat, selected?.dropoff_lat]);

  const myPin = !isDispatcher ? deliveries.map(driverPinOf).find(Boolean) : null;
  const mapDrivers = isDispatcher ? drivers : myPin ? [myPin] : [];
  const onMapCount = deliveries.filter((d) => hasCoords(d, 'pickup') && hasCoords(d, 'dropoff')).length;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Live map</h1>
          <p className="muted">
            {onMapCount} of {deliveries.length} {showDelivered ? '' : 'active '}deliveries on the map
            {updatedAt && ` · updated ${timeAgo(updatedAt)}`} · refreshes every 30 seconds
          </p>
        </div>
        <div className="btn-row">
          <label className="check">
            <input type="checkbox" checked={showDelivered} onChange={(e) => setShowDelivered(e.target.checked)} />
            Show delivered
          </label>
          <button className="btn btn-secondary" onClick={load}><Icon name="refresh" /> Refresh</button>
        </div>
      </div>

      {error && <div className="notice notice-error">{error}</div>}
      {sharing.available && <LocationCard sharing={sharing} />}

      <div className="map-layout">
        <aside className="map-side">
          <div className="list-card">
            {deliveries.length === 0 && <p className="empty">No deliveries to show.</p>}
            {deliveries.map((d) => (
              <button
                key={d.id}
                className={`list-row ${d.id === selectedId ? 'selected' : ''}`}
                onClick={() => setSelectedId(d.id === selectedId ? null : d.id)}
              >
                <span className="grow">
                  <span className="row-title"><span className="mono">{d.tracking_code}</span> · {d.customer_name}</span>
                  <span className="row-sub">→ {d.dropoff_address}</span>
                  <span className="row-sub">
                    {d.driver_name || 'Unassigned'}
                    {!(hasCoords(d, 'pickup') && hasCoords(d, 'dropoff')) && ' · not on the map'}
                  </span>
                </span>
                <StatusBadge status={d.status} />
              </button>
            ))}
          </div>

          {isDispatcher && (
            <div className="card drivers-card">
              <h3><Icon name="users" /> Drivers</h3>
              {drivers.map((dr) => (
                <div key={dr.id} className="driver-row">
                  <span className="avatar sm">{initials(dr.name)}</span>
                  <span className="grow">
                    <span className="row-title">{dr.name}</span>
                    <span className="row-sub">
                      {dr.last_lat != null ? `Last seen ${timeAgo(dr.location_updated_at)}` : 'Not sharing location'}
                    </span>
                  </span>
                  <span className="count-pill" title="Active deliveries">{dr.active_count}</span>
                </div>
              ))}
            </div>
          )}
        </aside>

        <section className="map-main">
          {selected && (
            <div className="map-selected">
              <div className="grow">
                <div className="row-title">
                  <span className="ticket">{selected.tracking_code}</span> <StatusBadge status={selected.status} />
                </div>
                <div className="row-sub">{selected.pickup_address} → {selected.dropoff_address}</div>
                <div className="small">
                  <Icon name="route" size={14} />{' '}
                  {route
                    ? <><strong>{formatDistance(route.distance)}</strong> · about {formatDuration(route.duration)}{route.approximate ? ' (straight-line estimate)' : ''}</>
                    : hasCoords(selected, 'pickup') && hasCoords(selected, 'dropoff') ? 'Working out the route…' : 'Not on the map yet'}
                </div>
              </div>
              <div className="btn-row">
                <button className="btn btn-sm" onClick={() => setOpenId(selected.id)}>Details</button>
                <button className="btn btn-secondary btn-sm icon-btn" onClick={() => setSelectedId(null)} aria-label="Clear selection">
                  <Icon name="x" />
                </button>
              </div>
            </div>
          )}
          <MapView
            deliveries={deliveries}
            drivers={mapDrivers}
            route={route}
            selectedId={selectedId}
            onSelect={(d) => setSelectedId(d.id)}
            height="calc(100vh - 260px)"
          />
          <MapLegend showDrivers={mapDrivers.length > 0} />
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
    </>
  );
}
