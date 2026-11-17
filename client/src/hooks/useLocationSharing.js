import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';

const KEY = 'routetrack_share_location';
const SEND_EVERY_MS = 30000;

// Drivers can share their position so dispatch sees them on the live map.
// It sends the position straight away, then every 30 seconds while switched on.
export default function useLocationSharing(user) {
  const isDriver = user?.role === 'driver';
  const [enabled, setEnabled] = useState(() => localStorage.getItem(KEY) === 'on');
  const [status, setStatus] = useState('off'); // off | waiting | live | error
  const [error, setError] = useState('');
  const [lastSent, setLastSent] = useState(null);

  useEffect(() => {
    if (!isDriver || !enabled) {
      setStatus('off');
      return undefined;
    }
    if (!('geolocation' in navigator)) {
      setStatus('error');
      setError('This browser cannot share its location.');
      return undefined;
    }

    let cancelled = false;
    setStatus('waiting');
    setError('');

    const send = () =>
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          if (cancelled) return;
          try {
            await api('/me/location', {
              method: 'POST',
              body: { lat: pos.coords.latitude, lng: pos.coords.longitude },
            });
            if (!cancelled) {
              setStatus('live');
              setLastSent(new Date());
              setError('');
            }
          } catch (err) {
            if (!cancelled) {
              setStatus('error');
              setError(err.message);
            }
          }
        },
        (err) => {
          if (cancelled) return;
          setStatus('error');
          setError(err.code === 1
            ? 'Location access was blocked. Allow it in your browser settings.'
            : 'Could not get your location. Check that location is switched on.');
        },
        { enableHighAccuracy: true, maximumAge: 15000, timeout: 20000 }
      );

    send();
    const timer = setInterval(send, SEND_EVERY_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [isDriver, enabled]);

  const toggle = useCallback(() => {
    setEnabled((on) => {
      const next = !on;
      localStorage.setItem(KEY, next ? 'on' : 'off');
      return next;
    });
  }, []);

  return { available: isDriver, enabled, status, error, lastSent, toggle };
}
