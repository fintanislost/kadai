import { createRootRoute, createRoute, createRouter } from '@tanstack/react-router';
import { Layout } from './components/Layout';
import { Home } from './pages/Home';
import { Epic } from './pages/Epic';
import { Feature } from './pages/Feature';
import { Story } from './pages/Story';
import { Search } from './pages/Search';
import { Activity } from './pages/Activity';
import { Compare } from './pages/Compare';
import { Projects } from './pages/Projects';

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
  validateSearch: (s: Record<string, unknown>): { view?: 'tree' } => ({
    view: s.view === 'tree' ? 'tree' : undefined,
  }),
});

const featureRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/features/$id',
  component: Feature,
  validateSearch: (s: Record<string, unknown>): { view?: 'tree' | 'kanban' } => ({
    view: s.view === 'tree' ? 'tree' : s.view === 'kanban' ? 'kanban' : undefined,
  }),
});

const storyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/stories/$id',
  component: Story,
  validateSearch: (s: Record<string, unknown>): { view?: 'tree' } => ({
    view: s.view === 'tree' ? 'tree' : undefined,
  }),
});

const searchRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/search',
  component: Search,
  validateSearch: (s: Record<string, unknown>): { q?: string } => {
    return { q: typeof s.q === 'string' ? s.q : undefined };
  },
});

const activityRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/activity',
  component: Activity,
});

const compareRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/compare',
  component: Compare,
  validateSearch: (s: Record<string, unknown>): { a?: string; b?: string } => ({
    a: typeof s.a === 'string' ? s.a : undefined,
    b: typeof s.b === 'string' ? s.b : undefined,
  }),
});

const projectsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/projects',
  component: Projects,
});

// Project-scoped routes — mirror the above under /p/$slug/
const projectHomeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/p/$slug/',
  component: Home,
});

const projectEpicRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/p/$slug/epics/$id',
  component: Epic,
  validateSearch: (s: Record<string, unknown>): { view?: 'tree' } => ({
    view: s.view === 'tree' ? 'tree' : undefined,
  }),
});

const projectFeatureRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/p/$slug/features/$id',
  component: Feature,
  validateSearch: (s: Record<string, unknown>): { view?: 'tree' | 'kanban' } => ({
    view: s.view === 'tree' ? 'tree' : s.view === 'kanban' ? 'kanban' : undefined,
  }),
});

const projectStoryRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/p/$slug/stories/$id',
  component: Story,
  validateSearch: (s: Record<string, unknown>): { view?: 'tree' } => ({
    view: s.view === 'tree' ? 'tree' : undefined,
  }),
});

const projectSearchRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/p/$slug/search',
  component: Search,
  validateSearch: (s: Record<string, unknown>): { q?: string } => ({
    q: typeof s.q === 'string' ? s.q : undefined,
  }),
});

const projectActivityRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/p/$slug/activity',
  component: Activity,
});

const projectCompareRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/p/$slug/compare',
  component: Compare,
  validateSearch: (s: Record<string, unknown>): { a?: string; b?: string } => ({
    a: typeof s.a === 'string' ? s.a : undefined,
    b: typeof s.b === 'string' ? s.b : undefined,
  }),
});

const routeTree = rootRoute.addChildren([
  homeRoute, epicRoute, featureRoute, storyRoute, searchRoute, activityRoute, compareRoute, projectsRoute,
  projectHomeRoute, projectEpicRoute, projectFeatureRoute, projectStoryRoute, projectSearchRoute, projectActivityRoute, projectCompareRoute,
]);

export const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
