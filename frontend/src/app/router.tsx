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
    { path: 'households', lazy: page(() => import('@/pages/admin/HouseholdsPage')) },
    { path: 'backups', lazy: page(() => import('@/pages/admin/BackupsPage')) },
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

const wishlistRoutes: RouteObject = {
  path: 'buy-list',
  lazy: page(() => import('@/wishlist/WishlistPage')),
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

/**
 * Watching: shows and films from TMDB, each person's own. The fixed screens come before `:id`
 * (a title, 'movie:603' / 'tv:1399').
 */
const watchingRoutes: RouteObject = {
  path: 'watching',
  children: [
    { index: true, lazy: page(() => import('@/watching/pages/WatchingHomePage')) },
    { path: 'search', lazy: page(() => import('@/watching/pages/SearchPage')) },
    { path: 'library', lazy: page(() => import('@/watching/pages/LibraryPage')) },
    { path: 'discover', lazy: page(() => import('@/watching/pages/DiscoverPage')) },
    { path: 'calendar', lazy: page(() => import('@/watching/pages/CalendarPage')) },
    { path: 'stats', lazy: page(() => import('@/watching/pages/StatsPage')) },
    { path: 'import', lazy: page(() => import('@/watching/pages/ImportPage')) },
    { path: 'lists', lazy: page(() => import('@/watching/pages/ListsPage')) },
    { path: 'lists/:listId', lazy: page(() => import('@/watching/pages/ListPage')) },
    { path: 'person/:personId', lazy: page(() => import('@/watching/pages/PersonPage')) },
    { path: ':id', lazy: page(() => import('@/watching/pages/TitlePage')) },
    { path: ':id/season/:n', lazy: page(() => import('@/watching/pages/SeasonPage')) },
  ],
};

/** Drinks: the household's cellar and tasting journal. Fixed screens before a drink's `:id`. */
const drinksRoutes: RouteObject = {
  path: 'drinks',
  children: [
    { index: true, lazy: page(() => import('@/drinks/pages/DrinksHomePage')) },
    { path: 'journal', lazy: page(() => import('@/drinks/pages/JournalPage')) },
    { path: 'stats', lazy: page(() => import('@/drinks/pages/StatsPage')) },
    { path: ':id', lazy: page(() => import('@/drinks/pages/DrinkPage')) },
  ],
};

/** The closet: everyone's clothes. Fixed screens before a piece's `:id`. */
const closetRoutes: RouteObject = {
  path: 'closet',
  children: [
    { index: true, lazy: page(() => import('@/closet/pages/ClosetHomePage')) },
    { path: 'add', lazy: page(() => import('@/closet/pages/AddPage')) },
    { path: 'places', lazy: page(() => import('@/closet/pages/PlacesPage')) },
    { path: ':id', lazy: page(() => import('@/closet/pages/ItemPage')) },
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
              wishlistRoutes,
              watchingRoutes,
              drinksRoutes,
              closetRoutes,
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
