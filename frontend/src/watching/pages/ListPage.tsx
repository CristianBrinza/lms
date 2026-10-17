import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { ConfirmSheet } from '@/components/common/ConfirmSheet';
import { IconButton, Skeleton, toast } from '@/components/ui';
import { CloseIcon, DeleteIcon, EditIcon } from '@/components/ui/icons';
import { errorMessage } from '@/lib/errors';
import { watchingApi, watchingKeys } from '../api';
import { ErrorCard, WatchingScreen } from '../components/parts';
import { PosterCard } from '../components/Poster';
import { useWatchingT } from '../i18n';
import { ListFormSheet } from '../components/ListFormSheet';

/** One list: its posters; mine (or shared with the family) can lose a title with the corner ×. */
export default function ListPage() {
  const { listId = '' } = useParams();
  const t = useWatchingT();
  const client = useQueryClient();
  const navigate = useNavigate();
  const query = useQuery({
    queryKey: watchingKeys.list(listId),
    queryFn: () => watchingApi.list(listId),
  });
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const list = query.data?.list;
  const mine = !!list?.mine;
  const editable = mine || !!list?.shared;

  const removeItem = useMutation({
    mutationFn: (titleId: string) => watchingApi.removeFromList(listId, titleId),
    onSuccess: () => toast(t.lists.removedItem),
    onError: (error) => toast.error(t.common.failed, { description: errorMessage(error) }),
    onSettled: () => client.invalidateQueries({ queryKey: watchingKeys.all }),
  });
  const removeList = useMutation({
    mutationFn: () => watchingApi.removeList(listId),
    onSuccess: () => {
      toast(t.lists.removed);
      navigate('/watching/lists', { replace: true });
    },
    onError: (error) => toast.error(t.common.failed, { description: errorMessage(error) }),
    onSettled: () => client.invalidateQueries({ queryKey: watchingKeys.lists }),
  });

  return (
    <WatchingScreen
      stored
      title={list?.name ?? ' '}
      subtitle={
        list
          ? [
              t.common.titles(list.count),
              list.shared ? (mine ? t.lists.familyBadge : t.lists.sharedBy(list.owner.name)) : null,
            ]
              .filter(Boolean)
              .join(' · ')
          : ' '
      }
      back="/watching/lists"
      error={query.error}
      actions={
        mine ? (
          <>
            <IconButton
              icon={EditIcon}
              label={t.lists.edit}
              variant="outline"
              size="sm"
              onClick={() => setEditing(true)}
            />
            <IconButton
              icon={DeleteIcon}
              label={t.lists.remove}
              variant="outline"
              size="sm"
              onClick={() => setConfirming(true)}
            />
          </>
        ) : null
      }
    >
      {query.isPending ? (
        <div aria-hidden="true" className="grid grid-cols-3 gap-3 sm:grid-cols-4">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="aspect-[2/3] w-full rounded-[0.875rem]" />
          ))}
        </div>
      ) : query.error ? (
        <ErrorCard error={query.error} onRetry={() => void query.refetch()} />
      ) : query.data?.items.length ? (
        <ul className="grid grid-cols-3 gap-x-3 gap-y-4 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8">
          {query.data.items.map(({ title: item }) => (
            <li key={item.id} className="relative">
              <PosterCard
                title={item}
                sizes="(min-width: 80rem) 9rem, (min-width: 44rem) 18vw, 30vw"
              />
              {editable ? (
                <IconButton
                  icon={CloseIcon}
                  label={`${t.common.remove}: ${item.title}`}
                  size="sm"
                  className="absolute right-1 top-1 size-8 text-[1.05rem]"
                  onClick={() => removeItem.mutate(item.id)}
                />
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-[1.25rem] bg-white px-4 py-3.5 text-sm text-ink-600 shadow-[var(--shadow-xs)]">
          {t.lists.emptyList}
        </p>
      )}

      {list && editing ? (
        <ListFormSheet open onClose={() => setEditing(false)} list={list} />
      ) : null}
      {list ? (
        <ConfirmSheet
          open={confirming}
          onClose={() => setConfirming(false)}
          onConfirm={() => removeList.mutate()}
          title={t.lists.confirmRemove(list.name)}
          description={t.lists.confirmRemoveBody}
          confirmLabel={t.lists.remove}
          tone="danger"
          loading={removeList.isPending}
        />
      ) : null}
    </WatchingScreen>
  );
}
