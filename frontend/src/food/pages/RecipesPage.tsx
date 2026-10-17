import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { PageHeader } from '@/components/layout/PageHeader';
import { Screen } from '@/components/layout/Screen';
import { Button, ButtonLink, Chips, IconLink, Skeleton, TextField } from '@/components/ui';
import {
  AccessTimeIcon,
  AddIcon,
  FavoriteIcon,
  FireIcon,
  PeopleIcon,
  SearchIcon,
  SparkleIcon,
} from '@/components/ui/icons';
import { getLocale, intlLocale, tr } from '@/i18n';
import { cx } from '@/lib/cx';
import { errorMessage } from '@/lib/errors';
import { foodApi, foodKeys } from '../api';
import { normalize } from '../catalog';
import { FoodIcon, SceneArt } from '../icons/FoodIcon';
import type { Recipe } from '../types';
import { formatKcal } from '../nutrition';
import { useRecipesT } from '../recipes.i18n';

type Filter = 'all' | 'ready' | 'soon' | 'favorites';

const TILE = [
  'bg-butter-100',
  'bg-cyan-100',
  'bg-pink-100',
  'bg-mint-100',
  'bg-lav-100',
  'bg-peach-100',
];

/**
 * The kitchen's recipes: what can be cooked now, what uses up food about to expire or already
 * opened (?uses=<item>, from Food home), favourites, drinks and snacks by tag.
 */
export default function RecipesPage() {
  const t = useRecipesT();
  const recipes = useQuery({ queryKey: foodKeys.recipes, queryFn: foodApi.recipes });
  const [params, setParams] = useSearchParams();
  const uses = params.get('uses');
  const [filter, setFilter] = useState<Filter>('all');
  const [tag, setTag] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const all = useMemo(() => recipes.data ?? [], [recipes.data]);
  const tags = useMemo(() => [...new Set(all.flatMap((r) => r.tags))].sort(), [all]);

  const usesName = uses
    ? all.flatMap((r) => r.ingredients).find((i) => i.productId === uses)?.name
    : null;
  const shown = all
    .filter(
      (r) =>
        !uses ||
        r.ingredients.some(
          (i) => i.productId === uses || i.alternatives.some((alt) => alt.productId === uses),
        ),
    )
    .filter((r) => filter !== 'ready' || r.availability.ready)
    .filter((r) => filter !== 'soon' || r.availability.useSoon > 0)
    .filter((r) => filter !== 'favorites' || r.favorite)
    .filter((r) => !tag || r.tags.includes(tag))
    .filter(
      (r) =>
        !query.trim() ||
        normalize(r.title).includes(normalize(query)) ||
        normalize(tr(r, 'title')).includes(normalize(query)) ||
        r.ingredients.some((i) => normalize(i.name).includes(normalize(query))),
    )
    .sort((a, b) =>
      filter === 'soon'
        ? b.availability.useSoon - a.availability.useSoon
        : Number(b.favorite) - Number(a.favorite) ||
          Number(b.availability.ready) - Number(a.availability.ready) ||
          tr(a, 'title').localeCompare(tr(b, 'title'), intlLocale(getLocale())),
    );
  const ready = all.filter((r) => r.availability.ready).length;

  return (
    <Screen tone="white">
      <PageHeader
        compact
        back="/food"
        title={t.title}
        subtitle={recipes.data ? t.count(all.length, ready) : ' '}
        actions={
          <IconLink
            to="/food/recipes/new"
            icon={AddIcon}
            label={t.newRecipe}
            variant="ink"
            size="sm"
          />
        }
      />

      {all.length ? (
        <div className="gutter-x mt-2.5 flex flex-col gap-2 md:px-5 lg:px-8">
          <TextField
            label={t.search}
            hideLabel
            dense
            icon={SearchIcon}
            surface="raised"
            placeholder={t.searchPlaceholder}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <Chips
            label={t.show}
            tone="sheet"
            dense
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'all', label: t.filter.all, count: all.length },
              { value: 'ready', label: t.filter.ready, count: ready },
              {
                value: 'soon',
                label: t.filter.soon,
                icon: FireIcon,
                count: all.filter((r) => r.availability.useSoon > 0).length,
              },
              {
                value: 'favorites',
                label: t.filter.favorites,
                icon: FavoriteIcon,
                count: all.filter((r) => r.favorite).length,
              },
            ]}
          />
          {uses ? (
            <button
              type="button"
              onClick={() => setParams({}, { replace: true })}
              className="press inline-flex h-9 w-fit items-center gap-1.5 rounded-pill bg-peach-100 px-3.5 text-sm font-semibold text-peach-800"
            >
              {t.withItem(usesName?.toLowerCase() ?? null)}
            </button>
          ) : null}
          {tags.length ? (
            <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 [scrollbar-width:none]">
              {tags.map((name) => (
                <button
                  key={name}
                  type="button"
                  aria-pressed={tag === name}
                  onClick={() => setTag(tag === name ? null : name)}
                  className={cx(
                    'press h-9 shrink-0 rounded-pill px-3.5 text-sm font-semibold',
                    tag === name
                      ? 'bg-ink-900 text-white'
                      : 'bg-white text-ink-700 shadow-xs hover:bg-ink-50',
                  )}
                >
                  #{name}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="gutter-x mt-3 md:px-5 lg:px-8">
        {recipes.isPending ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <Skeleton className="h-52 rounded-3xl" />
            <Skeleton className="h-52 rounded-3xl" />
          </div>
        ) : recipes.error ? (
          <div className="rounded-3xl bg-white p-5 shadow-[var(--shadow-card)]">
            <p className="font-semibold text-danger-700">{t.loadFailed}</p>
            <p className="mt-1 text-sm text-ink-600">{errorMessage(recipes.error)}</p>
            <Button
              size="sm"
              variant="tint"
              className="mt-3"
              onClick={() => void recipes.refetch()}
            >
              {t.tryAgain}
            </Button>
          </div>
        ) : !all.length ? (
          <Empty />
        ) : !shown.length ? (
          <p className="rounded-3xl bg-white p-6 text-center text-[0.9375rem] text-ink-600 shadow-[var(--shadow-card)]">
            {t.noMatch}
          </p>
        ) : (
          <ul className="grid grid-cols-2 gap-2.5 md:grid-cols-3 lg:gap-4 xl:grid-cols-4">
            {shown.map((recipe, index) => (
              <li key={recipe.id}>
                <RecipeCard recipe={recipe} tone={TILE[index % TILE.length]!} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </Screen>
  );
}

function RecipeCard({ recipe, tone }: { recipe: Recipe; tone: string }) {
  const t = useRecipesT();
  const minutes = (recipe.prepMinutes ?? 0) + (recipe.cookMinutes ?? 0);
  const { availability } = recipe;
  return (
    <Link
      to={`/food/recipes/${recipe.id}`}
      viewTransition
      className="group/recipe press flex h-full flex-col overflow-hidden rounded-[1.5rem] bg-white shadow-[var(--shadow-card)] ring-1 ring-inset ring-ink-100/70 transition-[translate,box-shadow] duration-300 ease-(--ease-lift) hover:-translate-y-0.5 hover:shadow-[var(--shadow-raised)]"
    >
      <span className={cx('relative grid h-20 place-items-center sm:h-24', tone)}>
        <FoodIcon
          name={recipe.icon}
          className="size-12 transition-transform duration-500 ease-(--ease-lift) group-hover/recipe:-rotate-6 group-hover/recipe:scale-110 sm:size-14"
        />
        {recipe.favorite ? (
          <span className="absolute right-2.5 top-2.5 grid size-8 place-items-center rounded-full bg-white text-base text-pink-800 shadow-xs">
            <FavoriteIcon fontSize="inherit" />
          </span>
        ) : null}
        {recipe.createdVia === 'ai' ? (
          <span
            className="absolute left-2.5 top-2.5 grid size-8 place-items-center rounded-full bg-white text-base text-lav-700 shadow-xs"
            title={t.addedByClaude}
          >
            <SparkleIcon fontSize="inherit" />
          </span>
        ) : null}
      </span>
      <span className="flex flex-1 flex-col p-2.5">
        <span className="line-clamp-2 text-[0.9375rem] font-bold leading-snug">
          {tr(recipe, 'title')}
        </span>
        <span className="mt-1 flex items-center gap-2.5 text-xs font-medium text-ink-600">
          {minutes ? (
            <span className="inline-flex items-center gap-1">
              <AccessTimeIcon fontSize="inherit" className="text-sm" />
              {t.minutes(minutes)}
            </span>
          ) : null}
          <span className="inline-flex items-center gap-1">
            <PeopleIcon fontSize="inherit" className="text-sm" />
            {recipe.servings}
          </span>
          {recipe.nutrition.known ? (
            <span className="tabular">
              {t.kcalAbout(formatKcal(recipe.nutrition.perServing.kcal))}
            </span>
          ) : null}
        </span>
        <span className="mt-auto flex flex-wrap gap-1 pt-2">
          {availability.total === 0 ? null : availability.ready ? (
            <span className="inline-flex h-6 items-center rounded-pill bg-mint-100 px-2 text-xs font-semibold text-mint-800">
              {t.readyToCook}
            </span>
          ) : (
            <span className="inline-flex h-6 items-center rounded-pill bg-peach-100 px-2 text-xs font-semibold text-peach-800">
              {t.missing(availability.missing.length)}
            </span>
          )}
          {availability.useSoon ? (
            <span
              className="inline-flex h-6 items-center gap-0.5 rounded-pill bg-butter-100 px-2 text-xs font-semibold text-butter-800"
              title={t.usesSoon}
            >
              <FireIcon fontSize="inherit" className="text-sm" />
              {availability.useSoon}
            </span>
          ) : null}
        </span>
      </span>
    </Link>
  );
}

function Empty() {
  const t = useRecipesT();
  return (
    <div className="flex flex-col items-center rounded-[2rem] bg-white px-6 py-10 text-center shadow-[var(--shadow-card)]">
      <SceneArt scene="recipes" className="size-24" />
      <h2 className="mt-4 text-h2 font-bold">{t.emptyTitle}</h2>
      <p className="mt-2 max-w-sm text-[0.9375rem] text-ink-600">{t.emptyText}</p>
      <div className="mt-6 flex flex-wrap justify-center gap-2.5">
        <ButtonLink to="/food/recipes/new" icon={AddIcon}>
          {t.addRecipe}
        </ButtonLink>
        <ButtonLink to="/settings/ai" variant="tint" icon={SparkleIcon}>
          {t.letClaude}
        </ButtonLink>
      </div>
    </div>
  );
}
