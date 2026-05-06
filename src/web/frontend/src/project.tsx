import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Link, useRouter } from '@tanstack/react-router';

export interface ProjectInfo {
  slug: string;
  name: string;
  rootDir: string;
}

export interface ProjectMode {
  isMulti: boolean;
  projects: ProjectInfo[];
  activeSlug: string | null;
}

const ProjectModeContext = createContext<ProjectMode>({
  isMulti: false,
  projects: [],
  activeSlug: null,
});

export function ProjectModeProvider({ children }: { children: ReactNode }) {
  const [projects, setProjects] = useState<ProjectInfo[]>([]);
  const router = useRouter();
  const [pathname, setPathname] = useState(() => window.location.pathname);

  useEffect(() => {
    fetch('/api/projects')
      .then(r => (r.ok ? r.json() : []))
      .then((list: unknown) => setProjects(Array.isArray(list) ? (list as ProjectInfo[]) : []))
      .catch(() => setProjects([]));
  }, []);

  useEffect(() => {
    const unsub = router.subscribe('onLoad', () => setPathname(window.location.pathname));
    return unsub;
  }, [router]);

  const isMulti = projects.length > 0;
  const m = pathname.match(/^\/p\/([^/]+)(?:\/|$)/);
  const activeSlug = m ? m[1] : null;

  return (
    <ProjectModeContext.Provider value={{ isMulti, projects, activeSlug }}>
      {children}
    </ProjectModeContext.Provider>
  );
}

export function useProjectMode(): ProjectMode {
  return useContext(ProjectModeContext);
}

/**
 * Returns the API base URL for the active project.
 * - single mode: '/api'
 * - multi mode: '/api/p/<slug>'
 */
export function apiBase(activeSlug: string | null): string {
  return activeSlug ? `/api/p/${activeSlug}` : '/api';
}

/**
 * Build a SPA link path that's project-scoped when in multi-mode, plain otherwise.
 * E.g., projectLink(null, '/epics/X') → '/epics/X'
 *       projectLink('alpha', '/epics/X') → '/p/alpha/epics/X'
 */
export function projectLink(activeSlug: string | null, path: string): string {
  return activeSlug ? `/p/${activeSlug}${path}` : path;
}

/**
 * A Link component that's project-aware. When activeSlug is set, maps legacy
 * paths like '/epics/$id' to '/p/$slug/epics/$id'.
 *
 * Note: `as never` casts are needed because TanStack Router's typed routes are
 * very strict and don't accept dynamic string concatenation for the `to` prop.
 * This is a pragmatic compromise for the multi-project feature.
 */
export function ProjectScopedLink({
  activeSlug,
  to,
  params,
  children,
  className,
}: {
  activeSlug: string | null;
  to: string;
  params?: Record<string, string>;
  children?: React.ReactNode;
  className?: string;
}) {
  if (activeSlug && to.startsWith('/')) {
    const projectTo = `/p/$slug${to}` as never;
    return (
      <Link to={projectTo} params={{ slug: activeSlug, ...params } as never} className={className}>
        {children}
      </Link>
    );
  }
  return (
    <Link to={to as never} params={params as never} className={className}>
      {children}
    </Link>
  );
}
