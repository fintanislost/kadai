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
        className="bg-bg border border-white/[0.10] rounded-md text-[13px] px-3 py-1.5 w-full focus:outline-none focus:border-white/[0.20] text-text-primary placeholder:text-text-tertiary"
      />
    </form>
  );
}
