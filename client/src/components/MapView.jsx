import { useEffect, useRef } from 'react';
import L from 'leaflet';
import { esc, hasCoords, initials, timeAgo, STATUS } from '../utils';

// Gauteng, so the map starts somewhere sensible before data loads
const DEFAULT_CENTER = [-26.05, 28.15];
const DEFAULT_ZOOM = 10;

const cssVar = (name, fallback) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;

const pinIcon = (kind, letter, faded) =>
  L.divIcon({
    className: 'rt-marker',
    html: `<div class="map-pin ${kind}${faded ? ' faded' : ''}"><span>${letter}</span></div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 34],
    popupAnchor: [0, -30],
  });

const driverIcon = (name) =>
  L.divIcon({
    className: 'rt-marker',
    html: `<div class="map-driver"><span>${esc(initials(name))}</span></div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16],
  });

const deliveryPopup = (d, which) => `
  <div class="map-popup">
    <strong>${esc(d.tracking_code)}</strong> · ${esc(STATUS[d.status]?.label || d.status)}<br/>
    <span class="muted">${which === 'pickup' ? 'Pickup' : 'Drop-off'}:</span> ${esc(d[`${which}_address`])}<br/>
    <span class="muted">Customer:</span> ${esc(d.customer_name)}
  </div>`;

/**
 * Leaflet map with OpenStreetMap tiles.
 *  - deliveries: pickup (A, green) and drop-off (B, ink) pins joined by a dashed line
 *  - drivers: blue circles with initials at each driver's last shared position
 *  - route: the driving route for the selected delivery, drawn as a solid green line
 */
export default function MapView({ deliveries = [], drivers = [], route = null, selectedId = null, onSelect, height = 400 }) {
  const elRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);
  const fitRef = useRef('');
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  // Create the map once
  useEffect(() => {
    const map = L.map(elRef.current, { zoomControl: true }).setView(DEFAULT_CENTER, DEFAULT_ZOOM);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);

    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    fitRef.current = '';

    // Keep the map sized correctly when it sits in a modal or the window resizes
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(elRef.current);

    return () => {
      observer.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Draw pins, lines and the route whenever the data changes
  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();

    const allPoints = [];
    let selectedPoints = [];
    const lineColor = cssVar('--text-2', '#5B6573');

    deliveries.forEach((d) => {
      const selected = d.id === selectedId;
      const faded = selectedId != null && !selected;
      const points = [];

      ['pickup', 'dropoff'].forEach((which) => {
        if (!hasCoords(d, which)) return;
        const point = [d[`${which}_lat`], d[`${which}_lng`]];
        points.push(point);
        const marker = L.marker(point, {
          icon: pinIcon(which, which === 'pickup' ? 'A' : 'B', faded),
          zIndexOffset: selected ? 500 : 0,
        })
          .bindPopup(deliveryPopup(d, which))
          .addTo(layer);
        marker.on('click', () => onSelectRef.current?.(d));
      });

      if (points.length === 2 && !(selected && route)) {
        L.polyline(points, { color: lineColor, weight: 2, dashArray: '4 6', opacity: faded ? 0.25 : 0.7 }).addTo(layer);
      }

      allPoints.push(...points);
      if (selected) selectedPoints = points;
    });

    if (route?.path?.length) {
      L.polyline(route.path, {
        color: cssVar('--accent', '#15803D'),
        weight: 5,
        opacity: 0.9,
        dashArray: route.approximate ? '8 8' : null,
      }).addTo(layer);
    }

    drivers.forEach((driver) => {
      if (driver.last_lat == null || driver.last_lng == null) return;
      const point = [driver.last_lat, driver.last_lng];
      L.marker(point, { icon: driverIcon(driver.name), zIndexOffset: 1000 })
        .bindPopup(`<div class="map-popup"><strong>${esc(driver.name)}</strong><br/><span class="muted">Last seen ${esc(timeAgo(driver.location_updated_at))}</span></div>`)
        .addTo(layer);
      allPoints.push(point);
    });

    // Only move the camera when the focus changes, not on every refresh
    const focusKey = `${selectedId ?? ''}|${route ? route.path.length : 0}|${allPoints.length > 0}`;
    if (focusKey !== fitRef.current) {
      fitRef.current = focusKey;
      let points = allPoints;
      if (route?.path?.length) points = route.path;
      else if (selectedId != null && selectedPoints.length) points = selectedPoints;

      if (points.length === 1) map.setView(points[0], 14);
      else if (points.length > 1) map.fitBounds(L.latLngBounds(points), { padding: [36, 36], maxZoom: 15 });
    }
  }, [deliveries, drivers, route, selectedId]);

  return <div ref={elRef} className="map-box" style={{ height }} />;
}

export function MapLegend({ showDrivers = true }) {
  return (
    <div className="map-legend">
      <span><i className="lg pickup" /> Pickup</span>
      <span><i className="lg dropoff" /> Drop-off</span>
      <span><i className="lg route" /> Route</span>
      {showDrivers && <span><i className="lg driver" /> Driver</span>}
    </div>
  );
}
