// node closet.mjs item.json — adds one garment with its photos and label data.
// item.json: { item: {name, category, subcategory, colors, seasons, occasions, condition, notes, ownerId?},
//   place?: "Bedroom > Wardrobe > Stand", storage?: "folded"|"hanging"|"vacuum"|…,
//   photos: [{ path: "C:\\...\\x.jpg" or "/mnt/c/...", kind: "front"|"back"|"label"|"detail" }],
//   care?, materials?, size?, sizeSystem?, brand?, madeIn? (country code, e.g. CN), storageAdvice?, labelText? }
// Category/subcategory ids are in backend/src/modules/closet (CATEGORIES), e.g. tops/tshirt, outerwear/vest.
import { readFileSync } from 'node:fs';
import { api } from './api.mjs';

const spec = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const toWsl = (p) => p.replace(/^([A-Za-z]):[\\/]/, (_, d) => `/mnt/${d.toLowerCase()}/`).replace(/\\/g, '/');
const mime = (p) => (/\.png$/i.test(p) ? 'image/png' : /\.webp$/i.test(p) ? 'image/webp' : 'image/jpeg');

// "Bedroom > Wardrobe > Stand" → the place id, walking the tree by name (shelves by "shelf N").
let placeId = null;
if (spec.place) {
  const { places } = await api('GET', '/api/closet/places');
  const label = (p) => (p.name || `${p.kind} ${p.number ?? ''}`).trim().toLowerCase();
  let parent = null;
  for (const part of spec.place.split('>').map((s) => s.trim().toLowerCase())) {
    const hit = places.find((p) => (p.parentId ?? null) === parent && label(p) === part);
    if (!hit) { console.log('place not found:', part, '(item saved without a place)'); parent = null; break; }
    parent = hit.id;
  }
  placeId = parent;
}
const created = await api('POST', '/api/closet/items', {
  ...spec.item, ...(placeId ? { placeId } : {}), ...(spec.storage ? { storage: spec.storage } : {}),
});
const item = created.item ?? created;
for (const ph of spec.photos ?? []) {
  const file = toWsl(ph.path);
  const image = `data:${mime(file)};base64,${readFileSync(file).toString('base64')}`;
  await api('POST', `/api/closet/items/${item.id}/photos`, { image, kind: ph.kind, needsCutout: ph.kind !== 'label' });
}
const label = Object.fromEntries(
  ['care', 'materials', 'size', 'sizeSystem', 'brand', 'madeIn', 'storageAdvice', 'labelText']
    .filter((k) => spec[k] !== undefined).map((k) => [k, spec[k]]),
);
if (Object.keys(label).length) await api('PATCH', `/api/closet/items/${item.id}`, label);
const after = await api('GET', `/api/closet/items/${item.id}`);
const it = after.item ?? after;
console.log('added', it.id, it.name, it.ownerName, 'photos', (after.photos ?? []).length, 'place', it.placeId ?? '-');
