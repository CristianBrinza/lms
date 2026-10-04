import { describe, expect, it } from 'vitest';
import { APP_URL, setupTestApp } from './helpers';

const t = setupTestApp();

async function person(email: string, role: 'member' | 'admin' = 'member', name = 'Ana') {
  const user = await t.createUser({ email, role, name });
  const b = t.browser();
  await b.login(email);
  return { user, b };
}

/** A client with only a key: no cookies, no Origin (like Claude Code or a connector). */
function keyed(token: string) {
  async function request(method: string, path: string, body?: unknown) {
    const res = await t.app.request(path, {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    return { status: res.status, headers: res.headers, body: text ? JSON.parse(text) : null };
  }
  return {
    get: (path: string) => request('GET', path),
    post: (path: string, body?: unknown) => request('POST', path, body),
  };
}

async function newKey(
  b: Awaited<ReturnType<typeof person>>['b'],
  scope: 'food:read' | 'food' | 'admin',
  name = 'Claude',
) {
  const res = await b.post('/api/me/tokens', { name, scope });
  return res;
}

let rpcId = 0;
const rpc = (method: string, params?: unknown) => ({
  jsonrpc: '2.0',
  id: ++rpcId,
  method,
  ...(params ? { params } : {}),
});

describe('AI access keys', () => {
  it('are shown once and act as their owner in Food', async () => {
    const { b } = await person('ana@example.com');
    const res = await newKey(b, 'food');
    expect(res.status).toBe(201);
    expect(res.body.token).toMatch(/^lms_[\w-]{40,}$/);
    expect(res.body.key).toMatchObject({ name: 'Claude', scope: 'food', lastUsedAt: null });
    expect(res.body.key.prefix).toBe(res.body.token.slice(0, 10));
    const listed = await b.get('/api/me/tokens');
    expect(listed.body.keys).toHaveLength(1);
    expect(JSON.stringify(listed.body)).not.toContain(res.body.token);

    const ai = keyed(res.body.token);
    const added = await ai.post('/api/food/stock', { name: 'Tomatoes', quantity: 3 });
    expect(added.status).toBe(201);
    const detail = await b.get(`/api/food/products/${added.body.product.id}`);
    expect(detail.body.events[0]).toMatchObject({ kind: 'added', via: 'ai', actor: 'Ana' });
    expect((await b.get('/api/me/tokens')).body.keys[0].lastUsedAt).toBeTruthy();
  });

  it('never reach sign-in, password, devices or keys', async () => {
    const { b } = await person('ana@example.com');
    const ai = keyed((await newKey(b, 'food')).body.token);
    expect((await ai.get('/api/me')).status).toBe(200);
    expect((await ai.post('/api/me/password', { newPassword: 'another-password-1' })).status).toBe(
      403,
    );
    expect((await ai.get('/api/me/sessions')).status).toBe(403);
    expect((await ai.get('/api/me/tokens')).status).toBe(403);
    expect((await ai.post('/api/me/tokens', { name: 'x', scope: 'food' })).status).toBe(403);
    expect((await ai.post('/api/auth/logout')).status).toBe(403);
    expect((await ai.get('/api/admin/users')).status).toBe(403);
  });

  it('a read-only key can look but not change', async () => {
    const { b } = await person('ana@example.com');
    const ai = keyed((await newKey(b, 'food:read')).body.token);
    expect((await ai.get('/api/food/kitchen')).status).toBe(200);
    const res = await ai.post('/api/food/stock', { name: 'Tomatoes', quantity: 1 });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('KEY_SCOPE');
  });

  it('admin keys are for admins, and reach the admin console', async () => {
    const member = await person('ana@example.com');
    expect((await newKey(member.b, 'admin')).status).toBe(403);
    const admin = await person('boss@example.com', 'admin', 'Cristian');
    const ai = keyed((await newKey(admin.b, 'admin')).body.token);
    expect((await ai.get('/api/admin/users')).body.users).toHaveLength(2);
  });

  it('stop working when revoked or when the owner is switched off', async () => {
    const { b, user } = await person('ana@example.com');
    const one = await newKey(b, 'food', 'one');
    const two = await newKey(b, 'food', 'two');
    expect((await b.delete(`/api/me/tokens/${one.body.key.id}`)).status).toBe(204);
    expect((await keyed(one.body.token).get('/api/food/kitchen')).status).toBe(401);
    expect((await keyed(two.body.token).get('/api/food/kitchen')).status).toBe(200);
    await t.db.query('UPDATE users SET is_active = false WHERE id = $1', [user.id]);
    expect((await keyed(two.body.token).get('/api/food/kitchen')).status).toBe(401);
    expect(
      (await keyed('lms_not-a-real-key-not-a-real-key-000000').get('/api/food/kitchen')).status,
    ).toBe(401);
  });
});

describe('MCP endpoint', () => {
  it('introduces itself and lists the tools the key may use', async () => {
    const { b } = await person('ana@example.com');
    const write = keyed((await newKey(b, 'food')).body.token);
    const init = await write.post(
      '/api/mcp',
      rpc('initialize', {
        protocolVersion: '2025-06-18',
        capabilities: {},
        clientInfo: { name: 'test', version: '1' },
      }),
    );
    expect(init.status).toBe(200);
    expect(init.body.result).toMatchObject({
      protocolVersion: '2025-06-18',
      serverInfo: { name: 'lms-kitchen' },
      capabilities: { tools: {}, prompts: {} },
    });
    expect(init.body.result.instructions).toMatch(/Start with kitchen_overview/);
    expect(
      (await write.post('/api/mcp', { jsonrpc: '2.0', method: 'notifications/initialized' }))
        .status,
    ).toBe(202);

    const tools = (await write.post('/api/mcp', rpc('tools/list'))).body.result.tools;
    const names = tools.map((tool: any) => tool.name);
    expect(names).toEqual(
      expect.arrayContaining([
        'kitchen_overview',
        'add_stock',
        'save_recipe',
        'plan_meal',
        'plan_needs',
        'add_to_shopping_list',
      ]),
    );
    expect(names).not.toContain('list_people');
    for (const tool of tools) {
      expect(tool.inputSchema.type).toBe('object');
      expect(JSON.stringify(tool.inputSchema)).not.toContain('$schema');
    }
    expect(
      tools.find((tool: any) => tool.name === 'add_stock').inputSchema.properties.items.items
        .properties.name,
    ).toBeTruthy();
    expect(
      tools.find((tool: any) => tool.name === 'update_meal').inputSchema.properties,
    ).toHaveProperty('mealId');

    const read = keyed((await newKey(b, 'food:read')).body.token);
    const readNames = (await read.post('/api/mcp', rpc('tools/list'))).body.result.tools.map(
      (tool: any) => tool.name,
    );
    expect(readNames).toContain('list_stock');
    expect(readNames).not.toContain('add_stock');
  });

  it('runs the kitchen through tools, as the AI', async () => {
    const { b } = await person('ana@example.com');
    const ai = keyed((await newKey(b, 'food')).body.token);
    const call = async (name: string, args: unknown) => {
      const res = await ai.post('/api/mcp', rpc('tools/call', { name, arguments: args }));
      expect(res.status).toBe(200);
      return res.body.result;
    };

    const added = await call('add_stock', {
      items: [
        { name: 'Beef steak', quantity: 1.3, unit: 'kg' },
        { name: 'Beef steak', quantity: 300, unit: 'g' },
        { name: 'roșii', quantity: 4 },
      ],
    });
    expect(added.isError).toBeUndefined();
    expect(JSON.parse(added.content[0].text).map((x: any) => x.item)).toEqual([
      'Beef steak',
      'Beef steak',
      'Tomatoes',
    ]);

    const stock = JSON.parse((await call('list_stock', {})).content[0].text);
    expect(stock.find((x: any) => x.name === 'Beef steak')).toMatchObject({
      total: 1600,
      unit: 'g',
    });
    expect(stock.find((x: any) => x.name === 'Beef steak').lots).toHaveLength(2);

    const saved = JSON.parse(
      (
        await call('save_recipe', {
          title: 'Steak and tomatoes',
          servings: 2,
          ingredients: [
            { name: 'Beef steak', amount: 400, unit: 'g' },
            { name: 'Tomatoes', amount: 2 },
          ],
          steps: ['Sear the steak.', 'Slice the tomatoes.'],
        })
      ).content[0].text,
    );
    expect(saved).toMatchObject({ title: 'Steak and tomatoes', ready: true, have: '2/2' });

    const planned = JSON.parse(
      (await call('plan_meal', { date: '2026-10-05', time: '19:00', recipeId: saved.id }))
        .content[0].text,
    );
    expect(planned).toMatchObject({ title: 'Steak and tomatoes', status: 'planned' });
    const done = JSON.parse((await call('complete_meal', { mealId: planned.id })).content[0].text);
    expect(done.meal.status).toBe('done');

    const after = JSON.parse((await call('list_stock', { query: 'steak' })).content[0].text);
    expect(after[0].total).toBe(1200);

    const recipes = await b.get('/api/food/recipes');
    expect(recipes.body.recipes[0].createdVia).toBe('ai');
  });

  it('trains through tools: equipment, a made-up workout, planned, a set logged; a read key only looks', async () => {
    const { b } = await person('ana@example.com');
    const ai = keyed((await newKey(b, 'food')).body.token);
    const call = async (name: string, args: unknown) => {
      const res = await ai.post('/api/mcp', rpc('tools/call', { name, arguments: args }));
      expect(res.status).toBe(200);
      return res.body.result;
    };
    const json = async (name: string, args: unknown) =>
      JSON.parse((await call(name, args)).content[0].text);

    await json('add_equipment', { kind: 'kettlebell', weights: [12] });
    const swings = (await json('list_exercises', { query: 'swing' }))[0];
    expect(swings).toMatchObject({
      name: 'Kettlebell swings',
      available: true,
      weights: [{ kg: 12, pair: false }],
    });
    const made = await json('suggest_workout', { minutes: 15, focus: 'lower', quiet: true });
    const planned = await json('plan_workout', {
      date: '2026-10-06',
      title: made.title,
      items: made.items,
    });
    expect(planned.status).toBe('planned');
    const logged = await json('log_exercise', {
      workoutId: planned.id,
      exerciseId: planned.items[0].exerciseId,
      reps: 10,
    });
    expect(logged.set.workoutId).toBe(planned.id);
    const quick = await json('log_exercise', { exerciseId: swings.id, reps: 20, weight: 12 });
    expect(quick.set).toMatchObject({ workoutId: null, reps: 20, weight: 12 });
    expect(
      (await b.get('/api/training/workouts?from=2026-10-06&to=2026-10-06')).body.workouts[0].status,
    ).toBe('active');

    const reader = keyed((await newKey(b, 'food:read', 'Reader')).body.token);
    expect((await reader.get('/api/training/overview')).status).toBe(200);
    expect(
      (await reader.post('/api/training/sets', { exerciseId: swings.id, reps: 1 })).status,
    ).toBe(403);
    const refused = await reader.post(
      '/api/mcp',
      rpc('tools/call', { name: 'log_exercise', arguments: { exerciseId: swings.id, reps: 1 } }),
    );
    expect(JSON.stringify(refused.body)).toMatch(/error/i);
  });

  it('answers mistakes as tool errors the model can fix', async () => {
    const { b } = await person('ana@example.com');
    const ai = keyed((await newKey(b, 'food:read')).body.token);
    const bad = await ai.post(
      '/api/mcp',
      rpc('tools/call', { name: 'list_meals', arguments: { from: 'tomorrow' } }),
    );
    expect(bad.body.result.isError).toBe(true);
    expect(bad.body.result.content[0].text).toMatch(/from/);
    const denied = await ai.post(
      '/api/mcp',
      rpc('tools/call', {
        name: 'add_stock',
        arguments: { items: [{ name: 'Eggs', quantity: 1 }] },
      }),
    );
    expect(denied.body.result).toMatchObject({ isError: true });
    const missing = await ai.post(
      '/api/mcp',
      rpc('tools/call', {
        name: 'get_recipe',
        arguments: { recipeId: '00000000-0000-4000-8000-000000000000' },
      }),
    );
    expect(missing.body.result.content[0].text).toBe('Recipe not found');
    expect((await ai.post('/api/mcp', rpc('nope'))).body.error.code).toBe(-32601);
    expect((await ai.post('/api/mcp', { hello: 'world' })).body.error.code).toBe(-32600);
  });

  it('takes the key in the path for URL-only clients, and refuses without one', async () => {
    const { b } = await person('ana@example.com');
    const token = (await newKey(b, 'food')).body.token;
    const viaPath = await t.app.request(`/api/mcp/k/${token}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(rpc('ping')),
    });
    expect(viaPath.status).toBe(200);
    expect(((await viaPath.json()) as { result: unknown }).result).toEqual({});
    const none = await t.app.request('/api/mcp', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(rpc('ping')),
    });
    expect(none.status).toBe(401);
    expect(none.headers.get('www-authenticate')).toMatch(/Bearer/);
    expect(
      (
        await t.app.request('/api/mcp', {
          method: 'GET',
          headers: { authorization: `Bearer ${token}` },
        })
      ).status,
    ).toBe(405);
    const prompts = (await keyed(token).post('/api/mcp', rpc('prompts/list'))).body.result.prompts;
    expect(prompts.map((p: any) => p.name)).toEqual([
      'plan_week',
      'use_it_up',
      'shop_for_month',
      'save_recipe_from',
    ]);
    const prompt = (
      await keyed(token).post(
        '/api/mcp',
        rpc('prompts/get', { name: 'plan_week', arguments: { people: '3' } }),
      )
    ).body.result;
    expect(prompt.messages[0].content.text).toMatch(/for 3 people/);
  });

  it('lets an admin key manage people through the same rules', async () => {
    const admin = await person('boss@example.com', 'admin', 'Cristian');
    const ai = keyed((await newKey(admin.b, 'admin')).body.token);
    const created = await ai.post(
      '/api/mcp',
      rpc('tools/call', {
        name: 'create_person',
        arguments: { email: 'mama@example.com', name: 'Elena' },
      }),
    );
    const body = JSON.parse(created.body.result.content[0].text);
    expect(body.user).toMatchObject({ email: 'mama@example.com', mustChangePassword: true });
    expect(body.password).toMatch(/^[a-z2-9]{4}-/);
    const people = JSON.parse(
      (await ai.post('/api/mcp', rpc('tools/call', { name: 'list_people', arguments: {} }))).body
        .result.content[0].text,
    );
    expect(people.map((p: any) => p.email).sort()).toEqual([
      'boss@example.com',
      'mama@example.com',
    ]);
  });
});

describe('admin: shared kitchens', () => {
  it('seats people in one kitchen, or gives them their own', async () => {
    const admin = await person('boss@example.com', 'admin', 'Cristian');
    const mama = await person('mama@example.com', 'member', 'Elena');
    await admin.b.post('/api/food/stock', { name: 'Milk', quantity: 1, unit: 'l' });
    await mama.b.get('/api/food/kitchen');

    const households = (await admin.b.get('/api/admin/households')).body.households;
    expect(households).toHaveLength(2);
    const adminKitchen = households.find((h: any) => h.members[0].name === 'Cristian');

    const seated = await admin.b.put(`/api/admin/users/${mama.user.id}/kitchen`, {
      householdId: adminKitchen.id,
    });
    expect(seated.body.user.kitchen).toMatchObject({ id: adminKitchen.id, members: 2 });
    expect((await mama.b.get('/api/food/kitchen')).body.products[0].name).toBe('Milk');

    const own = await admin.b.put(`/api/admin/users/${mama.user.id}/kitchen`, {
      householdId: null,
    });
    expect(own.body.user.kitchen).toMatchObject({ name: 'Elena’s kitchen', members: 1 });
    expect((await mama.b.get('/api/food/kitchen')).body.products).toEqual([]);
    expect(
      (await mama.b.put(`/api/admin/users/${admin.user.id}/kitchen`, { householdId: null })).status,
    ).toBe(403);
    void APP_URL;
  });
});
