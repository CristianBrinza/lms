import { describe, expect, it } from 'vitest';
import { iconKeyFor, parseSvg, validateShapes } from '../src/modules/food/icons';
import { setupTestApp } from './helpers';

const t = setupTestApp();

const OPEN =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none" stroke="var(--color-ink-900, #1d1d24)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">';

/** A slice of toast, in the house style. */
const TOAST = `${OPEN}
  <!-- the crust, then the crumb -->
  <path d="M12 38V20c-2.5-.8-3.6-2.8-3.6-5 0-4 5-7 15.6-7s15.6 3 15.6 7c0 2.2-1.1 4.2-3.6 5v18c0 1.1-.9 2-2 2H14c-1.1 0-2-.9-2-2z" fill="#b87a4b"/>
  <path d="M15 36.5V18.5c-2-.5-3.2-1.8-3.2-3.5 0-2.6 4.6-4.5 12.2-4.5s12.2 1.9 12.2 4.5c0 1.7-1.2 3-3.2 3.5v18z" fill="#f4d9a8" stroke="none"/>
  <g transform="translate(24 27) rotate(-8)"><circle cx="-4" cy="0" r="1" fill="#e2b06f" stroke-width="1.3"/><ellipse cx="4" cy="3" rx="1.2" ry=".8" fill="#e2b06f" stroke="none"/></g>
</svg>`;

const reason = (svg: string) => {
  try {
    parseSvg(svg);
    return null;
  } catch (error) {
    return (error as Error).message;
  }
};

describe('icon drawings are data', () => {
  it('turn a house-style SVG into checked shapes', () => {
    const shapes = parseSvg(TOAST);
    expect(shapes.map((s) => s.tag)).toEqual(['path', 'path', 'g']);
    expect(shapes[1]!.attrs).toMatchObject({ fill: '#f4d9a8', stroke: 'none' });
    expect(shapes[2]).toMatchObject({
      tag: 'g',
      attrs: { transform: 'translate(24 27) rotate(-8)' },
      children: [
        { tag: 'circle', attrs: { cx: -4, cy: 0, r: 1, 'stroke-width': 1.3 } },
        { tag: 'ellipse', attrs: { rx: 1.2, ry: 0.8 } },
      ],
    });
    // Bare shapes (no <svg>) work too, and the JSON form is checked the same way.
    expect(parseSvg('<circle cx="24" cy="24" r="10" fill="#F0705F"/>')).toEqual([
      { tag: 'circle', attrs: { cx: 24, cy: 24, r: 10, fill: '#f0705f' } },
    ]);
    expect(validateShapes(shapes)).toEqual(shapes);
  });

  it('keep a root that differs from the house defaults as a group', () => {
    const shapes = parseSvg(
      '<svg viewBox="0 0 48 48" fill="#ffffff" stroke-width="2"><rect x="10" y="10" width="28" height="28" rx="4"/></svg>',
    );
    expect(shapes).toEqual([
      {
        tag: 'g',
        attrs: { fill: '#ffffff', 'stroke-width': 2 },
        children: [{ tag: 'rect', attrs: { x: 10, y: 10, width: 28, height: 28, rx: 4 } }],
      },
    ]);
  });

  it('refuse scripts, links, styles, url(), events, entities and unknown tags', () => {
    const inside = (body: string) => `${OPEN}${body}</svg>`;
    expect(reason(inside('<script>alert(1)</script>'))).toMatch(/<script> is not allowed/);
    expect(reason(inside('<a href="https://x.test"><path d="M1 1h4"/></a>'))).toMatch(
      /<a> is not allowed/,
    );
    expect(reason(inside('<use href="#a"/>'))).toMatch(/<use> is not allowed/);
    expect(reason(inside('<image href="x.png" width="4" height="4"/>'))).toMatch(/not allowed/);
    expect(reason(inside('<foreignObject width="9" height="9"></foreignObject>'))).toMatch(
      /<foreignObject> is not allowed/,
    );
    expect(reason(inside('<style>path{fill:red}</style>'))).toMatch(/<style> is not allowed/);
    expect(reason(inside('<path d="M1 1h4" style="fill:red"/>'))).toMatch(
      /style is not allowed on <path>/,
    );
    expect(reason(inside('<path d="M1 1h4" fill="url(#g)"/>'))).toMatch(/colours are hex/);
    expect(reason(inside('<path d="M1 1h4" fill="red"/>'))).toMatch(/colours are hex/);
    expect(reason(inside('<path d="M1 1h4" onload="alert(1)"/>'))).toMatch(/onload is not allowed/);
    expect(reason(inside('<path d="M1 1h4" xlink:href="#x"/>'))).toMatch(/not allowed/);
    expect(reason(inside('<linearGradient id="g"/>'))).toMatch(/not allowed/);
    expect(reason(inside('<text x="4" y="4">Hi</text>'))).toMatch(/not allowed/);
    expect(reason(inside('<path d="M1 1h4" transform="translate(1 1) skewX(9)"/>'))).toMatch(
      /transform must be/,
    );
    expect(reason(inside('<path d="javascript:alert(1)"/>'))).toMatch(/d must be path data/);
    expect(reason(inside('hello'))).toMatch(/no text/);
    expect(
      reason('<!DOCTYPE svg [<!ENTITY x "y">]><svg viewBox="0 0 48 48"><path d="M1 1"/></svg>'),
    ).toMatch(/no doctype, entities/);
    expect(reason(inside('<path d="M1 1h4" fill="&#x23;fff"/>'))).toMatch(/entities/);
    expect(reason(inside('<path d=M1/>'))).toMatch(/could not be read/);
    expect(reason(inside('<path d="M1 1"><circle r="2"/></path>'))).toMatch(/can’t hold/);
    expect(reason(`${OPEN}<path d="M1 1h4"/>`)).toMatch(/<svg> is not closed/);
  });

  it('hold to the 48×48 grid and the size limits', () => {
    expect(reason('<svg viewBox="0 0 24 24"><path d="M1 1h4"/></svg>')).toMatch(/48×48/);
    expect(reason(`${OPEN}</svg>`)).toMatch(/no shapes/);
    const many = Array.from({ length: 61 }, (_, i) => `<circle cx="${i % 40}" cy="9" r="1"/>`);
    expect(reason(`${OPEN}${many.join('')}</svg>`)).toMatch(/at most 60 shapes/);
    expect(reason(`${OPEN}<path d="M1 1${' l1 1'.repeat(4500)}"/></svg>`)).toMatch(/20 KB/);
    expect(() => validateShapes([{ tag: 'path', attrs: { d: 'M1 1', href: '#x' } }])).toThrow(
      /href is not allowed/,
    );
    expect(() => validateShapes([{ tag: 'circle', attrs: { r: 2 }, children: [] }])).toThrow(
      /only a <g> has children/,
    );
  });

  it('make keys from names in any of the three languages', () => {
    expect(iconKeyFor('Toast bread')).toBe('custom:toast-bread');
    expect(iconKeyFor('Pâine de toast')).toBe('custom:paine-de-toast');
    expect(iconKeyFor('Тостовый хлеб')).toBe('custom:tostovyi-hleb');
    expect(iconKeyFor('!!!')).toBeNull();
  });
});

async function cook() {
  await t.createUser({ email: 'ana@example.com', name: 'Ana' });
  const b = t.browser();
  await b.login('ana@example.com');
  return b;
}

describe('the kitchen’s own icons', () => {
  it('are added, listed, used by items and removed', async () => {
    const b = await cook();
    const created = await b.post('/api/food/icons', {
      name: 'Toast bread',
      translations: { ro: { name: 'Pâine de toast' }, ru: { name: 'Тостовый хлеб' } },
      svg: TOAST,
    });
    expect(created.status).toBe(201);
    expect(created.body.icon).toMatchObject({
      key: 'custom:toast-bread',
      name: 'Toast bread',
      translations: { ro: { name: 'Pâine de toast' } },
    });
    expect(created.body.icon.shapes).toHaveLength(3);

    // The same name again gets its own key; the key itself redraws.
    const second = await b.post('/api/food/icons', {
      name: 'Toast bread',
      shapes: [{ tag: 'circle', attrs: { cx: 24, cy: 24, r: 12, fill: '#f6d47a' } }],
    });
    expect(second.body.icon.key).toBe('custom:toast-bread-2');
    const redrawn = await b.post('/api/food/icons', {
      key: 'custom:toast-bread-2',
      name: 'Round toast',
      shapes: [{ tag: 'circle', attrs: { cx: 24, cy: 24, r: 14, fill: '#f6d47a' } }],
    });
    expect(redrawn.status).toBe(200);
    expect(redrawn.body.icon).toMatchObject({ name: 'Round toast' });
    expect(redrawn.body.icon.shapes[0].attrs.r).toBe(14);

    const listed = await b.get('/api/food/icons');
    expect(listed.body.icons.map((i: any) => i.key)).toEqual([
      'custom:toast-bread-2',
      'custom:toast-bread',
    ]);

    // An item, a recipe and a piece of kitchenware can use it.
    const stocked = await b.post('/api/food/stock', {
      name: 'Toast bread',
      quantity: 12,
      unit: 'pcs',
    });
    expect(stocked.status).toBe(201);
    const id = stocked.body.product.id;
    const patched = await b.patch(`/api/food/products/${id}`, { icon: 'custom:toast-bread' });
    expect(patched.status).toBe(200);
    expect(patched.body.product.icon).toBe('custom:toast-bread');
    const made = await b.post('/api/food/products', {
      name: 'Grandma toast',
      icon: 'custom:toast-bread',
    });
    expect(made.status).toBe(201);
    expect(made.body.product.icon).toBe('custom:toast-bread');
    const kitchen = await b.get('/api/food/kitchen');
    expect(kitchen.body.products.find((p: any) => p.id === id).icon).toBe('custom:toast-bread');
    const recipe = await b.post('/api/food/recipes', {
      title: 'Toast',
      icon: 'custom:toast-bread',
    });
    expect(recipe.body.recipe.icon).toBe('custom:toast-bread');
    const tool = await b.post('/api/food/kitchenware', {
      name: 'Toaster',
      icon: 'custom:toast-bread-2',
    });
    expect(tool.body.tool.icon).toBe('custom:toast-bread-2');

    // Unknown custom keys and malformed keys are refused.
    const unknown = await b.patch(`/api/food/products/${id}`, { icon: 'custom:nothing-here' });
    expect(unknown.status).toBe(400);
    expect(unknown.body.error.fields.icon).toMatch(/no such icon/);
    expect((await b.patch(`/api/food/products/${id}`, { icon: 'custom:Bad Key' })).status).toBe(
      400,
    );
    expect((await b.patch(`/api/food/products/${id}`, { icon: 'not-an-icon' })).status).toBe(400);

    // Removing it puts the plain pictures back.
    expect((await b.delete('/api/food/icons/custom:toast-bread')).status).toBe(204);
    expect((await b.delete('/api/food/icons/custom:toast-bread')).status).toBe(404);
    expect((await b.get(`/api/food/products/${id}`)).body.product.icon).toBe('basket');
    expect((await b.get(`/api/food/recipes/${recipe.body.recipe.id}`)).body.recipe.icon).toBe(
      'pot',
    );
  });

  it('refuse a drawing that isn’t only shapes, in the person’s language', async () => {
    const b = await cook();
    const res = await b.post(
      '/api/food/icons',
      { name: 'Evil', svg: `${OPEN}<script>alert(1)</script></svg>` },
      { 'accept-language': 'ro' },
    );
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/^Desenul nu poate fi folosit: <script>/);
    expect(res.body.error.fields.svg).toMatch(/<script> is not allowed/);
    expect((await b.post('/api/food/icons', { name: 'Nothing' })).status).toBe(400);
    expect((await b.get('/api/food/icons')).body.icons).toEqual([]);
  });

  it('belong to one kitchen', async () => {
    const b = await cook();
    await b.post('/api/food/icons', { name: 'Toast bread', svg: TOAST });
    await t.createUser({ email: 'ion@example.com', name: 'Ion' });
    const other = t.browser();
    await other.login('ion@example.com');
    expect((await other.get('/api/food/icons')).body.icons).toEqual([]);
    const res = await other.post('/api/food/products', {
      name: 'Toast',
      icon: 'custom:toast-bread',
    });
    expect(res.status).toBe(400);
  });
});

describe('icons over MCP', () => {
  it('lets Claude draw an icon and use it at once', async () => {
    const b = await cook();
    const token = (await b.post('/api/me/tokens', { name: 'Claude', scope: 'food' })).body.token;
    let id = 0;
    const mcp = async (method: string, params?: unknown) => {
      const res = await t.app.request('/api/mcp', {
        method: 'POST',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: ++id, method, ...(params ? { params } : {}) }),
      });
      return ((await res.json()) as any).result;
    };
    const call = async (name: string, args: unknown) => {
      const result = await mcp('tools/call', { name, arguments: args });
      const text: string = result.content[0].text;
      return result.isError
        ? { error: true, body: text }
        : { error: false, body: JSON.parse(text) };
    };

    const tools = (await mcp('tools/list')).tools;
    const create = tools.find((tool: any) => tool.name === 'create_icon');
    expect(create.description).toContain('viewBox="0 0 48 48"');
    expect(create.description).toContain('#2f2f38');
    expect(create.inputSchema.properties).toHaveProperty('svg');
    expect((await mcp('initialize', {})).instructions).toContain('create_icon');

    const before = await call('list_icons', {});
    expect(before.body.builtIn.items).toContain('bread-toast');
    expect(before.body.builtIn.kitchenware).toContain('pot');
    expect(before.body.custom).toEqual([]);

    const drawn = await call('create_icon', {
      name: 'Toast bread',
      translations: { ro: { name: 'Pâine de toast' }, ru: { name: 'Тостовый хлеб' } },
      svg: TOAST,
    });
    expect(drawn).toEqual({
      error: false,
      body: { key: 'custom:toast-bread', name: 'Toast bread', shapes: 3 },
    });
    const saved = await call('save_item', { name: 'Toast bread', icon: 'custom:toast-bread' });
    expect(saved.error).toBe(false);
    expect(saved.body.icon).toBe('custom:toast-bread');
    expect((await call('list_icons', {})).body.custom).toEqual([
      {
        key: 'custom:toast-bread',
        name: 'Toast bread',
        translations: { ro: { name: 'Pâine de toast' }, ru: { name: 'Тостовый хлеб' } },
      },
    ]);

    const refused = await call('create_icon', { name: 'Bad', svg: '<svg><script/></svg>' });
    expect(refused).toMatchObject({
      error: true,
      body: expect.stringMatching(/<script> is not allowed/),
    });
  });
});
