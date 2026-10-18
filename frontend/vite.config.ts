/// <reference types="vitest/config" />
import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath, URL } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import { VitePWA, type ManifestOptions } from 'vite-plugin-pwa';
import { BRAND_FIELD, generateBrandAssets, splashLinkTags } from './scripts/brand-assets.mjs';
import { SPLASH_GATE_SCRIPT } from './src/lib/splashGate.ts';

const root = fileURLToPath(new URL('.', import.meta.url));
const src = resolve(root, 'src');

function git(args: string): string {
  try {
    return execSync(`git ${args}`, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return ''; // Not a git checkout.
  }
}

interface BuildInfo {
  version: string;
  commit: string;
  builtAt: string;
}

/** Build id: yyyymmddhhmm-<git sha>, overridable with APP_VERSION (the deploy script sets it). */
function buildInfo(): BuildInfo {
  const commit = git('rev-parse --short HEAD') || 'local';
  const builtAt = new Date().toISOString();
  const version = process.env.APP_VERSION || `${builtAt.replace(/[-:T]/g, '').slice(0, 12)}-${commit}`;
  return { version, commit, builtAt };
}

/** The splash logo, inline (painted before any JS); its gradient id made unique on the page. */
function splashLogo(): string {
  const svg = readFileSync(resolve(root, 'brand/logo.svg'), 'utf8');
  return svg
    .replace('<svg ', '<svg class="splash__logo" aria-hidden="true" ')
    .replaceAll('paint0_linear_312_577', 'splash-gloss')
    .replace(/\s*\n\s*/g, '');
}

/** The CSP allows no inline script except the splash gate, by its hash. */
const SPLASH_GATE_CSP = `'sha256-${createHash('sha256').update(SPLASH_GATE_SCRIPT).digest('base64')}'`;

/**
 * Icons, favicon and iOS launch screens from brand/logo.svg; the inline splash logo; and the
 * splash gate (src/lib/splashGate.ts), with its hash added to `script-src` in the built _headers.
 */
function brandPlugin(): Plugin {
  let headersFile: string | null = null;
  return {
    name: 'lms:brand',
    configResolved(config) {
      if (config.command === 'build') headersFile = resolve(config.root, config.build.outDir, '_headers');
    },
    async buildStart() {
      await generateBrandAssets({ log: (message: string) => this.info(message) });
    },
    transformIndexHtml(html) {
      return html
        .replace('<!--splash-logo-->', splashLogo())
        .replace('<!--apple-splash-links-->', splashLinkTags())
        .replace('<!--splash-gate-->', `<script>${SPLASH_GATE_SCRIPT}</script>`);
    },
    async closeBundle() {
      if (!headersFile) return;
      const headers = await readFile(headersFile, 'utf8');
      const scriptSrc = /script-src 'self'/;
      if (!scriptSrc.test(headers)) throw new Error(`${headersFile}: no "script-src 'self'" to add the splash gate hash to`);
      await writeFile(headersFile, headers.replace(scriptSrc, `script-src 'self' ${SPLASH_GATE_CSP}`));
    },
  };
}

/**
 * The dev server behaves like the real app too (open it on a phone with `yarn dev:lan`): it
 * serves the manifest, so "Add to Home Screen" gives a full-screen app, and a /version.json that
 * changes whenever a source file is saved, so an app resumed from the background offers "Update".
 */
const RETIRE_SERVICE_WORKER = `self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) await caches.delete(key);
    await self.registration.unregister();
    for (const client of await self.clients.matchAll({ type: 'window' })) client.navigate(client.url);
  })());
});
`;

function devAppPlugin(): Plugin {
  let version = `dev-${Date.now()}`;
  return {
    name: 'lms:dev-app',
    apply: 'serve',
    configureServer(server) {
      server.watcher.on('change', () => {
        version = `dev-${Date.now()}`;
      });
      server.middlewares.use((req, res, next) => {
        const path = req.url?.split('?')[0];
        if (path === '/manifest.webmanifest') {
          res.setHeader('Content-Type', 'application/manifest+json');
          res.setHeader('Cache-Control', 'no-cache');
          res.end(JSON.stringify(MANIFEST));
          return;
        }
        // A service worker left over from a production build on this address would keep serving
        // that build: answer its update check with one that removes itself and reloads the page.
        if (path === '/sw.js') {
          res.setHeader('Content-Type', 'text/javascript');
          res.setHeader('Cache-Control', 'no-store');
          res.end(RETIRE_SERVICE_WORKER);
          return;
        }
        if (path === '/version.json') {
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Cache-Control', 'no-store');
          res.end(JSON.stringify({ service: 'lms-web', version, builtAt: version, dev: true }));
          return;
        }
        next();
      });
    },
    transformIndexHtml(html) {
      return html.replace('</head>', '    <link rel="manifest" href="/manifest.webmanifest" />\n  </head>');
    },
  };
}

/** version.json: which build is live (the update check, /health and the deploy checks read it). */
function versionPlugin(info: BuildInfo): Plugin {
  return {
    name: 'lms:version',
    apply: 'build',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: `${JSON.stringify({ service: 'lms-web', ...info }, null, 2)}\n`,
      });
    },
  };
}

/** The installed app: name, icons, start page (the app decides where to go), standalone window. */
const MANIFEST: Partial<ManifestOptions> = {
  id: '/',
  name: 'LMS — Life Management System',
  short_name: 'LMS',
  description: 'Your private hub for training, food and every other area of life.',
  lang: 'en',
  dir: 'ltr',
  start_url: '/?source=pwa',
  scope: '/',
  display: 'standalone',
  display_override: ['standalone', 'minimal-ui'],
  orientation: 'portrait',
  // Android draws its launch screen from these: the lavender field around the icon.
  background_color: BRAND_FIELD,
  theme_color: BRAND_FIELD,
  categories: ['lifestyle', 'health', 'productivity'],
  icons: [
    { src: '/icons/pwa-64x64.png', sizes: '64x64', type: 'image/png' },
    { src: '/icons/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
    { src: '/icons/pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    { src: '/icons/maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
};

/**
 * onnxruntime-web's own WebAssembly (about 24 MB): the closet's cut-out gives the runtime the copy
 * it fetches from IMG.LY's CDN with its model, so the one Vite would emit is never asked for.
 */
function dropOnnxWasm(): Plugin {
  return {
    name: 'lms:drop-onnx-wasm',
    apply: 'build',
    generateBundle(_, bundle) {
      for (const name of Object.keys(bundle))
        if (name.startsWith('assets/ort-wasm') && name.endsWith('.wasm')) delete bundle[name];
    },
  };
}

/** Admin screens: their chunks go to assets/admin/, which the installed app never precaches. */
const ADMIN_MODULE = /[\\/]src[\\/]pages[\\/]admin[\\/]/;

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const build = buildInfo();
  const apiTarget = env.VITE_API_PROXY || 'http://127.0.0.1:8790';

  return {
    define: {
      __APP_VERSION__: JSON.stringify(build.version),
      __APP_COMMIT__: JSON.stringify(build.commit),
      __APP_BUILT_AT__: JSON.stringify(build.builtAt),
    },
    resolve: {
      alias: {
        '@': src,
        // MUI icons without the MUI/emotion runtime: icons only need createSvgIcon, which our
        // small shim provides (src/components/ui/icons/SvgIcon.tsx).
        '@mui/material/SvgIcon': `${src}/components/ui/icons/SvgIcon.tsx`,
      },
    },
    server: {
      port: 5190,
      strictPort: true,
      proxy: { '/api': { target: apiTarget, changeOrigin: false }, '/.well-known/oauth': { target: apiTarget, changeOrigin: false } },
    },
    preview: {
      port: 4190,
      proxy: { '/api': { target: apiTarget, changeOrigin: false }, '/.well-known/oauth': { target: apiTarget, changeOrigin: false } },
    },
    build: {
      sourcemap: 'hidden',
      reportCompressedSize: false,
      // The entry holds React, the router and TanStack Query (about 130 kB gzipped); pages load on demand.
      chunkSizeWarningLimit: 450,
      rolldownOptions: {
        output: {
          chunkFileNames: (chunk) =>
            chunk.moduleIds.some((id) => ADMIN_MODULE.test(id)) ? 'assets/admin/[name]-[hash].js' : 'assets/[name]-[hash].js',
        },
      },
    },
    plugins: [
      react(),
      tailwindcss(),
      brandPlugin(),
      versionPlugin(build),
      dropOnnxWasm(),
      devAppPlugin(),
      VitePWA({
        registerType: 'prompt',
        injectRegister: false,
        strategies: 'generateSW',
        manifestFilename: 'manifest.webmanifest',
        includeAssets: ['favicon.svg', 'favicon.ico', 'robots.txt', 'icons/apple-touch-icon-180x180.png'],
        manifest: MANIFEST,
        workbox: {
          // A new version takes over at once, also in apps installed before (public/update-sw.js);
          // reminders arrive as notifications (public/push-sw.js).
          importScripts: ['update-sw.js', 'push-sw.js'],
          globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2,webmanifest}'],
          // Admin code, launch screens and the version probe stay out of the install.
          globIgnores: ['**/assets/admin/**', '**/splash/**', 'version.json', '**/figtree-{vietnamese,cyrillic,cyrillic-ext}-*.woff2'],
          navigateFallback: '/index.html',
          navigateFallbackDenylist: [/^\/api\//, /^\/version\.json$/, /^\/health$/],
          cleanupOutdatedCaches: true,
          // update-sw.js claims open windows itself, after telling the older ones apart.
          clientsClaim: false,
          maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
          runtimeCaching: [
            {
              // The closet's cut-out model and runtime (IMG.LY's CDN, fetched on the cut-out screen
              // only): tens of megabytes, kept once on the device rather than fetched again.
              urlPattern: ({ url }) => url.origin === 'https://staticimgly.com',
              handler: 'CacheFirst',
              options: {
                cacheName: 'lms-closet-cutout',
                expiration: { maxEntries: 60, maxAgeSeconds: 180 * 86_400, purgeOnQuotaError: true },
                cacheableResponse: { statuses: [200] },
              },
            },
            {
              urlPattern: ({ url }) => url.pathname.startsWith('/assets/admin/'),
              handler: 'CacheFirst',
              options: { cacheName: 'lms-admin', expiration: { maxEntries: 40, maxAgeSeconds: 30 * 86_400 } },
            },
            {
              // Watching's posters, stills and faces, straight from TMDB's CDN (never stored on the
              // server): kept on the device with a hard cap, dropped first when storage runs short.
              urlPattern: ({ url }) => url.origin === 'https://image.tmdb.org',
              handler: 'CacheFirst',
              options: {
                cacheName: 'lms-tmdb-images',
                expiration: { maxEntries: 300, maxAgeSeconds: 30 * 86_400, purgeOnQuotaError: true },
                // The <img>s ask with crossorigin="anonymous" (TMDB answers CORS), so responses are
                // real 200s, not opaque ones that count megabytes each against the quota.
                cacheableResponse: { statuses: [200] },
              },
            },
          ],
        },
        devOptions: { enabled: false },
      }),
    ],
    test: {
      environment: 'jsdom',
      include: ['src/**/*.test.{ts,tsx}'],
      setupFiles: ['./src/test/setup.ts'],
      css: false,
      // Let Vite resolve the MUI icon modules so the SvgIcon alias applies in tests too.
      server: { deps: { inline: [/@mui\/icons-material/] } },
    },
  };
});
