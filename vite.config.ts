import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';
import { legalPage } from './src/legal/staticPage.ts';

/** privacy.html and terms.html next to index.html: the legal pages readable without JavaScript. */
const legalPages = (): Plugin => ({
  name: 'legal-pages',
  apply: 'build',
  generateBundle() {
    for (const page of ['privacy', 'terms'] as const) {
      this.emitFile({ type: 'asset', fileName: `${page}.html`, source: legalPage(page) });
    }
  },
});

// The API is served from the same origin under /api: in development Vite proxies it to the backend,
// in production the reverse proxy does. The refresh token cookie therefore needs no CORS.
export default defineConfig({
  plugins: [react(), legalPages()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: process.env.API_URL ?? 'http://localhost:8080' },
    },
  },
});
