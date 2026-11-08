// node use.mjs "<exact item name>" <quantity> <unit>  → marks that much as eaten/drunk (used up).
// Find the exact name first: GET /api/food/products?q=<part of it>.
import { api } from './api.mjs';

const [name, qty, unit] = process.argv.slice(2);
const { products } = await api('GET', `/api/food/products?q=${encodeURIComponent(name)}`);
const p = products.find((x) => x.name === name);
if (!p) throw new Error(`No product named exactly "${name}": ${products.map((x) => x.name).join(', ')}`);
await api('POST', '/api/food/stock/use', { productId: p.id, quantity: Number(qty), unit });
const d = await api('GET', `/api/food/products/${p.id}`);
console.log(name, 'left:', (d.product.lots ?? []).map((l) => `${l.quantity} ${p.unit} ${l.location}`).join(', ') || 'none');
