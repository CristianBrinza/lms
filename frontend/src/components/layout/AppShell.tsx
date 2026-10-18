import { Outlet } from 'react-router';
import { AssistantLauncher } from '@/assistant/AssistantLauncher';
import { useLiveSync } from '@/services/liveSync';
import { PullToRefresh } from './PullToRefresh';
import { SideNav } from './SideNav';
import { TabBar } from './TabBar';

/** Signed-in screens: the tab bar (phones) or the side rail (tablets, desktop) around the page. */
export function AppShell() {
  // What others in the household change shows up here without refreshing.
  useLiveSync();
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[90rem] md:gap-3 md:py-3 md:pl-[max(0.75rem,var(--safe-left,0px))] md:pr-3 lg:gap-6 lg:p-4">
      <SideNav />
      <main id="main" className="min-w-0 flex-1">
        <PullToRefresh>
          <Outlet />
        </PullToRefresh>
      </main>
      <TabBar />
      <AssistantLauncher />
    </div>
  );
}
