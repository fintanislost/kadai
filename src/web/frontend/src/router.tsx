import { createRootRoute, createRoute, createRouter } from '@tanstack/react-router';
import { Layout } from './components/Layout';
import { Home } from './pages/Home';

const rootRoute = createRootRoute({
  component: Layout,
});

const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: Home,
});

// Placeholder routes for the not-yet-implemented pages — replaced in Tasks 8/9.
const epicRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/epics/$id',
  component: () => <div>Epic detail (placeholder)</div>,
});

const featureRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/features/$id',
  component: () => <div>Feature detail (placeholder)</div>,
});

const storyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/stories/$id',
  component: () => <div>Story detail (placeholder)</div>,
});

const routeTree = rootRoute.addChildren([homeRoute, epicRoute, featureRoute, storyRoute]);

export const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
