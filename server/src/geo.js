// Free OpenStreetMap services:
//  - Nominatim turns an address into map coordinates (geocoding)
//  - OSRM works out the driving route, distance and travel time
// Both are fine for a demo or portfolio. A busy production app should use a paid
// provider or host its own copy, because the free servers limit usage.

const USER_AGENT = 'RouteTrack/1.0 (portfolio project by Vukona Ngwenya)';
const country = () => process.env.GEOCODE_COUNTRY || 'za';
const osrmUrl = () => (process.env.OSRM_URL || 'https://router.project-osrm.org').replace(/\/$/, '');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Nominatim allows about one request per second, so lookups wait their turn.
let queue = Promise.resolve();
function oneAtATime(task) {
  const run = queue.then(task, task);
  queue = run.then(() => sleep(1100), () => sleep(1100));
  return run;
}

const geocodeCache = new Map();

async function geocode(address, { fresh = false } = {}) {
  const key = String(address || '').trim().toLowerCase();
  if (!key) return null;
  if (!fresh && geocodeCache.has(key)) return geocodeCache.get(key);

  return oneAtATime(async () => {
    try {
      const params = new URLSearchParams({ format: 'json', limit: '1', countrycodes: country(), q: address });
      const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
        headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'en' },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) return null;
      const results = await res.json();
      const point = results[0] ? { lat: Number(results[0].lat), lng: Number(results[0].lon) } : null;
      geocodeCache.set(key, point);
      return point;
    } catch (err) {
      console.warn(`Address lookup failed for "${address}": ${err.message}`);
      return null;
    }
  });
}

function distanceMeters(a, b) {
  const R = 6371000;
  const rad = (deg) => (deg * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

const routeCache = new Map();

async function getRoute(from, to) {
  const key = `${from.lat},${from.lng};${to.lat},${to.lng}`;
  if (routeCache.has(key)) return routeCache.get(key);

  try {
    const url = `${osrmUrl()}/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`;
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error(`routing service answered ${res.status}`);
    const data = await res.json();
    const best = data.routes && data.routes[0];
    if (!best) throw new Error('no route found');

    const route = {
      distance: best.distance, // metres
      duration: best.duration, // seconds
      path: best.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
      approximate: false,
    };
    routeCache.set(key, route);
    return route;
  } catch (err) {
    console.warn(`Routing failed, using a straight line: ${err.message}`);
    const distance = distanceMeters(from, to);
    return {
      distance,
      duration: (distance / 1000 / 40) * 3600, // rough guess at 40 km/h
      path: [[from.lat, from.lng], [to.lat, to.lng]],
      approximate: true,
    };
  }
}

module.exports = { geocode, getRoute };
