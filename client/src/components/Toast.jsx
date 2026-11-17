import { useEffect, useState } from 'react';

export function toast(message) {
  window.dispatchEvent(new CustomEvent('rt-toast', { detail: message }));
}

export default function Toast() {
  const [message, setMessage] = useState('');

  useEffect(() => {
    let timer;
    const onToast = (e) => {
      setMessage(e.detail);
      clearTimeout(timer);
      timer = setTimeout(() => setMessage(''), 3500);
    };
    window.addEventListener('rt-toast', onToast);
    return () => {
      window.removeEventListener('rt-toast', onToast);
      clearTimeout(timer);
    };
  }, []);

  if (!message) return null;
  return <div className="toast" role="status" aria-live="polite">{message}</div>;
}
