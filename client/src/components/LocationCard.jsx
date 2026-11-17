import { Icon } from '../icons';
import { timeAgo } from '../utils';

// Shown to drivers: switch location sharing on or off
export default function LocationCard({ sharing }) {
  const text = {
    off: ['Location sharing is off', 'Switch it on so dispatch can see where you are on the live map.'],
    waiting: ['Finding your location…', 'Allow location access if your browser asks.'],
    live: ['Sharing your location', `Last sent ${timeAgo(sharing.lastSent)}. Updates every 30 seconds.`],
    error: ['Location problem', sharing.error],
  }[sharing.status];

  const tone = sharing.status === 'live' ? 'tone-green' : sharing.status === 'error' ? 'tone-red' : 'tone-amber';

  return (
    <div className={`alert-card ${tone}`}>
      <span className="alert-ic"><Icon name="location" /></span>
      <span className="grow">
        <strong>{text[0]}</strong>
        <span className="small muted">{text[1]}</span>
      </span>
      <button className={`btn btn-sm ${sharing.enabled ? 'btn-secondary' : 'btn-accent'}`} onClick={sharing.toggle}>
        {sharing.enabled ? 'Stop sharing' : 'Share location'}
      </button>
    </div>
  );
}
