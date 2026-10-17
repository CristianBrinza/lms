import { Hono, type Context } from 'hono';
import { z } from 'zod';
import type { AppDeps, AppEnv } from '../../context';
import { requestLocale } from '../../lib/i18n';
import { readJson, readQuery } from '../../lib/validation';
import { requireAuth } from '../../middleware/auth';
import { foodCtx, requireKitchen } from '../food/kitchen';
import { kitchenPeople } from '../food/restrictions';
import { idField } from '../food/schemas';
import {
  because,
  config,
  discover,
  genres,
  person,
  providers,
  related,
  search,
  trending,
} from './discover';
import { titleExtras } from './extras';
import { calendar, home, library } from './home';
import { importHistory } from './import';
import {
  addToList,
  createList,
  getList,
  listLists,
  removeFromList,
  removeList,
  reorderList,
  updateList,
} from './lists';
import { peopleOf, type Watch } from './people';
import {
  addPlays,
  clearStatus,
  getSettings,
  removeAvailability,
  removeGroup,
  removePlay,
  updatePlay,
  saveSettings,
  seasonView,
  setAvailability,
  setEpisodeMark,
  setStatus,
  titleView,
} from './plays';
import {
  AvailabilityInput,
  DiscoverQuery,
  EpisodeMarkInput,
  ImportInput,
  LibraryQuery,
  ListInput,
  ListItemInput,
  ListOrder,
  ListPatch,
  PeopleQuery,
  PlayInput,
  PlayPatch,
  RangeQuery,
  SearchQuery,
  SettingsInput,
  StatusInput,
} from './schemas';
import { watchStats, yearInReview } from './stats';
import { parseTitleId } from './titles';

const kindParam = z.enum(['movie', 'tv']).optional();
const number = (value: string, max: number) => {
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 && n <= max ? n : NaN;
};

/**
 * /api/watching — films and series, TMDB's details with each person's plays, library, lists and
 * statistics. Each person's own; the family can look at each other's (userId, people, scope) and
 * mark things watched together (userIds).
 */
export function watchingRoutes(deps: AppDeps) {
  const app = new Hono<AppEnv>();
  app.use('*', requireAuth(deps), requireKitchen(deps));
  const watch = (c: Context<AppEnv>): Watch => ({
    deps,
    ctx: foodCtx(deps, c.get('actor')),
    locale: requestLocale(c),
  });
  const titleParam = (c: Context<AppEnv>) => {
    const id = c.req.param('id') ?? '';
    parseTitleId(id);
    return id;
  };
  const seasonParam = (c: Context<AppEnv>, name: string) => {
    const n = number(c.req.param(name) ?? '', 5000);
    if (Number.isNaN(n)) parseTitleId('');
    return n;
  };

  app.get('/config', (c) => c.json(config(watch(c))));

  // Finding things
  app.get('/search', async (c) => {
    const q = readQuery(c, SearchQuery);
    return c.json(await search(watch(c), q.q, q.kind, q.page));
  });
  app.get('/trending', async (c) => {
    const q = readQuery(
      c,
      z.object({
        kind: z.enum(['movie', 'tv', 'all']).optional(),
        window: z.enum(['day', 'week']).optional(),
      }),
    );
    return c.json(await trending(watch(c), q.kind, q.window));
  });
  app.get('/discover', async (c) => c.json(await discover(watch(c), readQuery(c, DiscoverQuery))));
  app.get('/genres', async (c) =>
    c.json(await genres(watch(c), readQuery(c, z.object({ kind: kindParam })).kind)),
  );
  app.get('/providers', async (c) => {
    const q = readQuery(c, z.object({ kind: kindParam, region: z.enum(['MD', 'RO']).optional() }));
    return c.json(await providers(watch(c), q.kind, q.region));
  });
  app.get('/because', async (c) =>
    c.json(await because(watch(c), readQuery(c, z.object({ kind: kindParam })).kind)),
  );
  app.get('/people/:id', async (c) => c.json(await person(watch(c), Number(c.req.param('id')))));

  // Mine (or ours)
  app.get('/household', async (c) => c.json({ people: await kitchenPeople(watch(c).ctx) }));
  app.get('/home', async (c) => {
    const q = readQuery(c, PeopleQuery.extend({ kind: kindParam }));
    const w = watch(c);
    return c.json(await home(w, await peopleOf(w, q), q.kind));
  });
  app.get('/library', async (c) => {
    const q = readQuery(c, LibraryQuery);
    const w = watch(c);
    return c.json(await library(w, await peopleOf(w, q), q));
  });
  app.get('/calendar', async (c) => {
    const q = readQuery(c, RangeQuery);
    const w = watch(c);
    return c.json(await calendar(w, await peopleOf(w, q), q.from, q.to));
  });
  app.get('/stats', async (c) => {
    const q = readQuery(c, RangeQuery);
    const w = watch(c);
    return c.json(await watchStats(w, await peopleOf(w, q), q.from, q.to));
  });
  app.get('/stats/year', async (c) => {
    const q = readQuery(
      c,
      PeopleQuery.extend({ year: z.coerce.number().int().min(1900).max(2200).optional() }),
    );
    const w = watch(c);
    return c.json(await yearInReview(w, await peopleOf(w, q), q.year ?? w.ctx.now.getFullYear()));
  });
  app.get('/settings', async (c) => c.json(await getSettings(watch(c))));
  app.put('/settings', async (c) =>
    c.json(await saveSettings(watch(c), await readJson(c, SettingsInput))),
  );

  // A title
  app.get('/titles/:id', async (c) => {
    const q = readQuery(
      c,
      z.object({ userId: idField.optional(), refresh: z.enum(['1', 'true']).optional() }),
    );
    const w = watch(c);
    const [userId] = q.userId ? await peopleOf(w, { userId: q.userId }) : [undefined];
    return c.json(await titleView(w, titleParam(c), { userId, refresh: Boolean(q.refresh) }));
  });
  app.get('/titles/:id/extras', async (c) => {
    const q = readQuery(c, z.object({ userId: idField.optional() }));
    const w = watch(c);
    const [userId] = q.userId ? await peopleOf(w, { userId: q.userId }) : [undefined];
    return c.json(await titleExtras(w, titleParam(c), userId));
  });
  app.get('/titles/:id/similar', async (c) =>
    c.json(await related(watch(c), titleParam(c), 'similar')),
  );
  app.get('/titles/:id/recommendations', async (c) =>
    c.json(await related(watch(c), titleParam(c), 'recommendations')),
  );
  app.get('/titles/:id/seasons/:n', async (c) => {
    const q = readQuery(c, z.object({ userId: idField.optional() }));
    const w = watch(c);
    const [userId] = q.userId ? await peopleOf(w, { userId: q.userId }) : [undefined];
    return c.json(await seasonView(w, titleParam(c), seasonParam(c, 'n'), userId));
  });
  app.put('/titles/:id/status', async (c) =>
    c.json(await setStatus(watch(c), titleParam(c), await readJson(c, StatusInput))),
  );
  app.delete('/titles/:id/status', async (c) => {
    const q = readQuery(c, PeopleQuery);
    await clearStatus(watch(c), titleParam(c), q.people.length ? q.people : undefined);
    return c.body(null, 204);
  });
  app.put('/titles/:id/episodes/:season/:episode', async (c) =>
    c.json(
      await setEpisodeMark(
        watch(c),
        titleParam(c),
        seasonParam(c, 'season'),
        seasonParam(c, 'episode'),
        await readJson(c, EpisodeMarkInput),
      ),
    ),
  );

  // Plays
  app.post('/plays', async (c) =>
    c.json(await addPlays(watch(c), await readJson(c, PlayInput)), 201),
  );
  app.delete('/plays/groups/:groupId', async (c) =>
    c.json(await removeGroup(watch(c), c.req.param('groupId'))),
  );
  app.patch('/plays/:id', async (c) =>
    c.json(await updatePlay(watch(c), c.req.param('id'), await readJson(c, PlayPatch))),
  );
  app.delete('/plays/:id', async (c) =>
    c.json(await removePlay(watch(c), c.req.param('id'), c.req.query('together') === 'true')),
  );

  // Where it really plays in Moldova
  app.post('/availability', async (c) =>
    c.json(await setAvailability(watch(c), await readJson(c, AvailabilityInput))),
  );
  app.delete('/availability/:id', async (c) => {
    await removeAvailability(watch(c), c.req.param('id'));
    return c.body(null, 204);
  });

  // Lists
  app.get('/lists', async (c) => c.json(await listLists(watch(c))));
  app.post('/lists', async (c) =>
    c.json(await createList(watch(c), await readJson(c, ListInput)), 201),
  );
  app.get('/lists/:id', async (c) => c.json(await getList(watch(c), c.req.param('id'))));
  app.patch('/lists/:id', async (c) =>
    c.json(await updateList(watch(c), c.req.param('id'), await readJson(c, ListPatch))),
  );
  app.delete('/lists/:id', async (c) => {
    await removeList(watch(c), c.req.param('id'));
    return c.body(null, 204);
  });
  app.post('/lists/:id/items', async (c) =>
    c.json(await addToList(watch(c), c.req.param('id'), await readJson(c, ListItemInput)), 201),
  );
  app.delete('/lists/:id/items/:titleId', async (c) => {
    await removeFromList(watch(c), c.req.param('id'), c.req.param('titleId'));
    return c.body(null, 204);
  });
  app.put('/lists/:id/order', async (c) =>
    c.json(await reorderList(watch(c), c.req.param('id'), (await readJson(c, ListOrder)).titleIds)),
  );

  // Bringing a history over
  app.post('/import', async (c) =>
    c.json(await importHistory(watch(c), await readJson(c, ImportInput))),
  );

  return app;
}
