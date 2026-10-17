import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router';
import { Button, Skeleton } from '@/components/ui';
import { AddIcon, PeopleIcon } from '@/components/ui/icons';
import { watchingApi, watchingKeys } from '../api';
import { ListFormSheet } from '../components/ListFormSheet';
import { ErrorCard, WatchingScreen } from '../components/parts';
import { Poster } from '../components/Poster';
import { useWatchingT } from '../i18n';
import type { WatchList } from '../types';

/** Lists: mine and those the family shares, each as a small fan of posters. */
export default function ListsPage() {
  const t = useWatchingT();
  const lists = useQuery({ queryKey: watchingKeys.lists, queryFn: watchingApi.lists });
  const [creating, setCreating] = useState(false);

  return (
    <WatchingScreen
      stored
      title={t.lists.title}
      subtitle={t.lists.subtitle}
      error={lists.error}
      actions={
        <Button size="sm" icon={AddIcon} onClick={() => setCreating(true)}>
          {t.lists.create}
        </Button>
      }
    >
      {lists.isPending ? (
        <div aria-hidden="true" className="grid gap-3 md:grid-cols-2">
          <Skeleton className="h-28 rounded-[1.5rem]" />
          <Skeleton className="h-28 rounded-[1.5rem]" />
        </div>
      ) : lists.error ? (
        <ErrorCard error={lists.error} onRetry={() => void lists.refetch()} />
      ) : lists.data?.lists.length ? (
        <ul className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {lists.data.lists.map((list) => (
            <li key={list.id}>
              <ListCard list={list} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-[1.25rem] bg-white px-4 py-3.5 text-sm text-ink-600 shadow-[var(--shadow-xs)]">
          {t.lists.empty}
        </p>
      )}
      <ListFormSheet open={creating} onClose={() => setCreating(false)} />
    </WatchingScreen>
  );
}

function ListCard({ list }: { list: WatchList }) {
  const t = useWatchingT();
  const posters = list.posters.slice(0, 3);
  return (
    <Link
      to={`/watching/lists/${list.id}`}
      viewTransition
      className="press flex items-center gap-4 rounded-[1.5rem] bg-white p-3.5 shadow-[var(--shadow-card)] hover:bg-pink-100"
    >
      <span className="relative h-[5.25rem] w-[5.5rem] shrink-0" aria-hidden="true">
        {posters.length ? (
          posters.map((path, i) => (
            <span
              key={i}
              className="absolute top-0 w-[3.5rem]"
              style={{ left: `${i * 1}rem`, zIndex: 3 - i, transform: `rotate(${(i - 1) * 4}deg)` }}
            >
              <Poster path={path} sizes="3.5rem" className="rounded-[0.5rem] ring-2 ring-white" />
            </span>
          ))
        ) : (
          <span className="block h-full w-[3.5rem] rounded-[0.5rem] bg-ink-100" />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[1.0625rem] font-bold">{list.name}</span>
        <span className="block text-sm text-ink-600">{t.common.titles(list.count)}</span>
        {list.shared ? (
          <span className="mt-1.5 inline-flex items-center gap-1 rounded-pill bg-pink-100 px-2 py-0.5 text-xs font-bold text-pink-800">
            <PeopleIcon fontSize="inherit" />
            {list.mine ? t.lists.familyBadge : t.lists.sharedBy(list.owner.name)}
          </span>
        ) : null}
      </span>
    </Link>
  );
}
