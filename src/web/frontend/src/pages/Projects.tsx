import { useProjectMode } from '../project';

export function Projects() {
  const { projects } = useProjectMode();

  if (projects.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">No projects registered</h1>
        <div className="text-muted text-sm">
          Run <code className="bg-zinc-800 px-1.5 py-0.5 rounded">kadai serve register [path]</code> to add a project.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Projects ({projects.length})</h1>
      <ul className="space-y-2">
        {projects.map(p => (
          <li key={p.slug}>
            <a
              href={`/p/${p.slug}/`}
              className="block bg-panel border border-zinc-800 rounded p-3 hover:border-zinc-600"
            >
              <div className="font-bold">{p.name}</div>
              <div className="text-xs text-muted mt-1">{p.slug} · {p.rootDir}</div>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
