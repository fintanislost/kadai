import { useState, type FormEvent } from 'react';
import { useNavigate } from '@tanstack/react-router';

interface Props {
  initialQuery?: string;
}

export function SearchBox({ initialQuery = '' }: Props) {
  const [value, setValue] = useState(initialQuery);
  const navigate = useNavigate();

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = value.trim();
    if (trimmed.length < 2) return;
    navigate({ to: '/search', search: { q: trimmed } });
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center">
      <input
        type="search"
        value={value}
        onChange={e => setValue(e.target.value)}
        placeholder="Search…"
        aria-label="Search the kadai spine"
        className="bg-zinc-900 border border-zinc-700 rounded text-sm px-3 py-1 w-48 focus:outline-none focus:border-zinc-500"
      />
    </form>
  );
}
