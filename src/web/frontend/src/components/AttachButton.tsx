import { useRef, useState } from 'react';
import { attachFile } from '../api';

interface Props {
  itemId: string;
  kind: 'spec' | 'plan';
  onAttached: () => void;
}

export function AttachButton({ itemId, kind, onAttached }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPending(true);
    setError(null);
    try {
      await attachFile(itemId, kind, file);
      onAttached();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setPending(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div className="space-y-2">
      <button
        disabled={pending}
        onClick={() => inputRef.current?.click()}
        className="bg-zinc-800 hover:bg-zinc-700 text-sm px-3 py-1.5 rounded disabled:opacity-50"
      >
        {pending ? 'Uploading…' : `Attach a ${kind}.md`}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".md,text/markdown"
        className="hidden"
        onChange={handleChange}
      />
      {error && <div className="text-xs text-red-400">{error}</div>}
    </div>
  );
}
