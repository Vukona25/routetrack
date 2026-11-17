export const STATUS = {
  pending: { label: 'Pending', tone: 'amber', icon: 'package' },
  in_transit: { label: 'In transit', tone: 'blue', icon: 'truck' },
  delivered: { label: 'Delivered', tone: 'green', icon: 'done' },
};

export const NEXT_ACTION = {
  pending: { status: 'in_transit', label: 'Start trip' },
  in_transit: { status: 'delivered', label: 'Mark delivered' },
};

export const roleLabel = (role) => (role === 'dispatcher' ? 'Dispatcher' : 'Driver');

export function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-ZA', { dateStyle: 'medium', timeStyle: 'short' });
}

export function timeAgo(value) {
  if (!value) return 'never';
  const seconds = Math.round((Date.now() - new Date(value).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return formatDate(value);
}

export function formatDistance(metres) {
  if (metres == null) return '—';
  return metres >= 1000 ? `${(metres / 1000).toFixed(1)} km` : `${Math.round(metres)} m`;
}

export function formatDuration(seconds) {
  if (seconds == null) return '—';
  const minutes = Math.max(1, Math.round(seconds / 60));
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
}

export const initials = (name = '') =>
  name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');

export function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export const esc = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const hasCoords = (d, which) => d && d[`${which}_lat`] != null && d[`${which}_lng`] != null;

// Opens turn-by-turn directions in Google Maps on the driver's phone
export function directionsLink(d) {
  const origin = hasCoords(d, 'pickup') ? `${d.pickup_lat},${d.pickup_lng}` : d.pickup_address;
  const destination = hasCoords(d, 'dropoff') ? `${d.dropoff_lat},${d.dropoff_lng}` : d.dropoff_address;
  const params = new URLSearchParams({ api: '1', origin, destination, travelmode: 'driving' });
  return `https://www.google.com/maps/dir/?${params}`;
}

// The assigned driver's last position, in the shape the map expects
export function driverPinOf(d) {
  if (!d || d.driver_lat == null || d.driver_lng == null) return null;
  return {
    id: d.driver_id,
    name: d.driver_name,
    last_lat: d.driver_lat,
    last_lng: d.driver_lng,
    location_updated_at: d.driver_location_at,
  };
}
