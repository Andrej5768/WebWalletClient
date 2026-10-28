import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';
import { staticHome } from './src/landing/staticHome.ts';
import { robots, seoHead, sitemap } from './src/landing/seo.ts';
import { legalPage } from './src/legal/staticPage.ts';

const homeTitle = {
  en: 'WebWallet — personal finance, investments and taxes',
  uk: 'WebWallet — особисті фінанси, інвестиції та податки',
};
const homeDescription = {
  en: 'WebWallet: track money in several banks and currencies, envelope budgeting, investment portfolio analytics and Ukrainian taxes in one place.',
  uk: 'WebWallet: облік грошей у кількох банках і валютах, бюджет конвертами, аналітика інвестиційного портфеля й українські податки в одному місці.',
};

/** The head and the static home of one language, between markers that the Ukrainian copy replaces. */
function homeParts(language: 'en' | 'uk') {
  const home = staticHome(language);
  return {
    head: `<!--seo-->\n<title>${homeTitle[language]}</title>\n<meta name="description" content="${homeDescription[language]}" />\n${seoHead('/', language, homeTitle[language], homeDescription[language])}\n<!--/seo-->`,
    style: home.style,
    body: `<!--home-->${home.body}<!--/home-->`,
  };
}

/**
 * Pages readable without JavaScript, for crawlers: the home page inside index.html (English) and uk/index.html
 * (Ukrainian), privacy.html and terms.html next to them and under uk/, the sitemap and robots.txt.
 */
const publicPages = (): Plugin => {
  let outDir = 'dist';
  return {
    name: 'public-pages',
    apply: 'build',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
    },
    transformIndexHtml(html) {
      const home = homeParts('en');
      return html
        .replace(/<title>[\s\S]*?<\/title>\s*<meta\s+name="description"[\s\S]*?\/>/, home.head)
        .replace('</head>', `${home.style}\n</head>`)
        .replace('<div id="root"></div>', `<div id="root">${home.body}</div>`);
    },
    generateBundle() {
      for (const page of ['privacy', 'terms'] as const) {
        this.emitFile({ type: 'asset', fileName: `${page}.html`, source: legalPage(page, 'en') });
        this.emitFile({ type: 'asset', fileName: `uk/${page}.html`, source: legalPage(page, 'uk') });
      }
      this.emitFile({
        type: 'asset',
        fileName: 'sitemap.xml',
        source: sitemap(new Date().toISOString().slice(0, 10)),
      });
      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: robots });
    },
    // The Ukrainian home is the finished index.html (with the hashed scripts) in Ukrainian
    closeBundle() {
      const html = readFileSync(join(outDir, 'index.html'), 'utf8');
      const uk = homeParts('uk');
      const page = html
        .replace('<html lang="en">', '<html lang="uk">')
        .replace(/<!--seo-->[\s\S]*?<!--\/seo-->/, uk.head)
        .replace(/<!--home-->[\s\S]*?<!--\/home-->/, uk.body);
      if (page === html || !page.includes('<html lang="uk">'))
        throw new Error('The Ukrainian home page was not built');
      mkdirSync(join(outDir, 'uk'), { recursive: true });
      writeFileSync(join(outDir, 'uk', 'index.html'), page);
    },
  };
};

// The API is served from the same origin under /api: in development Vite proxies it to the backend,
// in production the reverse proxy does. The refresh token cookie therefore needs no CORS.
export default defineConfig({
  plugins: [react(), publicPages()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: process.env.API_URL ?? 'http://localhost:8080' },
    },
  },
});
