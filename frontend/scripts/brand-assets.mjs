#!/usr/bin/env node
/**
 * Brand asset pipeline — one source logo, every size the app needs.
 *
 *   brand/logo.svg  (source of truth: the red tile with the white sparkle)
 *     → src/assets/logo.svg             the logo the app draws                (committed)
 *     → public/favicon.svg, favicon.ico  browser tab                          (generated)
 *     → public/icons/*.png              PWA, Android and iOS Home Screen icons (generated)
 *     → public/splash/*.png             iOS launch screens (apple-touch-startup-image)
 *
 * Runs before `dev` and `build` (vite.config.ts) and skips the work when nothing changed, so
 * every deploy ships icons and launch screens that match the current logo.
 * Usage: node scripts/brand-assets.mjs [--force]
 */
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = resolve(root, 'brand/logo.svg');
const OUT_APP = resolve(root, 'src/assets');
const OUT_PUBLIC = resolve(root, 'public');
const STAMP = resolve(OUT_PUBLIC, 'icons/.stamp');

/** The lavender field (--color-lav-300): splash, manifest background and theme color. */
export const BRAND_FIELD = '#BABBF4';

/** Corner radius of the logo tile wherever the app (not the OS) rounds it, as a share of its size. */
export const TILE_RADIUS = 0.26;

/**
 * The splash tile: 26% of the screen's width, at most 112 px, centred. index.html sizes the
 * in-page splash with the same numbers, so the iOS launch image hands over without a jump.
 */
export const SPLASH_TILE = { width: 0.26, maxWidth: 112 };

/** Portrait launch screens for current iPhones and iPads (CSS px × device pixel ratio). */
export const SPLASH_SCREENS = [
  { w: 440, h: 956, dpr: 3 }, // iPhone 16/17 Pro Max
  { w: 402, h: 874, dpr: 3 }, // iPhone 16/17 Pro, iPhone 17
  { w: 420, h: 912, dpr: 3 }, // iPhone Air
  { w: 430, h: 932, dpr: 3 }, // iPhone 14/15 Pro Max, 15/16 Plus
  { w: 393, h: 852, dpr: 3 }, // iPhone 14 Pro, 15, 15 Pro, 16
  { w: 390, h: 844, dpr: 3 }, // iPhone 12/13/14, 12/13 Pro
  { w: 428, h: 926, dpr: 3 }, // iPhone 12/13 Pro Max, 14 Plus
  { w: 375, h: 812, dpr: 3 }, // iPhone X/XS/11 Pro, 12/13 mini
  { w: 414, h: 896, dpr: 3 }, // iPhone XS Max, 11 Pro Max
  { w: 414, h: 896, dpr: 2 }, // iPhone XR, 11
  { w: 414, h: 736, dpr: 3 }, // iPhone 8 Plus
  { w: 375, h: 667, dpr: 2 }, // iPhone SE (2nd/3rd gen), 8
  { w: 744, h: 1133, dpr: 2 }, // iPad mini
  { w: 820, h: 1180, dpr: 2 }, // iPad Air, iPad (10th gen)
  { w: 834, h: 1194, dpr: 2 }, // iPad Pro 11"
  { w: 1024, h: 1366, dpr: 2 }, // iPad Pro 12.9"
];

export const splashFileName = (s) => `splash/apple-splash-${s.w * s.dpr}x${s.h * s.dpr}.png`;

/** iOS picks the launch image by device size and pixel ratio. Portrait only (the app is portrait). */
export function splashLinkTags() {
  return SPLASH_SCREENS.map(
    (s) =>
      `<link rel="apple-touch-startup-image" href="/${splashFileName(s)}" media="screen and (device-width: ${s.w}px) and (device-height: ${s.h}px) and (-webkit-device-pixel-ratio: ${s.dpr}) and (orientation: portrait)">`,
  ).join('\n    ');
}

export const splashTileSize = (screenWidth) => Math.min(screenWidth * SPLASH_TILE.width, SPLASH_TILE.maxWidth);

// ── SVG helpers ───────────────────────────────────────────────────────────────

/** The logo's inner markup and viewBox, ids made unique so several copies can share a page. */
function readLogo(svg) {
  const viewBox = /viewBox="([^"]+)"/.exec(svg)?.[1];
  const inner = /<svg[^>]*>([\s\S]*)<\/svg>/.exec(svg)?.[1];
  if (!viewBox || !inner) throw new Error('brand/logo.svg: expected an <svg> with a viewBox');
  return { viewBox, inner: inner.trim() };
}

/**
 * The logo as a tile of `size` px at (x, y), its corners rounded by `radius` (0 = square, the
 * OS rounds it), on an optional full-canvas background.
 */
function canvas({ width, height, background, tile }) {
  const { logo, x, y, size, radius, id } = tile;
  const r = size * radius;
  const inner = logo.inner.replaceAll('paint0_linear_312_577', `${id}-gloss`);
  const clip = radius > 0 ? `<clipPath id="${id}-clip"><rect x="${x}" y="${y}" width="${size}" height="${size}" rx="${r}" ry="${r}"/></clipPath>` : '';
  const bg = background ? `<rect width="${width}" height="${height}" fill="${background}"/>` : '';
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
    `<defs>${clip}</defs>${bg}` +
    `<g${radius > 0 ? ` clip-path="url(#${id}-clip)"` : ''}>` +
    `<svg x="${x}" y="${y}" width="${size}" height="${size}" viewBox="${logo.viewBox}">${inner}</svg>` +
    `</g></svg>`
  );
}

/** Minimal ICO writer with an embedded PNG (supported by every current browser). */
function pngToIco(png, size) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(1, 4);
  const entry = Buffer.alloc(16);
  entry.writeUInt8(size >= 256 ? 0 : size, 0);
  entry.writeUInt8(size >= 256 ? 0 : size, 1);
  entry.writeUInt16LE(1, 4);
  entry.writeUInt16LE(32, 6);
  entry.writeUInt32LE(png.length, 8);
  entry.writeUInt32LE(22, 12);
  return Buffer.concat([header, entry, png]);
}

// ── Pipeline ─────────────────────────────────────────────────────────────────

export async function generateBrandAssets({ force = false, log = console.info } = {}) {
  const [source, script] = await Promise.all([readFile(SOURCE, 'utf8'), readFile(fileURLToPath(import.meta.url), 'utf8')]);
  const hash = createHash('sha256').update(source).update(script).digest('hex').slice(0, 16);
  if (!force) {
    const previous = await readFile(STAMP, 'utf8').catch(() => '');
    if (previous.trim() === hash) return { skipped: true };
  }

  const { default: sharp } = await import('sharp');
  const logo = readLogo(source);
  await mkdir(OUT_APP, { recursive: true });
  await mkdir(resolve(OUT_PUBLIC, 'icons'), { recursive: true });
  await mkdir(resolve(OUT_PUBLIC, 'splash'), { recursive: true });

  await writeFile(resolve(OUT_APP, 'logo.svg'), source.trim() + '\n');
  const png = (svg) => sharp(Buffer.from(svg)).png({ compressionLevel: 9, effort: 10 });
  const tile = (size, radius, x = 0, y = 0) => ({ logo, x, y, size, radius, id: `t${size}` });

  // Browser tab: the tile with soft corners.
  await writeFile(resolve(OUT_PUBLIC, 'favicon.svg'), `${canvas({ width: 64, height: 64, tile: tile(64, 0.22) })}\n`);
  const favicon48 = await png(canvas({ width: 48, height: 48, tile: tile(48, 0.22) })).toBuffer();
  await writeFile(resolve(OUT_PUBLIC, 'favicon.ico'), pngToIco(favicon48, 48));

  const icons = [
    // "any": shown as-is by browsers and desktops, so the corners are rounded here.
    { file: 'icons/pwa-64x64.png', size: 64, radius: 0.22 },
    { file: 'icons/pwa-192x192.png', size: 192, radius: 0.22 },
    { file: 'icons/pwa-512x512.png', size: 512, radius: 0.22 },
    // Maskable and iOS: full bleed; the OS cuts its own shape (the sparkle sits well inside the safe zone).
    { file: 'icons/maskable-icon-512x512.png', size: 512, radius: 0 },
    { file: 'icons/apple-touch-icon-180x180.png', size: 180, radius: 0 },
  ];
  for (const icon of icons) {
    await png(canvas({ width: icon.size, height: icon.size, tile: tile(icon.size, icon.radius) })).toFile(resolve(OUT_PUBLIC, icon.file));
  }

  // iOS launch screens are the in-page splash, pixel for pixel: the field and the centred tile.
  await Promise.all(
    SPLASH_SCREENS.map((s) => {
      const width = s.w * s.dpr;
      const height = s.h * s.dpr;
      const size = Math.round(splashTileSize(s.w) * s.dpr);
      return png(
        canvas({ width, height, background: BRAND_FIELD, tile: { ...tile(size, TILE_RADIUS, (width - size) / 2, (height - size) / 2), id: 'splash' } }),
      ).toFile(resolve(OUT_PUBLIC, splashFileName(s)));
    }),
  );

  await writeFile(STAMP, `${hash}\n`);
  log(`[brand] generated the favicon, ${icons.length} icons and ${SPLASH_SCREENS.length} launch screens`);
  return { skipped: false };
}

const invokedDirectly = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  generateBrandAssets({ force: process.argv.includes('--force') }).then(
    (result) => result.skipped && console.info('[brand] assets up to date'),
    (error) => {
      console.error('[brand] failed:', error);
      process.exit(1);
    },
  );
}
