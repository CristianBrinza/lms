import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Button, Sheet, Switch, TextField, toast } from '@/components/ui';
import { errorMessage } from '@/lib/errors';
import { watchingApi, watchingKeys } from '../api';
import { useWatchingT } from '../i18n';
import type { WatchList } from '../types';

/** A new list, or a list's name and sharing changed. */
export function ListFormSheet({
  open,
  onClose,
  list,
}: {
  open: boolean;
  onClose: () => void;
  list?: WatchList;
}) {
  const t = useWatchingT();
  const client = useQueryClient();
  const navigate = useNavigate();
  const [name, setName] = useState(list?.name ?? '');
  const [shared, setShared] = useState(list?.shared ?? false);
  const save = useMutation({
    mutationFn: () =>
      list
        ? watchingApi.updateList(list.id, { name: name.trim(), shared })
        : watchingApi.createList({ name: name.trim(), shared }),
    onSuccess: ({ list: saved }) => {
      onClose();
      if (!list) navigate(`/watching/lists/${saved.id}`);
    },
    onError: (error) => toast.error(t.common.failed, { description: errorMessage(error) }),
    onSettled: () => client.invalidateQueries({ queryKey: watchingKeys.all }),
  });
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={list ? t.lists.edit : t.lists.create}
      footer={
        <Button
          fullWidth
          disabled={!name.trim()}
          loading={save.isPending}
          onClick={() => save.mutate()}
        >
          {t.common.save}
        </Button>
      }
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) save.mutate();
        }}
      >
        <TextField
          label={t.lists.name}
          placeholder={t.lists.namePlaceholder}
          value={name}
          maxLength={80}
          onChange={(e) => setName(e.target.value)}
        />
        <Switch
          checked={shared}
          onChange={setShared}
          label={t.lists.shared}
          hint={t.lists.sharedHint}
        />
      </form>
    </Sheet>
  );
}
