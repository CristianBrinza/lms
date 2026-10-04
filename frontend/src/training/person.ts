import { useQuery } from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';
import { useUser } from '@/app/auth';
import { STORAGE_KEYS, storage } from '@/lib/storage';
import { trainingApi, trainingKeys } from './api';
import type { Person } from './types';

/**
 * Whose training the screens show. Everyone in the household can look at and plan for the others
 * (a parent planning for a partner, logging a child's push-ups); the choice is remembered on this
 * device, shared by every Training screen at once, and falls back to me when that person has left
 * the household.
 */

const listeners = new Set<() => void>();
let chosen: string | null = storage.get(STORAGE_KEYS.trainingPerson);

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function choosePerson(id: string) {
  chosen = id;
  storage.set(STORAGE_KEYS.trainingPerson, id);
  listeners.forEach((listener) => listener());
}

export function usePerson(): {
  personId: string;
  person: Person | null;
  people: Person[];
  isMe: boolean;
  setPerson: (id: string) => void;
} {
  const me = useUser();
  const current = useSyncExternalStore(subscribe, () => chosen);
  const people = useQuery({
    queryKey: trainingKeys.people,
    queryFn: trainingApi.people,
    staleTime: 5 * 60_000,
  });
  const list = people.data ?? [];
  const wanted = current ?? me.id;
  const valid = wanted === me.id || !people.data || list.some((p) => p.id === wanted);
  const personId = valid ? wanted : me.id;
  return {
    personId,
    person:
      list.find((p) => p.id === personId) ??
      (personId === me.id ? { id: me.id, name: me.name, surname: me.surname } : null),
    people: list,
    isMe: personId === me.id,
    setPerson: choosePerson,
  };
}
