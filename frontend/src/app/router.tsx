import type { ComponentType } from 'react';
import { createBrowserRouter, Navigate, type RouteObject } from 'react-router';
import { RouteError } from '@/components/common/RouteError';
import { AppShell } from '@/components/layout/AppShell';
import { GuestOnly, RequireAuth, RequireRole } from './guards';
import { Root } from './Root';

/** Route modules are code-split; each page downloads only when first visited. */
const page = (load: () => Promise<{ default: ComponentType }>) => async () => ({ Component: (await load()).default });

/**
 * Admin screens: only reachable through these dynamic imports, so members never download them
 * and the installed app never precaches them (vite.config.ts puts them under assets/admin/).
 */
const adminRoutes: RouteObject = {
  path: 'admin',
  element: <RequireRole roles={['admin']} />,
  children: [
    { index: true, element: <Navigate to="/admin/users" replace /> },
    { path: 'users', lazy: page(() => import('@/pages/admin/UsersPage')) },
    { path: 'users/new', lazy: page(() => import('@/pages/admin/NewUserPage')) },
    { path: 'users/:id', lazy: page(() => import('@/pages/admin/UserPage')) },
  ],
};

/** Food: one area, four sections, each its own lazily loaded screen. */
const foodRoutes: RouteObject = {
  path: 'food',
  children: [
    { index: true, lazy: page(() => import('@/food/pages/FoodHomePage')) },
    { path: 'kitchen', lazy: page(() => import('@/food/pages/KitchenPage')) },
    { path: 'recipes', lazy: page(() => import('@/food/pages/RecipesPage')) },
    { path: 'shopping', lazy: page(() => import('@/food/pages/ShoppingPage')) },
    { path: 'plan', lazy: page(() => import('@/food/pages/PlanPage')) },
  ],
};

const routes: RouteObject[] = [
  {
    element: <Root />,
    errorElement: <RouteError />,
    // The static splash covers the first load; nothing to render meanwhile.
    HydrateFallback: () => null,
    children: [
      { index: true, lazy: page(() => import('@/pages/landing/LandingPage')) },
      { path: 'app', lazy: page(() => import('@/pages/install/InstallPage')) },
      { element: <GuestOnly />, children: [{ path: 'login', lazy: page(() => import('@/pages/auth/LoginPage')) }] },
      {
        element: <RequireAuth />,
        children: [
          { path: 'welcome', lazy: page(() => import('@/pages/auth/WelcomePage')) },
          {
            element: <AppShell />,
            children: [
              { path: 'home', lazy: page(() => import('@/pages/home/HomePage')) },
              { path: 'utilities', lazy: page(() => import('@/pages/utilities/UtilitiesPage')) },
              { path: 'settings', lazy: page(() => import('@/pages/settings/SettingsPage')) },
              { path: 'profile', lazy: page(() => import('@/pages/profile/ProfilePage')) },
              foodRoutes,
              adminRoutes,
            ],
          },
        ],
      },
      { path: '*', lazy: page(() => import('@/pages/NotFoundPage')) },
    ],
  },
];

let router: ReturnType<typeof createBrowserRouter> | null = null;

export function getRouter() {
  router ??= createBrowserRouter(routes);
  return router;
}
