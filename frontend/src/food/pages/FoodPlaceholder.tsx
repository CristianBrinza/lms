import { PageHeader } from '@/components/layout/PageHeader';
import { Screen } from '@/components/layout/Screen';

/** A Food section whose screen is being built right now. */
export function FoodPlaceholder({ title }: { title: string }) {
  return (
    <Screen tone="white">
      <PageHeader back="/food" title={title} subtitle="This screen is being built — it appears here as soon as it’s ready." />
    </Screen>
  );
}
