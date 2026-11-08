// Closet photos.
//   node photo.mjs add <itemId> <path.jpg> [kind=back]          add one photo (front|back|label|detail)
//   node photo.mjs get <photoId> <out-file>                     save a photo (to check it with Read)
//   node photo.mjs vector <itemId> <replacesPhotoId> <file.svg>  upload a Claude drawing (front)
// Paths may be Windows (C:\...) or WSL (/mnt/c/...). SVG text must be strokes: the server has no fonts
// (run letters.mjs first). To redo a drawing, DELETE /api/closet/photos/<id> (restores the original).
import { readFileSync, writeFileSync } from 'node:fs';
import { api, raw } from './api.mjs';

const toWsl = (p) => p.replace(/^([A-Za-z]):[\\/]/, (_, d) => `/mnt/${d.toLowerCase()}/`).replace(/\\/g, '/');
const [cmd, a, b, c] = process.argv.slice(2);
if (cmd === 'add') {
  const file = toWsl(b);
  const type = /\.png$/i.test(file) ? 'image/png' : 'image/jpeg';
  const kind = c ?? 'back';
  await api('POST', `/api/closet/items/${a}/photos`, {
    image: `data:${type};base64,${readFileSync(file).toString('base64')}`, kind, needsCutout: kind !== 'label',
  });
  const r = await api('GET', `/api/closet/items/${a}`);
  console.log((r.photos ?? []).map((p) => p.kind).join(', '));
} else if (cmd === 'get') {
  const res = await raw(`/api/closet/photos/${a}/full`);
  writeFileSync(toWsl(b), Buffer.from(await res.arrayBuffer()));
  console.log(res.status, res.headers.get('content-type'));
} else if (cmd === 'vector') {
  const image = `data:image/svg+xml;base64,${readFileSync(toWsl(c)).toString('base64')}`;
  const r = await api('POST', `/api/closet/items/${a}/photos`, { image, kind: 'front', vector: true, replaces: b });
  const p = r.photo ?? r;
  console.log('uploaded', p.id);
} else {
  console.log('usage: node photo.mjs add|get|vector …');
  process.exit(1);
}
