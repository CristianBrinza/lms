import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { PageHeader } from '@/components/layout/PageHeader';
import { Screen } from '@/components/layout/Screen';
import { Button, ButtonLink, Chips, IconLink, Skeleton, TextField } from '@/components/ui';
import { AccessTimeIcon, AddIcon, FavoriteIcon, FireIcon, PeopleIcon, SearchIcon, SparkleIcon } from '@/components/ui/icons';
import { cx } from '@/lib/cx';
import { errorMessage } from '@/lib/errors';
import { foodApi, foodKeys } from '../api';
import { normalize } from '../catalog';
import { FoodIcon, SceneArt } from '../icons/FoodIcon';
import type { Recipe } from '../types';

type Filter = 'all' | 'ready' | 'soon' | 'favorites';

const TILE = ['bg-butter-100', 'bg-cyan-100', 'bg-pink-100', 'bg-mint-100', 'bg-lav-100', 'bg-peach-100'];

/** The kitchen's recipes: what can be cooked now, what uses up food about to expire, favourites. */
export default function RecipesPage() {
  const recipes = useQuery({ queryKey: foodKeys.recipes, queryFn: foodApi.recipes });
  const [filter, setFilter] = useState<Filter>('all');
  const [tag, setTag] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const all = useMemo(() => recipes.data ?? [], [recipes.data]);
  const tags = useMemo(() => [...new Set(all.flatMap((r) => r.tags))].sort(), [all]);

  const shown = all
    .filter((r) => filter !== 'ready' || r.availability.ready)
    .filter((r) => filter !== 'soon' || r.availability.useSoon > 0)
    .filter((r) => filter !== 'favorites' || r.favorite)
    .filter((r) => !tag || r.tags.includes(tag))
    .filter((r) => !query.trim() || normalize(r.title).includes(normalize(query)) || r.ingredients.some((i) => normalize(i.name).includes(normalize(query))))
    .sort((a, b) =>
      filter === 'soon'
        ? b.availability.useSoon - a.availability.useSoon
        : Number(b.favorite) - Number(a.favorite) || Number(b.availability.ready) - Number(a.availability.ready) || a.title.localeCompare(b.title),
    );
  const ready = all.filter((r) => r.availability.ready).length;

  return (
    <Screen tone="white">
      <PageHeader
        back="/food"
        title="Recipes"
        subtitle={recipes.data ? `${all.length} ${all.length === 1 ? 'recipe' : 'recipes'} · ${ready} ready to cook` : ' '}
        actions={<IconLink to="/food/recipes/new" icon={AddIcon} label="New recipe" variant="ink" />}
      />

      {all.length ? (
        <div className="gutter-x mt-5 flex flex-col gap-3 lg:px-8">
          <TextField label="Search recipes" hideLabel icon={SearchIcon} surface="raised" placeholder="A dish or an ingredient" value={query} onChange={(event) => setQuery(event.target.value)} />
          <Chips
            label="Show"
            tone="sheet"
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'all', label: 'All', count: all.length },
              { value: 'ready', label: 'Ready to cook', count: ready },
              { value: 'soon', label: 'Use it up', icon: FireIcon, count: all.filter((r) => r.availability.useSoon > 0).length },
              { value: 'favorites', label: 'Favourites', icon: FavoriteIcon, count: all.filter((r) => r.favorite).length },
            ]}
          />
          {tags.length ? (
            <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 [scrollbar-width:none]">
              {tags.map((t) => (
                <button
                  key={t}
                  type="button"
                  aria-pressed={tag === t}
                  onClick={() => setTag(tag === t ? null : t)}
                  className={cx('press h-9 shrink-0 rounded-pill px-3.5 text-sm font-semibold', tag === t ? 'bg-ink-900 text-white' : 'bg-white text-ink-700 shadow-xs hover:bg-ink-50')}
                >
                  #{t}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="gutter-x mt-5 lg:px-8">
        {recipes.isPending ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <Skeleton className="h-52 rounded-3xl" />
            <Skeleton className="h-52 rounded-3xl" />
          </div>
        ) : recipes.error ? (
          <div className="rounded-3xl bg-white p-5 shadow-[var(--shadow-card)]">
            <p className="font-semibold text-danger-700">Couldn’t load recipes</p>
            <p className="mt-1 text-sm text-ink-600">{errorMessage(recipes.error)}</p>
            <Button size="sm" variant="tint" className="mt-3" onClick={() => void recipes.refetch()}>
              Try again
            </Button>
          </div>
        ) : !all.length ? (
          <Empty />
        ) : !shown.length ? (
          <p className="rounded-3xl bg-white p-6 text-center text-[0.9375rem] text-ink-600 shadow-[var(--shadow-card)]">Nothing matches. Try another filter.</p>
        ) : (
          <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:gap-4 xl:grid-cols-4">
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
  const minutes = (recipe.prepMinutes ?? 0) + (recipe.cookMinutes ?? 0);
  const { availability } = recipe;
  return (
    <Link
      to={`/food/recipes/${recipe.id}`}
      viewTransition
      className="group/recipe press flex h-full flex-col overflow-hidden rounded-[1.5rem] bg-white shadow-[var(--shadow-card)] ring-1 ring-inset ring-ink-100/70 transition-[translate,box-shadow] duration-300 ease-(--ease-lift) hover:-translate-y-0.5 hover:shadow-[var(--shadow-raised)]"
    >
      <span className={cx('relative grid aspect-[4/3] place-items-center', tone)}>
        <FoodIcon name={recipe.icon} className="size-16 transition-transform duration-500 ease-(--ease-lift) group-hover/recipe:-rotate-6 group-hover/recipe:scale-110 sm:size-20" />
        {recipe.favorite ? (
          <span className="absolute right-2.5 top-2.5 grid size-8 place-items-center rounded-full bg-white text-base text-pink-800 shadow-xs">
            <FavoriteIcon fontSize="inherit" />
          </span>
        ) : null}
        {recipe.createdVia === 'ai' ? (
          <span className="absolute left-2.5 top-2.5 grid size-8 place-items-center rounded-full bg-white text-base text-lav-700 shadow-xs" title="Added by Claude">
            <SparkleIcon fontSize="inherit" />
          </span>
        ) : null}
      </span>
      <span className="flex flex-1 flex-col p-3.5">
        <span className="line-clamp-2 text-[0.9375rem] font-bold leading-snug">{recipe.title}</span>
        <span className="mt-1 flex items-center gap-2.5 text-xs font-medium text-ink-600">
          {minutes ? (
            <span className="inline-flex items-center gap-1">
              <AccessTimeIcon fontSize="inherit" className="text-sm" />
              {minutes} min
            </span>
          ) : null}
          <span className="inline-flex items-center gap-1">
            <PeopleIcon fontSize="inherit" className="text-sm" />
            {recipe.servings}
          </span>
        </span>
        <span className="mt-auto flex flex-wrap gap-1.5 pt-2.5">
          {availability.total === 0 ? null : availability.ready ? (
            <span className="inline-flex h-6 items-center rounded-pill bg-mint-100 px-2 text-xs font-semibold text-mint-800">Ready to cook</span>
          ) : (
            <span className="inline-flex h-6 items-center rounded-pill bg-peach-100 px-2 text-xs font-semibold text-peach-800">
              {availability.missing.length} missing
            </span>
          )}
          {availability.useSoon ? (
            <span className="inline-flex h-6 items-center gap-0.5 rounded-pill bg-butter-100 px-2 text-xs font-semibold text-butter-800" title="Uses food that expires soon">
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
  return (
    <div className="flex flex-col items-center rounded-[2rem] bg-white px-6 py-10 text-center shadow-[var(--shadow-card)]">
      <SceneArt scene="recipes" className="size-24" />
      <h2 className="mt-4 text-h2 font-bold">No recipes yet</h2>
      <p className="mt-2 max-w-sm text-[0.9375rem] text-ink-600">Write down the dishes you make. Each ingredient links to your kitchen, so you can see what’s ready to cook.</p>
      <div className="mt-6 flex flex-wrap justify-center gap-2.5">
        <ButtonLink to="/food/recipes/new" icon={AddIcon}>
          Add a recipe
        </ButtonLink>
        <ButtonLink to="/settings/ai" variant="tint" icon={SparkleIcon}>
          Let Claude add some
        </ButtonLink>
      </div>
    </div>
  );
}
