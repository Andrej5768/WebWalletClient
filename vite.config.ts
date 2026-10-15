import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// The API is served from the same origin under /api: in development Vite proxies it to the backend,
// in production the reverse proxy does. The refresh token cookie therefore needs no CORS.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: process.env.API_URL ?? 'http://localhost:8080' },
    },
  },
});
