import { useEffect, useState } from 'react';
import { api } from '../api';
import { STATUS_LABELS, formatDate } from '../utils';

export default function HistoryPanel({ delivery, onClose }) {
  const [events, setEvents] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    api(`/deliveries/${delivery.id}/events`)
      .then(setEvents)
      .catch((err) => setError(err.message));
  }, [delivery.id]);

  return (
    <div className="overlay" onClick={onClose}>
      <div className="card modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2 className="mono">{delivery.tracking_code}</h2>
          <button className="btn" onClick={onClose}>Close</button>
        </div>
        <p className="muted">
          {delivery.pickup_address} → {delivery.dropoff_address}
        </p>

        {error && <p className="error">{error}</p>}

        <ol className="timeline">
          {events.map((ev) => (
            <li key={ev.id}>
              <span className={`badge ${ev.status}`}>{STATUS_LABELS[ev.status]}</span>
              <div>
                <strong>{ev.note || 'Status updated'}</strong>
                <div className="muted small">
                  {ev.changed_by_name} · {formatDate(ev.created_at)}
                </div>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
