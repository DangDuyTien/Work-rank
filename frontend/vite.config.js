import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const apiTarget = process.env.VITE_API_URL || 'http://localhost:5001';

function devServiceWorkerCleanupPlugin() {
  return {
    name: 'workrank-dev-service-worker-cleanup',
    apply: 'serve',
    transformIndexHtml(html) {
      return html.replace(
        '<script type="module" src="/src/main.jsx"></script>',
        `<script type="module">
          const resetKey = 'workrank:dev-worker-reset-count';
          const registrations = 'serviceWorker' in navigator
            ? await navigator.serviceWorker.getRegistrations()
            : [];
          const wasControlled = Boolean(navigator.serviceWorker?.controller);
          await Promise.all(registrations.map((registration) => registration.unregister()));
          if ('caches' in window) await caches.delete('workrank-static-v2');
          const resetCount = Number(sessionStorage.getItem(resetKey) || 0);
          if (wasControlled && resetCount < 1) {
            sessionStorage.setItem(resetKey, String(resetCount + 1));
            window.location.reload();
          } else {
            sessionStorage.removeItem(resetKey);
            await import('/src/main.jsx');
          }
        </script>`,
      );
    },
  };
}

export default defineConfig({
  plugins: [react(), devServiceWorkerCleanupPlugin()],
  server: {
    port: 5173,
    proxy: {
      '/api': apiTarget,
      '/socket.io': { target: apiTarget, ws: true },
    },
  },
});
