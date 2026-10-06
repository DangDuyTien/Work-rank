import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

if ('serviceWorker' in navigator) {
  if (import.meta.env.PROD) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    });
  } else {
    window.addEventListener('load', async () => {
      try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        if (!registrations.length && !navigator.serviceWorker.controller) return;

        await Promise.all(registrations.map((registration) => registration.unregister()));
        if (window.caches) {
          await window.caches.delete('workrank-static-v2');
        }

        if (navigator.serviceWorker.controller && !sessionStorage.getItem('workrank:dev-worker-cleared')) {
          sessionStorage.setItem('workrank:dev-worker-cleared', '1');
          window.location.reload();
        }
      } catch {
        // Dev mode must stay usable when browser worker storage is unavailable.
      }
    });
  }
}

// Auto-recover from stale chunks on new deployments without crashing
window.addEventListener('vite:preloadError', (event) => {
  console.warn('Stale chunk detected or network drop, reloading latest bundle...', event);
  window.location.reload();
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
