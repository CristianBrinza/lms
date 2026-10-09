import type { ComponentType } from 'react';
import { createBrowserRouter, Navigate, type RouteObject } from 'react-router';
import { RouteError } from '@/components/common/RouteError';
import { AppShell } from '@/components/layout/AppShell';
import { GuestOnly, RequireAuth, RequireRole } from './guards';
import { Root } from './Root';

/** Route modules are code-split; each page downloads only when first visited. */
const page = (load: () => Promise<{ default: ComponentType }>) => async () => ({
  Component: (await load()).default,
});

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
    { path: 'recipes/new', lazy: page(() => import('@/food/pages/RecipeEditorPage')) },
    { path: 'recipes/:id', lazy: page(() => import('@/food/pages/RecipePage')) },
    { path: 'recipes/:id/edit', lazy: page(() => import('@/food/pages/RecipeEditorPage')) },
    { path: 'shopping', lazy: page(() => import('@/food/pages/ShoppingPage')) },
    { path: 'plan', lazy: page(() => import('@/food/pages/PlanPage')) },
    { path: 'kitchenware', lazy: page(() => import('@/food/pages/KitchenwarePage')) },
    { path: 'people', lazy: page(() => import('@/food/pages/PeoplePage')) },
  ],
};

/** Training: home workouts for the family. The player runs full screen, outside the shell. */
const trainingRoutes: RouteObject = {
  path: 'training',
  children: [
    { index: true, lazy: page(() => import('@/training/pages/TrainingHomePage')) },
    { path: 'plan', lazy: page(() => import('@/training/pages/PlanPage')) },
    { path: 'workouts/:id', lazy: page(() => import('@/training/pages/WorkoutPage')) },
    { path: 'exercises', lazy: page(() => import('@/training/pages/ExercisesPage')) },
    { path: 'equipment', lazy: page(() => import('@/training/pages/EquipmentPage')) },
    { path: 'progress', lazy: page(() => import('@/training/pages/ProgressPage')) },
    { path: 'health', lazy: page(() => import('@/training/pages/HealthPage')) },
  ],
};

/** The house: things that aren't food, on the kitchen's engine. */
const houseRoutes: RouteObject = {
  path: 'house',
  children: [
    { index: true, lazy: page(() => import('@/house/HouseHomePage')) },
    { path: 'items', lazy: page(() => import('@/house/HouseItemsPage')) },
    { path: 'shopping', lazy: page(() => import('@/house/HouseShoppingPage')) },
  ],
};

const travelRoutes: RouteObject = {
  path: 'travel',
  children: [
    { index: true, lazy: page(() => import('@/travel/pages/TravelHomePage')) },
    { path: 'new', lazy: page(() => import('@/travel/pages/TripEditPage')) },
    { path: 'bags', lazy: page(() => import('@/travel/pages/BagsPage')) },
    { path: 'list', lazy: page(() => import('@/travel/pages/PackingListPage')) },
    { path: ':id', lazy: page(() => import('@/travel/pages/TripPage')) },
    { path: ':id/edit', lazy: page(() => import('@/travel/pages/TripEditPage')) },
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
      {
        element: <GuestOnly />,
        children: [{ path: 'login', lazy: page(() => import('@/pages/auth/LoginPage')) }],
      },
      {
        element: <RequireAuth />,
        children: [
          { path: 'welcome', lazy: page(() => import('@/pages/auth/WelcomePage')) },
          { path: 'oauth/authorize', lazy: page(() => import('@/pages/auth/OAuthConsentPage')) },
          {
            path: 'training/workouts/:id/play',
            lazy: page(() => import('@/training/player/PlayerPage')),
          },
          {
            element: <AppShell />,
            children: [
              { path: 'home', lazy: page(() => import('@/pages/home/HomePage')) },
              {
                path: 'statistics',
                lazy: page(() => import('@/pages/statistics/StatisticsPage')),
              },
              { path: 'utilities', element: <Navigate to="/statistics" replace /> },
              { path: 'settings', lazy: page(() => import('@/pages/settings/SettingsPage')) },
              {
                path: 'settings/reminders',
                lazy: page(() => import('@/pages/settings/RemindersPage')),
              },
              { path: 'settings/ai', lazy: page(() => import('@/pages/settings/AiAccessPage')) },
              { path: 'profile', lazy: page(() => import('@/pages/profile/ProfilePage')) },
              foodRoutes,
              trainingRoutes,
              houseRoutes,
              travelRoutes,
              { path: 'shopping', lazy: page(() => import('@/shopping/ShoppingAllPage')) },
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
