import { useQuery } from '@tanstack/react-query';
import { localDate } from '@/food/format';
import { travelApi, travelKeys } from './api';

/** Trips, bags, the packing list and the household's people, in one load. */
export function useTravel() {
  const today = localDate();
  return useQuery({ queryKey: travelKeys.home(today), queryFn: () => travelApi.home(today) });
}
