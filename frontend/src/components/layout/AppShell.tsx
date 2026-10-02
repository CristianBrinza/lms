import { Outlet } from 'react-router';
import { PullToRefresh } from './PullToRefresh';
import { SideNav } from './SideNav';
import { TabBar } from './TabBar';

/** Signed-in screens: the tab bar (phones) or the side rail (desktop) around the page. */
export function AppShell() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[90rem] gap-6 lg:p-4">
      <SideNav />
      <main id="main" className="min-w-0 flex-1">
        <PullToRefresh>
          <Outlet />
        </PullToRefresh>
      </main>
      <TabBar />
    </div>
  );
}
