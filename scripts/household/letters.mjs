// node letters.mjs in.svg out.svg — swaps <text> lines for stroked hand-drawn capitals, because the
// server's SVG rasterizer has no fonts (text would render as boxes). Covers A–Z, 0–9, - . ' and space.
import { readFileSync, writeFileSync } from 'node:fs';

const G = {
  A: 'M0 10L3 0L6 10M1 6.5H5', B: 'M0 0V10H4C7 10 7 5 4 5H0M0 0H4C6.5 0 6.5 5 4 5', C: 'M6 1.5C4 -1 0 0 0 5C0 10 4 11 6 8.5',
  D: 'M0 0V10H3C7 10 7 0 3 0Z', E: 'M6 0H0V10H6M0 5H5', F: 'M6 0H0V10M0 5H5', G: 'M6 1.5C4 -1 0 0 0 5C0 10 6 11 6 6H3.5',
  H: 'M0 0V10M6 0V10M0 5H6', I: 'M3 0V10', J: 'M5 0V7C5 11 0 11 0 7', K: 'M0 0V10M6 0L0 6M2 4.5L6 10', L: 'M0 0V10H6',
  M: 'M0 10V0L3 6L6 0V10', N: 'M0 10V0L6 10V0', O: 'M3 0C-1 0-1 10 3 10C7 10 7 0 3 0Z', P: 'M0 10V0H4C7 0 7 5 4 5H0',
  Q: 'M3 0C-1 0-1 10 3 10C7 10 7 0 3 0ZM4 7L6.5 10.5', R: 'M0 10V0H4C7 0 7 5 4 5H0M3 5L6 10', S: 'M6 1.5C4.5-.5 0 0 0 2.5C0 5.5 6 4.5 6 7.5C6 10.5 1.5 10.5 0 8.5',
  T: 'M0 0H6M3 0V10', U: 'M0 0V7C0 11 6 11 6 7V0', V: 'M0 0L3 10L6 0', W: 'M0 0L1.5 10L3 4L4.5 10L6 0', X: 'M0 0L6 10M6 0L0 10',
  Y: 'M0 0L3 5L6 0M3 5V10', Z: 'M0 0H6L0 10H6', 0: 'M3 0C-1 0-1 10 3 10C7 10 7 0 3 0Z', 1: 'M1.5 2L3.5 0V10', 2: 'M0 2C1-.5 6-.5 6 2.5C6 5 0 7 0 10H6',
  3: 'M0 1C2-.5 6 0 5.5 2.5C5 4.5 2 5 2 5C5 5 6.5 7 5.5 8.5C4.5 10.5 1 10.5 0 9', 4: 'M4.5 10V0L0 7H6', 5: 'M6 0H1L.5 4.5C3-.5 7 4 5.5 7.5C4.5 10.5 1 10.5 0 9',
  6: 'M5.5 1C3-.5 0 1 0 6C0 11 6 10.5 6 7C6 4 1.5 3.5 0 6', 7: 'M0 0H6L2 10', 8: 'M3 5C-.5 5-.5 0 3 0C6.5 0 6.5 5 3 5C-1 5-1 10 3 10C7 10 7 5 3 5Z',
  9: 'M6 4C4.5 6.5 0 6 0 3C0-.5 6-.5 6 4C6 9 3 10.5.5 9', '-': 'M1 5H5', '.': 'M3 9.6V10', "'": 'M3 0V2.5', ' ': '',
};
const line = (s, cx, y, size) => {
  const k = size / 10, adv = 8.6;
  const x0 = cx - ((s.length * adv - 2.6) * k) / 2;
  return [...s.toUpperCase()].map((c, i) => G[c] ? `<path transform="translate(${(x0 + i * adv * k).toFixed(2)} ${(y - size).toFixed(2)}) scale(${k})" d="${G[c]}"/>` : '').join('');
};
const [inp, out] = process.argv.slice(2);
let svg = readFileSync(inp, 'utf8');
svg = svg.replace(/<text x="([-\d.]+)" y="([-\d.]+)"[^>]*font-size="([\d.]+)"[^>]*>([^<]*)<\/text>/g,
  (_, x, y, fs, t) => `<g fill="none" stroke="#1e1e1e" stroke-width="${(1.7 / (fs / 10)).toFixed(2)}" stroke-linecap="round" stroke-linejoin="round">${line(t, +x, +y, +fs * 0.8)}</g>`);
writeFileSync(out, svg);
console.log('texts left:', (svg.match(/<text/g) ?? []).length);
