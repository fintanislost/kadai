import { createRootRoute, createRoute, createRouter } from '@tanstack/react-router';
import { Layout } from './components/Layout';
import { Home } from './pages/Home';
import { Epic } from './pages/Epic';
import { Feature } from './pages/Feature';
import { Story } from './pages/Story';
import { Search } from './pages/Search';

const rootRoute = createRootRoute({
  component: Layout,
});

const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: Home,
});

const epicRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/epics/$id',
  component: Epic,
});

const featureRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/features/$id',
  component: Feature,
});

const storyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/stories/$id',
  component: Story,
});

const searchRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/search',
  component: Search,
  validateSearch: (s: Record<string, unknown>): { q?: string } => {
    return { q: typeof s.q === 'string' ? s.q : undefined };
  },
});

const routeTree = rootRoute.addChildren([homeRoute, epicRoute, featureRoute, storyRoute, searchRoute]);

export const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
