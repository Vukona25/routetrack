import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import { Icon } from '../icons';
import {
  NEXT_ACTION, STATUS, directionsLink, driverPinOf, formatDate, formatDistance,
  formatDuration, hasCoords, timeAgo,
} from '../utils';
import Modal from './Modal';
import MapView, { MapLegend } from './MapView';
import StatusBadge from './StatusBadge';
import { TextArea } from './Fields';
import { toast } from './Toast';

// Pop-up with everything about one delivery: route map, details, actions and history
export default function DeliveryDetail({ deliveryId, user, drivers = [], onClose, onChanged }) {
  const isDispatcher = user.role === 'dispatcher';
  const [d, setD] = useState(null);
  const [events, setEvents] = useState([]);
  const [route, setRoute] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');

  const load = useCallback(async () => {
    try {
      const [delivery, history] = await Promise.all([
        api(`/deliveries/${deliveryId}`),
        api(`/deliveries/${deliveryId}/events`),
      ]);
      setD(delivery);
      setEvents(history);
      setError('');
      if (hasCoords(delivery, 'pickup') && hasCoords(delivery, 'dropoff')) {
        api(`/deliveries/${deliveryId}/route`).then(setRoute).catch(() => setRoute(null));
      } else {
        setRoute(null);
      }
    } catch (err) {
      setError(err.message);
    }
  }, [deliveryId]);

  useEffect(() => { load(); }, [load]);

  async function run(action, message) {
    setBusy(true);
    setError('');
    try {
      await action();
      toast(message);
      await load();
      onChanged?.();
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    } finally {
      setBusy(false);
    }
  }

  const assign = (driverId) =>
    run(
      () => api(`/deliveries/${deliveryId}/assign`, { method: 'PATCH', body: { driverId: driverId ? Number(driverId) : null } }),
      driverId ? 'Driver assigned' : 'Driver removed'
    );

  async function advance() {
    const next = NEXT_ACTION[d.status];
    const ok = await run(
      () => api(`/deliveries/${deliveryId}/status`, {
        method: 'PATCH',
        body: { status: next.status, note: next.status === 'delivered' ? note : 'Picked up, on the way' },
      }),
      next.status === 'delivered' ? 'Marked as delivered' : 'Trip started'
    );
    if (ok) setNote('');
  }

  const locate = () => run(() => api(`/deliveries/${deliveryId}/locate`, { method: 'PATCH' }), 'Delivery placed on the map');

  const onMap = d && hasCoords(d, 'pickup') && hasCoords(d, 'dropoff');
  const missing = d && !onMap
    ? [!hasCoords(d, 'pickup') && 'the pickup address', !hasCoords(d, 'dropoff') && 'the drop-off address'].filter(Boolean).join(' and ')
    : '';
  const driverPin = driverPinOf(d);
  const next = d && NEXT_ACTION[d.status];

  return (
    <Modal
      wide
      onClose={onClose}
      title={d ? (
        <span className="title-row">
          <span className="ticket">{d.tracking_code}</span>
          <StatusBadge status={d.status} />
        </span>
      ) : 'Loading…'}
      subtitle={d ? `${d.customer_name} · created ${formatDate(d.created_at)}` : ''}
    >
      {error && <div className="notice notice-error">{error}</div>}

      {d && (
        <>
          {onMap ? (
            <>
              <MapView
                deliveries={[d]}
                drivers={driverPin ? [driverPin] : []}
                route={route}
                selectedId={d.id}
                height={280}
              />
              <div className="route-summary">
                <span className="route-figures">
                  <Icon name="route" />
                  {route
                    ? <><strong>{formatDistance(route.distance)}</strong> · about {formatDuration(route.duration)} by road</>
                    : 'Working out the route…'}
                </span>
                {route?.approximate && <span className="tiny muted">Straight-line estimate (routing service unavailable)</span>}
                <MapLegend showDrivers={!!driverPin} />
                <a className="btn btn-secondary btn-sm" href={directionsLink(d)} target="_blank" rel="noreferrer">
                  <Icon name="navigation" /> Directions
                </a>
              </div>
            </>
          ) : (
            <div className="notice notice-warn">
              <strong>Not on the map yet</strong>
              We couldn't find {missing} on the map. Check the spelling, or add the suburb and city.
              {isDispatcher && (
                <div className="btn-row" style={{ marginTop: 8 }}>
                  <button className="btn btn-secondary btn-sm" onClick={locate} disabled={busy}>
                    <Icon name="refresh" /> Try again
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="detail-grid">
            <dl className="kv">
              <dt>Customer</dt>
              <dd>{d.customer_name}</dd>
              <dt>Phone</dt>
              <dd>{d.customer_phone ? <a href={`tel:${d.customer_phone}`}>{d.customer_phone}</a> : '—'}</dd>
              <dt><span className="dot-label pickup">A</span> Pickup</dt>
              <dd>{d.pickup_address}</dd>
              <dt><span className="dot-label dropoff">B</span> Drop-off</dt>
              <dd>{d.dropoff_address}</dd>
              <dt>Driver</dt>
              <dd>
                {isDispatcher ? (
                  <select
                    className="input"
                    value={d.driver_id || ''}
                    disabled={busy || d.status === 'delivered'}
                    onChange={(e) => assign(e.target.value)}
                  >
                    <option value="">Unassigned</option>
                    {drivers.map((dr) => (
                      <option key={dr.id} value={dr.id}>{dr.name}</option>
                    ))}
                  </select>
                ) : (d.driver_name || '—')}
                {driverPin && <div className="tiny muted">Last seen {timeAgo(driverPin.location_updated_at)}</div>}
              </dd>
              <dt>Notes</dt>
              <dd>{d.notes || '—'}</dd>
              <dt>Last update</dt>
              <dd>{formatDate(d.updated_at)}</dd>
            </dl>

            {!isDispatcher && next && (
              <div className="action-box">
                <div className="section-label">Next step</div>
                {next.status === 'delivered' && (
                  <TextArea
                    name="pod-note"
                    label="Delivery note (optional)"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    help="e.g. Signed by J. Mokoena"
                    rows={2}
                  />
                )}
                <button className="btn btn-accent btn-block btn-tall" disabled={busy} onClick={advance}>
                  <Icon name={next.status === 'delivered' ? 'done' : 'truck'} /> {next.label}
                </button>
              </div>
            )}
          </div>

          <h3 className="section-title"><Icon name="history" /> History</h3>
          <div className="timeline">
            {events.map((ev) => (
              <div key={ev.id} className={`tl-item tl-${ev.status}`}>
                <span className="tl-dot"><Icon name={STATUS[ev.status]?.icon || 'records'} /></span>
                <div className="tl-body">
                  <div className="tl-top">
                    <StatusBadge status={ev.status} />
                    <strong>{ev.note || 'Status updated'}</strong>
                    <span className="tl-time tiny muted">{formatDate(ev.created_at)}</span>
                  </div>
                  <div className="tiny muted">by {ev.changed_by_name}</div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </Modal>
  );
}
