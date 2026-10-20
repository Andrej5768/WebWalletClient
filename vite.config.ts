import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';
import { staticHome } from './src/landing/staticHome.ts';
import { legalPage } from './src/legal/staticPage.ts';

/**
 * Pages readable without JavaScript: the home page inside index.html, privacy.html and terms.html next to it.
 */
const legalPages = (): Plugin => ({
  name: 'legal-pages',
  apply: 'build',
  transformIndexHtml(html) {
    const home = staticHome();
    return html
      .replace('</head>', `${home.style}\n</head>`)
      .replace('<div id="root"></div>', `<div id="root">${home.body}</div>`);
  },
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
